// Leaderboard store. Backed by Upstash Redis in production (provisioned via
// the Vercel Marketplace; env vars KV_REST_API_URL / KV_REST_API_TOKEN).
// Falls back to an in-memory Map when those vars are absent, so `next dev`
// works with no credentials and tests stay hermetic.
//
// Layout in Redis:
//   hogger:<handle>   → JSON entry (one hash per hogger)
//   hoggers           → SET of lowercased handles, for getAll()

import { Redis } from "@upstash/redis";

export type HoggerEntry = {
  handle: string;
  kWhWeek: number;
  kWhAllTime: number;
  whPerDay: number;
  models: string[];
  updatedAt: string;
};

const INDEX_KEY = "hoggers";
const key = (handle: string) => `hogger:${handle.toLowerCase()}`;

// The Upstash Vercel integration sets KV_REST_API_* (not UPSTASH_REDIS_REST_*),
// so Redis.fromEnv() would miss them — wire the names explicitly.
const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;

type Store = {
  set(handle: string, entry: HoggerEntry): Promise<void>;
  get(handle: string): Promise<HoggerEntry | null>;
  getAll(): Promise<HoggerEntry[]>;
  delete(handle: string): Promise<void>;
};

function redisStore(redis: Redis): Store {
  return {
    async set(handle, entry) {
      const h = handle.toLowerCase();
      await Promise.all([
        redis.set(key(h), entry),
        redis.sadd(INDEX_KEY, h),
      ]);
    },

    async get(handle) {
      return (await redis.get<HoggerEntry>(key(handle))) ?? null;
    },

    async getAll() {
      const handles = await redis.smembers(INDEX_KEY);
      if (!handles.length) return [];
      const entries = await redis.mget<HoggerEntry[]>(
        ...handles.map((h) => key(h))
      );
      return entries.filter((e): e is HoggerEntry => e != null);
    },

    async delete(handle) {
      const h = handle.toLowerCase();
      await Promise.all([redis.del(key(h)), redis.srem(INDEX_KEY, h)]);
    },
  };
}

function memoryStore(): Store {
  const db = new Map<string, HoggerEntry>();
  return {
    async set(handle, entry) {
      db.set(handle.toLowerCase(), entry);
    },
    async get(handle) {
      return db.get(handle.toLowerCase()) ?? null;
    },
    async getAll() {
      return [...db.values()];
    },
    async delete(handle) {
      db.delete(handle.toLowerCase());
    },
  };
}

export const store: Store =
  url && token ? redisStore(new Redis({ url, token })) : memoryStore();
