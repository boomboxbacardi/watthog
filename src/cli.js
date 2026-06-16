#!/usr/bin/env node
import { parseArgs } from "node:util";

// node:sqlite still emits an ExperimentalWarning on some Node versions.
process.removeAllListeners("warning");
process.on("warning", (w) => {
  if (w.name === "ExperimentalWarning" && /SQLite/i.test(w.message)) return;
  console.warn(w.stack || w.message);
});

import * as claudeCode from "./sources/claude-code.js";
import * as opencode from "./sources/opencode.js";
import * as codex from "./sources/codex.js";
import * as cursor from "./sources/cursor.js";
import * as copilot from "./sources/copilot.js";
import { aggregate, render } from "./report.js";
import { runConnect, runDoctor } from "./setup.js";
import { runSubmit } from "./submit.js";
import { runInteractive } from "./interactive.js";
import { startLoader } from "./loader.js";
import { DEFAULT_GRID_GCO2_PER_KWH, stageFor } from "./energy.js";
import { loadConfig, saveConfig } from "./config.js";

const SOURCES = [claudeCode, opencode, codex, cursor, copilot];

const HELP = `watthog — estimate the electricity footprint of your LLM usage

Scans local logs from AI coding agents (Claude Code, OpenCode, Codex CLI,
Cursor, GitHub Copilot),
counts tokens per model and converts them to estimated energy, CO2e and water.

Usage: watthog [command] [options]

Commands:
  (default)         Scan local logs, print the report, then open an
                    interactive prompt to drill in (in a terminal)
  submit            Upload your aggregates to The Trough leaderboard (opt-in)
  connect copilot   Connect GitHub Copilot's premium-request billing (guided)
  doctor            Show which sources are detected and what they need

Options:
  --days <n>      Only include the last n days
  --co2 <g>       Grid intensity in gCO2e/kWh (default ${DEFAULT_GRID_GCO2_PER_KWH}; Sweden ≈ 30)
  --all           Show all models (default: top 12)
  --json          Machine-readable output
  --handle <name> Handle to use on the leaderboard (submit only)
  --yes           Skip confirmation prompt (submit only)
  --help          Show this help
`;

async function main() {
  let args, positionals;
  try {
    ({ values: args, positionals } = parseArgs({
      allowPositionals: true,
      options: {
        days: { type: "string" },
        co2: { type: "string" },
        all: { type: "boolean", default: false },
        json: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
        handle: { type: "string" },
        yes: { type: "boolean", default: false },
      },
    }));
  } catch (err) {
    console.error(err.message);
    console.error(HELP);
    process.exit(1);
  }
  if (args.help) {
    console.log(HELP);
    return;
  }

  const [command, sub] = positionals;
  if (command === "connect" || command === "setup") {
    await runConnect(sub);
    return;
  }
  if (command === "doctor") {
    await runDoctor(SOURCES);
    return;
  }
  if (command === "submit") {
    const { records } = await collectRecords();
    if (!records.length) {
      console.error("No usage data found — nothing to submit.");
      process.exit(1);
    }
    await runSubmit(records, { handle: args.handle, yes: args.yes });
    return;
  }
  if (command) {
    console.error(`watthog: unknown command "${command}"\n`);
    console.error(HELP);
    process.exit(1);
  }

  const days = args.days ? Number(args.days) : null;
  const gridGCo2PerKwh = args.co2
    ? Number(args.co2)
    : DEFAULT_GRID_GCO2_PER_KWH;
  if ((days !== null && !(days > 0)) || !(gridGCo2PerKwh > 0)) {
    console.error("--days and --co2 must be positive numbers");
    process.exit(1);
  }

  const { records, active } = await collectRecords();

  if (!records.length) {
    console.error(
      "No usage data found. Looked for: " +
        SOURCES.map((s) => s.name).join(", ")
    );
    process.exit(1);
  }

  const sourceSummary = summarizeSources(records, active);

  if (args.json) {
    const agg = aggregate(records, { days, gridGCo2PerKwh });
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          periodDays: days,
          sources: agg.sources,
          messages: agg.messages,
          since: agg.since,
          energyWh: agg.totalWh,
          lifetimeWh: agg.lifetimeWh,
          level: {
            level: agg.level.level,
            name: agg.level.name,
            progress: agg.level.frac,
            whToNext: agg.whToNextLevel,
          },
          whPerDay7: agg.whPerDay7,
          stage: stageFor(agg.whPerDay7),
          co2Grams: agg.co2g.median,
          co2GramsRange: agg.co2g,
          gridGCo2PerKwh,
          waterMl: agg.waterMl,
          models: agg.models,
          dailyWh: Object.fromEntries(agg.days),
        },
        null,
        2
      )
    );
    return;
  }

  // Print the report once. In a real terminal (and only then — pipes and
  // redirects still get a clean one-shot dump) stay open afterwards so the
  // user can drill into the same in-memory records.
  const agg = aggregate(records, { days, gridGCo2PerKwh });

  // The level is cumulative and persisted; if it climbed since the last run,
  // flash a LEVEL UP. First-ever run just records a baseline, no flash.
  const prevLevel = loadConfig().hogLevel;
  const levelUp =
    prevLevel != null && agg.level.level > prevLevel
      ? { from: prevLevel, to: agg.level.level }
      : null;
  if (prevLevel !== agg.level.level) saveConfig(undefined, { hogLevel: agg.level.level });

  console.log(render(agg, { sources: sourceSummary, full: args.all, levelUp }));

  if (process.stdin.isTTY && process.stdout.isTTY) {
    await runInteractive({
      records,
      sourceSummary,
      state: {
        days,
        gridGCo2PerKwh,
        defaultGrid: DEFAULT_GRID_GCO2_PER_KWH,
        source: null,
      },
    });
  }
}

// Scan every available source in parallel behind the loader animation.
// Sources warn via console.error; hold those until the show has cleared the
// stage, or they tear the animation apart mid-frame.
async function collectRecords() {
  const active = new Set(SOURCES.filter((s) => s.available()));
  const loader = startLoader([...active].map((s) => s.name));
  const heldWarnings = [];
  const origError = console.error;
  console.error = (...a) => heldWarnings.push(a);
  let results;
  try {
    results = await Promise.all(
      [...active].map(async (s) => {
        const result = await s.collect();
        loader.markDone(s.name);
        return result;
      })
    );
  } finally {
    await loader.stop();
    console.error = origError;
    for (const a of heldWarnings) console.error(...a);
  }
  return { records: results.flat(), active };
}

// One row per source for the report's SOURCES panel: counted, detected-but-
// empty, or not installed — plus a nudge for Copilot when only local sessions
// came through and the billing half is still unconnected.
function summarizeSources(records, active) {
  const counts = new Map();
  for (const r of records) counts.set(r.source, (counts.get(r.source) || 0) + 1);

  return SOURCES.map((s) => {
    if (!active.has(s)) {
      return { name: s.name, state: "absent", detail: "not installed" };
    }
    const n = counts.get(s.name) || 0;
    if (!n) return { name: s.name, state: "empty", detail: "detected, no usage found" };

    const row = {
      name: s.name,
      state: "ok",
      detail: `${n.toLocaleString("en-US")} ${s.unit || "messages"}`,
    };
    if (s === copilot) {
      const bs = copilot.billingState();
      if (bs === "org-managed") {
        row.hint = "license managed by your org — billing data isn't accessible to regular members";
      } else if (bs !== "connected") {
        row.hint = "billing not connected — run `watthog connect copilot`";
      }
    }
    return row;
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
