"use client";

import { useState } from "react";
import { CopyIcon, CheckIcon } from "@phosphor-icons/react";

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

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
      className="group flex w-full max-w-md items-center justify-between gap-4 rounded-xl border-2 border-line bg-surface-2 px-5 py-4 text-left font-mono text-base transition-colors hover:border-accent active:scale-[0.98]"
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
    </button>
  );
}
