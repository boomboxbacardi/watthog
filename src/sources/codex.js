// Reads Codex CLI session rollouts: ~/.codex/sessions/**/rollout-*.jsonl
// Token usage arrives as event_msg/token_count events carrying
// last_token_usage deltas; the active model comes from turn_context (or the
// session_meta line on older versions).

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";

export const name = "Codex CLI";

function sessionsDir(home) {
  return path.join(home, ".codex", "sessions");
}

export function available(home = os.homedir()) {
  return fs.existsSync(sessionsDir(home));
}

export async function collect(home = os.homedir()) {
  const files = [];
  walk(sessionsDir(home), files);

  const records = [];
  for (const file of files) {
    let model = "gpt-5";
    const rl = readline.createInterface({
      input: fs.createReadStream(file),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      const payload = entry.payload || entry;
      if (payload?.model) model = payload.model;
      const usage =
        payload?.info?.last_token_usage || payload?.last_token_usage;
      if (!usage) continue;
      records.push({
        source: name,
        model,
        ts: entry.timestamp ? Date.parse(entry.timestamp) : null,
        input: Math.max(
          0,
          (usage.input_tokens || 0) - (usage.cached_input_tokens || 0)
        ),
        output:
          (usage.output_tokens || 0) + (usage.reasoning_output_tokens || 0),
        cacheRead: usage.cached_input_tokens || 0,
        cacheWrite: 0,
      });
    }
  }
  return records;
}

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.startsWith("rollout-") && e.name.endsWith(".jsonl"))
      out.push(p);
  }
}
