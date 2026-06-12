// ═══════════════════════════════════════════════════════════════
// app/api/activity/route.ts — Supabase فقط
// ═══════════════════════════════════════════════════════════════
import { NextRequest } from "next/server";
import { verifyRequest } from "@/lib/firebase/auth-verify";
import { getClientIp, rateLimit, rateLimitedResponse, jsonResponse, errorResponse } from "@/lib/api/middleware";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 30)) return rateLimitedResponse(req);

  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const mode    = searchParams.get("mode") || "global";
  const max     = Math.min(Number(searchParams.get("limit")) || 30, 100);
  const userUid = searchParams.get("uid") || "";

  try {
    if (mode === "feed") {
      const user = await verifyRequest(req);
      if (!user) return errorResponse("Unauthorized", 401);

      const { data } = await sb
        .from("feed_items")
        .select("*")
        .eq("owner_uid", user.uid)
        .order("created_at", { ascending: false })
        .limit(max);

      return jsonResponse({ items: data ?? [], source: "fan-out" });
    }

    if (mode === "user" && userUid) {
      const { data } = await sb
        .from("activity")
        .select("*")
        .eq("uid", userUid)
        .order("created_at", { ascending: false })
        .limit(max);

      return jsonResponse({ items: data ?? [], source: "user" });
    }

    const uidsParam = searchParams.get("uids") || "";
    if (uidsParam) {
      const uids = uidsParam.split(",").filter(Boolean).slice(0, 10);
      if (uids.length > 0) {
        const { data } = await sb
          .from("activity")
          .select("*")
          .in("uid", uids)
          .order("created_at", { ascending: false })
          .limit(max);
        return jsonResponse({ items: data ?? [], source: "legacy" });
      }
    }

    const { data } = await sb
      .from("activity")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(max);

    return jsonResponse({ items: data ?? [], source: "global" });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Failed", 500);
  }
}
