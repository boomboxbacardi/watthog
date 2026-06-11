// Sample leaderboard data. Replaced by the submit API + Postgres once the
// social backend lands. Every figure here is mock.

import { stageFor } from "./equivalence";

export type Hogger = {
  handle: string;
  kWhWeek: number;
  kWhAllTime: number;
  whPerDay: number;
  models: string[];
};

export const HOGGERS: Hogger[] = [
  { handle: "hogfather_dev", kWhWeek: 31.2, kWhAllTime: 412.7, whPerDay: 4457, models: ["opus", "gpt-5"] },
  { handle: "tokenslurper", kWhWeek: 18.9, kWhAllTime: 96.4, whPerDay: 2700, models: ["opus", "sonnet"] },
  { handle: "eriksh", kWhWeek: 11.4, kWhAllTime: 11.4, whPerDay: 1629, models: ["opus", "sonnet", "haiku"] },
  { handle: "noctilucent", kWhWeek: 7.3, kWhAllTime: 154.0, whPerDay: 1043, models: ["gemini-pro"] },
  { handle: "parsnip_ops", kWhWeek: 4.1, kWhAllTime: 88.2, whPerDay: 586, models: ["gpt-5", "gpt-5-mini"] },
  { handle: "kvarnby", kWhWeek: 2.6, kWhAllTime: 31.9, whPerDay: 371, models: ["sonnet"] },
  { handle: "yeeun_db", kWhWeek: 1.2, kWhAllTime: 67.5, whPerDay: 171, models: ["haiku", "flash"] },
  { handle: "ferromagnetic", kWhWeek: 0.4, kWhAllTime: 5.1, whPerDay: 57, models: ["sonnet"] },
];

export function stageOf(h: Hogger) {
  return stageFor(h.whPerDay);
}

// Mock global counter for the landing strip.
export const GLOBAL_KWH = 1847;
