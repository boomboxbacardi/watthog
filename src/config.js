// watthog's own config file: ~/.config/watthog/config.json (XDG-aware,
// %APPDATA%\watthog on Windows). Holds anything the user shouldn't have to
// re-enter every shell — today just the GitHub billing token saved by
// `watthog connect copilot`, so it survives instead of living in a one-shot
// WATTHOG_GITHUB_TOKEN export.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function configRoot(home) {
  if (process.env.XDG_CONFIG_HOME) return process.env.XDG_CONFIG_HOME;
  if (process.platform === "win32") {
    return process.env.APPDATA || path.join(home, "AppData", "Roaming");
  }
  return path.join(home, ".config");
}

export function configPath(home = os.homedir()) {
  return path.join(configRoot(home), "watthog", "config.json");
}

export function loadConfig(home = os.homedir()) {
  try {
    const data = JSON.parse(fs.readFileSync(configPath(home), "utf8"));
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

export function saveConfig(home = os.homedir(), patch = {}) {
  const file = configPath(home);
  const next = { ...loadConfig(home), ...patch };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // 0600: the file can hold a token.
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n", { mode: 0o600 });
  return next;
}
