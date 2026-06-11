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
import { DEFAULT_GRID_GCO2_PER_KWH, stageFor } from "./energy.js";

const SOURCES = [claudeCode, opencode, codex, cursor, copilot];

const HELP = `watthog — estimate the electricity footprint of your LLM usage

Scans local logs from AI coding agents (Claude Code, OpenCode, Codex CLI,
Cursor, GitHub Copilot),
counts tokens per model and converts them to estimated energy, CO2e and water.

Usage: watthog [command] [options]

Commands:
  (default)         Scan local logs and print the energy report
  connect copilot   Connect GitHub Copilot's premium-request billing (guided)
  doctor            Show which sources are detected and what they need

Options:
  --days <n>    Only include the last n days
  --co2 <g>     Grid intensity in gCO2e/kWh (default ${DEFAULT_GRID_GCO2_PER_KWH}; Sweden ≈ 30)
  --json        Machine-readable output
  --help        Show this help
`;

async function main() {
  let args, positionals;
  try {
    ({ values: args, positionals } = parseArgs({
      allowPositionals: true,
      options: {
        days: { type: "string" },
        co2: { type: "string" },
        json: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
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

  const active = new Set(SOURCES.filter((s) => s.available()));
  const results = await Promise.all([...active].map((s) => s.collect()));
  const records = results.flat();

  if (!records.length) {
    console.error(
      "No usage data found. Looked for: " +
        SOURCES.map((s) => s.name).join(", ")
    );
    process.exit(1);
  }

  const sourceSummary = summarizeSources(records, active);

  const agg = aggregate(records, { days, gridGCo2PerKwh });

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          periodDays: days,
          sources: agg.sources,
          messages: agg.messages,
          since: agg.since,
          energyWh: agg.totalWh,
          whPerDay7: agg.whPerDay7,
          stage: stageFor(agg.whPerDay7),
          co2Grams: agg.co2g,
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

  console.log(render(agg, { sources: sourceSummary }));
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
    if (s === copilot && copilot.billingState() !== "connected") {
      row.hint = "billing not connected — run `watthog connect copilot`";
    }
    return row;
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
