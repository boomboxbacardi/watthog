// Reads OpenCode usage. Newer versions store messages in a SQLite database
// (~/.local/share/opencode/opencode.db, table `message` with a JSON `data`
// column); older versions used JSON files under storage/message/. Both are
// supported. SQLite is read via node:sqlite, falling back to the sqlite3 CLI.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

export const name = "OpenCode";

function baseDir(home) {
  return path.join(home, ".local", "share", "opencode");
}

export function available(home = os.homedir()) {
  return fs.existsSync(baseDir(home));
}

export async function collect(home = os.homedir()) {
  const base = baseDir(home);
  const records = [];

  const dbPath = path.join(base, "opencode.db");
  if (fs.existsSync(dbPath)) {
    for (const row of readDb(dbPath)) {
      const rec = toRecord(row.data, row.time_created);
      if (rec) records.push(rec);
    }
  }

  // Legacy file-based storage: storage/message/<session>/<msg>.json
  const msgRoot = path.join(base, "storage", "message");
  if (fs.existsSync(msgRoot)) {
    for (const session of safeReaddir(msgRoot)) {
      const dir = path.join(msgRoot, session);
      for (const f of safeReaddir(dir)) {
        if (!f.endsWith(".json")) continue;
        try {
          const rec = toRecord(fs.readFileSync(path.join(dir, f), "utf8"));
          if (rec) records.push(rec);
        } catch {
          // unreadable file — skip
        }
      }
    }
  }
  return records;
}

const QUERY =
  "SELECT data, time_created FROM message WHERE data LIKE '%\"role\":\"assistant\"%'";

function readDb(dbPath) {
  try {
    const { DatabaseSync } = requireNodeSqlite();
    const db = new DatabaseSync(dbPath, { readOnly: true });
    const rows = db.prepare(QUERY).all();
    db.close();
    return rows;
  } catch {
    try {
      const out = execFileSync("sqlite3", ["-json", dbPath, QUERY], {
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

function toRecord(json, fallbackTs = null) {
  let data;
  try {
    data = typeof json === "string" ? JSON.parse(json) : json;
  } catch {
    return null;
  }
  if (data.role !== "assistant" || !data.tokens || !data.modelID) return null;
  const t = data.tokens;
  return {
    source: name,
    model: data.modelID,
    ts: data.time?.created ?? fallbackTs ?? null,
    input: t.input || 0,
    output: (t.output || 0) + (t.reasoning || 0),
    cacheRead: t.cache?.read || 0,
    cacheWrite: t.cache?.write || 0,
  };
}

function safeReaddir(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}
