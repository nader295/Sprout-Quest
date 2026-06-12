/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  OPTIMIZED: app/api/stats/route.ts                              ║
 * ║                                                                  ║
 * ║  Now uses Supabase fast counts and Vercel Edge Cache!            ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonResponse, errorResponse, getClientIp, rateLimit, rateLimitedResponse } from "@/lib/api/middleware";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 30)) return rateLimitedResponse(req);

  try {
    const sb = getSupabaseAdmin();
    
    const devThreshRes = await sb.from("settings").select("value").eq("key", "dev_threshold_xp").single();
    const devXpTrigger = devThreshRes.data?.value ? Number(devThreshRes.data.value) : 600;

    // Supabase exact counts (fast and scalable due to indexes)
    const [
      romsRes, usersRes, devsRes, kernelsRes, modulesRes, recoveriesRes
    ] = await Promise.all([
      sb.from("roms").select("*", { count: "exact", head: true }),
      sb.from("users").select("*", { count: "exact", head: true }),
      sb.from("users").select("*", { count: "exact", head: true }).gte("xp", devXpTrigger),
      sb.from("roms").select("*", { count: "exact", head: true }).eq("content_type", "kernel"),
      sb.from("roms").select("*", { count: "exact", head: true }).eq("content_type", "module"),
      sb.from("roms").select("*", { count: "exact", head: true }).eq("content_type", "recovery"),
    ]);

    let onlineCount = 0;
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
      const { count } = await sb.from("presence")
        .select("*", { count: "exact", head: true })
        .gte("last_seen", fiveMinutesAgo);
      onlineCount = count ?? 0;
    } catch { /* ignore presence failure */ }

    const result = {
      totalRoms:       romsRes.count ?? 0,
      totalUsers:      usersRes.count ?? 0,
      totalDevs:       devsRes.count ?? 0,
      onlineCount,
      totalKernels:    kernelsRes.count ?? 0,
      totalModules:    modulesRes.count ?? 0,
      totalRecoveries: recoveriesRes.count ?? 0,
    };

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60, stale-if-error=300",
      },
    });
  } catch {
    return errorResponse("Failed to fetch stats", 500);
  }
}

export async function OPTIONS() {
  return jsonResponse({});
}
