// GET /api/global — live totals for the global trough counter. Cached briefly
// so the landing page's polling doesn't hammer Redis.

import { NextResponse } from "next/server";
import { getGlobalStats } from "@/lib/stats";

export const revalidate = 30;

export async function GET() {
  const stats = await getGlobalStats();
  return NextResponse.json(stats, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
