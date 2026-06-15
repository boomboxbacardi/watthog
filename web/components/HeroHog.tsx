"use client";

// The hero scene: a hog on a pile of toast whose pupils follow the cursor,
// with the occasional blink. Pupils are driven by motion values mapped to
// CSS variables, so nothing re-renders while the pig watches you.

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "motion/react";
import { Hog } from "./Hog";
import { ToastDoodle, SparkDoodle, TroughDoodle } from "./Doodles";

export function HeroHog() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 150, damping: 18 });
  const sy = useSpring(py, { stiffness: 150, damping: 18 });
  const pupilX = useTransform(sx, (v) => `${v}px`);
  const pupilY = useTransform(sy, (v) => `${v}px`);
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (reduce) return;
    function onMove(e: PointerEvent) {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height * 0.45);
      const len = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, len / 200);
      px.set((dx / len) * 4.5 * reach);
      py.set((dy / len) * 3.5 * reach);
    }
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduce, px, py]);

  useEffect(() => {
    if (reduce) return;
    let open: ReturnType<typeof setTimeout>;
    let shut: ReturnType<typeof setTimeout>;
    function schedule() {
      shut = setTimeout(() => {
        setBlink(true);
        open = setTimeout(() => {
          setBlink(false);
          schedule();
        }, 140);
      }, 2600 + Math.random() * 3400);
    }
    schedule();
    return () => {
      clearTimeout(open);
      clearTimeout(shut);
    };
  }, [reduce]);

  return (
    <div ref={ref} className="relative flex justify-center">
      {/* soft blob ground */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-[105%] w-[110%] -translate-x-1/2 -translate-y-[46%] bg-accent-soft"
        style={{ borderRadius: "46% 54% 52% 48% / 56% 48% 52% 44%" }}
      />
      <SparkDoodle size={30} className="absolute left-[8%] top-[6%] -rotate-12" />
      <SparkDoodle size={22} className="absolute right-[10%] top-[22%] rotate-12" />
      <motion.div
        className="relative"
        style={
          {
            "--pupil-x": pupilX,
            "--pupil-y": pupilY,
          } as React.CSSProperties
        }
      >
        <Hog stage={3} size={330} blink={blink} className="text-ink" />
      </motion.div>
      {/* the trough, served snout-side, with toast heaped over the rim */}
      <div aria-hidden className="absolute bottom-[0%] right-[4%] flex flex-col items-center">
        <div className="relative flex items-end">
          <ToastDoodle size={30} className="relative z-10 -mb-2 -rotate-12" />
          <ToastDoodle size={40} className="relative z-10 -ml-3 -mb-3 rotate-6" />
          <ToastDoodle size={28} className="relative z-10 -ml-2 -mb-1 rotate-12" />
        </div>
        <TroughDoodle size={120} className="-mt-3 text-ink" />
      </div>
    </div>
  );
}
