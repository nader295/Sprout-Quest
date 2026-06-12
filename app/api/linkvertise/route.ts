/**
 * /api/linkvertise
 *
 * POST → تسجيل نقرة تحميل عبر Linkvertise (يُستدعى من الـ frontend قبل التوجيه)
 * GET  → جلب ملخص الأرباح للمطور الحالي (من Supabase + تزامن مع Linkvertise API)
 *
 * نسبة المنصة: 10% من الأرباح المُبلَّغ عنها
 */

import { NextRequest } from "next/server";
import { sbAdmin } from "@/lib/supabase/admin";
import { verifyRequest } from "@/lib/api/auth";
import { jsonResponse, errorResponse, getClientIp } from "@/lib/api/middleware";

const PLATFORM_CUT = 0.10; // 10% عمولة المنصة

// ── POST: تسجيل نقرة ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const user = await verifyRequest(req);
    if (!user) return errorResponse("Unauthorized", 401, req);

    const body = await req.json();
    const { romId } = body as { romId?: string; action?: string };

    // ── Toggle single ROM ──────────────────────────────────────────────
    if (body.action === "toggle") {
      const { enabled } = body as { enabled: boolean };
      if (!romId || typeof enabled !== "boolean") return errorResponse("Missing romId or enabled", 400, req);
      const { data: rom } = await sbAdmin.from("roms").select("maintainer_uid").eq("id", romId).single();
      if (!rom) return errorResponse("ROM not found", 404, req);
      if ((rom as Record<string, unknown>).maintainer_uid !== user.uid) return errorResponse("Forbidden", 403, req);
      await sbAdmin.from("roms").update({ linkvertise_enabled: enabled, updated_at: new Date().toISOString() }).eq("id", romId);
      return jsonResponse({ success: true, romId, enabled }, 200, req);
    }

    // ── Toggle ALL roms for this user ──────────────────────────────────
    if (body.action === "toggleAll") {
      const { enabled } = body as { enabled: boolean };
      if (typeof enabled !== "boolean") return errorResponse("Missing enabled", 400, req);
      await sbAdmin.from("roms").update({ linkvertise_enabled: enabled, updated_at: new Date().toISOString() }).eq("maintainer_uid", user.uid);
      await sbAdmin.from("users").update({ linkvertise_global_enabled: enabled }).eq("id", user.uid);
      return jsonResponse({ success: true, enabled }, 200, req);
    }

    if (!romId) return errorResponse("Missing romId", 400, req);

    // جلب بيانات الـ ROM للتأكد إن Linkvertise مفعّل
    const { data: rom } = await sbAdmin
      .from("roms")
      .select("id, maintainer_uid, linkvertise_enabled, name")
      .eq("id", romId)
      .single();

    if (!rom) return errorResponse("ROM not found", 404, req);
    if (!rom.linkvertise_enabled) return errorResponse("Linkvertise not enabled for this ROM", 400, req);

    // لا تسجّل النقرات الذاتية
    if (rom.maintainer_uid === user.uid) {
      return jsonResponse({ ok: true, selfClick: true }, 200, req);
    }

    const ip = getClientIp(req);
    const country = req.headers.get("x-vercel-ip-country") || "";

    // تسجيل النقرة
    await sbAdmin.from("linkvertise_clicks").insert({
      rom_id:         romId,
      maintainer_uid: rom.maintainer_uid,
      user_uid:       user.uid,
      ip,
      country,
    });

    return jsonResponse({ ok: true }, 200, req);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return errorResponse(msg, 500, req);
  }
}

// ── GET: ملخص الأرباح ──────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const user = await verifyRequest(req);
    if (!user) return errorResponse("Unauthorized", 401, req);

    const url = new URL(req.url);
    const targetUid = url.searchParams.get("uid") || user.uid;

    // المسؤول يمكنه رؤية أرباح أي مطور
    if (targetUid !== user.uid) {
      const { data: me } = await sbAdmin
        .from("users").select("role").eq("id", user.uid).single();
      const role = (me as Record<string,string> | null)?.role;
      if (role !== "admin" && role !== "moderator") {
        return errorResponse("Forbidden", 403, req);
      }
    }

    // جلب بيانات المطور
    const { data: userData } = await sbAdmin
      .from("users")
      .select("linkvertise_publisher_id, linkvertise_earnings, linkvertise_last_sync, linkvertise_global_enabled")
      .eq("id", targetUid)
      .single();

    if (!userData) return errorResponse("User not found", 404, req);

    const publisherId = userData.linkvertise_publisher_id as string || "";
    const storedEarnings = (userData.linkvertise_earnings as number) || 0;
    const lastSync = userData.linkvertise_last_sync as string | null;
    const globalEnabled = userData.linkvertise_global_enabled as boolean;

    // إحصاء النقرات من قاعدة البيانات (مقياس داخلي)
    const { count: totalClicks } = await sbAdmin
      .from("linkvertise_clicks")
      .select("*", { count: "exact", head: true })
      .eq("maintainer_uid", targetUid);

    // نقرات اليوم
    const today = new Date().toISOString().slice(0, 10);
    const { count: todayClicks } = await sbAdmin
      .from("linkvertise_clicks")
      .select("*", { count: "exact", head: true })
      .eq("maintainer_uid", targetUid)
      .gte("clicked_at", `${today}T00:00:00Z`);

    // نقرات هذا الشهر
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const { count: monthClicks } = await sbAdmin
      .from("linkvertise_clicks")
      .select("*", { count: "exact", head: true })
      .eq("maintainer_uid", targetUid)
      .gte("clicked_at", monthStart.toISOString());

    // محاولة جلب أرباح حقيقية من Linkvertise API لو عنده Publisher ID
    let liveEarnings: number | null = null;
    let syncError: string | null = null;

    if (publisherId) {
      try {
        // Linkvertise Statistics API
        const lvRes = await fetch(
          `https://publisher.linkvertise.com/api/v1/publisher/link/statistics?publisher_id=${publisherId}`,
          {
            headers: { "Accept": "application/json" },
            signal: AbortSignal.timeout(5000),
          }
        );
        if (lvRes.ok) {
          const lvData = await lvRes.json() as Record<string, unknown>;
          // الأرباح الإجمالية (يعتمد على بنية API الفعلية)
          const raw = lvData?.data as Record<string, unknown> | null;
          if (raw?.total_earnings !== undefined) {
            liveEarnings = parseFloat(String(raw.total_earnings)) || 0;
          }

          // تحديث الأرباح المخزّنة لو تغيّرت
          if (liveEarnings !== null && Math.abs(liveEarnings - storedEarnings) > 0.001) {
            const platformFee = liveEarnings * PLATFORM_CUT;
            const netEarnings = Math.max(0, liveEarnings - platformFee);
            await sbAdmin.from("users").update({
              linkvertise_earnings: netEarnings,
              linkvertise_last_sync: new Date().toISOString(),
            }).eq("id", targetUid);
          }
        }
      } catch (e: unknown) {
        syncError = e instanceof Error ? e.message : "Sync failed";
      }
    }

    const displayEarnings = liveEarnings !== null
      ? Math.max(0, liveEarnings * (1 - PLATFORM_CUT))
      : storedEarnings;

    return jsonResponse({
      publisherId,
      globalEnabled,
      earnings: {
        gross:     liveEarnings ?? storedEarnings,
        net:       displayEarnings,
        platform:  displayEarnings > 0 ? displayEarnings * PLATFORM_CUT / (1 - PLATFORM_CUT) : 0,
        currency:  "USD",
      },
      clicks: {
        total: totalClicks ?? 0,
        today: todayClicks ?? 0,
        month: monthClicks ?? 0,
      },
      lastSync,
      syncError,
    }, 200, req);

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return errorResponse(msg, 500, req);
  }
}
