"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CopyIcon, CheckIcon } from "@phosphor-icons/react";
import { ToastDoodle } from "./Doodles";

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const reduce = useReducedMotion();

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable (permissions, http): leave the text selectable
    }
  }

  return (
    <button
      onClick={copy}
      className="group relative flex w-full max-w-md items-center justify-between gap-4 rounded-xl border-2 border-line bg-surface-2 px-5 py-4 text-left font-mono text-base transition-colors hover:border-accent active:scale-[0.98]"
      aria-label={`Copy command ${command}`}
    >
      <span>
        <span className="select-none text-ink-muted">$ </span>
        {command}
      </span>
      {copied ? (
        <CheckIcon size={20} weight="bold" className="shrink-0 text-accent" />
      ) : (
        <CopyIcon
          size={20}
          weight="bold"
          className="shrink-0 text-ink-muted group-hover:text-accent"
        />
      )}
      {/* copying feeds the hog: a toast pops out as feedback */}
      {!reduce && (
        <AnimatePresence>
          {copied && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute -top-2 right-4"
              initial={{ opacity: 0, y: 4, scale: 0.5, rotate: -14 }}
              animate={{ opacity: 1, y: -18, scale: 1, rotate: 10 }}
              exit={{ opacity: 0, y: -30, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
            >
              <ToastDoodle size={26} />
            </motion.span>
          )}
        </AnimatePresence>
      )}
    </button>
  );
}
