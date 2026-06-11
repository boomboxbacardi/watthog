// Terminal rendering of the aggregated energy report.

import {
  classify,
  classLabel,
  energyWh,
  withRange,
  co2Grams,
  waterMl,
  cacheSavingsWh,
  pickEquivalent,
  stageFor,
  LADDER,
  STAGES,
} from "./energy.js";

const tty = process.stdout.isTTY;
const c = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const bold = c(1);
const dim = c(2);
const yellow = c(33);
const green = c(32);
const cyan = c(36);
const pink = c("38;5;218");
const amber = c("38;5;214");

// Shared with the setup/doctor commands so their output matches the report.
export const ui = { bold, dim, yellow, green, cyan, pink, amber };

export function aggregate(records, { days, gridGCo2PerKwh } = {}) {
  const cutoff = days ? Date.now() - days * 86400_000 : null;
  const byModel = new Map();
  const byDay = new Map();
  let totalWh = 0;
  let cacheSavedWh = 0;
  let outputWh = 0;
  let count = 0;
  let firstTs = Infinity;
  const sources = new Set();

  for (const r of records) {
    if (cutoff && (!r.ts || r.ts < cutoff)) continue;
    const wh = energyWh(r.model, r);
    totalWh += wh;
    outputWh += energyWh(r.model, {
      input: 0,
      output: r.output,
      cacheRead: 0,
      cacheWrite: 0,
    });
    cacheSavedWh += cacheSavingsWh(r.model, r.cacheRead);
    count++;
    sources.add(r.source);
    if (r.ts && r.ts < firstTs) firstTs = r.ts;

    let m = byModel.get(r.model);
    if (!m) {
      m = { model: r.model, input: 0, output: 0, cache: 0, wh: 0, n: 0, sources: new Set() };
      byModel.set(r.model, m);
    }
    m.sources.add(r.source);
    m.input += r.input;
    m.output += r.output;
    m.cache += r.cacheRead + r.cacheWrite;
    m.wh += wh;
    m.n++;

    if (r.ts) {
      const day = new Date(r.ts).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) || 0) + wh);
    }
  }

  // Rolling 7-day average drives the hog's growth stage.
  const weekCutoff = Date.now() - 7 * 86400_000;
  let weekWh = 0;
  for (const [day, wh] of byDay) {
    if (new Date(day + "T12:00:00Z").getTime() >= weekCutoff) weekWh += wh;
  }

  return {
    totalWh: withRange(totalWh),
    co2g: co2Grams(totalWh, gridGCo2PerKwh),
    waterMl: waterMl(totalWh),
    gridGCo2PerKwh,
    messages: count,
    since: firstTs === Infinity ? null : new Date(firstTs),
    sources: [...sources],
    models: [...byModel.values()]
      .map((m) => ({ ...m, sources: [...m.sources].sort() }))
      .sort((a, b) => b.wh - a.wh),
    days: [...byDay.entries()].sort(),
    whPerDay7: weekWh / 7,
    cacheSavedWh,
    outputWh,
  };
}

// One ASCII hog per growth stage. Same pig, more of it.
const HOGS = {
  1: [
    "  ^..^",
    " (o  o)~",
    '  "  "',
  ],
  2: [
    "  ^..^____",
    " (o  o    )~",
    '  "  "  " "',
  ],
  3: [
    "  ^..^_________",
    " ( o  o        )",
    " (             )~",
    '  "  "      " "',
  ],
  4: [
    "  ^..^______________",
    " ( o  o             )",
    " (                  )",
    " (                  )~",
    '  "  "          " "',
  ],
  5: [
    "        ^..^________________",
    "  \\   ( o  o                )",
    " --+--(                     )",
    "  /   (                     )",
    "      (                     )~",
    '       "  "             " "',
  ],
};

function hogBlock(agg) {
  const stage = stageFor(agg.whPerDay7);
  const art = HOGS[stage.stage].map((l) => pink(l));
  const next = STAGES.find((s) => s.stage === stage.stage + 1);
  const info = [
    bold(pink(stage.name.toUpperCase())) + dim(` · stage ${stage.stage} of 5`),
    `${fmtWh(agg.whPerDay7)}/day, 7-day average`,
    dim(stage.vibe),
  ];
  if (next) {
    info.push(
      dim(`${fmtWh(next.minWhPerDay - agg.whPerDay7)}/day of headroom before ${next.name}`)
    );
  } else {
    info.push(dim("the grid operator knows your name"));
  }

  // Art on the left, stage info vertically centered next to it.
  const width = Math.max(...HOGS[stage.stage].map((l) => l.length)) + 3;
  const pad = Math.max(0, Math.floor((art.length - info.length) / 2));
  const lines = [];
  for (let i = 0; i < Math.max(art.length, info.length + pad); i++) {
    const left = HOGS[stage.stage][i] ?? "";
    const right = info[i - pad] ?? "";
    lines.push("  " + (art[i] ?? "") + " ".repeat(width - left.length) + right);
  }
  return lines;
}

// Kuriosa: one personalized fact per run, derived from the user's own data
// where possible. Honest, sourced in the README, never preachy.
function facts(agg) {
  const t = agg.totalWh.median;
  const out = [];

  if (agg.cacheSavedWh >= 0.5) {
    out.push(
      `Prompt caching saved you about ${amber(fmtWh(agg.cacheSavedWh))} — cached tokens cost ` +
        `roughly a tenth of fresh ones. Without it your hog would be ` +
        `${pct(agg.cacheSavedWh, t)} fatter. (${fmtEq(agg.cacheSavedWh)})`
    );
  }

  if (agg.days.length >= 3) {
    const [day, wh] = agg.days.reduce((a, b) => (b[1] > a[1] ? b : a));
    out.push(
      `Your hungriest day was ${amber(day)}: ${fmtWh(wh)}, about ${fmtEq(wh)}. ` +
        `The hog remembers it fondly.`
    );
  }

  if (agg.outputWh > 0 && t > 0) {
    out.push(
      `${amber(pct(agg.outputWh, t))} of your energy went into tokens the model ` +
        `wrote — generating text costs ~8x more per token than reading it.`
    );
  }

  if (agg.waterMl >= 500) {
    out.push(
      `Cooling your tokens took about ${amber(fmtVol(agg.waterMl))} of water — ` +
        `${fmtNum(agg.waterMl / 30)} espresso cups the data center drank on your behalf.`
    );
  }

  out.push(
    `Google says a median Gemini prompt uses 0.24 Wh — about ${amber("one second of microwave")}. ` +
      `Agentic coding runs hotter: it's the only category that loops.`
  );

  if (agg.gridGCo2PerKwh > 100) {
    out.push(
      `The Swedish grid averages ~30 gCO₂e/kWh, ${amber(
        `${Math.round(agg.gridGCo2PerKwh / 30)}x cleaner`
      )} than the ${agg.gridGCo2PerKwh} g/kWh you're using. Same tokens, very different smoke. Try --co2 30.`
    );
  }

  // Deterministic per day, so repeated runs feel alive but not jittery.
  const seed = Number(new Date().toISOString().slice(0, 10).replace(/-/g, ""));
  return out[seed % out.length];
}

export function render(agg, { sources } = {}) {
  const lines = [];
  const p = (s = "") => lines.push(s);

  p();
  p(bold("🐷 watthog") + dim(" · estimated electricity use of your LLMs"));
  const since = agg.since ? agg.since.toISOString().slice(0, 10) : "?";
  p(
    dim(
      `${agg.messages.toLocaleString("en-US")} assistant messages since ${since}`
    )
  );
  p();
  for (const l of hogBlock(agg)) p(l);
  p();

  if (sources?.length) {
    for (const l of sourcesBlock(sources)) p(l);
    p();
  }

  const t = agg.totalWh;
  p(bold("TOTAL ESTIMATE"));
  p(
    `  Energy  ${amber(bold(fmtWh(t.median)))}   ${dim(`range ${fmtWh(t.low)} – ${fmtWh(t.high)}`)}`
  );
  p(
    `  CO₂e    ${fmtMass(agg.co2g)}   ${dim(`@ ${agg.gridGCo2PerKwh} gCO₂e/kWh grid`)}`
  );
  p(`  Water   ${fmtVol(agg.waterMl)}   ${dim("data center cooling")}`);
  p();
  p(`  ≈ ${equivalents(t.median)}`);
  p();

  if (agg.models.length) {
    p(bold("BY MODEL"));
    // The tail of a long model list is mostly rounding noise; show the hungry
    // ones in full and fold the rest into a single honest line.
    const TOP = 12;
    const shown = agg.models.slice(0, TOP);
    const rows = shown.map((m) => [
      m.model,
      m.sources.join(", "),
      classLabel(classify(m.model)),
      fmtNum(m.input + m.cache),
      fmtNum(m.output),
      fmtWh(m.wh),
      pct(m.wh, t.median),
    ]);
    p(
      table(
        ["model", "source", "class", "in+cache tok", "out tok", "energy", ""],
        rows
      )
    );
    if (agg.models.length > TOP) {
      const rest = agg.models.slice(TOP);
      const restWh = rest.reduce((s, m) => s + m.wh, 0);
      p(
        dim(
          `  + ${rest.length} more models  ·  ${fmtWh(restWh)}  ·  ${pct(restWh, t.median)} of total`
        )
      );
      p();
    }
  }

  if (agg.days.length) {
    p(bold("LAST 14 DAYS"));
    // Walk a continuous 14-day window so the time axis stays honest: quiet
    // days show as a faint dot instead of being skipped over.
    const whByDay = new Map(agg.days);
    const series = [];
    for (let i = 13; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86400_000)
        .toISOString()
        .slice(0, 10);
      series.push([day, whByDay.get(day) || 0]);
    }
    const max = Math.max(...series.map(([, wh]) => wh), 1);
    for (const [day, wh] of series) {
      if (wh > 0) {
        const bar = "█".repeat(Math.max(1, Math.round((wh / max) * 36)));
        p(`  ${dim(day)}  ${amber(bar)} ${fmtWh(wh)}`);
      } else {
        p(`  ${dim(day)}  ${dim("·")}`);
      }
    }
    p();
  }

  p(bold("HOG FACT"));
  p("  " + facts(agg));
  p();

  p(
    dim(
      "All figures are estimates. The hog is not a scientist. Factors come from\nopen benchmarks (AI Energy Score, EcoLogits) and Google's Gemini disclosure;\nclosed providers don't publish per-model energy. See README for methodology."
    )
  );
  p();
  return lines.join("\n");
}

// The "what did we read from" panel. Each row is { name, state, detail, hint }
// where state is "ok" (counted), "empty" (installed, nothing to count) or
// "absent" (not installed). Shared by the report and `watthog doctor`.
export function sourcesBlock(sources) {
  const lines = [bold("SOURCES")];
  const width = Math.max(...sources.map((s) => s.name.length));
  for (const s of sources) {
    const icon =
      s.state === "ok" ? green("✓") : s.state === "empty" ? amber("○") : dim("·");
    const label = (s.state === "absent" ? dim : (x) => x)(s.name.padEnd(width));
    lines.push(`  ${icon} ${label}   ${dim(s.detail)}`);
    if (s.hint) lines.push(`  ${" ".repeat(width + 3)}  ${amber("→ " + s.hint)}`);
  }
  return lines;
}

// The chosen equivalence first, then up to two smaller units for texture.
function equivalents(wh) {
  const chosen = pickEquivalent(wh);
  const parts = [green(bold(`${fmtNum(chosen.value)} ${chosen.unit}`))];
  const idx = LADDER.findIndex((e) => e.wh === chosen.wh);
  for (const eq of [LADDER[idx - 1], LADDER[idx - 2]]) {
    if (!eq) continue;
    const v = wh / eq.wh;
    if (v < 10000) parts.push(green(`${fmtNum(v)} ${eq.label}`));
  }
  return parts.join(dim("  ·  "));
}

function fmtEq(wh) {
  const { value, unit } = pickEquivalent(wh);
  return `${fmtNum(value)} ${unit}`;
}

function table(header, rows) {
  const all = [header, ...rows];
  const widths = header.map((_, i) =>
    Math.max(...all.map((r) => String(r[i]).length))
  );
  const fmt = (r) =>
    "  " +
    r
      .map((cell, i) =>
        i <= 2
          ? String(cell).padEnd(widths[i])
          : String(cell).padStart(widths[i])
      )
      .join("  ");
  return (
    dim(fmt(header)) +
    "\n" +
    rows.map((r) => fmt(r)).join("\n") +
    "\n"
  );
}

function pct(part, whole) {
  if (!whole) return "";
  return `${Math.round((part / whole) * 100)}%`;
}

export function fmtWh(wh) {
  if (wh >= 1000) return `${(wh / 1000).toFixed(wh >= 10000 ? 0 : 1)} kWh`;
  if (wh >= 10) return `${Math.round(wh)} Wh`;
  return `${wh.toFixed(2)} Wh`;
}

function fmtMass(g) {
  if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`;
  return `${Math.round(g)} g`;
}

function fmtVol(ml) {
  if (ml >= 1000) return `${(ml / 1000).toFixed(1)} L`;
  return `${Math.round(ml)} ml`;
}

function fmtNum(n) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  if (n >= 10) return String(Math.round(n));
  return n.toFixed(1);
}
