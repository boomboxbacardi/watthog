// Reads Cursor usage from its local state database
// (~/Library/Application Support/Cursor/User/globalStorage/state.vscdb on
// macOS, ~/.config/Cursor/... on Linux, %APPDATA%/Cursor/... on Windows).
//
// Token counts live in the `cursorDiskKV` table as JSON blobs keyed
// `bubbleId:<composerId>:<bubbleId>`, each with a `tokenCount`
// { inputTokens, outputTokens } and usually a `timingInfo.clientStartTime`.
// The model is not stored per bubble; `composerData:<composerId>` carries the
// conversation's `modelConfig.modelName`, which we attribute to all of its
// bubbles. "default" means Auto mode (Cursor picks the model and hides it).
// Cache reads/writes are not exposed locally, so they count as zero.
//
// The DB can be multiple GB, so extraction happens inside SQLite via
// json_extract instead of parsing blobs in JS. Read-only is safe alongside a
// running Cursor (WAL mode).

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

export const name = "Cursor";

const AUTO_MODEL = "auto (model hidden by Cursor)";

function dbPath(home, platform = process.platform) {
  const root =
    platform === "darwin"
      ? path.join(home, "Library", "Application Support")
      : platform === "win32"
        ? process.env.APPDATA || path.join(home, "AppData", "Roaming")
        : process.env.XDG_CONFIG_HOME || path.join(home, ".config");
  return path.join(root, "Cursor", "User", "globalStorage", "state.vscdb");
}

export function available(home = os.homedir()) {
  return fs.existsSync(dbPath(home));
}

const BUBBLE_QUERY = `
  SELECT substr(key, 10, instr(substr(key, 10), ':') - 1) AS composerId,
         json_extract(value, '$.tokenCount.inputTokens') AS input,
         json_extract(value, '$.tokenCount.outputTokens') AS output,
         json_extract(value, '$.timingInfo.clientStartTime') AS ts
  FROM cursorDiskKV
  WHERE key LIKE 'bubbleId:%' AND value LIKE '%"tokenCount"%'`;

const COMPOSER_QUERY = `
  SELECT substr(key, 14) AS composerId,
         json_extract(value, '$.modelConfig.modelName') AS model,
         json_extract(value, '$.createdAt') AS createdAt
  FROM cursorDiskKV
  WHERE key LIKE 'composerData:%'`;

export async function collect(home = os.homedir()) {
  const file = dbPath(home);
  const bubbles = readDb(file, BUBBLE_QUERY);
  if (!bubbles.length) return [];

  const composers = new Map(
    readDb(file, COMPOSER_QUERY).map((c) => [c.composerId, c])
  );

  const records = [];
  for (const b of bubbles) {
    const input = b.input || 0;
    const output = b.output || 0;
    if (!input && !output) continue;
    const composer = composers.get(b.composerId);
    let model = composer?.model;
    if (!model || model === "default") model = AUTO_MODEL;
    records.push({
      source: name,
      model,
      ts: b.ts ?? composer?.createdAt ?? null,
      input,
      output,
      cacheRead: 0,
      cacheWrite: 0,
    });
  }
  return records;
}

function readDb(file, query) {
  try {
    const { DatabaseSync } = requireNodeSqlite();
    const db = new DatabaseSync(file, { readOnly: true });
    const rows = db.prepare(query).all();
    db.close();
    return rows;
  } catch {
    try {
      const out = execFileSync("sqlite3", ["-json", `file:${file}?mode=ro`, query], {
        maxBuffer: 1024 * 1024 * 512,
        encoding: "utf8",
      });
      return out.trim() ? JSON.parse(out) : [];
    } catch {
      return [];
    }
  }
}

function requireNodeSqlite() {
  // Loaded lazily so the module works on Node builds without node:sqlite.
  return process.getBuiltinModule("node:sqlite");
}
