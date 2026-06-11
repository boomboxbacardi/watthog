import Link from "next/link";
import {
  TerminalIcon,
  ChartBarIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr";
import { HeroHog } from "@/components/HeroHog";
import { GlobalTrough } from "@/components/GlobalTrough";
import { TerminalDemo } from "@/components/TerminalDemo";
import { CopyCommand } from "@/components/CopyCommand";
import { EnergySlider } from "@/components/EnergySlider";
import { LeaderboardRows } from "@/components/LeaderboardRows";
import { HOGGERS } from "@/lib/mock";

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

export default function Home() {
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
      <GlobalTrough />

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
            <LeaderboardRows hoggers={HOGGERS.slice(0, 3)} metric="week" />
          </div>
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
        <div className="mt-8 rounded-3xl border-2 border-line">
          {[
            ["small", "Haiku, mini, flash", "0.03 Wh / 1k tokens"],
            ["medium", "Sonnet, GPT-4o, ~70B", "0.19 Wh / 1k tokens"],
            ["frontier", "Opus, GPT-5, o3", "0.45 Wh / 1k tokens"],
          ].map(([cls, examples, factor], i) => (
            <div
              key={cls}
              className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 px-6 py-4 ${
                i > 0 ? "border-t-2 border-line" : ""
              }`}
            >
              <p className="w-20 font-display text-lg font-bold">{cls}</p>
              <p className="flex-1 text-sm text-ink-muted">{examples}</p>
              <p className="font-mono text-sm text-volt">{factor}</p>
            </div>
          ))}
        </div>
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
