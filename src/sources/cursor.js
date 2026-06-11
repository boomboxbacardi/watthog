// Reads Cursor usage.
//
// Cursor stopped writing per-message token counts to its local state database
// in early 2026 (the `tokenCount` fields are still present but always zero),
// so local data alone misses everything recent. Instead, the primary path
// asks Cursor's own dashboard API for the account's usage-event export — the
// same data shown on cursor.com/settings — authenticated with the session
// token Cursor itself stores in the local DB (`ItemTable` key
// `cursorAuth/accessToken`). Nothing is sent anywhere except to the user's
// own Cursor account endpoint. Results are cached for an hour.
//
// When the API is unreachable (offline, signed out, expired token) we fall
// back to scanning the local DB's `cursorDiskKV` bubbles, which cover usage
// up to ~Jan 2026: token counts in `bubbleId:<composerId>:<bubbleId>` blobs,
// the model attributed from the conversation's `composerData` modelConfig
// ("default" means Auto mode). The DB can be multiple GB, so extraction
// happens inside SQLite via json_extract and is cached on the DB's
// mtime+size. Read-only is safe alongside a running Cursor (WAL mode).

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

export const name = "Cursor";

const AUTO_MODEL = "auto (model hidden by Cursor)";
const USAGE_CSV_URL =
  "https://cursor.com/api/dashboard/export-usage-events-csv?strategy=tokens";
const API_CACHE_MS = 60 * 60 * 1000;

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

export async function collect(home = os.homedir()) {
  const fromApi = await collectFromApi(home);
  if (fromApi) return fromApi;
  return collectFromLocalDb(home);
}

// --- Primary path: Cursor's usage-event export -----------------------------

async function collectFromApi(home) {
  const cached = readCache(home, "cursor-api.json", (meta) => {
    return Date.now() - meta.fetchedAt < API_CACHE_MS;
  });
  if (cached) return cached;

  const cookie = sessionCookie(home);
  if (!cookie) return null;

  let csv;
  try {
    const res = await fetch(USAGE_CSV_URL, {
      headers: { Cookie: cookie, Referer: "https://www.cursor.com/settings" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    csv = await res.text();
  } catch {
    return null;
  }

  const rows = parseCsv(csv);
  if (!rows.length) return null;
  const col = Object.fromEntries(rows[0].map((h, i) => [h, i]));
  if (col["Output Tokens"] === undefined) return null;

  const records = [];
  for (const row of rows.slice(1)) {
    const num = (h) => Number(row[col[h]]) || 0;
    const input = num("Input (w/o Cache Write)");
    const cacheWrite = num("Input (w/ Cache Write)");
    const cacheRead = num("Cache Read");
    const output = num("Output Tokens");
    if (!input && !cacheWrite && !cacheRead && !output) continue;
    const rawModel = row[col["Model"]];
    records.push({
      source: name,
      model: !rawModel || rawModel === "auto" ? AUTO_MODEL : rawModel,
      ts: Date.parse(row[col["Date"]]) || null,
      input,
      output,
      cacheRead,
      cacheWrite,
    });
  }
  writeCache(home, "cursor-api.json", { fetchedAt: Date.now() }, records);
  return records;
}

// Cursor authenticates its dashboard with a WorkOS session cookie of the form
// <userId>%3A%3A<jwt>; the JWT is in the local DB and carries the user id in
// its `sub` claim ("auth0|user_...").
function sessionCookie(home) {
  const rows = readDb(
    dbPath(home),
    "SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken'"
  );
  const token = rows[0]?.value;
  if (!token) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString()
    );
    const userId = String(payload.sub).split("|").pop();
    return `WorkosCursorSessionToken=${userId}%3A%3A${token}`;
  } catch {
    return null;
  }
}

// Minimal CSV parser for the export format (quoted fields, no embedded
// newlines inside the values Cursor emits, but handle them anyway).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// --- Fallback path: legacy local token counts -------------------------------

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

function collectFromLocalDb(home) {
  const file = dbPath(home);

  // Scanning a multi-GB DB takes seconds, so results are cached and reused
  // until the DB file changes (mtime+size).
  const stat = fs.statSync(file);
  const key = `${stat.mtimeMs}:${stat.size}`;
  const cached = readCache(home, "cursor.json", (meta) => meta.key === key);
  if (cached) return cached;

  const records = extract(file);
  writeCache(home, "cursor.json", { key }, records);
  return records;
}

function extract(file) {
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
    const rawTs = b.ts ?? composer?.createdAt ?? null;
    const ts = typeof rawTs === "string" ? Date.parse(rawTs) || null : rawTs;
    records.push({
      source: name,
      model,
      ts,
      input,
      output,
      cacheRead: 0,
      cacheWrite: 0,
    });
  }
  return records;
}

// --- Shared plumbing ---------------------------------------------------------

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
    // cache is best-effort; the scan still worked
  }
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
      const out = execFileSync(
        "sqlite3",
        ["-json", `file:${file}?mode=ro`, query],
        {
          maxBuffer: 1024 * 1024 * 512,
          encoding: "utf8",
        }
      );
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
