// `watthog connect [copilot]` and `watthog doctor` — the guided-onboarding
// commands. Everything else in watthog is read-only and zero-config; the one
// source that needs a credential is GitHub Copilot's premium-request billing,
// so this walks the user through getting a token, validates it, and saves it
// to watthog's own config so it's set once, not per shell.

import os from "node:os";
import readline from "node:readline/promises";
import { execFile } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

import * as copilot from "./sources/copilot.js";
import { saveConfig, configPath } from "./config.js";
import { ui, sourcesBlock } from "./report.js";

const { bold, dim, green, amber, cyan } = ui;

const PAT_URL = "https://github.com/settings/personal-access-tokens/new";

// Watthog's GitHub App (public client). Device flow exchanges this for a user
// access token carrying the "Plan: read" permission the billing API needs —
// no PAT, no client secret. https://github.com/settings/apps/watthog
const APP_CLIENT_ID = "Iv23linIaPrwWyEGpnSE";
const DEVICE_CODE_URL = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";

function openBrowser(url) {
  const cmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  return new Promise((resolve) => {
    execFile(cmd, [url], (err) => resolve(!err));
  });
}

// --- GitHub device flow ------------------------------------------------------

async function ghForm(url, params) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "watthog",
      },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(15000),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// Runs the full device flow and returns a user access token, or null if it
// couldn't be started or the user never authorized in time. Prints the code
// and a live "waiting" line; caller handles validation + saving.
async function deviceFlowToken() {
  const start = await ghForm(DEVICE_CODE_URL, { client_id: APP_CLIENT_ID });
  if (!start?.device_code || !start?.user_code) return null;

  const verifyUrl = start.verification_uri || "https://github.com/login/device";
  console.log(
    `  ${bold("1.")} Open ${cyan(verifyUrl)}` +
      ((await openBrowser(verifyUrl)) ? dim("  (opened for you)") : "")
  );
  console.log(`  ${bold("2.")} Enter this code:  ${bold(green(start.user_code))}`);
  console.log(`  ${bold("3.")} Click ${bold("Authorize")}.`);
  console.log();

  const deadline = Date.now() + (start.expires_in || 900) * 1000;
  let interval = (start.interval || 5) + 1; // +1s of slack over GitHub's floor
  process.stdout.write(dim("Waiting for you to authorize"));
  while (Date.now() < deadline) {
    await sleep(interval * 1000);
    process.stdout.write(dim("."));
    const data = await ghForm(ACCESS_TOKEN_URL, {
      client_id: APP_CLIENT_ID,
      device_code: start.device_code,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    });
    if (data?.access_token) {
      console.log();
      return data.access_token;
    }
    if (data?.error === "slow_down") interval += 5;
    else if (data?.error && data.error !== "authorization_pending") break;
  }
  console.log();
  return null;
}

// --- watthog connect ---------------------------------------------------------

export async function runConnect(source, { home = os.homedir() } = {}) {
  if (source && source !== "copilot") {
    console.error(
      `watthog connect: only "copilot" needs connecting — every other source ` +
        `is read locally with no setup.`
    );
    process.exitCode = 1;
    return;
  }

  console.log();
  console.log(bold("🐷 Connect GitHub Copilot billing"));
  console.log(
    dim(
      "Copilot keeps no token counts on your machine, so watthog reads your\n" +
        "premium-request history from GitHub's billing API, which needs your\n" +
        "permission to read your plan. Authorize once and you're done."
    )
  );
  console.log();

  // Maybe a token watthog can already see (gh, git, a prior connect) already
  // has the permission — no need to make the user do anything.
  process.stdout.write(dim("Checking for access watthog already has… "));
  const existing = await copilot.checkBilling(home);
  if (existing) {
    console.log(green("found some."));
    console.log(
      `  ${green("✓")} Billing already readable as ${bold("@" + existing.username)} ` +
        dim(`(via ${existing.label}).`)
    );
    if (existing.label !== "watthog config") {
      console.log(
        dim(
          `  Nothing to do — watthog will use it automatically. Run ` +
            `${cyan("watthog")} to see Copilot usage.`
        )
      );
    }
    console.log();
    return;
  }
  console.log(dim("none yet — let's authorize."));
  console.log();

  // Primary path: GitHub device flow. One "Authorize" click, no token to copy.
  const token = await deviceFlowToken();
  if (token) {
    process.stdout.write(dim("Verifying… "));
    const username = await copilot.probeToken(token);
    if (username) {
      console.log(green("done."));
      saveConfig(home, { githubToken: token });
      console.log();
      console.log(
        `  ${green("✓")} Connected as ${bold("@" + username)}. Saved to ${dim(configPath(home))}.`
      );
      console.log(dim(`  Run ${cyan("watthog")} — Copilot billing is in now.`));
      console.log();
      return;
    }
    // Authorized, but the endpoint won't return data — almost always means an
    // org/enterprise manages this account's Copilot (its usage lives on the
    // org endpoint, not the user one). A PAT won't change that.
    console.log(amber("authorized, but no billing visible."));
    console.log(
      dim(
        "That usually means your Copilot is billed through an organization or\n" +
          "enterprise — per-user billing isn't exposed for those accounts.\n" +
          "watthog will keep counting your local VS Code sessions."
      )
    );
    console.log();
    return;
  }

  // Fallback: manual fine-grained PAT (e.g. device flow blocked, or the user
  // prefers a token they control directly).
  console.log(amber("Couldn't finish the GitHub authorization."));
  console.log(dim("Falling back to a manual token.\n"));
  await manualPatFlow(home);
}

// Fine-grained PAT fallback: open the token page, take a pasted token, verify.
async function manualPatFlow(home) {
  const opened = await openBrowser(PAT_URL);
  console.log(
    opened ? `Opening ${cyan(PAT_URL)} …` : `Open ${cyan(PAT_URL)} in your browser.`
  );
  console.log("On that page:");
  console.log(`  ${bold("1.")} Give it any name and an expiry you like.`);
  console.log(
    `  ${bold("2.")} Under ${bold("Account permissions")} → ${bold("Plan")}, set ` +
      `access to ${bold("Read-only")}.`
  );
  console.log(`  ${bold("3.")} Click ${bold("Generate token")} and copy it.`);
  console.log();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    let token;
    try {
      token = (await rl.question("Paste your token here: ")).trim();
    } catch {
      // stdin closed (piped EOF, ^D) before a token arrived
      token = "";
    }
    if (!token) {
      console.log(dim("No token entered — nothing saved."));
      return;
    }

    process.stdout.write(dim("Verifying… "));
    const username = await copilot.probeToken(token);
    if (!username) {
      console.log(amber("that token can't read the billing report."));
      console.log(
        dim(
          'Make sure you set Account permissions → Plan → Read-only, then run ' +
            "`watthog connect copilot` again."
        )
      );
      process.exitCode = 1;
      return;
    }
    console.log(green("works."));

    saveConfig(home, { githubToken: token });
    console.log();
    console.log(
      `  ${green("✓")} Connected as ${bold("@" + username)}. Saved to ${dim(configPath(home))}.`
    );
    console.log(dim(`  Run ${cyan("watthog")} — Copilot billing is in now.`));
    console.log();
  } finally {
    rl.close();
  }
}

// Read-only status overview: what each source needs and whether it's ready.
// Like the report's SOURCES panel but without scanning any usage.
export async function runDoctor(sources, { home = os.homedir() } = {}) {
  const rows = [];
  for (const s of sources) {
    const available = s.available(home);
    if (!available) {
      rows.push({ name: s.name, state: "absent", detail: "not installed" });
      continue;
    }
    if (s.name === copilot.name) {
      const billing = await copilot.checkBilling(home);
      rows.push({
        name: s.name,
        state: "ok",
        detail: billing
          ? `local sessions + billing (@${billing.username}, via ${billing.label})`
          : "local sessions only",
        hint: billing
          ? undefined
          : "add premium-request billing — run `watthog connect copilot`",
      });
      continue;
    }
    rows.push({ name: s.name, state: "ok", detail: "ready" });
  }

  console.log();
  for (const l of sourcesBlock(rows)) console.log(l);
  console.log();
  console.log(dim(`Config: ${configPath(home)}`));
  console.log();
}
