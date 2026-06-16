"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { LinkIcon, CheckIcon } from "@phosphor-icons/react";
import { ToastDoodle } from "./Doodles";

// Copies the current page URL so a hogger can paste their trough card anywhere.
export function ShareButton({ label = "Copy link" }: { label?: string }) {
  const [copied, setCopied] = useState(false);
  const reduce = useReducedMotion();

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked; the URL bar still has the link
    }
  }

  return (
    <button
      onClick={copy}
      className="group relative inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-semibold text-white transition-transform active:scale-[0.98]"
    >
      {copied ? (
        <CheckIcon size={18} weight="bold" />
      ) : (
        <LinkIcon size={18} weight="bold" />
      )}
      {copied ? "Copied" : label}
      {!reduce && (
        <AnimatePresence>
          {copied && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute -top-1 right-3"
              initial={{ opacity: 0, y: 4, scale: 0.5, rotate: -14 }}
              animate={{ opacity: 1, y: -18, scale: 1, rotate: 10 }}
              exit={{ opacity: 0, y: -30, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
            >
              <ToastDoodle size={24} />
            </motion.span>
          )}
        </AnimatePresence>
      )}
    </button>
  );
}
