import type { Metadata } from "next";
import Link from "next/link";
import { Hog } from "@/components/Hog";
import { ShareButton } from "@/components/ShareButton";
import { CopyCommand } from "@/components/CopyCommand";
import { getHoggerWithRank } from "@/lib/stats";
import { stageFor, fmtEquivalent, fmtWh, type Stage } from "@/lib/equivalence";

export const revalidate = 30;

// Bigger hog, heavier hogger — the avatar carries the rank, same as the board.
const AVATAR_SIZE: Record<Stage, number> = { 1: 150, 2: 180, 3: 210, 4: 240, 5: 270 };

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const data = await getHoggerWithRank(handle);
  if (!data) {
    return { title: `@${handle} · Watthog`, description: "This hog hasn't fed yet." };
  }
  const stage = stageFor(data.entry.whPerDay);
  const title = `@${data.entry.handle} is a ${stage.name} · Watthog`;
  const description = `Rank #${data.rankWeek} this week · ${data.entry.kWhAllTime.toFixed(
    1
  )} kWh all-time · ${fmtEquivalent(data.entry.kWhAllTime * 1000)}.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "profile" },
    twitter: { card: "summary_large_image", title, description },
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-2xl font-semibold sm:text-3xl">{value}</p>
      <p className="mt-0.5 text-sm text-ink-muted">{label}</p>
    </div>
  );
}

export default async function HoggerPage({ params }: Props) {
  const { handle } = await params;
  const data = await getHoggerWithRank(handle);

  // Unknown / not-yet-submitted handle: a warm dead end, not a 404 wall.
  if (!data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6 sm:py-28">
        <Hog stage={1} size={140} sleeping className="mx-auto text-ink" />
        <h1 className="mt-6 font-display text-3xl font-bold sm:text-4xl">
          @{handle} hasn&apos;t fed yet
        </h1>
        <p className="mt-3 text-ink-muted">
          No hogger by that name is on the board. Run the command, then put
          yourself on it.
        </p>
        <div className="mt-8 flex justify-center">
          <CopyCommand command="npx watthog submit" />
        </div>
        <Link
          href="/trough"
          className="mt-6 inline-block font-semibold text-accent underline-offset-4 hover:underline"
        >
          See who is on the board
        </Link>
      </div>
    );
  }

  const { entry, rankWeek, total } = data;
  const stage = stageFor(entry.whPerDay);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="grid items-center gap-10 rounded-3xl border-2 border-line bg-surface-2/50 p-8 sm:p-12 md:grid-cols-[auto_1fr]">
        {/* Avatar: hog on a soft blob, sized by stage */}
        <div className="relative flex justify-center">
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 bg-accent-soft"
            style={{ borderRadius: "46% 54% 52% 48% / 56% 48% 52% 44%" }}
          />
          <Hog stage={stage.stage} size={AVATAR_SIZE[stage.stage]} className="relative text-ink" />
        </div>

        <div>
          <p className="font-display text-3xl font-bold sm:text-4xl">
            @{entry.handle}
          </p>
          <p className="mt-1 text-lg text-ink-muted">
            {stage.name} · rank{" "}
            <span className="font-mono font-semibold text-accent">#{rankWeek}</span>{" "}
            of {total} this week
          </p>

          <div className="mt-8 grid grid-cols-3 gap-6">
            <Stat label="this week" value={fmtWh(entry.kWhWeek * 1000)} />
            <Stat label="all-time" value={fmtWh(entry.kWhAllTime * 1000)} />
            <Stat label="per day" value={fmtWh(entry.whPerDay)} />
          </div>

          {entry.models.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-1.5">
              {entry.models.map((m) => (
                <span
                  key={m}
                  className="rounded-full bg-accent-soft px-3 py-0.5 font-mono text-xs text-accent"
                >
                  {m}
                </span>
              ))}
            </div>
          )}

          <p className="mt-6 text-ink-muted">
            All-time, that is ≈{" "}
            <span className="font-semibold text-ink">
              {fmtEquivalent(entry.kWhAllTime * 1000)}
            </span>
            .
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <ShareButton label="Share my hog" />
            <Link
              href="/trough"
              className="font-semibold text-accent underline-offset-4 hover:underline"
            >
              See the full trough
            </Link>
          </div>
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-ink-muted">
        Not on the board?{" "}
        <span className="font-mono text-ink">npx watthog submit</span>
      </p>
    </div>
  );
}
