/**
 * app/api/devices/route.ts — v2 CACHED
 *
 * قبل:  2 Supabase queries لكل request (ILIKE scan + roms scan)
 * بعد:  0 Supabase queries — كل البيانات في الذاكرة
 *       Load مرة واحدة كل 10 دقايق فقط
 *
 * استثناء: /api/devices?codename=X → يستمر يقرأ من Supabase
 *           لأنه يحتاج بيانات تفصيلية + ROMs للجهاز المحدد
 */

import { NextRequest, NextResponse } from "next/server";
import { sbAdmin } from "@/lib/supabase/admin";
import { getClientIp, rateLimit, rateLimitedResponse, errorResponse } from "@/lib/api/middleware";
import { getDevicesCache, searchDevicesInMemory } from "@/lib/server/devices-cache";

function normalizeRomRow(row: Record<string, unknown>) {
  return {
    id:              row.id,
    name:            row.name,
    contentType:     row.content_type,
    brand:           row.brand,
    device:          row.device,
    deviceCodename:  row.device_codename ?? "",
    android:         row.android,
    version:         row.version,
    downloads:       row.downloads ?? 0,
    likesCount:      row.likes_count ?? 0,
    ratingAvg:       row.rating_avg ?? 0,
    trendScore:      row.trend_score ?? 0,
    healthScore:     row.health_score ?? 0,
    thumbnail:       row.thumbnail ?? "",
    romStatus:       row.rom_status ?? "active",
    maintainerUid:   row.maintainer_uid,
    maintainerName:  row.maintainer_name ?? "",
    maintainerPhoto: row.maintainer_photo ?? "",
    createdAt:       row.created_at,
  };
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 60)) return rateLimitedResponse(req);

  const { searchParams } = new URL(req.url);
  const codename = searchParams.get("codename");
  const brand    = searchParams.get("brand") || undefined;
  const q        = searchParams.get("q") || undefined;
  const page     = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit    = Math.min(24, parseInt(searchParams.get("limit") || "24"));

  // ── 1. أرشيف جهاز معين — يقرأ من Supabase (بيانات تفصيلية) ──────────
  if (codename) {
    const offset = (page - 1) * limit;
    const [romsRes, devRes, statsRes] = await Promise.all([
      sbAdmin.from("roms")
        .select("*", { count: "exact" })
        .eq("device_codename", codename)
        .order("trend_score", { ascending: false })
        .range(offset, offset + limit - 1),

      sbAdmin.from("devices")
        .select("display_name, brand, chipset, released, aliases, image_url")
        .eq("codename", codename)
        .maybeSingle(),

      sbAdmin.from("roms")
        .select("downloads, likes_count, rating_avg")
        .eq("device_codename", codename),
    ]);

    if (romsRes.error) return errorResponse(romsRes.error.message, 500, req);

    const d     = devRes.data  as Record<string, unknown> | null;
    const roms  = romsRes.data as Record<string, unknown>[];
    const stats = (statsRes.data || []) as { downloads: number; likes_count: number; rating_avg: number }[];
    const firstRom = roms?.[0] as Record<string, unknown> | undefined;

    // ── لو الجهاز مش في devices table → جرب من DEVICE_DB (local) ────────
    let localEntry: { chipset?: string; released?: string; aliases?: string[]; imageUrl?: string } = {};
    if (!d?.chipset || !d?.released) {
      try {
        const { CODENAME_INDEX } = await import("@/lib/server/device-db");
        const local = CODENAME_INDEX.get(codename.toLowerCase());
        if (local) {
          localEntry = {
            chipset:  local.chipset,
            released: local.released,
            aliases:  local.aliases,
            imageUrl: local.imageUrl,
          };
        }
      } catch { /* ignore */ }
    }

    const device = {
      codename,
      name:     d?.display_name as string ?? firstRom?.device as string ?? codename,
      brand:    d?.brand        as string ?? firstRom?.brand  as string ?? "",
      chipset:  (d?.chipset     as string) || localEntry.chipset || null,
      released: (d?.released    as string) || localEntry.released || null,
      aliases:  (d?.aliases     as string[]) ?? localEntry.aliases ?? [],
      imageUrl: (d?.image_url   as string) || localEntry.imageUrl || null,
    };

    const totalDownloads = stats.reduce((s, r) => s + (r.downloads   ?? 0), 0);
    const totalLikes     = stats.reduce((s, r) => s + (r.likes_count ?? 0), 0);
    const avgRating      = stats.length
      ? stats.reduce((s, r) => s + (r.rating_avg ?? 0), 0) / stats.length : 0;

    return NextResponse.json(
      { device, items: roms.map(normalizeRomRow), total: romsRes.count ?? 0, page, limit, totalDownloads, totalLikes, avgRating: Math.round(avgRating * 10) / 10 },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } }
    );
  }

  // ── 2. قائمة الأجهزة — من الذاكرة (0 Supabase reads) ────────────────
  const cache = await getDevicesCache();
  const result = searchDevicesInMemory(cache.items, { q, brand, page, limit });

  return NextResponse.json(
    { items: result.items, total: result.total, page, limit, totalPages: result.totalPages },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        // header للـ debugging
        "X-Cache-Age": String(Math.round((Date.now() - cache.loadedAt) / 1000)) + "s",
      }
    }
  );
}
