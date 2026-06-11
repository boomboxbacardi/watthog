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

export function waterMl(wh) {
  return wh * WATER_ML_PER_WH;
}

// The Equivalence Engine: never show a watt-hour without something physical.
// Picks the largest unit on the ladder where the value lands at >= 1, so the
// number is always graspable ("9 dishwasher runs", never "0.01 dishwashers").
// Mirrors web/lib/equivalence.ts.
export const LADDER = [
  { label: "seconds of microwave", singular: "second of microwave", wh: 0.3 },
  { label: "phone charges", singular: "phone charge", wh: 12 },
  { label: "slices of toast", singular: "slice of toast", wh: 25 },
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

// Energy the cache saved vs. processing those tokens as fresh input.
export function cacheSavingsWh(model, cacheReadTokens) {
  const out1k = CLASSES[classify(model)].outWhPer1k;
  return (
    (cacheReadTokens / 1000) * out1k * (INPUT_FRACTION - CACHE_READ_FRACTION)
  );
}
