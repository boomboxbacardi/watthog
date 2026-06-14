// POST /api/submit — receives a hogger's aggregated energy stats and upserts
// them in the leaderboard store.
//
// Swap the store import for @vercel/kv (or any KV) when the backend is
// provisioned; the rest of this file stays the same.

import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

const HANDLE_RE = /^[a-zA-Z0-9_-]{1,32}$/;

type SubmitBody = {
  handle: string;
  kWhWeek: number;
  kWhAllTime: number;
  whPerDay: number;
  models: string[];
};

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: NextRequest) {
  let body: SubmitBody;
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON");
  }

  const { handle, kWhWeek, kWhAllTime, whPerDay, models } = body;

  if (!handle || !HANDLE_RE.test(handle)) {
    return err("handle must be 1-32 characters (a-z, 0-9, - _)");
  }
  if (
    typeof kWhWeek !== "number" || kWhWeek < 0 ||
    typeof kWhAllTime !== "number" || kWhAllTime < 0 ||
    typeof whPerDay !== "number" || whPerDay < 0
  ) {
    return err("kWhWeek, kWhAllTime, whPerDay must be non-negative numbers");
  }
  if (!Array.isArray(models) || models.length > 10 ||
    models.some((m) => typeof m !== "string" || m.length > 80)) {
    return err("models must be an array of up to 10 strings");
  }

  const entry = {
    handle,
    kWhWeek: Math.round(kWhWeek * 1000) / 1000,
    kWhAllTime: Math.round(kWhAllTime * 1000) / 1000,
    whPerDay: Math.round(whPerDay),
    models: models.map((m) => String(m).slice(0, 80)),
    updatedAt: new Date().toISOString(),
  };

  await store.set(handle, entry);

  return NextResponse.json({ ok: true, handle });
}

export async function GET() {
  const hoggers = await store.getAll();
  return NextResponse.json({ hoggers });
}
