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
import { aggregate, render } from "./report.js";
import { DEFAULT_GRID_GCO2_PER_KWH, stageFor } from "./energy.js";

const SOURCES = [claudeCode, opencode, codex];

const HELP = `watthog — estimate the electricity footprint of your LLM usage

Scans local logs from AI coding agents (Claude Code, OpenCode, Codex CLI),
counts tokens per model and converts them to estimated energy, CO2e and water.

Usage: watthog [options]

Options:
  --days <n>    Only include the last n days
  --co2 <g>     Grid intensity in gCO2e/kWh (default ${DEFAULT_GRID_GCO2_PER_KWH}; Sweden ≈ 30)
  --json        Machine-readable output
  --help        Show this help
`;

async function main() {
  let args;
  try {
    args = parseArgs({
      options: {
        days: { type: "string" },
        co2: { type: "string" },
        json: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
      },
    }).values;
  } catch (err) {
    console.error(err.message);
    console.error(HELP);
    process.exit(1);
  }
  if (args.help) {
    console.log(HELP);
    return;
  }

  const days = args.days ? Number(args.days) : null;
  const gridGCo2PerKwh = args.co2
    ? Number(args.co2)
    : DEFAULT_GRID_GCO2_PER_KWH;
  if ((days !== null && !(days > 0)) || !(gridGCo2PerKwh > 0)) {
    console.error("--days and --co2 must be positive numbers");
    process.exit(1);
  }

  const active = SOURCES.filter((s) => s.available());
  const results = await Promise.all(active.map((s) => s.collect()));
  const records = results.flat();

  if (!records.length) {
    console.error(
      "No usage data found. Looked for: " +
        SOURCES.map((s) => s.name).join(", ")
    );
    process.exit(1);
  }

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

  console.log(render(agg));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
