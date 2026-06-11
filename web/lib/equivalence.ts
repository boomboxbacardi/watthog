// The Equivalence Engine: never show a watt-hour without something physical.
// Picks the largest unit on the ladder where the value lands at >= 1, so the
// number is always graspable ("9 dishwasher runs", never "0.01 dishwashers").

export type Equivalent = {
  label: string;
  singular: string;
  wh: number;
};

export const LADDER: Equivalent[] = [
  { label: "seconds of microwave", singular: "second of microwave", wh: 0.3 },
  { label: "slices of toast", singular: "slice of toast", wh: 25 },
  { label: "phone charges", singular: "phone charge", wh: 12 },
  { label: "pots of coffee", singular: "pot of coffee", wh: 100 },
  { label: "hours on a gaming PC", singular: "hour on a gaming PC", wh: 350 },
  { label: "dishwasher runs", singular: "dishwasher run", wh: 1000 },
  { label: "km in an electric car", singular: "km in an electric car", wh: 150 },
  { label: "hot showers", singular: "hot shower", wh: 2500 },
  { label: "house-days", singular: "house-day", wh: 25000 },
].sort((a, b) => a.wh - b.wh);

export function pickEquivalent(wh: number): { value: number; unit: string } {
  let chosen = LADDER[0];
  for (const eq of LADDER) {
    if (wh / eq.wh >= 1) chosen = eq;
  }
  const value = wh / chosen.wh;
  return {
    value,
    unit: value >= 1 && value < 1.05 ? chosen.singular : chosen.label,
  };
}

export function fmtEquivalent(wh: number): string {
  const { value, unit } = pickEquivalent(wh);
  return `${fmtValue(value)} ${unit}`;
}

export function fmtValue(v: number): string {
  if (v >= 100) return Math.round(v).toLocaleString("en-US");
  if (v >= 10) return String(Math.round(v));
  return v.toFixed(1).replace(/\.0$/, "");
}

export function fmtWh(wh: number): string {
  if (wh >= 1000) return `${(wh / 1000).toFixed(wh >= 10000 ? 0 : 1)} kWh`;
  if (wh >= 10) return `${Math.round(wh)} Wh`;
  if (wh >= 1) return `${wh.toFixed(1)} Wh`;
  return `${wh.toFixed(2)} Wh`;
}

// Hog growth stages, from rolling Wh/day. Mirrors DESIGN.md.
export type Stage = 1 | 2 | 3 | 4 | 5;

export const STAGES: { stage: Stage; name: string; minWhPerDay: number }[] = [
  { stage: 1, name: "Piglet", minWhPerDay: 0 },
  { stage: 2, name: "Hog", minWhPerDay: 10 },
  { stage: 3, name: "Chonk", minWhPerDay: 100 },
  { stage: 4, name: "Unit", minWhPerDay: 400 },
  { stage: 5, name: "The Substation", minWhPerDay: 1500 },
];

export function stageFor(whPerDay: number) {
  let current = STAGES[0];
  for (const s of STAGES) {
    if (whPerDay >= s.minWhPerDay) current = s;
  }
  return current;
}
