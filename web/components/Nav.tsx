import Link from "next/link";
import { HogMark } from "./Hog";

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-line bg-surface/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2">
          <span className="inline-block transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 motion-reduce:transform-none">
            <HogMark size={34} />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">
            watthog
          </span>
        </Link>
        <div className="flex items-center gap-5 text-sm font-medium text-ink-muted sm:gap-7">
          <Link href="/trough" className="hover:text-ink">
            Leaderboard
          </Link>
          <Link href="/#method" className="hidden hover:text-ink sm:block">
            Method
          </Link>
          <a
            href="https://github.com/Boomboxbacardi/watthog"
            className="hover:text-ink"
          >
            GitHub
          </a>
        </div>
      </nav>
    </header>
  );
}
