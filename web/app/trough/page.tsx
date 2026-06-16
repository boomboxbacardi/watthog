import type { Metadata } from "next";
import { TroughBoard } from "@/components/TroughBoard";
import { HOGGERS, type Hogger } from "@/lib/mock";
import { store } from "@/lib/store";

export const metadata: Metadata = {
  title: "The Trough, Watthog's leaderboard",
  description:
    "The heaviest hogs in AI. Weekly and all-time electricity leaderboard across coding agents.",
};

export const revalidate = 60;

async function getHoggers(): Promise<{ hoggers: Hogger[]; live: boolean }> {
  const entries = await store.getAll();
  if (entries.length === 0) return { hoggers: HOGGERS, live: false };
  return {
    hoggers: entries.map((e) => ({
      handle: e.handle,
      kWhWeek: e.kWhWeek,
      kWhAllTime: e.kWhAllTime,
      whPerDay: e.whPerDay,
      models: e.models,
    })),
    live: true,
  };
}

export default async function TroughPage() {
  const { hoggers, live } = await getHoggers();
  const totalKWh = hoggers.reduce((s, h) => s + h.kWhWeek, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-4xl font-bold sm:text-5xl">
        The Trough
      </h1>
      <p className="mt-3 max-w-[55ch] text-ink-muted">
        Every hog here opted in with{" "}
        <code className="font-mono text-sm">watthog submit</code>. Aggregates
        only, never prompts or paths.{" "}
        {!live && <span className="text-ink-muted/70">Sample data — be the first to submit.</span>}
      </p>

      {live && (
        <div className="mt-8 rounded-3xl bg-volt-soft px-6 py-4 text-sm">
          Together this week:{" "}
          <strong className="font-mono">{totalKWh.toFixed(1)} kWh</strong> across{" "}
          {hoggers.length} hog{hoggers.length !== 1 ? "s" : ""}.
        </div>
      )}

      <div className="mt-8">
        <TroughBoard hoggers={hoggers} />
      </div>
    </div>
  );
}
