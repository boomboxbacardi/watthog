import type { Metadata } from "next";
import { TroughBoard } from "@/components/TroughBoard";

export const metadata: Metadata = {
  title: "The Trough, Watthog's leaderboard",
  description:
    "The heaviest hogs in AI. Weekly and all-time electricity leaderboard across coding agents.",
};

export default function TroughPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-4xl font-bold sm:text-5xl">
        The Trough
      </h1>
      <p className="mt-3 max-w-[55ch] text-ink-muted">
        Every hog here opted in with{" "}
        <code className="font-mono text-sm">watthog submit</code>. Aggregates
        only, never prompts or paths. Sample data until the backend opens.
      </p>

      <div className="mt-8 rounded-3xl bg-volt-soft px-6 py-4 text-sm">
        Together this week:{" "}
        <strong className="font-mono">77.1 kWh</strong>, 89% of it from
        frontier models. Busiest hour: 14:00 UTC.
      </div>

      <div className="mt-8">
        <TroughBoard />
      </div>
    </div>
  );
}
