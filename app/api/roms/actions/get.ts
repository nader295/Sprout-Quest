import { NextRequest } from "next/server";
import {
  jsonResponse, errorResponse, getClientIp, hashIp,
  rateLimit, rateLimitedResponse, cachedJsonResponse,
} from "@/lib/api/middleware";
import { sbAdmin } from "@/lib/supabase/admin";
import { verifyRequest } from "@/lib/firebase/auth-verify";
import { nr } from "../utils";

export async function handleGet(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 120, 60_000)) return rateLimitedResponse(req);

  const p = new URL(req.url).searchParams;

  // ── XP Preview (دقيق) — يُستخدم قبل تأكيد الحذف ──────────────────
  const xpPreviewId = p.get("xpPreview");
  if (xpPreviewId) {
    const user = await verifyRequest(req);
    if (!user) return errorResponse("Unauthorized", 401, req);

    const { data: romRow } = await sbAdmin
      .from("roms")
      .select("maintainer_uid, content_type, likes_count, downloads, total_views, milestone_100_awarded, milestone_500_awarded, milestone_1000_awarded")
      .eq("id", xpPreviewId)
      .single();
    if (!romRow) return errorResponse("Not found", 404, req);
    const rom = romRow as Record<string, unknown>;
    if (rom.maintainer_uid !== user.uid) return errorResponse("Forbidden", 403, req);

    const { count: dedupCount } = await sbAdmin
      .from("xp_comments_dedup")
      .select("id", { count: "exact", head: true })
      .eq("rom_id", xpPreviewId);
    const uniqueCommenters = dedupCount ?? 0;

    const { computeRomXP } = await import("@/lib/server/xp");
    const { total, breakdown } = computeRomXP({
      contentType:      rom.content_type as string,
      likesCount:       (rom.likes_count   as number) ?? 0,
      downloads:        (rom.downloads     as number) ?? 0,
      totalViews:       (rom.total_views   as number) ?? 0,
      uniqueCommenters,
      milestone100:     !!(rom.milestone_100_awarded),
      milestone500:     !!(rom.milestone_500_awarded),
      milestone1000:    !!(rom.milestone_1000_awarded),
    });

    // اشيك على الإنجازات اللي ممكن تتأثر بالحذف
    const { data: userRow } = await sbAdmin.from("users").select("achievements, roms_count").eq("id", user.uid).single();
    const currentAchievements: string[] = (userRow?.achievements as string[]) ?? [];
    const romsCount: number = ((userRow?.roms_count as number) ?? 1) - 1; // بعد الحذف
    return jsonResponse({ total, breakdown, currentAchievements, romsCount }, 200, req);
  }

  // Single ROM
  const id = p.get("id");
  if (id) {
    const { data, error } = await sbAdmin.from("roms").select("*").eq("id", id).single();
    if (error || !data) return errorResponse("Not found", 404, req);
    return jsonResponse(nr(data as Record<string, unknown>), 200, req);
  }

  const action = p.get("action");

  // Check liked
  if (action === "checkLiked") {
    const romId = p.get("romId");
    if (!romId) return errorResponse("Missing romId", 400, req);
    const user = await verifyRequest(req).catch(() => null);

    // Authenticated user — check the `likes` table by UID
    if (user) {
      const { data } = await sbAdmin.from("likes").select("rom_id")
        .eq("rom_id", romId).eq("user_id", user.uid).maybeSingle();
      return jsonResponse({ liked: !!data }, 200, req);
    }

    // Anonymous user — check the `anon_likes_dedup` table by IP hash
    // This means even after a page refresh or localStorage clear, the
    // server knows if this IP already liked the ROM.
    const anonDedupId = `anon_${hashIp(ip)}_${romId}`;
    const { data: anonData } = await sbAdmin.from("anon_likes_dedup")
      .select("id").eq("id", anonDedupId).maybeSingle();
    return jsonResponse({ liked: !!anonData }, 200, req);
  }

  // My likes — bounded to 2000 most recent. Clients that need pagination
  // should call this endpoint with an explicit cursor (future work).
  if (action === "myLikes") {
    const user = await verifyRequest(req);
    if (!user) return errorResponse("Unauthorized", 401, req);
    const { data } = await sbAdmin
      .from("likes")
      .select("rom_id, created_at")
      .eq("user_id", user.uid)
      .order("created_at", { ascending: false })
      .limit(2000);
    return jsonResponse({ items: (data || []).map((r: Record<string, unknown>) => r.rom_id) }, 200, req);
  }

  // Get rating
  if (action === "getRating") {
    const romId = p.get("romId");
    if (!romId) return errorResponse("Missing romId", 400, req);
    const user = await verifyRequest(req);
    if (!user) return jsonResponse({ score: 0 }, 200, req);
    const { data } = await sbAdmin.from("ratings").select("score")
      .eq("rom_id", romId).eq("user_id", user.uid).maybeSingle();
    return jsonResponse({ score: (data as Record<string, unknown> | null)?.score || 0 }, 200, req);
  }

  // List ROMs
  const max           = Math.min(Number(p.get("max")) || 24, 100);
  const sortBy        = p.get("sortBy") || "newest";
  const contentType   = p.get("contentType") || "";
  const brand         = p.get("brand") || "";
  const android       = p.get("android") || "";
  const device        = p.get("device") || "";
  const status        = p.get("status") || "";
  const page          = Math.max(0, Number(p.get("page") || p.get("cursor") || 0));
  const maintainerUid = p.get("maintainerUid") || "";
  const featured      = p.get("featured") === "true";
  const idsParam      = p.get("ids") || "";
  const q             = p.get("q") || "";

  // Batch by IDs
  if (idsParam) {
    const ids = idsParam.split(",").filter(Boolean).slice(0, 100);
    if (!ids.length) return jsonResponse({ items: [], nextCursor: null }, 200, req);
    const { data } = await sbAdmin.from("roms").select("*").in("id", ids);
    return jsonResponse({ items: (data || []).map((r: Record<string, unknown>) => nr(r)), nextCursor: null }, 200, req);
  }

  // Full-text search
  if (q && q.length >= 2) {
    const { data } = await sbAdmin.rpc("search_roms", {
      query: q,
      p_content_type: contentType || null,
      p_brand: brand || null,
      p_android: android || null,
      p_device: device || null,
      p_limit: max,
      p_offset: page * max,
    });
    return cachedJsonResponse(
      { items: (data as Record<string, unknown>[] || []).map(nr), nextCursor: null },
      60, req
    );
  }

  // Filtered list
  const sortMap: Record<string, string> = {
    newest: "created_at", likes: "likes_count", views: "total_views",
    downloads: "downloads", rating: "rating_avg", trending: "trend_score",
  };
  const sortField = sortMap[sortBy] || "created_at";

  let query = sbAdmin.from("roms").select("*");
  if (maintainerUid) query = query.eq("maintainer_uid", maintainerUid);
  if (contentType)   query = query.eq("content_type", contentType);
  if (brand)         query = query.eq("brand", brand);
  if (android)       query = query.eq("android", android);
  if (status)        query = query.eq("rom_status", status);
  if (featured)      query = query.eq("featured", true);
  if (device)        query = query.ilike("device", `%${device}%`);

  query = query.order(sortField, { ascending: false }).range(page * max, page * max + max - 1);

  const { data, error } = await query;
  if (error) return errorResponse(error.message, 500, req);

  const items = (data || []).map((r: Record<string, unknown>) => nr(r));
  const nextPage = items.length === max ? page + 1 : null;

  return maintainerUid
    ? jsonResponse({ items, nextCursor: nextPage }, 200, req)
    : cachedJsonResponse({ items, nextCursor: nextPage }, 120, req);
}
