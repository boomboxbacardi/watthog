"use client";

// The global counter strip. Digits roll odometer-style, and on every tick a
// toast slice arcs into the hog's mouth: the signature animation from
// DESIGN.md, used wherever numbers go up.

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Hog } from "./Hog";
import { ToastDoodle } from "./Doodles";
import { fmtEquivalent } from "@/lib/equivalence";
import { GLOBAL_KWH } from "@/lib/mock";

const SPRING = { type: "spring", stiffness: 80, damping: 16 } as const;

function Digit({ d }: { d: number }) {
  return (
    <span className="inline-block h-[1em] overflow-hidden align-baseline leading-none">
      <motion.span
        className="flex flex-col"
        animate={{ y: `${-d}em` }}
        transition={SPRING}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="h-[1em] leading-none">
            {i}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

function Odometer({ value }: { value: string }) {
  return (
    <span className="font-mono leading-none text-volt" aria-label={`${value} kilowatt hours`}>
      <span aria-hidden>
        {value.split("").map((ch, i) =>
          /\d/.test(ch) ? <Digit key={i} d={Number(ch)} /> : <span key={i}>{ch}</span>
        )}
      </span>
    </span>
  );
}

function fmtKwh(wh: number): string {
  return (wh / 1000).toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function GlobalTrough({
  initialWh = 0,
  live = false,
}: {
  initialWh?: number;
  live?: boolean;
}) {
  const reduce = useReducedMotion();
  // Before any hogger has submitted, show the sample figure so the strip never
  // reads a lonely "0.0". Once real submissions exist, the seed is the truth.
  const seed = live && initialWh > 0 ? initialWh : GLOBAL_KWH * 1000;
  const [wh, setWh] = useState(seed);
  const [tick, setTick] = useState(0);
  const [eating, setEating] = useState(false);

  // Live mode: poll the real total and roll the odometer toward it. Sample
  // mode (pre-launch): a gentle simulated drift so the strip still feels alive.
  useEffect(() => {
    if (!live) {
      const id = setInterval(() => {
        setWh((w) => w + 40 + Math.random() * 260);
        setTick((t) => t + 1);
      }, 4200);
      return () => clearInterval(id);
    }
    let stop = false;
    async function poll() {
      try {
        const res = await fetch("/api/global", { cache: "no-store" });
        if (!res.ok) return;
        const { totalWh } = await res.json();
        if (stop || typeof totalWh !== "number") return;
        setWh((prev) => {
          if (totalWh > prev) setTick((t) => t + 1); // a hog ate: feed animation
          return totalWh > 0 ? totalWh : prev;
        });
      } catch {
        // offline or transient; keep the last good number
      }
    }
    const id = setInterval(poll, 30000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [live]);

  useEffect(() => {
    if (tick === 0 || reduce) return;
    const open = setTimeout(() => setEating(true), 450);
    const close = setTimeout(() => setEating(false), 1050);
    return () => {
      clearTimeout(open);
      clearTimeout(close);
    };
  }, [tick, reduce]);

  return (
    <section className="border-y-2 border-line bg-volt-soft/50">
      <div className="mx-auto max-w-6xl px-4 py-12 text-center sm:px-6">
        <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">
          The global trough
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <p className="font-display text-3xl font-bold sm:text-4xl">
            All hogs together have eaten{" "}
            {reduce ? (
              <span className="font-mono text-volt">{fmtKwh(wh)}</span>
            ) : (
              <Odometer value={fmtKwh(wh)} />
            )}{" "}
            kWh
          </p>
          <span className="relative inline-block">
            {!reduce && (
              <AnimatePresence>
                <motion.span
                  key={tick}
                  aria-hidden
                  className="absolute -left-10 top-0"
                  initial={{ x: -28, y: -26, rotate: -30, opacity: 0, scale: 0.7 }}
                  animate={{
                    x: [-28, -6, 14],
                    y: [-26, -34, -2],
                    rotate: [-30, 10, 40],
                    opacity: [0, 1, 0],
                    scale: [0.7, 1, 0.5],
                  }}
                  transition={{ duration: 0.9, delay: 0.15, ease: "easeIn" }}
                >
                  <ToastDoodle size={30} />
                </motion.span>
              </AnimatePresence>
            )}
            <Hog stage={2} size={86} eating={eating} className="text-ink" />
          </span>
        </div>
        <p className="mt-1 text-ink-muted">
          ≈ {fmtEquivalent(wh)}
          {live ? "" : " (sample figure until launch)"}
        </p>
      </div>
    </section>
  );
}
