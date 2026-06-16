// Aggregate read models over the leaderboard store. Used by the landing page
// (SSR), the global counter API, and the /u/[handle] rank lookup so every
// surface agrees on the same numbers.

import { store, type HoggerEntry } from "./store";

export type GlobalStats = {
  totalWh: number;
  hoggerCount: number;
  topModel: string | null;
};

export async function getGlobalStats(): Promise<GlobalStats> {
  const all = await store.getAll();
  const totalWh = all.reduce((s, h) => s + h.kWhAllTime * 1000, 0);

  const modelCounts = new Map<string, number>();
  for (const h of all) {
    for (const m of h.models) modelCounts.set(m, (modelCounts.get(m) || 0) + 1);
  }
  const topModel =
    [...modelCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return { totalWh, hoggerCount: all.length, topModel };
}

// One hogger plus their standing in the board, for the share page. Rank is by
// all-time kWh; null entry means the handle hasn't submitted.
export type HoggerWithRank = {
  entry: HoggerEntry;
  rankAllTime: number;
  rankWeek: number;
  total: number;
};

export async function getHoggerWithRank(
  handle: string
): Promise<HoggerWithRank | null> {
  const all = await store.getAll();
  const target = all.find((h) => h.handle.toLowerCase() === handle.toLowerCase());
  if (!target) return null;

  const byAllTime = [...all].sort((a, b) => b.kWhAllTime - a.kWhAllTime);
  const byWeek = [...all].sort((a, b) => b.kWhWeek - a.kWhWeek);

  return {
    entry: target,
    rankAllTime: byAllTime.findIndex((h) => h === target) + 1,
    rankWeek: byWeek.findIndex((h) => h === target) + 1,
    total: all.length,
  };
}

// Share-friendly framing for the long tail: what fraction of the board this
// hogger out-burns. Rank 1 of 100 tops ~99%; the lightest hog is at 0%. The
// leaderboard only gives the top few something to brag about — this gives
// everyone a number. Returns null when the board is too small to compare.
export function outburnPct(rank: number, total: number): number | null {
  if (total < 2) return null;
  return Math.round(((total - rank) / total) * 100);
}
