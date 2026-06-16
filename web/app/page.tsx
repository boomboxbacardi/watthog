import Link from "next/link";
import {
  TerminalIcon,
  ChartBarIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr";
import { Hog } from "@/components/Hog";
import { HeroHog } from "@/components/HeroHog";
import { GlobalTrough } from "@/components/GlobalTrough";
import { TerminalDemo } from "@/components/TerminalDemo";
import { CopyCommand } from "@/components/CopyCommand";
import { EnergySlider } from "@/components/EnergySlider";
import { LeaderboardRows } from "@/components/LeaderboardRows";
import { HOGGERS, type Hogger } from "@/lib/mock";
import { store } from "@/lib/store";
import { getGlobalStats } from "@/lib/stats";

export const revalidate = 30;

async function getLanding(): Promise<{
  hoggers: Hogger[];
  live: boolean;
  totalWh: number;
}> {
  const [entries, stats] = await Promise.all([store.getAll(), getGlobalStats()]);
  if (entries.length === 0) {
    return { hoggers: HOGGERS, live: false, totalWh: 0 };
  }
  return {
    hoggers: entries.map((e) => ({
      handle: e.handle,
      kWhWeek: e.kWhWeek,
      kWhAllTime: e.kWhAllTime,
      whPerDay: e.whPerDay,
      models: e.models,
    })),
    live: true,
    totalWh: stats.totalWh,
  };
}

const STEPS = [
  {
    icon: TerminalIcon,
    title: "Run it",
    body: "npx watthog scans Claude Code, OpenCode, Codex, Cursor and Copilot logs already on your disk.",
  },
  {
    icon: ChartBarIcon,
    title: "Read it",
    body: "Tokens per model become watt-hours, CO2e and water, always with honest ranges.",
  },
  {
    icon: UsersThreeIcon,
    title: "Feed the leaderboard",
    body: "Opt in with watthog submit. Aggregates only; your prompts never leave home.",
  },
];

// Size classes and their measured Wh-per-1k-output-token factors (src/energy.js).
// The bar widths make the spread physical: frontier eats ~15x a small model.
const METHOD_CLASSES = [
  { name: "small", examples: "Haiku, mini, flash", factor: 0.03 },
  { name: "medium", examples: "Sonnet, GPT-4o, ~70B", factor: 0.19 },
  { name: "frontier", examples: "Opus, GPT-5, o3", factor: 0.45 },
];
const METHOD_MAX = 0.45;

export default async function Home() {
  const { hoggers, live, totalWh } = await getLanding();
  return (
    <>
      {/* Hero: asymmetric split, the CLI command is the primary CTA */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-20">
        <div>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            <span className="rise rise-1 block">
              Your AI runs on electricity.
            </span>
            <span className="rise rise-2 block">
              Meet the <span className="text-accent">pig</span> that counts it.
            </span>
          </h1>
          <p className="rise rise-2 mt-5 max-w-[42ch] text-lg text-ink-muted">
            One command reads your local agent logs and turns tokens into
            watt-hours. Nothing leaves your machine.
          </p>
          <div className="rise rise-3 mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <CopyCommand command="npx watthog" />
            <Link
              href="/trough"
              className="shrink-0 font-semibold text-accent underline-offset-4 hover:underline"
            >
              See the leaderboard
            </Link>
          </div>
        </div>
        <div className="rise rise-4">
          <HeroHog />
        </div>
      </section>

      {/* Global trough: live odometer, toast flies into the hog's mouth */}
      <GlobalTrough initialWh={totalWh} live={live} />

      {/* The teaching slider */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <EnergySlider />
      </section>

      {/* How it works: the real CLI output next to the three steps */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">
          Run it. Read it. Brag about it.
        </h2>
        <div className="mt-10 grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
          <TerminalDemo />
          <ol className="flex flex-col gap-8">
            {STEPS.map((s) => (
              <li key={s.title} className="flex gap-5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft">
                  <s.icon size={24} weight="duotone" className="text-accent" />
                </span>
                <span>
                  <h3 className="font-display text-xl font-bold">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                    {s.body}
                  </p>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Leaderboard teaser */}
      <section className="border-y-2 border-line bg-surface-2/60">
        <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">
              This week&apos;s heaviest hogs
            </h2>
            <Link
              href="/trough"
              className="shrink-0 font-semibold text-accent underline-offset-4 hover:underline"
            >
              Full trough
            </Link>
          </div>
          <div className="mt-8">
            <LeaderboardRows
              hoggers={[...hoggers]
                .sort((a, b) => b.kWhWeek - a.kWhWeek)
                .slice(0, 3)}
              metric="week"
            />
          </div>
        </div>
      </section>

      {/* Put yourself on the board: a preview of the share card you get back */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">
          Put yourself on the board
        </h2>
        <p className="mx-auto mt-3 max-w-[44ch] text-ink-muted">
          One opt-in command and you get a share card of your own. Aggregates
          only, never your prompts or paths.
        </p>

        <div className="mx-auto mt-10 grid max-w-lg items-center gap-6 rounded-3xl border-2 border-line bg-surface-2/50 p-6 text-left sm:grid-cols-[auto_1fr] sm:p-8">
          <div className="relative flex justify-center">
            <div
              aria-hidden
              className="absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 bg-accent-soft"
              style={{ borderRadius: "46% 54% 52% 48% / 56% 48% 52% 44%" }}
            />
            <Hog stage={4} size={132} className="relative text-ink" />
          </div>
          <div>
            <p className="font-display text-2xl font-bold">@ci_gremlin</p>
            <p className="mt-0.5 text-ink-muted">
              Unit · rank <span className="font-mono font-semibold text-accent">#4</span> this week
            </p>
            <div className="mt-5 grid grid-cols-3 gap-4">
              {[
                ["this week", "6.2 kWh"],
                ["all-time", "88 kWh"],
                ["per day", "1.2 kWh"],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="font-mono text-lg font-semibold">{value}</p>
                  <p className="text-xs text-ink-muted">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {["opus", "sonnet"].map((m) => (
                <span
                  key={m}
                  className="rounded-full bg-accent-soft px-3 py-0.5 font-mono text-xs text-accent"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <CopyCommand command="npx watthog submit" />
        </div>
      </section>

      {/* Method */}
      <section id="method" className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">
          How the pig counts
        </h2>
        <p className="mt-4 leading-relaxed text-ink-muted">
          Providers do not publish per-model energy figures, so Watthog maps
          every model to a size class with a Wh-per-1k-token factor and always
          shows a low-to-high range, never a false-precision point value.
        </p>
        <div className="mt-10 flex flex-col gap-8">
          {METHOD_CLASSES.map((c) => (
            <div key={c.name}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <p className="font-display text-lg font-bold">
                  {c.name}{" "}
                  <span className="font-sans text-sm font-normal text-ink-muted">
                    {c.examples}
                  </span>
                </p>
                <p className="font-mono text-sm text-volt">
                  {c.factor.toFixed(2)} Wh / 1k
                </p>
              </div>
              <div
                className="mt-2.5 h-3 rounded-full bg-volt"
                style={{ width: `${(c.factor / METHOD_MAX) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-ink-muted">
          Wh per 1,000 output tokens. A frontier model eats roughly 15x what a
          small one does for the same work, which is why the model mix matters
          more than the token count.
        </p>
        <p className="mt-8 text-sm leading-relaxed text-ink-muted">
          Factors are anchored in measured benchmarks:{" "}
          <a
            className="text-accent underline-offset-4 hover:underline"
            href="https://huggingface.co/spaces/AIEnergyScore/Leaderboard"
          >
            AI Energy Score
          </a>
          ,{" "}
          <a
            className="text-accent underline-offset-4 hover:underline"
            href="https://ecologits.ai"
          >
            EcoLogits
          </a>{" "}
          and{" "}
          <a
            className="text-accent underline-offset-4 hover:underline"
            href="https://www.technologyreview.com/2025/08/21/1122288/google-gemini-ai-energy/"
          >
            Google&apos;s Gemini disclosure
          </a>
          . Input tokens are weighted at 1/8 of output, cache reads at 1/80.
          All figures are estimates. The hog is not a scientist.
        </p>
      </section>
    </>
  );
}
