// `watthog submit` — opt-in upload to The Trough leaderboard.
// Sends aggregated energy stats only; no prompts, paths, or raw tokens.

import os from "node:os";
import readline from "node:readline/promises";

import { aggregate } from "./report.js";
import { DEFAULT_GRID_GCO2_PER_KWH } from "./energy.js";
import { loadConfig, saveConfig } from "./config.js";
import { ui } from "./report.js";

const { bold, dim, green, amber, cyan } = ui;

const SUBMIT_URL = "https://watthog.vercel.app/api/submit";

// Top model names from the aggregate, capped so the payload stays small.
function topModels(agg, max = 5) {
  return agg.models
    .slice(0, max)
    .map((m) => m.model);
}

// Week is the rolling 7-day window (whPerDay7 is the per-day average over the
// last 7 calendar days); all-time is the full, un-windowed history. Note that
// agg.totalWh is a {low, median, high} range object, not a scalar — only
// lifetimeWh and whPerDay7 are raw numbers.
function buildPayload(agg, handle) {
  const weekWh = agg.whPerDay7 * 7;
  return {
    handle,
    kWhWeek: parseFloat((weekWh / 1000).toFixed(3)),
    kWhAllTime: parseFloat((agg.lifetimeWh / 1000).toFixed(3)),
    whPerDay: Math.round(agg.whPerDay7),
    models: topModels(agg),
  };
}

function printPayload(payload) {
  const pad = 18;
  const row = (k, v) =>
    `  ${dim(k.padEnd(pad))} ${v}`;

  console.log();
  console.log(bold("🐷 Submit to The Trough") + dim("  (watthog.vercel.app/trough)"));
  console.log();
  console.log(row("You'll appear as:", bold("@" + payload.handle)));
  console.log();
  console.log(dim("  What will be sent:"));
  console.log(row("  kWh this week", payload.kWhWeek.toFixed(1)));
  console.log(row("  kWh all-time", payload.kWhAllTime.toFixed(1)));
  console.log(row("  Wh/day avg", payload.whPerDay.toLocaleString("en-US")));
  console.log(row("  Models", payload.models.join(", ")));
  console.log();
  console.log(
    dim("  Nothing else. No prompts, no paths, no model output.")
  );
  console.log();
}

export async function runSubmit(records, { handle: handleOverride, yes = false, home = os.homedir() } = {}) {
  const agg = aggregate(records, { gridGCo2PerKwh: DEFAULT_GRID_GCO2_PER_KWH });

  // Resolve handle: CLI flag > saved handle > GitHub username from Copilot > ask
  const cfg = loadConfig(home);
  let handle = handleOverride || cfg.submitHandle || cfg.githubUsername;

  if (!handle) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = (await rl.question(
        bold("  Choose a handle for the leaderboard") + dim(" (shown publicly): ")
      )).trim();
      if (!answer) {
        console.log(dim("No handle entered — nothing submitted."));
        return;
      }
      handle = answer;
    } finally {
      rl.close();
    }
  }

  // Sanitize: alphanumeric + hyphens/underscores, max 32 chars
  handle = handle.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  if (!handle) {
    console.error(amber("Handle contains no valid characters (a–z, 0–9, - _)."));
    process.exitCode = 1;
    return;
  }

  const payload = buildPayload(agg, handle);
  printPayload(payload);

  if (!yes) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let answer;
    try {
      answer = (await rl.question("  Submit? [y/N]  ")).trim().toLowerCase();
    } finally {
      rl.close();
    }
    if (answer !== "y" && answer !== "yes") {
      console.log(dim("Cancelled."));
      return;
    }
  }

  process.stdout.write(dim("  Uploading… "));
  let res;
  try {
    res = await fetch(SUBMIT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "watthog-cli",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    console.log();
    console.error(amber("Could not reach the server. Check your connection."));
    console.error(dim(err.message));
    process.exitCode = 1;
    return;
  }

  if (!res.ok) {
    console.log();
    const text = await res.text().catch(() => "");
    console.error(amber(`Server returned ${res.status}.`) + (text ? dim(" " + text) : ""));
    process.exitCode = 1;
    return;
  }

  console.log(green("done."));
  console.log();
  console.log(`  ${green("✓")} ${bold("@" + handle)} is on the board.`);
  console.log(`    Your hog:   ${cyan(`watthog.vercel.app/u/${handle}`)}  ${dim("(share it)")}`);
  console.log(`    The trough: ${cyan("watthog.vercel.app/trough")}`);
  console.log();

  // Remember the chosen handle so future submits don't ask again.
  saveConfig(home, { submitHandle: handle });
}
