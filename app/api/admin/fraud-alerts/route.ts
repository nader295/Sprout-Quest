import { NextRequest, NextResponse } from "next/server";
import { sbAdmin } from "@/lib/supabase/admin";
import { verifyRequest, isAdmin } from "@/lib/api/auth";

export const runtime = "nodejs";

/**
 * GET   /api/admin/fraud-alerts  — list alerts (admin only)
 * PATCH /api/admin/fraud-alerts  — mark an alert reviewed  { id, reviewed }
 *
 * Added in P0. `fraud_alerts` is a sensitive table (flags which users
 * look like XP farmers / abusers) and must not be readable by anon.
 */
export async function GET(req: NextRequest) {
  const user = await verifyRequest(req);
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") || "50"), 200);

  const { data, error } = await sbAdmin
    .from("fraud_alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[admin/fraud-alerts] list failed:", error);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }

  return NextResponse.json({ items: data || [] });
}

export async function PATCH(req: NextRequest) {
  const user = await verifyRequest(req);
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { id?: string; reviewed?: boolean };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const reviewed = body.reviewed !== false;

  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const { error } = await sbAdmin
    .from("fraud_alerts")
    .update({ reviewed })
    .eq("id", id);

  if (error) {
    console.error("[admin/fraud-alerts] update failed:", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
