"use client";

// A real render of what `npx watthog` actually prints (condensed from a live
// run), revealed line by line on scroll so the section tells the story of
// running the command. Not a fake dashboard: this is the product.

import { motion, useReducedMotion } from "motion/react";

type Line = {
  text: string;
  tone?: "cmd" | "bold" | "dim" | "volt";
};

const LINES: Line[] = [
  { text: "$ npx watthog", tone: "cmd" },
  { text: "" },
  { text: "🐷 watthog · estimated electricity use of your LLMs", tone: "bold" },
  { text: "9,419 assistant messages · Claude Code, OpenCode", tone: "dim" },
  { text: "" },
  { text: "TOTAL ESTIMATE", tone: "bold" },
  { text: "  Energy  11 kWh    range 4.0 - 32 kWh" },
  { text: "  CO2e    4.6 kg    Water  12.6 L" },
  { text: "  ≈ 953 phone charges · 11 dishwasher runs", tone: "volt" },
  { text: "" },
  { text: "LAST 14 DAYS", tone: "bold" },
  { text: "  06-07  ████████████████████████ 713 Wh", tone: "volt" },
  { text: "  06-08  ████████████████████ 582 Wh", tone: "volt" },
  { text: "  06-09  ███████████████████████ 697 Wh", tone: "volt" },
  { text: "  06-10  ████ 118 Wh", tone: "volt" },
  { text: "  06-11  ███ 97 Wh", tone: "volt" },
  { text: "" },
  { text: "Estimates only. The hog is not a scientist.", tone: "dim" },
];

const TONE: Record<NonNullable<Line["tone"]>, string> = {
  cmd: "text-accent",
  bold: "font-semibold text-zinc-100",
  dim: "text-zinc-500",
  volt: "text-[#f5b82e]",
};

export function TerminalDemo() {
  const reduce = useReducedMotion();

  return (
    <div className="overflow-hidden rounded-3xl border-2 border-zinc-700 bg-zinc-900 shadow-[0_18px_48px_-20px_rgba(28,25,23,0.45)]">
      <div className="border-b border-zinc-700/70 px-5 py-2.5 font-mono text-xs text-zinc-500">
        ~ watthog
      </div>
      <div className="overflow-x-auto px-5 py-4">
        {LINES.map((l, i) => (
          <motion.pre
            key={i}
            initial={reduce ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.25, delay: i * 0.09 }}
            className={`font-mono text-[12.5px] leading-[1.6] sm:text-[13px] ${
              l.tone ? TONE[l.tone] : "text-zinc-300"
            }`}
          >
            {l.text || " "}
          </motion.pre>
        ))}
      </div>
    </div>
  );
}
