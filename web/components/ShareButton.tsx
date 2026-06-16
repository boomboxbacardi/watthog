"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { XLogoIcon, LinkIcon, CheckIcon } from "@phosphor-icons/react";
import { ToastDoodle } from "./Doodles";

// The share moment. Primary action is a pre-composed post — the number and
// the rank are already written, so the hogger just hits send. Copy-link stays
// as a no-account fallback. `text` is the post body; `url` defaults to the
// current page (the hogger's own /u/<handle> card with its OG image).
export function ShareButton({
  text,
  url,
  label = "Share my hog",
}: {
  text?: string;
  url?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const reduce = useReducedMotion();

  function here() {
    return url ?? (typeof window !== "undefined" ? window.location.href : "");
  }

  function shareOnX() {
    const intent =
      "https://x.com/intent/tweet?text=" +
      encodeURIComponent(text ?? "My hog on @watthog's Trough 🐷⚡") +
      "&url=" +
      encodeURIComponent(here());
    window.open(intent, "_blank", "noopener,noreferrer");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(here());
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked; the URL bar still has the link
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={shareOnX}
        className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-semibold text-white transition-transform active:scale-[0.98]"
      >
        <XLogoIcon size={18} weight="bold" />
        {label}
      </button>

      <button
        onClick={copy}
        className="group relative inline-flex items-center gap-2 rounded-full border-2 border-line px-4 py-2 font-semibold text-ink-muted transition-colors hover:text-ink active:scale-[0.98]"
      >
        {copied ? (
          <CheckIcon size={18} weight="bold" />
        ) : (
          <LinkIcon size={18} weight="bold" />
        )}
        {copied ? "Copied" : "Copy link"}
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
    </div>
  );
}
