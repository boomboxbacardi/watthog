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
  /haiku|mini|nano|flash|lite|small|tiny|\b[1-9]b\b|gemma|phi-|smol/;
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

// Everyday equivalents for making Wh tangible.
export const EQUIVALENTS = [
  { label: "phone charges", wh: 12 },
  { label: "hours of LED light (8W)", wh: 8 },
  { label: "dishwasher runs", wh: 1000 },
  { label: "km in an electric car", wh: 150 },
];
