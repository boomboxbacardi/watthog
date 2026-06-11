import { Hog } from "./Hog";
import { fmtEquivalent } from "@/lib/equivalence";
import { stageOf, type Hogger } from "@/lib/mock";

// The pig avatar IS the rank: bigger hog, more kWh.
const AVATAR_SIZE: Record<number, number> = { 1: 44, 2: 56, 3: 68, 4: 80, 5: 96 };

export function LeaderboardRows({
  hoggers,
  metric,
}: {
  hoggers: Hogger[];
  metric: "week" | "all";
}) {
  const sorted = [...hoggers].sort((a, b) =>
    metric === "week" ? b.kWhWeek - a.kWhWeek : b.kWhAllTime - a.kWhAllTime
  );

  return (
    <ol className="flex flex-col gap-3">
      {sorted.map((h, i) => {
        const stage = stageOf(h);
        const kWh = metric === "week" ? h.kWhWeek : h.kWhAllTime;
        return (
          <li
            key={h.handle}
            className="flex items-center gap-4 rounded-3xl border-2 border-line bg-surface px-4 py-3 sm:gap-6 sm:px-6"
          >
            <span className="w-6 shrink-0 font-mono text-sm text-ink-muted">
              {i + 1}
            </span>
            <span className="flex w-24 shrink-0 justify-center">
              <Hog stage={stage.stage} size={AVATAR_SIZE[stage.stage]} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">@{h.handle}</span>
              <span className="block text-sm text-ink-muted">
                {stage.name}
              </span>
            </span>
            <span className="hidden flex-wrap gap-1.5 md:flex">
              {h.models.map((m) => (
                <span
                  key={m}
                  className="rounded-full bg-accent-soft px-2.5 py-0.5 font-mono text-xs text-accent"
                >
                  {m}
                </span>
              ))}
            </span>
            <span className="text-right">
              <span className="block font-mono text-lg font-semibold">
                {kWh.toFixed(1)}{" "}
                <span className="text-sm font-normal text-ink-muted">kWh</span>
              </span>
              <span className="block text-sm text-ink-muted">
                ≈ {fmtEquivalent(kWh * 1000)}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
