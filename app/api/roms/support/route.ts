/**
 * POST /api/roms/support
 * يسجّل "دعم" من مستخدم لـ ROM معين
 * Anti-fraud: cooldown 24h per user per ROM
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api/auth";
import { sbAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const uid = user.uid;

    const { romId } = await req.json();
    if (!romId || typeof romId !== "string") {
      return NextResponse.json({ error: "romId required" }, { status: 400 });
    }

    // ── Anti-fraud: 24h cooldown per user per ROM ─────────────────────
    const dedupId = `support_${uid}_${romId}`;
    const { data: existing } = await sbAdmin
      .from("downloads_dedup")
      .select("last_at")
      .eq("id", dedupId)
      .maybeSingle();

    const cooldown = 24 * 60 * 60 * 1000; // 24 hours
    if (existing?.last_at) {
      const lastAt = new Date(existing.last_at).getTime();
      if (Date.now() - lastAt < cooldown) {
        return NextResponse.json({ success: false, alreadySupported: true });
      }
    }

    // ── Record support cooldown ──────────────────────────────────────
    await sbAdmin.from("downloads_dedup").upsert({
      id: dedupId,
      rom_id: romId,
      last_at: new Date().toISOString(),
    });

    // ── Increment supportCount on ROM ─────────────────────────────────
    const { data: rom } = await sbAdmin
      .from("roms")
      .select("support_count, maintainer_uid")
      .eq("id", romId)
      .maybeSingle();

    if (!rom) return NextResponse.json({ error: "ROM not found" }, { status: 404 });

    await sbAdmin.rpc("increment_rom_support", { p_rom_id: romId, p_delta: 1 });
    const newCount = ((rom.support_count as number) || 0) + 1;

    // ── Increment totalSupportsReceived on developer (Supabase) ───────
    if (rom.maintainer_uid) {
      await sbAdmin.rpc("increment_user_supports_received", { p_user_id: rom.maintainer_uid }).then(undefined, () => {});
    }

    return NextResponse.json({ success: true, newCount });
  } catch (err) {
    console.error("[support] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
