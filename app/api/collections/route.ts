// ═══════════════════════════════════════════════════════════════
// app/api/collections/route.ts — Supabase فقط
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyRequest } from "@/lib/firebase/auth-verify";
import { getClientIp, rateLimit, rateLimitedResponse } from "@/lib/api/middleware";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 30)) return rateLimitedResponse(req);

  const user = await verifyRequest(req).catch(() => null);
  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const { data, error } = await sb.from("collections").select("*").eq("id", id).maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!data.is_public && user?.uid !== data.owner_uid) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  }

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await sb.from("collections")
    .select("*")
    .eq("owner_uid", user.uid)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 10)) return rateLimitedResponse(req);

  const user = await verifyRequest(req).catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabaseAdmin();
  const body = await req.json();
  const action = body.action;

  if (action === "addRom") {
    const { collectionId, romId } = body;
    if (!collectionId || !romId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const { data: col } = await sb.from("collections").select("owner_uid, rom_ids, rom_count").eq("id", collectionId).maybeSingle();
    if (!col || col.owner_uid !== user.uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const currentIds = (col.rom_ids as string[]) || [];
    if (currentIds.includes(romId)) return NextResponse.json({ ok: true }); // already exists
    await sb.from("collections").update({
      rom_ids: [...currentIds, romId],
      rom_count: (col.rom_count || 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq("id", collectionId);
    return NextResponse.json({ ok: true });
  }

  if (action === "removeRom") {
    const { collectionId, romId } = body;
    if (!collectionId || !romId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const { data: col } = await sb.from("collections").select("owner_uid, rom_ids, rom_count").eq("id", collectionId).maybeSingle();
    if (!col || col.owner_uid !== user.uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const currentIds = (col.rom_ids as string[]) || [];
    await sb.from("collections").update({
      rom_ids: currentIds.filter((id: string) => id !== romId),
      rom_count: Math.max(0, (col.rom_count || 0) - 1),
      updated_at: new Date().toISOString(),
    }).eq("id", collectionId);
    return NextResponse.json({ ok: true });
  }

  // Create new collection
  const { name, description = "", isPublic = true } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const { data: inserted } = await sb.from("collections").insert({
    owner_uid: user.uid,
    name: name.trim(),
    description: (description || "").trim(),
    is_public: isPublic !== false,
    rom_ids: [],
    rom_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select("id").single();

  return NextResponse.json({ id: inserted?.id });
}

export async function PUT(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 10)) return rateLimitedResponse(req);

  const user = await verifyRequest(req).catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabaseAdmin();
  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const { data: col } = await sb.from("collections").select("owner_uid").eq("id", id).maybeSingle();
  if (!col || col.owner_uid !== user.uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = ["name", "description", "is_public"];
  const safe: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in updates) safe[k] = updates[k];
  }
  // Also accept camelCase from frontend
  if ("isPublic" in updates) safe.is_public = updates.isPublic;
  safe.updated_at = new Date().toISOString();

  await sb.from("collections").update(safe).eq("id", id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 10)) return rateLimitedResponse(req);

  const user = await verifyRequest(req).catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const { data: col } = await sb.from("collections").select("owner_uid").eq("id", id).maybeSingle();
  if (!col || col.owner_uid !== user.uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await sb.from("collections").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
