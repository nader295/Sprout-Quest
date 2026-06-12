import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/firebase/auth-verify";
import { getClientIp, rateLimit, rateLimitedResponse } from "@/lib/api/middleware";
import { LEVEL_GATES, getLevel } from "@/lib/constants";
import { sbAdmin } from "@/lib/supabase/admin";

// ── GET /api/analytics ────────────────────────────────
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 20)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check level from Supabase
  const { data: userRow } = await sbAdmin.from("users").select("xp").eq("id", user.uid).single();
  const xp = ((userRow as Record<string, unknown> | null)?.xp || 0) as number;
  const level = getLevel(xp);

  if (level.level < LEVEL_GATES.ANALYTICS) {
    return NextResponse.json(
      { error: `Analytics unlocks at Level ${LEVEL_GATES.ANALYTICS}. You are Level ${level.level}.` },
      { status: 403 }
    );
  }

  // ── Fetch totals from Supabase (source of truth for ROMs) ──
  const { data: romsData } = await sbAdmin
    .from("roms")
    .select("id, name, total_views, downloads, likes_count")
    .eq("maintainer_uid", user.uid);

  const roms = (romsData || []) as {
    id: string; name: string; total_views: number; downloads: number; likes_count: number;
  }[];

  let totalViews = 0, totalDownloads = 0, totalLikes = 0;
  const topRoms: { id: string; name: string; views: number; downloads: number; likes: number }[] = [];

  for (const rom of roms) {
    totalViews     += rom.total_views  || 0;
    totalDownloads += rom.downloads    || 0;
    totalLikes     += rom.likes_count  || 0;
    topRoms.push({ id: rom.id, name: rom.name, views: rom.total_views || 0, downloads: rom.downloads || 0, likes: rom.likes_count || 0 });
  }
  topRoms.sort((a, b) => b.downloads !== a.downloads ? b.downloads - a.downloads : b.views - a.views);

  // ── Real daily stats from rom_daily_stats (last 30 days) ──
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: dailyData } = await sbAdmin
    .from("rom_daily_stats")
    .select("stat_date, views, downloads")
    .eq("maintainer_uid", user.uid)
    .gte("stat_date", thirtyDaysAgo)
    .order("stat_date", { ascending: true });

  // Group by date
  const dailyMap = new Map<string, { views: number; downloads: number }>();
  for (const row of (dailyData || []) as { stat_date: string; views: number; downloads: number }[]) {
    const d = row.stat_date;
    const existing = dailyMap.get(d) || { views: 0, downloads: 0 };
    dailyMap.set(d, {
      views:     existing.views     + (row.views     || 0),
      downloads: existing.downloads + (row.downloads || 0),
    });
  }

  // Build last 30 days array (fill zeros for missing days)
  const viewsByDay: { date: string; views: number }[] = [];
  const downloadsByDay: { date: string; downloads: number }[] = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split("T")[0];
    const entry = dailyMap.get(dateStr) || { views: 0, downloads: 0 };
    viewsByDay.push({ date: dateStr, views: entry.views });
    downloadsByDay.push({ date: dateStr, downloads: entry.downloads });
  }

  return NextResponse.json(
    {
      totalViews,
      totalDownloads,
      totalLikes,
      totalRoms: roms.length,
      viewsByDay,
      downloadsByDay,
      topRoms: topRoms.slice(0, 5),
      level: level.level,
      levelLabel: level.label,
      // Flag to distinguish real vs estimated data
      hasRealDailyData: dailyData && dailyData.length > 0,
    },
    { headers: { "Cache-Control": "private, max-age=3600, stale-while-revalidate=7200" } } // تحسين: من 2 دقيقة إلى 1 ساعة + cache refresh
  );
}
