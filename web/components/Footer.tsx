import Link from "next/link";
import { Hog } from "./Hog";

export function Footer() {
  return (
    <footer className="border-t-2 border-line bg-surface-2/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-12 sm:flex-row sm:justify-between sm:px-6">
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <div className="relative">
            <Hog stage={1} size={76} sleeping className="text-ink" />
            <span aria-hidden className="zz absolute -top-1 right-1 font-display text-sm font-bold text-accent">
              z
            </span>
            <span
              aria-hidden
              className="zz absolute -top-4 -right-1 font-display text-xs font-bold text-accent"
              style={{ animationDelay: "1s" }}
            >
              z
            </span>
            <span
              aria-hidden
              className="zz absolute -top-6 -right-3 font-display text-[10px] font-bold text-accent"
              style={{ animationDelay: "2s" }}
            >
              z
            </span>
          </div>
          <p className="text-sm text-ink-muted">
            All figures are estimates with ranges. The hog is not a scientist.
          </p>
        </div>
        <div className="flex gap-6 text-sm font-medium text-ink-muted">
          <Link href="/#method" className="hover:text-ink">
            Method
          </Link>
          <a
            href="https://github.com/Boomboxbacardi/watthog"
            className="hover:text-ink"
          >
            GitHub
          </a>
          <Link href="/trough" className="hover:text-ink">
            Leaderboard
          </Link>
        </div>
      </div>
    </footer>
  );
}
