// Energy model for LLM inference, expressed as Wh per 1k tokens.
//
// Anchors (see README for sources):
//  - Llama-3.3-70B on H100/FP8: ~0.39 J/output token ≈ 0.11 Wh/1k GPU-only.
//    Google's Gemini disclosure attributes only 58% of total energy to the
//    accelerator (CPU/RAM 25%, idle failover 10%, PUE overhead 8%), so the
//    full-stack figure for a ~70B-class model lands around 0.19 Wh/1k.
//  - AI Energy Score v2 (H100 benchmarks) and "How Hungry is AI?" for the
//    spread between small and frontier-class models.
//
// Closed providers don't publish per-model numbers, so each model is mapped
// to a size class and every result carries a low–high range rather than a
// false-precision point value.

const CLASSES = {
  small: { label: "small (≤20B active)", outWhPer1k: 0.03 },
  medium: { label: "medium (~70B class)", outWhPer1k: 0.19 },
  large: { label: "large (frontier)", outWhPer1k: 0.45 },
};

// Prefill is compute-heavy but batches far better than decode; cached reads
// skip prefill almost entirely. Cache writes do the same work as prefill.
const INPUT_FRACTION = 1 / 8;
const CACHE_READ_FRACTION = 1 / 80;
const CACHE_WRITE_FRACTION = 1 / 8;

// Uncertainty band: production batching/quantization can cut energy hard,
// while worst-case deployments and long contexts push it up.
export const RANGE = { low: 0.35, high: 2.8 };

// Defaults for derived footprints.
export const DEFAULT_GRID_GCO2_PER_KWH = 400; // global average grid intensity
export const WATER_ML_PER_WH = 1.1; // Google: 0.26 ml / 0.24 Wh per prompt

const SMALL_RE =
  /haiku|\bmini\b|nano|flash|lite|small|tiny|\b[1-9]b\b|gemma|phi-|smol/;
const LARGE_RE =
  /opus|fable|mythos|gpt-5|gpt-4\.5|\bo[134](-pro)?\b|grok-[34]|ultra|qwen[^a-z]*max/;

export function classify(model) {
  const m = String(model || "").toLowerCase();
  if (SMALL_RE.test(m)) return "small";
  if (LARGE_RE.test(m)) return "large";
  return "medium";
}

export function classLabel(cls) {
  return CLASSES[cls].label;
}

// usage: { input, output, cacheRead, cacheWrite } in tokens.
// Returns median Wh for one record.
export function energyWh(model, usage) {
  const out1k = CLASSES[classify(model)].outWhPer1k;
  const in1k = out1k * INPUT_FRACTION;
  return (
    (usage.output / 1000) * out1k +
    (usage.input / 1000) * in1k +
    (usage.cacheRead / 1000) * out1k * CACHE_READ_FRACTION +
    (usage.cacheWrite / 1000) * out1k * CACHE_WRITE_FRACTION
  );
}

export function withRange(medianWh) {
  return {
    median: medianWh,
    low: medianWh * RANGE.low,
    high: medianWh * RANGE.high,
  };
}

export function co2Grams(wh, gridGCo2PerKwh = DEFAULT_GRID_GCO2_PER_KWH) {
  return (wh / 1000) * gridGCo2PerKwh;
}

// CO₂ inherits the energy uncertainty band: same low/median/high, run through
// the grid factor. Keeps the design rule that no number ships without a range.
export function co2Range(whRange, gridGCo2PerKwh = DEFAULT_GRID_GCO2_PER_KWH) {
  return {
    low: co2Grams(whRange.low, gridGCo2PerKwh),
    median: co2Grams(whRange.median, gridGCo2PerKwh),
    high: co2Grams(whRange.high, gridGCo2PerKwh),
  };
}

export function waterMl(wh) {
  return wh * WATER_ML_PER_WH;
}

// The Equivalence Engine: never show a watt-hour without something physical.
// Picks the largest unit on the ladder where the value lands at >= 1, so the
// number is always graspable ("9 dishwasher runs", never "0.01 dishwashers").
// Mirrors web/lib/equivalence.ts.
export const LADDER = [
  { label: "seconds of microwave", singular: "second of microwave", wh: 0.3 },
  { label: "LED bulb-hours", singular: "LED bulb-hour", wh: 10 },
  { label: "phone charges", singular: "phone charge", wh: 12 },
  { label: "e-bike km", singular: "km on an e-bike", wh: 15 },
  { label: "slices of toast", singular: "slice of toast", wh: 25 },
  { label: "laptop-hours", singular: "laptop-hour", wh: 50 },
  { label: "pots of coffee", singular: "pot of coffee", wh: 100 },
  { label: "km in an electric car", singular: "km in an electric car", wh: 150 },
  { label: "hours on a gaming PC", singular: "hour on a gaming PC", wh: 350 },
  { label: "dishwasher runs", singular: "dishwasher run", wh: 1000 },
  { label: "hot showers", singular: "hot shower", wh: 2500 },
  { label: "house-days", singular: "house-day", wh: 25000 },
];

export function pickEquivalent(wh) {
  let chosen = LADDER[0];
  for (const eq of LADDER) {
    if (wh / eq.wh >= 1) chosen = eq;
  }
  const value = wh / chosen.wh;
  return {
    ...chosen,
    value,
    unit: value >= 1 && value < 1.05 ? chosen.singular : chosen.label,
  };
}

// The same idea in gCO₂e: ground every emissions figure in something physical
// instead of an abstract gram count. Anchors are lifecycle estimates, sourced
// in the README (Berners-Lee "How Bad Are Bananas?", EU fleet averages).
export const CO2_LADDER = [
  { label: "Google searches", singular: "Google search", g: 0.2 },
  { label: "text messages", singular: "text message", g: 0.014 },
  { label: "cups of black coffee", singular: "cup of black coffee", g: 50 },
  { label: "bananas", singular: "banana", g: 80 },
  { label: "km in a petrol car", singular: "km in a petrol car", g: 120 },
  { label: "km flown", singular: "km flown", g: 250 },
  { label: "liters of petrol burned", singular: "liter of petrol burned", g: 2310 },
  { label: "beef burgers", singular: "beef burger", g: 3300 },
].sort((a, b) => a.g - b.g);

export function pickCo2Equivalent(g) {
  let chosen = CO2_LADDER[0];
  for (const eq of CO2_LADDER) {
    if (g / eq.g >= 1) chosen = eq;
  }
  const value = g / chosen.g;
  return {
    ...chosen,
    value,
    unit: value >= 1 && value < 1.05 ? chosen.singular : chosen.label,
  };
}

// Hog growth stages, from rolling 7-day Wh/day. Mirrors DESIGN.md.
export const STAGES = [
  { stage: 1, name: "Piglet", minWhPerDay: 0, vibe: "tiny, big eyes, one toast crumb" },
  { stage: 2, name: "Hog", minWhPerDay: 10, vibe: "content, round" },
  { stage: 3, name: "Chonk", minWhPerDay: 100, vibe: "visibly thriving" },
  { stage: 4, name: "Unit", minWhPerDay: 400, vibe: "fills the terminal, smug" },
  { stage: 5, name: "The Substation", minWhPerDay: 1500, vibe: "power lines bend toward it" },
];

export function stageFor(whPerDay) {
  let current = STAGES[0];
  for (const s of STAGES) {
    if (whPerDay >= s.minWhPerDay) current = s;
  }
  return current;
}

// ── The Villain Arc ────────────────────────────────────────────────────────
// STAGES above is the hog's *body size right now* (rate-based, can shrink).
// This is its *legend*: a cumulative, monotonic level on lifetime energy that
// only ever climbs. We don't celebrate burning power — the higher you go the
// more gloriously monstrous the hog becomes, cute-evil all the way down.
//
// Infinite log scale, calibrated against tokscale.ai/leaderboard so the global
// #1 (~160 MWh) lands near Lv 65 with headroom to spare. Each level is +25%
// lifetime energy; past the last named form the hog just earns higher Mk
// numbers, so the arc never tops out.
const LEVEL_BASE_WH = 100; // lifetime energy at which Lv 1 begins
const LEVEL_GROWTH = 1.25; // each level costs 25% more lifetime energy

// Each form carries 2+ frames (idle / motion) cycled by the interactive view;
// the one-shot report prints frame 0. `color` is a 256-color code; the final
// open-ended form cycles a palette so even Lv 90 looks different from Lv 60.
export const EVOLUTIONS = [
  {
    minLevel: 1,
    name: "Piglet",
    vibe: "tiny, innocent, no idea what it will become",
    color: "38;5;218",
    frames: [
      ["  ^..^", " (o  o)~", '  "  "'],
      ["  ^..^", " (-  -)~", '  "  "'],
    ],
  },
  {
    minLevel: 4,
    name: "Hoglet",
    vibe: "first taste of compute, wants more",
    color: "38;5;219",
    frames: [
      ["  ^..^_", " (o  o  )~", '  "  " "'],
      ["  ^..^_", " (o  o  )∾", '  "  " "'],
    ],
  },
  {
    minLevel: 7,
    name: "Hog",
    vibe: "content, round, a little too into it",
    color: "38;5;175",
    frames: [
      ["  ^..^____", " (o  o    )~", '  "  "  " "'],
      ["  ^..^____", " (-  -    )∾", '  "  "  " "'],
    ],
  },
  {
    minLevel: 10,
    name: "Chonk",
    vibe: "visibly thriving, suspiciously smug",
    color: "38;5;217",
    frames: [
      ["  ^..^_______", " ( o  o   ◡  )", " (           )~", '  "  "    " "'],
      ["  ^..^_______", " ( -  -   ◡  )", " (           )∾", '  "  "    " "'],
    ],
  },
  {
    minLevel: 14,
    name: "Big Chonkus",
    vibe: "gluttony, classical proportions, zero regrets",
    color: "38;5;214",
    frames: [
      ["  ^..^__________", " ( o  o   ◡     )", " (              )", " (              )~", '  "  "       " "'],
      ["  ^..^__________", " ( -  -   ◡     )", " (              )", " (              )∾", '  "  "       " "'],
    ],
  },
  {
    minLevel: 18,
    name: "The Unit",
    vibe: "the eyes have started to glow. that's new.",
    color: "38;5;208",
    frames: [
      ["  ^..^__________", " ( ●  ●   ◡     )", " (              )~", '  "  "       " "'],
      ["  ^..^__________", " ( ◉  ◉   ◡     )", " (              )∾", '  "  "       " "'],
    ],
  },
  {
    minLevel: 23,
    name: "Substation Swine",
    vibe: "power lines bend toward it. the grid operator knows your name.",
    color: "38;5;202",
    frames: [
      ["   \\   ^..^_________", " --+-- ( ●  ●       )", "   /   (            )~", '        "  "     " "'],
      ["   \\ ⚡ ^..^_________", " --+-- ( ◉  ◉       )", "   /   (            )∾", '        "  "     " "'],
    ],
  },
  {
    minLevel: 28,
    name: "Hognarök",
    vibe: "the sky cracks. it does not care.",
    color: "38;5;166",
    frames: [
      ["  ╲ ╱  ^..^_________", " ⚡( ◉  ◉   ʖ      )", "   (              )~", '    "  "       " "'],
      ["  ╳ ⚡  ^..^_________", " ⚡( ◉  ◉   ʖ      )", "   (              )∾", '    "  "       " "'],
    ],
  },
  {
    minLevel: 33,
    name: "Hogzilla",
    vibe: "horns now. it breathes smoke. still kind of adorable.",
    color: "38;5;196",
    frames: [
      ["  ╓╖  ^\\../^_________", " ( ° )( ◉  ◉   ʖ     )", "  ╜╙ (              )~", "      '' ''     '' '"],
      ["  ╓╖ ˚^\\../^_________", " (   )( ◉  ◉   ʖ     )", "  ╜╙ (              )∾", "      '' ''     '' '"],
    ],
  },
  {
    minLevel: 38,
    name: "Megahog",
    vibe: "kaiju scale. cities draft evacuation plans.",
    color: "38;5;160",
    frames: [
      ["  ╓╖  ^\\../^___________", " ( ° )( ◉  ◉    ʖ      )", "  ╜╙ (                )", " ░░░ (                )~", "      '' ''       '' '"],
      ["  ╓╖ ˚^\\../^___________", " (   )( ◉  ◉    ʖ      )", "  ╜╙ (                )", " ▒▒▒ (                )∾", "      '' ''       '' '"],
    ],
  },
  {
    minLevel: 43,
    name: "Brimstone Sow",
    vibe: "wreathed in flame, wearing a tiny crown. earned every watt.",
    color: "38;5;124",
    frames: [
      ["    ♛  /\\____/\\______", "  ≈ ( ◉  ◉    ʖ      )", "  ≈ (               )~", "  ≈  '' ''      '' '"],
      ["    ♛ ≋/\\____/\\______", "  ≋ ( ◉  ◉    ʖ      )", "  ≋ (               )∾", "  ≋  '' ''      '' '"],
    ],
  },
  {
    minLevel: 48,
    name: "Infernal Boar",
    vibe: "hellfire for breath, brimstone for bedding",
    color: "38;5;88",
    frames: [
      ["   ▲♛▲ /\\____/\\______", "  ≋ ( ◉  ◉   ⩌      )", "  ≋ (                )~", "  ≋  '' ''      '' '"],
      ["   ▲♛▲ /\\____/\\______", "  ≈ ( ◉  ◉   ⩌      )", "  ≈ (                )∾", "  ≈  '' ''      '' '"],
    ],
  },
  {
    minLevel: 53,
    name: "The Coal Baron",
    vibe: "top hat, monocle, owns a power plant and eats from it",
    color: "38;5;94",
    frames: [
      ["   ┌─┐  ^..^_________", " ╾┤ ├ ( ◉  o   ʖ     )", " └─┘ (             )~", '       "  "      " "'],
      ["   ┌─┐  ^..^_________", " ╾┤ ├ ( ◉  o   ʖ     )", " └─┘ (             )∾", '       "  "      " "'],
    ],
  },
  {
    minLevel: 58,
    name: "The Grid Eater",
    vibe: "eldritch, cabled, no longer entirely a pig",
    color: "38;5;201",
    frames: [
      ["  ╲ ╱  ▟▙___________", " ╾█╼ ( ◉  ◉   ⩌     )", "  ╱ ╲ (             )≈", "   ⌇  '' ''     '' '"],
      ["  ╳ ⌇  ▟▙___________", " ╾█╼ ( ◉  ◉   ⩌     )", "  ⌇ ╳ (             )≋", "   ╲  '' ''     '' '"],
    ],
  },
  {
    minLevel: 63,
    name: "Singularity Swine",
    vibe: "a hog-shaped hole in the power budget of reality. you did this.",
    color: "38;5;201",
    cycle: ["38;5;201", "38;5;165", "38;5;129", "38;5;93", "38;5;57", "38;5;63", "38;5;99"],
    frames: [
      ["  ✷ ╳ ✦ ▟▙__________", " ╾█╼ ( ✦  ✦  ⩌      )", "  ✦ ╳ (             )≋", "   ✷  '' ''     '' '"],
      ["  ✦ ⌇ ✷ ▟▙__________", " ╾█╼ ( ✦  ✦  ⩌      )", "  ✷ ⌇ (             )≈", "   ✦  '' ''     '' '"],
    ],
  },
];

// Roman numerals for the open-ended form's Mk suffix (Mk II, Mk III, …).
function roman(n) {
  if (n < 1) return "";
  const map = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"],
    [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"],
    [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  for (const [v, s] of map) while (n >= v) (out += s), (n -= v);
  return out;
}

// Cumulative lifetime energy → level. Returns the integer level, the 0–1
// progress toward the next, the matching evolution form, its display name
// (with Mk suffix past the last form) and the level-driven color.
export function levelFor(lifetimeWh) {
  const wh = Math.max(0, lifetimeWh);
  let level, frac;
  if (wh < LEVEL_BASE_WH) {
    level = 1;
    frac = wh / LEVEL_BASE_WH;
  } else {
    const x = Math.log(wh / LEVEL_BASE_WH) / Math.log(LEVEL_GROWTH);
    level = Math.floor(x) + 1;
    frac = x - Math.floor(x);
  }

  let evo = EVOLUTIONS[0];
  for (const e of EVOLUTIONS) if (level >= e.minLevel) evo = e;

  let name = evo.name;
  let color = evo.color;
  if (evo.cycle) {
    const mk = level - evo.minLevel + 1; // 1 at the form's first level
    if (mk >= 2) name = `${evo.name} Mk ${roman(mk)}`;
    color = evo.cycle[(level - evo.minLevel) % evo.cycle.length];
  }

  return { level, frac, evo, name, color, vibe: evo.vibe };
}

// Energy the next level demands, so the report can show "X to go".
export function whToNextLevel(lifetimeWh) {
  const { level } = levelFor(lifetimeWh);
  const nextThreshold = LEVEL_BASE_WH * Math.pow(LEVEL_GROWTH, level); // start of level+1
  return Math.max(0, nextThreshold - lifetimeWh);
}

// Energy the cache saved vs. processing those tokens as fresh input.
export function cacheSavingsWh(model, cacheReadTokens) {
  const out1k = CLASSES[classify(model)].outWhPer1k;
  return (
    (cacheReadTokens / 1000) * out1k * (INPUT_FRACTION - CACHE_READ_FRACTION)
  );
}
