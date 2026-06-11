// `watthog connect [copilot]` and `watthog doctor` — the guided-onboarding
// commands. Everything else in watthog is read-only and zero-config; the one
// source that needs a credential is GitHub Copilot's premium-request billing,
// so this walks the user through getting a token, validates it, and saves it
// to watthog's own config so it's set once, not per shell.

import os from "node:os";
import readline from "node:readline/promises";
import { execFile } from "node:child_process";

import * as copilot from "./sources/copilot.js";
import { saveConfig, configPath } from "./config.js";
import { ui, sourcesBlock } from "./report.js";

const { bold, dim, green, amber, cyan } = ui;

const PAT_URL = "https://github.com/settings/personal-access-tokens/new";

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
        "premium-request history from GitHub's billing API. That needs a token\n" +
        'with the "Plan: read" permission.'
    )
  );
  console.log();

  // Maybe a token watthog can already see (gh, git, a prior connect) already
  // has the permission — no need to make the user do anything.
  process.stdout.write(dim("Checking for a token that already works… "));
  const existing = await copilot.checkBilling(home);
  if (existing) {
    console.log(green("found one."));
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
  console.log(dim("none yet."));
  console.log();

  const opened = await openBrowser(PAT_URL);
  console.log(
    opened
      ? `Opening ${cyan(PAT_URL)} …`
      : `Open ${cyan(PAT_URL)} in your browser.`
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
