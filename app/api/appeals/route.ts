// ═══════════════════════════════════════════════════════════════
// app/api/appeals/route.ts — Supabase فقط
// ═══════════════════════════════════════════════════════════════
import { NextRequest } from "next/server";
import { verifyRequest, isAdmin } from "@/lib/firebase/auth-verify";
import { getClientIp, rateLimit, rateLimitedResponse, jsonResponse, errorResponse } from "@/lib/api/middleware";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 30)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user) return errorResponse("Unauthorized", 401);

  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);

  if (searchParams.get("mine") === "true") {
    const { data } = await sb
      .from("appeals").select("*").eq("uid", user.uid)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    return jsonResponse(data ?? null);
  }

  if (!isAdmin(user)) return errorResponse("Forbidden", 403);
  const status = searchParams.get("status") || "pending";
  const max    = Math.min(Number(searchParams.get("limit")) || 20, 50);
  let q = sb.from("appeals").select("*").order("created_at", { ascending: false }).limit(max);
  if (status !== "all") q = q.eq("status", status);
  const { data } = await q;
  return jsonResponse({ items: data ?? [], count: data?.length ?? 0 });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 3, 60_000)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user) return errorResponse("Unauthorized", 401);

  const sb = getSupabaseAdmin();

  const { data: userData } = await sb.from("users").select("is_suspended, suspended_until").eq("id", user.uid).single();
  if (!userData?.is_suspended) return errorResponse("You are not currently suspended", 400);

  const { data: existing } = await sb
    .from("appeals").select("id").eq("uid", user.uid).eq("status", "pending").maybeSingle();
  if (existing) return errorResponse("You already have a pending appeal", 400);

  const body = await req.json();
  const { data: inserted } = await sb.from("appeals").insert({
    uid:        user.uid,
    reason:     (body.reason || body.explanation || "").toString().slice(0, 2000),
    details:    (body.details || body.evidenceUrl || "").toString().slice(0, 2000),
    status:     "pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select("id").single();

  return jsonResponse({ id: inserted?.id, message: "Appeal submitted" }, 201);
}

export async function PUT(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 20)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user || !isAdmin(user)) return errorResponse("Forbidden", 403);

  const sb = getSupabaseAdmin();
  const { id, status, adminNote } = await req.json();
  if (!id || !["approved", "rejected"].includes(status)) return errorResponse("Invalid", 400);

  const { data: appeal } = await sb.from("appeals").select("uid").eq("id", id).single();
  if (!appeal) return errorResponse("Not found", 404);

  await sb.from("appeals").update({
    status, admin_note: adminNote ?? "", updated_at: new Date().toISOString(),
  }).eq("id", id);

  if (status === "approved") {
    await sb.from("users").update({
      is_suspended: false, suspended_until: null, suspension_reason: "",
      updated_at: new Date().toISOString(),
    }).eq("id", appeal.uid);
  }

  return jsonResponse({ success: true });
}
