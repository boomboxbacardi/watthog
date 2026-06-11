"use client";

// The hero teaching tool: drag a token count, watch the hog and the
// real-world equivalence respond. Uses the medium model class factor
// (0.19 Wh per 1k output tokens, see watthog CLI methodology).

import { useState } from "react";
import { Hog } from "./Hog";
import { fmtEquivalent, fmtWh, type Stage } from "@/lib/equivalence";

const WH_PER_1K_OUTPUT = 0.19;

const MARKS: { at: number; label: string }[] = [
  { at: 2.7, label: "one prompt" },
  { at: 4.7, label: "a coding session" },
  { at: 6.2, label: "a week with agents" },
  { at: 7.7, label: "an agent fleet, monthly" },
];

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}

export function EnergySlider() {
  const [exp, setExp] = useState(4.7);
  const tokens = Math.round(10 ** exp);
  const wh = (tokens / 1000) * WH_PER_1K_OUTPUT;
  // map the slider range onto hog stages so the pig visibly fattens
  const stage = (Math.min(5, Math.max(1, Math.ceil((exp - 2) / 1.2))) ||
    1) as Stage;
  const nearest = MARKS.reduce((a, b) =>
    Math.abs(b.at - exp) < Math.abs(a.at - exp) ? b : a
  );

  return (
    <div className="grid items-center gap-10 rounded-3xl border-2 border-line bg-surface-2/50 p-8 sm:p-12 md:grid-cols-2">
      <div>
        <h2 className="font-display text-3xl font-bold sm:text-4xl">
          What does a watt-hour even mean?
        </h2>
        <p className="mt-3 max-w-[45ch] text-ink-muted">
          Drag the tokens. The pig does the math.
        </p>

        <input
          type="range"
          min={2}
          max={8}
          step={0.01}
          value={exp}
          onChange={(e) => setExp(Number(e.target.value))}
          className="mt-8 w-full"
          aria-label="Number of generated tokens"
        />
        <div className="mt-2 flex justify-between font-mono text-xs text-ink-muted">
          <span>100 tokens</span>
          <span>100M tokens</span>
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-6">
          <div>
            <dt className="text-sm text-ink-muted">Tokens ({nearest.label})</dt>
            <dd className="font-mono text-2xl font-semibold">
              {fmtTokens(tokens)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Electricity</dt>
            <dd className="font-mono text-2xl font-semibold text-volt">
              {fmtWh(wh)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-col items-center text-center">
        <Hog stage={stage} size={260} />
        <p className="mt-4 font-display text-2xl font-bold">
          ≈ {fmtEquivalent(wh)}
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          assuming a mid-size model; frontier models run 2 to 3 times hotter
        </p>
      </div>
    </div>
  );
}
