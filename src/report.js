// Terminal rendering of the aggregated energy report.

import {
  classify,
  classLabel,
  energyWh,
  withRange,
  co2Range,
  waterMl,
  cacheSavingsWh,
  pickEquivalent,
  pickCo2Equivalent,
  levelFor,
  whToNextLevel,
  LADDER,
  CO2_LADDER,
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
  let lifetimeWh = 0; // un-windowed: the level is cumulative and never resets
  let cacheSavedWh = 0;
  let outputWh = 0;
  let count = 0;
  let firstTs = Infinity;
  const sources = new Set();

  for (const r of records) {
    const wh = energyWh(r.model, r);
    lifetimeWh += wh;
    if (cutoff && (!r.ts || r.ts < cutoff)) continue;
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

  const whRange = withRange(totalWh);
  return {
    totalWh: whRange,
    lifetimeWh,
    level: levelFor(lifetimeWh),
    whToNextLevel: whToNextLevel(lifetimeWh),
    co2g: co2Range(whRange, gridGCo2PerKwh),
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

// An 18-cell XP meter toward the next level, painted in the hog's own color.
function xpBar(frac, paint, width = 18) {
  const fill = Math.max(0, Math.min(width, Math.round(frac * width)));
  return paint("▓".repeat(fill)) + dim("░".repeat(width - fill));
}

// An uncertainty band: low and high anchor the ends, a bright marker sits where
// the median lands on a *log* scale (the honest scale for a ×0.35–×2.8 spread,
// so the eye reads "wide guess", not "precise number"). Mirrors the headline
// figure but gives the range equal visual weight.
function band(low, median, high, fmt, paint, width = 26) {
  const safe = (x) => Math.log(x > 0 ? x : 1e-9);
  const lo = safe(low);
  const span = safe(high) - lo || 1;
  const pos = Math.max(
    0,
    Math.min(width - 1, Math.round(((safe(median) - lo) / span) * (width - 1)))
  );
  let cells = "";
  for (let i = 0; i < width; i++) cells += i === pos ? paint("●") : dim("░");
  return `${dim(fmt(low).padStart(7))} ${dim("▏")}${cells}${dim("▏")} ${dim(fmt(high))}`;
}

// A 16-cell leanness meter: how much of the energy the cache spared you. Green,
// because unlike the level (which only ever climbs) this is the number you can
// actually improve — the hog's one redeeming axis.
function leanBar(frac, width = 16) {
  const fill = Math.max(0, Math.min(width, Math.round(frac * width)));
  return green("█".repeat(fill)) + dim("░".repeat(width - fill));
}

// The DIET line: prompt caching means you burned less than the same tokens
// would have cost fresh. lean% = what the cache spared / what it would've cost.
// The villain arc never lets you un-burn lifetime energy; this is where being
// efficient is the thing the hog respects. Empty when there's no cache data
// (e.g. only request-estimated sources), so it never shows a hollow 0%.
function dietBlock(agg) {
  const saved = agg.cacheSavedWh;
  const wouldBe = agg.totalWh.median + saved;
  if (!(saved > 0) || !(wouldBe > 0)) return [];
  const lean = saved / wouldBe;
  const tier =
    lean >= 0.6
      ? "monstrous, yes — but it wastes almost nothing. the hog approves."
      : lean >= 0.4
        ? "runs lean for its size. the cache earns its keep."
        : lean >= 0.2
          ? "carrying some fat — more caching would feed it less."
          : "eats everything fresh. caching would trim the hog hard.";
  return [
    `  ${bold("DIET")}   ${leanBar(lean)} ${green(`${Math.round(lean * 100)}% lean`)}` +
      `   ${dim(`cache ate ${fmtWh(saved)} it would've burned`)}`,
    `         ${dim(tier)}`,
  ];
}

// The hog's identity is its *level* (cumulative, climbing) — the ASCII form and
// color come straight from the evolution it has reached. The one-shot report
// prints frame 0; the interactive view animates the rest.
function hogBlock(agg) {
  const lv = agg.level; // { level, frac, evo, name, color, vibe }
  const paint = c(lv.color);
  const form = lv.evo.frames[0];
  const art = form.map((l) => paint(l));

  const info = [
    bold(paint(lv.name.toUpperCase())) + dim(`  ·  Lv ${lv.level}`),
    `${xpBar(lv.frac, paint)} ${dim(`${Math.round(lv.frac * 100)}% → Lv ${lv.level + 1}`)}`,
    dim(lv.vibe),
    dim(
      `${fmtWh(agg.lifetimeWh)} burned for life  ·  ${fmtWh(agg.whToNextLevel)} to level up`
    ),
  ];

  // Art on the left, level info vertically centered next to it.
  const width = Math.max(...form.map((l) => l.length)) + 3;
  const pad = Math.max(0, Math.floor((art.length - info.length) / 2));
  const lines = [];
  for (let i = 0; i < Math.max(art.length, info.length + pad); i++) {
    const left = form[i] ?? "";
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

  const co2 = agg.co2g.median;
  if (co2 >= 5) {
    out.push(
      `Your tokens emitted about ${amber(fmtMass(co2))} of CO₂e — roughly ${amber(fmtCo2Eq(co2))}. ` +
        `The grid factor you picked decides how much smoke that really is.`
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

export function render(agg, { sources, full, levelUp } = {}) {
  const lines = [];
  const p = (s = "") => lines.push(s);
  // Deterministic per day, so repeated runs feel alive but not jittery.
  const seed = Number(new Date().toISOString().slice(0, 10).replace(/-/g, ""));

  p();
  p(bold("🐷 watthog") + dim(" · estimated electricity use of your LLMs"));
  const since = agg.since ? agg.since.toISOString().slice(0, 10) : "?";
  p(
    dim(
      `${agg.messages.toLocaleString("en-US")} assistant messages since ${since}`
    )
  );
  p();
  if (levelUp) {
    const paint = c(agg.level.color);
    p(
      paint(bold(`  ⚡ LEVEL UP  ·  Lv ${levelUp.from} → Lv ${levelUp.to}  ·  ${agg.level.name.toUpperCase()} ⚡`))
    );
    p(dim("  the hog has evolved. there is no going back."));
    p();
  }
  for (const l of hogBlock(agg)) p(l);
  const diet = dietBlock(agg);
  if (diet.length) {
    p();
    for (const l of diet) p(l);
  }
  p();

  if (sources?.length) {
    for (const l of sourcesBlock(sources)) p(l);
    p();
  }

  const t = agg.totalWh;
  const co2 = agg.co2g;
  p(bold("TOTAL ESTIMATE") + dim("  ·  best guess, with the band it really sits in"));
  p(
    `  Energy  ${amber(bold(("≈ " + fmtWh(t.median)).padEnd(10)))}  ${band(t.low, t.median, t.high, fmtWh, amber)}`
  );
  p(`          ${dim("≈")} ${equivalents(t.median, seed)}`);
  p(
    `  CO₂e    ${bold(("≈ " + fmtMass(co2.median)).padEnd(10))}  ${band(co2.low, co2.median, co2.high, fmtMass, amber)}  ${dim(`@ ${agg.gridGCo2PerKwh} g/kWh`)}`
  );
  p(`          ${dim("≈")} ${co2Equivalents(co2.median, seed)}`);
  p(
    `          ${dim(`a mature tree would need ${fmtNum(co2.median / 55)} days to breathe it back in`)}`
  );
  p(`  Water   ${("≈ " + fmtVol(agg.waterMl)).padEnd(10)}  ${dim("data center cooling")}`);
  p();

  if (agg.models.length) {
    p(bold("BY MODEL"));
    // The tail of a long model list is mostly rounding noise; show the hungry
    // ones in full and fold the rest into a single honest line unless --all.
    const TOP = full ? Infinity : 12;
    const shown = agg.models.slice(0, TOP);
    // Copilot has no token counts on disk; its rows are reconstructed from
    // request counts. Mark those so the table doesn't blend estimated tokens
    // in with the token-accurate sources without a word.
    const estimated = (m) =>
      m.sources.length === 1 && m.sources[0] === "GitHub Copilot";
    let anyEstimated = false;
    const rows = shown.map((m) => {
      const est = estimated(m);
      if (est) anyEstimated = true;
      return [
        est ? m.model + " ~" : m.model,
        m.sources.join(", "),
        classLabel(classify(m.model)),
        fmtNum(m.input + m.cache),
        fmtNum(m.output),
        fmtWh(m.wh),
        pct(m.wh, t.median),
      ];
    });
    p(
      table(
        ["model", "source", "class", "in+cache tok", "out tok", "energy", ""],
        rows
      )
    );
    if (anyEstimated) {
      p(
        dim(
          "  ~ estimated from request counts — Copilot keeps no token data locally"
        )
      );
    }
    if (!full && agg.models.length > TOP) {
      const rest = agg.models.slice(TOP);
      const restWh = rest.reduce((s, m) => s + m.wh, 0);
      p(
        dim(
          `  + ${rest.length} more models  ·  ${fmtWh(restWh)}  ·  ${pct(restWh, t.median)} of total  ·  re-run with --all to expand`
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
    series.reverse(); // most recent day first
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
  lines.push(dim("  run `watthog doctor` to inspect paths and troubleshoot missing sources"));
  return lines;
}

// Rotate through human-scale equivalents daily so the numbers stay fresh.
// "Human-scale" = value lands between 1 and 400 (easy to visualise).
function equivalents(wh, seed = 0) {
  const valid = LADDER.filter((eq) => {
    const v = wh / eq.wh;
    return v >= 1 && v <= 400;
  });
  if (!valid.length) {
    const { value, unit } = pickEquivalent(wh);
    return green(bold(`${fmtNum(value)} ${unit}`));
  }
  const n = valid.length;
  const picks = [0, 1, 2]
    .map((i) => valid[(seed + i * Math.max(1, Math.floor(n / 3))) % n])
    .filter((eq, i, arr) => arr.indexOf(eq) === i); // deduplicate
  return picks
    .map((eq, i) => {
      const value = wh / eq.wh;
      const unit = value >= 1 && value < 1.05 ? eq.singular : eq.label;
      const text = `${fmtNum(value)} ${unit}`;
      return i === 0 ? green(bold(text)) : green(text);
    })
    .join(dim("  ·  "));
}

// CO₂ twin of equivalents(): rotate through gCO₂e comparisons that land in a
// graspable 1–400 band so the same emissions read differently each day.
function co2Equivalents(g, seed = 0) {
  const valid = CO2_LADDER.filter((eq) => {
    const v = g / eq.g;
    return v >= 1 && v <= 400;
  });
  if (!valid.length) {
    const { value, unit } = pickCo2Equivalent(g);
    return green(bold(`${fmtNum(value)} ${unit}`));
  }
  const n = valid.length;
  const picks = [0, 1, 2]
    .map((i) => valid[(seed + i * Math.max(1, Math.floor(n / 3))) % n])
    .filter((eq, i, arr) => arr.indexOf(eq) === i); // deduplicate
  return picks
    .map((eq, i) => {
      const value = g / eq.g;
      const unit = value >= 1 && value < 1.05 ? eq.singular : eq.label;
      const text = `${fmtNum(value)} ${unit}`;
      return i === 0 ? green(bold(text)) : green(text);
    })
    .join(dim("  ·  "));
}

function fmtEq(wh) {
  const { value, unit } = pickEquivalent(wh);
  return `${fmtNum(value)} ${unit}`;
}

function fmtCo2Eq(g) {
  const { value, unit } = pickCo2Equivalent(g);
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
