// Reads GitHub Copilot usage.
//
// Copilot keeps no token counts on disk at all — VS Code's chat sessions and
// the extension logs carry zero usage numbers — so the only record of what
// you used is GitHub's own billing data. This source asks the REST API for
// the premium-request usage report (the same numbers as Settings → Billing →
// Premium request usage): per-model request counts, by day for the current
// month and by month for the year before that.
//
// Auth needs a GitHub token with the "Plan: read" permission (fine-grained
// PAT) — the tokens VS Code/git already hold don't carry billing access, so
// the user has to provide one. Candidates are tried in order: the
// WATTHOG_GITHUB_TOKEN env var, `gh auth token`, the git credential helper,
// and ~/.config/github-copilot. Nothing is sent anywhere except
// api.github.com; results are cached for an hour.
//
// GitHub bills requests, not tokens, so token counts are estimated: one
// premium request is one user prompt in chat/agent mode, normalized so that
// 1 unit = one interaction with a 1x frontier model (model multipliers are
// already folded into the billed quantity). Across watthog's token-accurate
// sources a coding-agent prompt averages a handful of model calls totalling
// on the order of 1–2k output tokens, a few thousand fresh input tokens and
// tens of thousands of cached-context reads — those are the per-unit
// estimates used here. Usage of 0x "included" models (the free base models)
// never reaches billing and is invisible to this source.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

export const name = "GitHub Copilot";

const API = "https://api.github.com";
const API_CACHE_MS = 60 * 60 * 1000;
const MONTHS_BACK = 12;

// Estimated tokens per billed premium-request unit (see header).
const PER_REQUEST = { input: 5000, output: 1500, cacheRead: 25000 };

function copilotChatDir(home, platform = process.platform) {
  const root =
    platform === "darwin"
      ? path.join(home, "Library", "Application Support")
      : platform === "win32"
        ? process.env.APPDATA || path.join(home, "AppData", "Roaming")
        : process.env.XDG_CONFIG_HOME || path.join(home, ".config");
  return path.join(root, "Code", "User", "globalStorage", "github.copilot-chat");
}

export function available(home = os.homedir()) {
  return (
    Boolean(process.env.WATTHOG_GITHUB_TOKEN) ||
    fs.existsSync(copilotChatDir(home)) ||
    fs.existsSync(path.join(home, ".config", "github-copilot"))
  );
}

export async function collect(home = os.homedir()) {
  const cached = readCache(home, "copilot-api.json", (meta) => {
    return Date.now() - meta.fetchedAt < API_CACHE_MS;
  });
  if (cached) return cached;

  const auth = await authenticate(home);
  if (!auth) {
    console.error(
      "watthog: GitHub Copilot keeps no token counts locally, and your usage\n" +
        "couldn't be fetched from GitHub's billing API. Create a fine-grained\n" +
        'PAT with the "Plan: read" account permission (github.com/settings/\n' +
        "personal-access-tokens) and export it as WATTHOG_GITHUB_TOKEN —\n" +
        "Copilot usage is missing from the totals until then."
    );
    return [];
  }

  const records = await fetchUsage(auth);
  writeCache(home, "copilot-api.json", { fetchedAt: Date.now() }, records);
  return records;
}

// --- GitHub billing API ------------------------------------------------------

async function fetchUsage({ token, username }) {
  const now = new Date();
  const periods = [];

  // Current month day by day (daily resolution drives the 7-day average and
  // the hog's growth stage)...
  for (let day = 1; day <= now.getUTCDate(); day++) {
    periods.push({
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
      day,
    });
  }
  // ...and one query per earlier month, spread evenly across its days.
  for (let back = 1; back <= MONTHS_BACK; back++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    periods.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  }

  const results = await Promise.all(
    periods.map((p) => fetchPeriod(token, username, p))
  );

  const records = [];
  for (let i = 0; i < periods.length; i++) {
    const { year, month, day } = periods[i];
    for (const item of results[i]) {
      const units = Number(item.grossQuantity) || 0;
      if (!(units > 0)) continue;
      const model = item.model || "unknown";
      if (day) {
        records.push(record(model, units, Date.UTC(year, month - 1, day, 12)));
      } else {
        // Monthly totals carry no dates; spreading them across the month
        // keeps daily averages sane instead of faking a one-day spike.
        const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
        for (let d = 1; d <= days; d++) {
          records.push(
            record(model, units / days, Date.UTC(year, month - 1, d, 12))
          );
        }
      }
    }
  }
  return records;
}

function record(model, units, ts) {
  return {
    source: name,
    model,
    ts,
    input: units * PER_REQUEST.input,
    output: units * PER_REQUEST.output,
    cacheRead: units * PER_REQUEST.cacheRead,
    cacheWrite: 0,
  };
}

async function fetchPeriod(token, username, { year, month, day }) {
  const params = new URLSearchParams({ year, month });
  if (day) params.set("day", day);
  const data = await api(
    token,
    `/users/${username}/settings/billing/premium_request/usage?${params}`
  );
  return data?.usageItems ?? [];
}

async function api(token, route) {
  try {
    const res = await fetch(API + route, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "watthog",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// --- Token discovery ---------------------------------------------------------

// Returns { token, username } for the first candidate token that can actually
// read the billing report (most tokens on a dev machine lack "Plan: read",
// and the API answers 404 — not 403 — when permission is missing).
async function authenticate(home) {
  for (const token of candidateTokens(home)) {
    const user = await api(token, "/user");
    if (!user?.login) continue;
    const probe = await api(
      token,
      `/users/${user.login}/settings/billing/premium_request/usage`
    );
    if (probe) return { token, username: user.login };
  }
  return null;
}

function* candidateTokens(home) {
  const seen = new Set();
  const emit = (t) => {
    t = t?.trim();
    if (!t || seen.has(t)) return null;
    seen.add(t);
    return t;
  };

  if (process.env.WATTHOG_GITHUB_TOKEN) {
    const t = emit(process.env.WATTHOG_GITHUB_TOKEN);
    if (t) yield t;
  }

  try {
    const t = emit(execFileSync("gh", ["auth", "token"], { encoding: "utf8" }));
    if (t) yield t;
  } catch {
    // gh missing or signed out
  }

  try {
    const out = execFileSync("git", ["credential", "fill"], {
      input: "protocol=https\nhost=github.com\n\n",
      encoding: "utf8",
    });
    const t = emit(out.match(/^password=(.+)$/m)?.[1]);
    if (t) yield t;
  } catch {
    // no credential helper
  }

  // Copilot's own OAuth token (written by Copilot CLI / JetBrains / Neovim).
  for (const file of ["apps.json", "hosts.json"]) {
    try {
      const data = JSON.parse(
        fs.readFileSync(
          path.join(home, ".config", "github-copilot", file),
          "utf8"
        )
      );
      for (const entry of Object.values(data)) {
        const t = emit(entry?.oauth_token);
        if (t) yield t;
      }
    } catch {
      // file missing or unreadable
    }
  }
}

// --- Cache (mirrors cursor.js) -----------------------------------------------

function cachePath(home, filename) {
  const root =
    process.env.XDG_CACHE_HOME ||
    (process.platform === "darwin"
      ? path.join(home, "Library", "Caches")
      : path.join(home, ".cache"));
  return path.join(root, "watthog", filename);
}

function readCache(home, filename, isFresh) {
  try {
    const { meta, records } = JSON.parse(
      fs.readFileSync(cachePath(home, filename), "utf8")
    );
    return meta && Array.isArray(records) && isFresh(meta) ? records : null;
  } catch {
    return null;
  }
}

function writeCache(home, filename, meta, records) {
  try {
    const file = cachePath(home, filename);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ meta, records }));
  } catch {
    // cache is best-effort
  }
}
