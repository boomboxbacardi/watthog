// Terminal rendering of the aggregated energy report.

import {
  classify,
  classLabel,
  energyWh,
  withRange,
  co2Grams,
  waterMl,
  EQUIVALENTS,
} from "./energy.js";

const tty = process.stdout.isTTY;
const c = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const bold = c(1);
const dim = c(2);
const yellow = c(33);
const green = c(32);
const cyan = c(36);

export function aggregate(records, { days, gridGCo2PerKwh } = {}) {
  const cutoff = days ? Date.now() - days * 86400_000 : null;
  const byModel = new Map();
  const byDay = new Map();
  let totalWh = 0;
  let count = 0;
  let firstTs = Infinity;
  const sources = new Set();

  for (const r of records) {
    if (cutoff && (!r.ts || r.ts < cutoff)) continue;
    const wh = energyWh(r.model, r);
    totalWh += wh;
    count++;
    sources.add(r.source);
    if (r.ts && r.ts < firstTs) firstTs = r.ts;

    let m = byModel.get(r.model);
    if (!m) {
      m = { model: r.model, input: 0, output: 0, cache: 0, wh: 0, n: 0 };
      byModel.set(r.model, m);
    }
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

  return {
    totalWh: withRange(totalWh),
    co2g: co2Grams(totalWh, gridGCo2PerKwh),
    waterMl: waterMl(totalWh),
    gridGCo2PerKwh,
    messages: count,
    since: firstTs === Infinity ? null : new Date(firstTs),
    sources: [...sources],
    models: [...byModel.values()].sort((a, b) => b.wh - a.wh),
    days: [...byDay.entries()].sort(),
  };
}

export function render(agg) {
  const lines = [];
  const p = (s = "") => lines.push(s);

  p();
  p(bold("⚡ llm-energy") + dim(" — estimated electricity use of your LLMs"));
  const since = agg.since ? agg.since.toISOString().slice(0, 10) : "?";
  p(
    dim(
      `${agg.messages.toLocaleString("en-US")} assistant messages since ${since} · sources: ${agg.sources.join(", ") || "none found"}`
    )
  );
  p();

  const t = agg.totalWh;
  p(bold("TOTAL ESTIMATE"));
  p(
    `  Energy  ${yellow(bold(fmtWh(t.median)))}   ${dim(`range ${fmtWh(t.low)} – ${fmtWh(t.high)}`)}`
  );
  p(
    `  CO₂e    ${fmtMass(agg.co2g)}   ${dim(`@ ${agg.gridGCo2PerKwh} gCO₂e/kWh grid`)}`
  );
  p(`  Water   ${fmtVol(agg.waterMl)}   ${dim("data center cooling")}`);
  p();

  const eq = EQUIVALENTS.map(
    (e) => `${green(fmtNum(t.median / e.wh))} ${e.label}`
  ).join(dim("  ·  "));
  p(`  ≈ ${eq}`);
  p();

  if (agg.models.length) {
    p(bold("BY MODEL"));
    const rows = agg.models.map((m) => [
      m.model,
      classLabel(classify(m.model)),
      fmtNum(m.input + m.cache),
      fmtNum(m.output),
      fmtWh(m.wh),
      pct(m.wh, t.median),
    ]);
    p(
      table(
        ["model", "class", "in+cache tok", "out tok", "energy", ""],
        rows
      )
    );
  }

  if (agg.days.length) {
    p(bold("LAST 14 DAYS"));
    const recent = agg.days.slice(-14);
    const max = Math.max(...recent.map(([, wh]) => wh));
    for (const [day, wh] of recent) {
      const bar = "█".repeat(Math.max(1, Math.round((wh / max) * 36)));
      p(`  ${dim(day)}  ${cyan(bar)} ${fmtWh(wh)}`);
    }
    p();
  }

  p(
    dim(
      "Estimates only. Closed providers don't publish per-model energy; factors are\nderived from open benchmarks (AI Energy Score, EcoLogits) and Google's Gemini\ndisclosure. See README for methodology."
    )
  );
  p();
  return lines.join("\n");
}

function table(header, rows) {
  const all = [header, ...rows];
  const widths = header.map((_, i) =>
    Math.max(...all.map((r) => String(r[i]).length))
  );
  const fmt = (r, dimRow) =>
    "  " +
    r
      .map((cell, i) =>
        i <= 1
          ? String(cell).padEnd(widths[i])
          : String(cell).padStart(widths[i])
      )
      .join("  ") +
    (dimRow ? "" : "");
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
