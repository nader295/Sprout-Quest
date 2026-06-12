// app/api/notifications/route.ts — Supabase فقط
import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, getClientIp, rateLimit, rateLimitedResponse } from "@/lib/api/middleware";
import { verifyRequest } from "@/lib/firebase/auth-verify";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// ═══════════════════════════════════════════════════════════════
// app/api/notifications/route.ts — Supabase فقط
// ═══════════════════════════════════════════════════════════════
// Separate file: app/api/notifications/route.ts
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 30)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user) return errorResponse("Unauthorized", 401, req);

  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);

  // ── Fast path: only return the unread count (polled every 30s by use-auth) ──
  if (searchParams.get("countOnly") === "true") {
    const { count } = await sb
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("recipient_uid", user.uid)
      .eq("read", false);
    return jsonResponse({ unreadCount: count ?? 0 }, 200, req);
  }

  const { data } = await sb
    .from("notifications")
    .select("*")
    .eq("recipient_uid", user.uid)
    .order("created_at", { ascending: false })
    .limit(30);

  return jsonResponse({ items: data ?? [] }, 200, req);
}

export async function PUT(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 10)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user) return errorResponse("Unauthorized", 401, req);

  const sb = getSupabaseAdmin();

  // Mark all unread as read
  await sb.from("notifications")
    .update({ read: true })
    .eq("recipient_uid", user.uid)
    .eq("read", false);

  // Reset counter
  await sb.from("users")
    .update({ unread_notifications: 0, updated_at: new Date().toISOString() })
    .eq("id", user.uid);

  return jsonResponse({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 20)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user) return errorResponse("Unauthorized", 401, req);

  const sb = getSupabaseAdmin();
  const body = await req.json().catch(() => ({}));

  // Mark a single notification as read
  const notifId = body.notificationId || body.id;
  if (notifId) {
    await sb.from("notifications")
      .update({ read: true })
      .eq("id", notifId)
      .eq("recipient_uid", user.uid);
    return jsonResponse({ ok: true });
  }

  // Fallback: mark all as read (same as PUT)
  await sb.from("notifications")
    .update({ read: true })
    .eq("recipient_uid", user.uid)
    .eq("read", false);

  await sb.from("users")
    .update({ unread_notifications: 0, updated_at: new Date().toISOString() })
    .eq("id", user.uid);

  return jsonResponse({ ok: true });
}
