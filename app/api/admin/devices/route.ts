/**
 * app/api/admin/devices/route.ts
 *
 * GET    /api/admin/devices           → قائمة الأجهزة في DB + الـ orphans
 * POST   /api/admin/devices           → إضافة جهاز جديد (مع auto-fetch صورة)
 * PUT    /api/admin/devices           → تعديل جهاز موجود
 * DELETE /api/admin/devices?codename= → حذف جهاز
 */

import { NextRequest, NextResponse } from "next/server";
import { sbAdmin } from "@/lib/supabase/admin";
import { verifyRequest } from "@/lib/firebase/auth-verify";
import { getClientIp, rateLimit, rateLimitedResponse } from "@/lib/api/middleware";
import { invalidateCache } from "@/lib/server/smart-device-engine";

async function requireAdmin(req: NextRequest) {
  const user = await verifyRequest(req);
  if (!user) return null;
  if (user.role !== "admin" && user.role !== "owner") return null;
  return user;
}

// ── Auto-fetch device image from GSMArena pattern ─────────────────────
async function fetchDeviceImage(displayName: string, brand: string): Promise<string | null> {
  // Build GSMArena slug: "Poco X7 Pro" → "xiaomi-poco-x7-pro"
  const brandLower = brand.toLowerCase();
  const nameLower  = displayName.toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  // Try with brand prefix first, then without
  const candidates = [
    `https://fdn2.gsmarena.com/vv/bigpic/${brandLower}-${nameLower}.jpg`,
    `https://fdn2.gsmarena.com/vv/bigpic/${nameLower}.jpg`,
    `https://fdn.gsmarena.com/vv/bigpic/${brandLower}-${nameLower}.jpg`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) return url;
    } catch {
      // try next
    }
  }
  return null;
}

// ── GET ───────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 30)) return rateLimitedResponse(req);

  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view"); // "orphans" → أجهزة بدون entry

  if (view === "orphans") {
    const { data, error } = await sbAdmin
      .from("orphan_rom_devices")
      .select("*");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  }

  const q = searchParams.get("q") || "";
  let query = sbAdmin
    .from("devices")
    .select("*")
    .order("brand")
    .order("display_name");

  if (q) query = query.or(`codename.ilike.%${q}%,display_name.ilike.%${q}%,brand.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

// ── POST — إضافة جهاز جديد ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 10)) return rateLimitedResponse(req);

  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.codename || !body?.display_name || !body?.brand) {
    return NextResponse.json({ error: "codename, display_name, brand مطلوبين" }, { status: 400 });
  }

  // Auto-fetch image if not provided
  let imageUrl = body.image_url || null;
  if (!imageUrl) {
    imageUrl = await fetchDeviceImage(body.display_name, body.brand);
  }

  const { data, error } = await sbAdmin.from("devices").insert({
    codename:      body.codename.toLowerCase().trim(),
    display_name:  body.display_name.trim(),
    brand:         body.brand.trim(),
    chipset:       body.chipset?.trim() || "",
    released:      body.released?.trim() || "",
    image_url:     imageUrl,
    aliases:       body.aliases || [],
    variant_words: body.variant_words || [],
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  invalidateCache(); // flush smartMatch cache
  return NextResponse.json({ device: data, imageAutoFetched: !body.image_url && !!imageUrl });
}

// ── PUT — تعديل جهاز ─────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 20)) return rateLimitedResponse(req);

  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.codename) return NextResponse.json({ error: "codename مطلوب" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (body.display_name  !== undefined) updates.display_name  = body.display_name;
  if (body.brand         !== undefined) updates.brand         = body.brand;
  if (body.chipset       !== undefined) updates.chipset       = body.chipset;
  if (body.released      !== undefined) updates.released      = body.released;
  if (body.image_url     !== undefined) updates.image_url     = body.image_url;
  if (body.aliases       !== undefined) updates.aliases       = body.aliases;
  if (body.variant_words !== undefined) updates.variant_words = body.variant_words;

  // Re-fetch image if explicitly requested
  if (body.refetchImage && body.display_name && body.brand) {
    updates.image_url = await fetchDeviceImage(body.display_name, body.brand);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "لا يوجد تعديلات" }, { status: 400 });
  }

  const { data, error } = await sbAdmin.from("devices")
    .update(updates)
    .eq("codename", body.codename)
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  invalidateCache();
  return NextResponse.json({ device: data });
}

// ── DELETE ────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const codename = searchParams.get("codename");
  if (!codename) return NextResponse.json({ error: "codename مطلوب" }, { status: 400 });

  const { error } = await sbAdmin.from("devices").delete().eq("codename", codename);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
