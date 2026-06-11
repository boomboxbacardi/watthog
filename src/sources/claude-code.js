// Reads Claude Code conversation logs: ~/.claude/projects/**/*.jsonl
// Each assistant message line carries message.usage with token counts.
// The same message id can appear on multiple lines (one per content block),
// so records are deduplicated on message.id + requestId.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";

export const name = "Claude Code";

export function available(home = os.homedir()) {
  return fs.existsSync(path.join(home, ".claude", "projects"));
}

export async function collect(home = os.homedir()) {
  const root = path.join(home, ".claude", "projects");
  const files = [];
  for (const project of safeReaddir(root)) {
    const dir = path.join(root, project);
    for (const f of safeReaddir(dir)) {
      if (f.endsWith(".jsonl")) files.push(path.join(dir, f));
    }
  }

  const records = [];
  const seen = new Set();
  for (const file of files) {
    const rl = readline.createInterface({
      input: fs.createReadStream(file),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      if (!line.includes('"usage"')) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      if (entry.type !== "assistant") continue;
      const msg = entry.message;
      const usage = msg?.usage;
      if (!usage || !msg.model || msg.model === "<synthetic>") continue;
      const key = `${msg.id}:${entry.requestId}`;
      if (msg.id && seen.has(key)) continue;
      seen.add(key);
      records.push({
        source: name,
        model: msg.model,
        ts: entry.timestamp ? Date.parse(entry.timestamp) : null,
        input: usage.input_tokens || 0,
        output: usage.output_tokens || 0,
        cacheRead: usage.cache_read_input_tokens || 0,
        cacheWrite: usage.cache_creation_input_tokens || 0,
      });
    }
  }
  return records;
}

function safeReaddir(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}
