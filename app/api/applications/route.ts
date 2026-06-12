// ═══════════════════════════════════════════════════════════════
// app/api/applications/route.ts — Supabase فقط
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { verifyRequest, isAdmin } from "@/lib/firebase/auth-verify";
import { getClientIp, rateLimit, rateLimitedResponse } from "@/lib/api/middleware";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 20)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);

  if (searchParams.get("mine") === "true") {
    const { data } = await sb
      .from("applications")
      .select("*")
      .eq("uid", user.uid)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return NextResponse.json(data ?? null);
  }

  // Admin: list all
  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const status = searchParams.get("status") || "pending";
  let q = sb.from("applications").select("*").order("created_at", { ascending: false }).limit(50);
  if (status !== "all") q = q.eq("status", status);
  const { data } = await q;
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 3, 10 * 60_000)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb   = getSupabaseAdmin();
  const body = await req.json();

  const { data: existing } = await sb
    .from("applications").select("id").eq("uid", user.uid).eq("status", "pending").maybeSingle();
  if (existing) return NextResponse.json({ error: "You already have a pending application" }, { status: 409 });

  const { data: userData } = await sb.from("users").select("name, email, photo").eq("id", user.uid).single();

  const MAX_TEXT = 2000;
  const MAX_URL  = 500;

  const { data: inserted } = await sb.from("applications").insert({
    uid:     user.uid,
    name:    userData?.name  || body.name  || "",
    links: [
      body.githubUrl    ? { label: "GitHub",   url: (body.githubUrl   as string).slice(0, MAX_URL) } : null,
      body.xdaUrl       ? { label: "XDA",      url: (body.xdaUrl      as string).slice(0, MAX_URL) } : null,
      body.telegramUrl  ? { label: "Telegram", url: (body.telegramUrl as string).slice(0, MAX_URL) } : null,
      body.sampleRomUrl ? { label: "ROM",      url: (body.sampleRomUrl as string).slice(0, MAX_URL) } : null,
    ].filter(Boolean),
    message:    `${(body.reason || "").slice(0, MAX_TEXT)}\n\n${(body.experience || "").slice(0, MAX_TEXT)}`.trim(),
    status:     "pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select("id").single();

  return NextResponse.json({ id: inserted?.id });
}

export async function PUT(req: NextRequest) {
  const user = await verifyRequest(req);
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sb  = getSupabaseAdmin();
  const { id, status, adminNote } = await req.json();
  if (!id || !["pending", "approved", "rejected"].includes(status))
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  await sb.from("applications").update({
    status, admin_note: adminNote ?? "", reviewed_by: user.uid,
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  if (status === "approved") {
    const { data: app } = await sb.from("applications").select("uid").eq("id", id).single();
    if (app?.uid) {
      await sb.from("users").update({
        role: "verifiedDev", manual_verified: true, updated_at: new Date().toISOString(),
      }).eq("id", app.uid);
    }
  }

  return NextResponse.json({ ok: true });
}
