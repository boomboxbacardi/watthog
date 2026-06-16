// Update notifier + self-upgrade.
//
// watthog is privacy-first — the only thing it ever sends is an opt-in
// leaderboard submit. The version check is the one passive network call, so it
// stays deliberately polite: a single HEAD-weight GET to the npm registry, a
// short timeout, results cached for a day, and total silence on any failure.
// Worst case it just doesn't nag you about a new release.

import os from "node:os";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { loadConfig, saveConfig } from "./config.js";
import { ui } from "./report.js";

const REGISTRY_URL = "https://registry.npmjs.org/watthog/latest";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // re-check the registry at most once a day

// --- version plumbing --------------------------------------------------------

let _version;
export function currentVersion() {
  if (_version !== undefined) return _version;
  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8")
    );
    _version = typeof pkg.version === "string" ? pkg.version : null;
  } catch {
    _version = null;
  }
  return _version;
}

function parseVersion(v) {
  // Drop a leading "v" and any -prerelease suffix; we only compare x.y.z.
  return String(v)
    .replace(/^v/, "")
    .split("-")[0]
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
}

// True when `a` is a strictly higher release than `b` (prerelease tags ignored).
export function isNewer(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if ((x[i] || 0) > (y[i] || 0)) return true;
    if ((x[i] || 0) < (y[i] || 0)) return false;
  }
  return false;
}

// --- the check ---------------------------------------------------------------

async function fetchLatest(timeoutMs) {
  try {
    const res = await fetch(REGISTRY_URL, {
      headers: { Accept: "application/json", "User-Agent": "watthog-cli" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

// Resolve { current, latest, hasUpdate } or null. Uses the day-old cache when
// it can so a typical run makes no network call at all; `force` (used by the
// `upgrade` command) always re-checks. Never throws.
export async function checkForUpdate({
  home = os.homedir(),
  force = false,
  timeoutMs = 2500,
} = {}) {
  const current = currentVersion();
  if (!current) return null;

  const cfg = loadConfig(home);
  const cached = cfg.updateCheck;
  let latest = cached?.latest || null;
  const fresh = cached?.at && Date.now() - cached.at < CACHE_TTL_MS;

  if (force || !fresh) {
    const fetched = await fetchLatest(timeoutMs);
    if (fetched) {
      latest = fetched;
      saveConfig(home, { updateCheck: { latest: fetched, at: Date.now() } });
    }
  }

  if (!latest) return null;
  return { current, latest, hasUpdate: isNewer(latest, current) };
}

// The banner shown under the report (and at the top of interactive mode) when a
// newer release exists. Inside the interactive shell the command is just
// `upgrade`; everywhere else it's `watthog upgrade`.
export function updateNotice({ current, latest }, { interactive = false } = {}) {
  const { bold, dim, amber, cyan, pink } = ui;
  const cmd = interactive ? cyan("upgrade") : cyan("watthog upgrade");
  return [
    "",
    `${pink("🐷")} ${bold("A fatter hog is available")} ` +
      dim(`— v${current} → `) +
      amber(`v${latest}`),
    `   ${dim("run")} ${cmd} ${dim("to feed it")}`,
    "",
  ].join("\n");
}

// --- the upgrade itself ------------------------------------------------------

// Guess how watthog was installed from the real path of this module, so the
// upgrade uses the matching package manager. Falls back to npm, which covers
// the overwhelming majority of installs.
export function upgradeCommand() {
  const p = fileURLToPath(import.meta.url).replace(/\\/g, "/");
  if (/\/(\.pnpm|pnpm-global|pnpm)\//.test(p))
    return { manager: "pnpm", cmd: "pnpm", args: ["add", "-g", "watthog@latest"] };
  if (/\/\.bun\//.test(p))
    return { manager: "bun", cmd: "bun", args: ["add", "-g", "watthog@latest"] };
  if (/\/(\.yarn|\.config\/yarn)\//.test(p))
    return { manager: "yarn", cmd: "yarn", args: ["global", "add", "watthog@latest"] };
  if (/\/(Cellar|homebrew|linuxbrew)\//.test(p))
    return { manager: "Homebrew", cmd: "brew", args: ["upgrade", "watthog"] };
  return { manager: "npm", cmd: "npm", args: ["install", "-g", "watthog@latest"] };
}

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      shell: process.platform === "win32", // npm/pnpm/etc. are .cmd shims on Windows
    });
    child.on("error", (err) => resolve({ ok: false, err }));
    child.on("close", (code) => resolve({ ok: code === 0, code }));
  });
}

// `watthog upgrade` — force a fresh check, then shell out to the detected
// package manager. Safe to run when already current (it just says so).
export async function runUpgrade({ home = os.homedir() } = {}) {
  const { bold, dim, green, amber, cyan } = ui;
  const current = currentVersion();

  console.log();
  process.stdout.write(dim("Checking npm for a fatter hog… "));
  const info = await checkForUpdate({ home, force: true });

  if (info && !info.hasUpdate) {
    console.log(green("you're current."));
    console.log(
      `  ${green("✓")} ${bold("watthog v" + current)} is the fattest hog available.`
    );
    console.log();
    return;
  }
  if (info) console.log(green(`v${info.latest} is out.`));
  else console.log(amber("couldn't reach npm — trying the upgrade anyway."));

  const { manager, cmd, args } = upgradeCommand();
  const line = [cmd, ...args].join(" ");
  console.log(dim(`  Detected ${manager}. Running `) + bold(line));
  console.log();

  const result = await run(cmd, args);

  console.log();
  if (result.ok) {
    console.log(
      `  ${green("✓")} ${bold("Upgraded.")} ${dim("run")} ${cyan("watthog")} ` +
        dim("to see the hog at its new weight.")
    );
  } else {
    console.log(amber("  The upgrade didn't finish cleanly."));
    console.log(dim("  Try it by hand: ") + bold(line));
    if (result.err) console.log(dim("  " + result.err.message));
    process.exitCode = 1;
  }
  console.log();
}
