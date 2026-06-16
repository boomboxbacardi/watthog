// Interactive shell. `watthog` with no command drops you here after the first
// report: the scanned records stay in memory and every command re-aggregates
// them locally, so changing the window or grid intensity is instant and still
// never leaves the machine.

import { createInterface } from "node:readline";
import { aggregate, render, sourcesBlock, ui, fmtWh } from "./report.js";
import {
  classify,
  classLabel,
  co2Grams,
  waterMl,
  withRange,
} from "./energy.js";
import { runUpgrade, updateNotice } from "./update.js";

const { bold, dim, amber, green, pink, cyan } = ui;

const HELP = `Commands:
  report                re-draw the full report
  models [all]          list models by energy (top 12, or all)
  model <name>          drill into one model (partial name is fine)
  source <name|all>     focus on one source, or clear the filter
  sources               show which logs were read
  chart                 daily energy over the last 14 days
  hog                   watch the hog at its current evolution
  days <n|all>          limit to the last n days, or clear the limit
  co2 <g>               set grid intensity in gCO₂e/kWh
  upgrade               update watthog to the latest published version
  clear                 clear the screen
  help                  show this list
  exit                  leave (or press Ctrl-D)`;

function pct(part, whole) {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

// Resolve a user-typed fragment to a single model row. Returns the row, or an
// array of candidates when the fragment is ambiguous, or null when nothing hit.
function findModel(models, query) {
  const q = query.toLowerCase();
  const exact = models.find((m) => m.model.toLowerCase() === q);
  if (exact) return exact;
  const hits = models.filter((m) => m.model.toLowerCase().includes(q));
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) return hits;
  return null;
}

function printModel(m, agg, state) {
  const range = withRange(m.wh);
  const out = [];
  out.push("");
  out.push(bold(m.model) + dim(`  ·  ${classLabel(classify(m.model))}`));
  out.push(dim(`  seen in: ${m.sources.join(", ")}`));
  out.push("");
  out.push(`  Messages   ${m.n.toLocaleString("en-US")}`);
  out.push(
    `  Tokens     ${dim("in")} ${m.input.toLocaleString("en-US")}  ` +
      `${dim("out")} ${m.output.toLocaleString("en-US")}  ` +
      `${dim("cache")} ${m.cache.toLocaleString("en-US")}`
  );
  out.push(
    `  Energy     ${amber(bold(fmtWh(m.wh)))}   ${dim(`range ${fmtWh(range.low)} – ${fmtWh(range.high)}`)}`
  );
  out.push(
    `  CO₂e       ${fmtMass(co2Grams(m.wh, state.gridGCo2PerKwh))}   ${dim(`@ ${state.gridGCo2PerKwh} gCO₂e/kWh`)}`
  );
  out.push(`  Water      ${fmtVol(waterMl(m.wh))}`);
  out.push(`  Share      ${pct(m.wh, agg.totalWh.median)} of total energy`);
  out.push("");
  console.log(out.join("\n"));
}

function printModels(agg, all) {
  const t = agg.totalWh.median;
  const TOP = all ? Infinity : 12;
  const shown = agg.models.slice(0, TOP);
  const width = Math.max(...shown.map((m) => m.model.length), 5);
  const out = [""];
  out.push(bold("BY MODEL"));
  for (const m of shown) {
    out.push(
      `  ${m.model.padEnd(width)}  ${amber(fmtWh(m.wh).padStart(9))}  ${dim(pct(m.wh, t).padStart(4))}  ${dim(m.sources.join(", "))}`
    );
  }
  if (!all && agg.models.length > TOP) {
    const rest = agg.models.slice(TOP);
    const restWh = rest.reduce((s, m) => s + m.wh, 0);
    out.push(
      dim(`  + ${rest.length} more  ·  ${fmtWh(restWh)}  ·  ${pct(restWh, t)}  ·  type 'models all' to expand`)
    );
  }
  out.push("");
  console.log(out.join("\n"));
}

function printChart(agg) {
  const out = ["", bold("LAST 14 DAYS")];
  if (!agg.days.length) {
    out.push(dim("  no dated usage in range"));
    out.push("");
    console.log(out.join("\n"));
    return;
  }
  const whByDay = new Map(agg.days);
  const series = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
    series.push([day, whByDay.get(day) || 0]);
  }
  const max = Math.max(...series.map(([, wh]) => wh), 1);
  series.reverse();
  for (const [day, wh] of series) {
    if (wh > 0) {
      const bar = "█".repeat(Math.max(1, Math.round((wh / max) * 36)));
      out.push(`  ${dim(day)}  ${amber(bar)} ${fmtWh(wh)}`);
    } else {
      out.push(`  ${dim(day)}  ${dim("·")}`);
    }
  }
  out.push("");
  console.log(out.join("\n"));
}

function fmtMass(g) {
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`;
  return `${Math.round(g)} g`;
}

function fmtVol(ml) {
  if (ml >= 1000) return `${(ml / 1000).toFixed(1)} L`;
  return `${Math.round(ml)} ml`;
}

// The set of source names we actually scanned, for `source` validation.
function knownSources(records) {
  return [...new Set(records.map((r) => r.source))].sort();
}

// The hog only *moves* here, in the live TTY — the one-shot report prints a
// still. Cycles the current evolution's frames in place by walking the cursor
// back up over the art each tick, painted in the level's own color.
function animateHog(level, output, { cycles = 6, ms = 220 } = {}) {
  if (!output.isTTY) return Promise.resolve();
  const frames = level.evo.frames;
  const rows = frames[0].length;
  const paint = (s) => `\x1b[${level.color}m${s}\x1b[0m`;
  const drawFrame = (f) => f.map((l) => `\x1b[2K  ${paint(l)}`).join("\n") + "\n";

  return new Promise((resolve) => {
    output.write(frames[0].map((l) => "  " + paint(l)).join("\n") + "\n");
    let i = 1;
    const total = cycles * frames.length;
    const timer = setInterval(() => {
      output.write(`\x1b[${rows}A`); // back up to the first art row
      output.write(drawFrame(frames[i % frames.length]));
      if (++i > total) {
        clearInterval(timer);
        resolve();
      }
    }, ms);
  });
}

export function runInteractive({
  records,
  sourceSummary,
  state,
  update = null,
  input = process.stdin,
  output = process.stdout,
}) {
  const sources = knownSources(records);

  // Re-aggregate the in-memory records under the current filters. A source
  // filter just narrows the records first; everything else flows through the
  // same aggregate() the one-shot report uses.
  const recompute = () => {
    const recs = state.source
      ? records.filter((r) => r.source === state.source)
      : records;
    return aggregate(recs, {
      days: state.days,
      gridGCo2PerKwh: state.gridGCo2PerKwh,
    });
  };

  const banner = () => {
    const bits = [];
    if (state.source) bits.push(`source ${state.source}`);
    if (state.days) bits.push(`last ${state.days}d`);
    if (state.gridGCo2PerKwh !== state.defaultGrid)
      bits.push(`${state.gridGCo2PerKwh} gCO₂e/kWh`);
    const filter = bits.length ? dim(`  [${bits.join(" · ")}]`) : "";
    return `${pink("🐷")} ${bold("watthog")}${filter} ${dim("›")} `;
  };

  // Greet with the hog actually moving, then drop into the prompt.
  return animateHog(recompute().level, output).then(() => startLoop());

  function startLoop() {
  console.log(
    dim(`Interactive mode — type ${cyan("help")} for commands, ${cyan("exit")} to leave.`)
  );
  if (update?.hasUpdate) console.log(updateNotice(update, { interactive: true }));

  const rl = createInterface({ input, output, prompt: banner() });
  let alive = true; // guards async re-prompts (e.g. `hog`) against an early exit
  rl.prompt();

  return new Promise((resolve) => {
    rl.on("line", async (line) => {
      const [cmd, ...rest] = line.trim().split(/\s+/);
      const arg = rest.join(" ");

      switch (cmd) {
        case "":
          break;
        case "help":
        case "?":
          console.log("\n" + HELP + "\n");
          break;
        case "report":
        case "r":
          console.log(
            render(recompute(), { sources: sourceSummary, full: false })
          );
          break;
        case "models":
          printModels(recompute(), arg === "all");
          break;
        case "model": {
          if (!arg) {
            console.log(dim("usage: model <name>"));
            break;
          }
          const agg = recompute();
          const hit = findModel(agg.models, arg);
          if (!hit) {
            console.log(dim(`no model matching "${arg}" in range`));
          } else if (Array.isArray(hit)) {
            console.log(dim(`several models match "${arg}":`));
            for (const m of hit) console.log("  " + m.model);
          } else {
            printModel(hit, agg, state);
          }
          break;
        }
        case "source":
          if (!arg || arg === "all") {
            state.source = null;
            console.log(green("✓") + " showing all sources");
          } else if (sources.includes(arg)) {
            state.source = arg;
            console.log(green("✓") + ` focused on ${bold(arg)}`);
          } else {
            console.log(
              dim(`unknown source "${arg}". available: ${sources.join(", ")}`)
            );
          }
          break;
        case "sources":
          console.log("\n" + sourcesBlock(sourceSummary).join("\n") + "\n");
          break;
        case "chart":
        case "daily":
          printChart(recompute());
          break;
        case "days":
          if (arg === "all" || arg === "") {
            state.days = null;
            console.log(green("✓") + " showing all time");
          } else if (Number(arg) > 0) {
            state.days = Number(arg);
            console.log(green("✓") + ` last ${state.days} days`);
          } else {
            console.log(dim("usage: days <n|all>"));
          }
          break;
        case "co2":
          if (Number(arg) > 0) {
            state.gridGCo2PerKwh = Number(arg);
            console.log(green("✓") + ` grid set to ${state.gridGCo2PerKwh} gCO₂e/kWh`);
          } else {
            console.log(dim("usage: co2 <g>   (Sweden ≈ 30, global ≈ 400)"));
          }
          break;
        case "upgrade":
        case "update":
          // Hand the terminal to the package manager, then come back. Whatever
          // it installs only takes effect on the next launch, so we nudge a
          // restart rather than pretend the running process changed.
          rl.pause();
          await runUpgrade();
          console.log(dim("Restart watthog to run the new version."));
          rl.resume();
          rl.setPrompt(banner());
          rl.prompt();
          return; // re-prompt handled above
        case "hog":
        case "anim":
          animateHog(recompute().level, output, { cycles: 8 }).then(() => {
            if (!alive) return; // user exited mid-animation
            rl.setPrompt(banner());
            rl.prompt();
          });
          return; // skip the synchronous re-prompt below; the animation does it
        case "clear":
          console.clear();
          break;
        case "exit":
        case "quit":
        case "q":
          rl.close();
          return;
        default:
          console.log(dim(`unknown command "${cmd}" — type 'help'`));
      }

      rl.setPrompt(banner());
      rl.prompt();
    });

    rl.on("close", () => {
      alive = false;
      console.log(dim("\nbye 🐷"));
      resolve();
    });
  });
  }
}
