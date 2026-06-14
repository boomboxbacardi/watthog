// Leaderboard store abstraction. Currently in-memory (resets on cold start).
// To persist: replace with @vercel/kv calls — interface is identical.
//
// kv.set(`hogger:${handle}`, JSON.stringify(entry))
// kv.get(`hogger:${handle}`) → parse
// kv.smembers("hoggers") + map over handles

export type HoggerEntry = {
  handle: string;
  kWhWeek: number;
  kWhAllTime: number;
  whPerDay: number;
  models: string[];
  updatedAt: string;
};

const db = new Map<string, HoggerEntry>();

export const store = {
  async set(handle: string, entry: HoggerEntry): Promise<void> {
    db.set(handle.toLowerCase(), entry);
  },

  async get(handle: string): Promise<HoggerEntry | null> {
    return db.get(handle.toLowerCase()) ?? null;
  },

  async getAll(): Promise<HoggerEntry[]> {
    return [...db.values()];
  },

  async delete(handle: string): Promise<void> {
    db.delete(handle.toLowerCase());
  },
};
