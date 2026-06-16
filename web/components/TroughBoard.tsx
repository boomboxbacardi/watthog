"use client";

import { useState } from "react";
import { LeaderboardRows } from "./LeaderboardRows";
import { type Hogger } from "@/lib/mock";

export function TroughBoard({ hoggers }: { hoggers: Hogger[] }) {
  const [metric, setMetric] = useState<"week" | "all">("week");

  return (
    <div>
      <div
        role="tablist"
        aria-label="Leaderboard period"
        className="inline-flex rounded-full border-2 border-line bg-surface-2 p-1"
      >
        {(
          [
            ["week", "This week"],
            ["all", "All time"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={metric === key}
            onClick={() => setMetric(key)}
            className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
              metric === key
                ? "bg-accent text-white"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <LeaderboardRows hoggers={hoggers} metric={metric} />
      </div>
    </div>
  );
}
