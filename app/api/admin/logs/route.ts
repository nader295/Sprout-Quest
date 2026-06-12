import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyRequest, isAdmin } from "@/lib/firebase/auth-verify";
import { getClientIp, rateLimit, rateLimitedResponse } from "@/lib/api/middleware";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(`admin_logs_get:${ip}`, 50)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const level    = searchParams.get("level");
  const category = searchParams.get("category");
  const max      = Math.min(Number(searchParams.get("limit")) || 100, 500);

  let q = sb.from("admin_logs").select("*").order("created_at", { ascending: false }).limit(max);
  if (level    && level    !== "all") q = q.eq("level", level);
  if (category && category !== "all") q = q.eq("type", category); // using 'type' conceptually as category

  const { data } = await q;
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(`admin_logs_post:${ip}`, 50)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sb = getSupabaseAdmin();
  const body = await req.json();
  const { level, category, data } = body;

  const { data: inserted } = await sb.from("admin_logs").insert({
    type:       category || "general", // map category to type
    uid:        user.uid,
    data:       { ...data, level, adminEmail: user.email || "" },
    created_at: new Date().toISOString(),
  }).select("id").single();

  return NextResponse.json({ id: inserted?.id });
}

export async function DELETE(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(`admin_logs_del:${ip}`, 20)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    await sb.from("admin_logs").delete().eq("id", id);
    return NextResponse.json({ ok: true });
  }

  // Delete top 500 logs if no ID specified
  const { data: oldLogs } = await sb.from("admin_logs").select("id").limit(500);
  if (oldLogs && oldLogs.length > 0) {
    const ids = oldLogs.map(l => l.id);
    await sb.from("admin_logs").delete().in("id", ids);
  }

  return NextResponse.json({ ok: true });
}
