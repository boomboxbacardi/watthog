import Link from "next/link";
import {
  TerminalIcon,
  ChartBarIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr";
import { Hog } from "@/components/Hog";
import { CopyCommand } from "@/components/CopyCommand";
import { EnergySlider } from "@/components/EnergySlider";
import { LeaderboardRows } from "@/components/LeaderboardRows";
import { fmtEquivalent } from "@/lib/equivalence";
import { GLOBAL_KWH, HOGGERS } from "@/lib/mock";

export default function Home() {
  return (
    <>
      {/* Hero: asymmetric split, the CLI command is the primary CTA */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-24">
        <div>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Your AI runs on electricity. Meet the pig that counts it.
          </h1>
          <p className="mt-5 max-w-[42ch] text-lg text-ink-muted">
            One command reads your local agent logs and turns tokens into
            watt-hours. Nothing leaves your machine.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <CopyCommand command="npx watthog" />
            <Link
              href="/trough"
              className="shrink-0 font-semibold text-accent underline-offset-4 hover:underline"
            >
              See the leaderboard
            </Link>
          </div>
        </div>
        <div className="flex justify-center">
          <Hog stage={3} size={340} className="text-ink" />
        </div>
      </section>

      {/* Global trough counter */}
      <section className="border-y-2 border-line bg-surface-2/60">
        <div className="mx-auto max-w-6xl px-4 py-10 text-center sm:px-6">
          <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">
            The global trough
          </p>
          <p className="mt-2 font-display text-3xl font-bold sm:text-4xl">
            All hogs together have eaten{" "}
            <span className="font-mono text-volt">
              {GLOBAL_KWH.toLocaleString("en-US")} kWh
            </span>
          </p>
          <p className="mt-1 text-ink-muted">
            ≈ {fmtEquivalent(GLOBAL_KWH * 1000)} (sample figure until launch)
          </p>
        </div>
      </section>

      {/* The teaching slider */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <EnergySlider />
      </section>

      {/* Three steps */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">
          Three steps to an honest pig
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: TerminalIcon,
              title: "Run it",
              body: "npx watthog scans Claude Code, OpenCode and Codex logs already on your disk.",
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
          ].map((s, i) => (
            <div
              key={s.title}
              className={`rounded-3xl border-2 border-line p-7 ${
                i === 1 ? "bg-accent-soft" : "bg-surface"
              }`}
            >
              <s.icon size={32} weight="duotone" className="text-accent" />
              <h3 className="mt-4 font-display text-xl font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {s.body}
              </p>
            </div>
          ))}
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
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["small", "Haiku, mini, flash", "0.03 Wh / 1k tokens"],
            ["medium", "Sonnet, GPT-4o, ~70B", "0.19 Wh / 1k tokens"],
            ["frontier", "Opus, GPT-5, o3", "0.45 Wh / 1k tokens"],
          ].map(([cls, examples, factor]) => (
            <div key={cls} className="rounded-3xl border-2 border-line p-5">
              <p className="font-display text-lg font-bold">{cls}</p>
              <p className="mt-1 text-sm text-ink-muted">{examples}</p>
              <p className="mt-3 font-mono text-sm text-volt">{factor}</p>
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
