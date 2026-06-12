/**
 * app/api/archive-reports/route.ts
 * Supabase-only migration
 * GET  /api/archive-reports?status=pending  → للأدمن
 * POST /api/archive-reports                 → تقديم بلاغ تصحيح
 * PUT  /api/archive-reports                 → الأدمن يوافق أو يرفض
 */

import { NextRequest, NextResponse } from "next/server";
import { sbAdmin } from "@/lib/supabase/admin";
import { verifyRequest, isAdmin } from "@/lib/firebase/auth-verify";
import { getClientIp, rateLimit, rateLimitedResponse } from "@/lib/api/middleware";

const REPORT_TYPES = ["wrong_codename", "wrong_name", "wrong_chipset", "wrong_rom", "duplicate", "missing_info", "other"] as const;
type ReportType = typeof REPORT_TYPES[number];

// XP للمبلّغ لو البلاغ صح
const XP_CORRECT_REPORT = 30;

// ── GET — للأدمن ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(`ar_get:${ip}`, 30)) return rateLimitedResponse(req);
  const user = await verifyRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);

  // المستخدم العادي يشوف بلاغاته هو بس
  if (searchParams.get("mine") === "true") {
    const { data } = await sbAdmin.from("archive_reports")
      .select("*")
      .eq("reporter_uid", user.uid)
      .order("created_at", { ascending: false })
      .limit(20);
    return NextResponse.json({ items: data ?? [] });
  }

  if (!isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = searchParams.get("status") || "pending";
  let q = sbAdmin.from("archive_reports").select("*").order("created_at", { ascending: false }).limit(50);
  
  if (status !== "all") {
    q = q.eq("status", status);
  }
  
  const { data } = await q;
  return NextResponse.json({ items: data ?? [] });
}

// ── POST — تقديم بلاغ ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(`ar_post_h:${ip}`, 3,  3_600_000)) return rateLimitedResponse(req); // 3/ساعة
  if (!await rateLimit(`ar_post_d:${ip}`, 20, 86_400_000)) return rateLimitedResponse(req); // 20/يوم
  const user = await verifyRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { codename, report_type, current_value, suggested_value, note, rom_id } = body || {};

  if (!codename || !report_type || !REPORT_TYPES.includes(report_type as ReportType)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // تحقق من عدم تكرار البلاغ (نفس المستخدم، نفس الكودنيم، نفس النوع، خلال 24 ساعة)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await sbAdmin.from("archive_reports")
    .select("id")
    .eq("reporter_uid", user.uid)
    .eq("codename", codename)
    .eq("report_type", report_type)
    .gte("created_at", oneDayAgo)
    .maybeSingle();
    
  if (existing) {
    return NextResponse.json({ error: "You already submitted this report recently" }, { status: 429 });
  }

  const { data: userData } = await sbAdmin.from("users").select("name").eq("id", user.uid).maybeSingle();

  const { data: inserted } = await sbAdmin.from("archive_reports").insert({
    codename,
    report_type,
    current_value: current_value || "",
    suggested_value: suggested_value || "",
    note: note || "",
    rom_id: rom_id || null,
    reporter_uid: user.uid,
    reporter_name: userData?.name || "",
    status: "pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select("id").single();

  return NextResponse.json({ id: inserted?.id, message: "Report submitted" }, { status: 201 });
}

// ── PUT — الأدمن يوافق أو يرفض ───────────────────────────────────────
export async function PUT(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(`ar_put:${ip}`, 20)) return rateLimitedResponse(req);
  const user = await verifyRequest(req);
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { id, action, admin_note } = body || {};
  if (!id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
  }

  const { data: report } = await sbAdmin.from("archive_reports").select("*").eq("id", id).maybeSingle();
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "approve") {
    // طبّق التصحيح في Supabase devices table
    await applyCorrection(report);

    // +XP للمبلّغ
    if (report.reporter_uid) {
      await sbAdmin.rpc("increment_user_xp", { p_uid: report.reporter_uid, p_amount: XP_CORRECT_REPORT }).then(() => {}, () => {});
    }

    await sbAdmin.from("archive_reports").update({
      status: "approved",
      admin_note: admin_note || "",
      reviewed_by: user.uid,
      updated_at: new Date().toISOString(),
    }).eq("id", id);

    // سجّل في admin_logs (Supabase)
    void sbAdmin.from("admin_logs").insert({
      type: "archive_report", action: "approved",
      by: user.uid, report_id: id,
      metadata: { codename: report.codename, report_type: report.report_type },
      created_at: new Date().toISOString(),
    }).then(undefined, () => {});

    return NextResponse.json({ ok: true, action: "approved", xp_awarded: XP_CORRECT_REPORT });
  }

  // reject
  await sbAdmin.from("archive_reports").update({
    status: "rejected",
    admin_note: admin_note || "",
    reviewed_by: user.uid,
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  return NextResponse.json({ ok: true, action: "rejected" });
}

// ── تطبيق التصحيح في Supabase — بـ RPC transaction لمنع نصف تحديث ─────
async function applyCorrection(report: Record<string, unknown>): Promise<void> {
  const codename = report.codename as string;
  const report_type = report.report_type as string;
  const suggested_value = report.suggested_value as string;
  const rom_id = report.rom_id as string | null;
  
  if (!codename) return;

  switch (report_type) {
    case "wrong_codename": {
      // نقل كل الـ ROMs للكودنيم الصح باستخدام RPC transaction
      // BEGIN → UPDATE roms → UPDATE devices aliases → COMMIT
      if (suggested_value) {
        // أولاً: جيب الـ aliases الحالية
        const { data: dev } = await sbAdmin.from("devices")
          .select("aliases").eq("codename", codename).maybeSingle();
        const currentAliases = (dev?.aliases as string[]) ?? [];
        // أضف الكودنيم القديم كـ alias لو مش موجود
        const newAliases = currentAliases.includes(codename)
          ? currentAliases
          : [...currentAliases, codename];

        // حاول باستخدام DB function لو متوفرة، وإلا sequential مع error handling
        const { error: rpcError } = await sbAdmin.rpc("transfer_device_codename", {
          p_old_codename: codename,
          p_new_codename: suggested_value,
          p_aliases:      newAliases,
        });

        if (rpcError) {
          // Fallback: sequential بدون transaction لو الـ RPC مش موجودة
          const { error: romsErr } = await sbAdmin.from("roms")
            .update({ device_codename: suggested_value })
            .eq("device_codename", codename);
          if (!romsErr) {
            await sbAdmin.from("devices")
              .update({ aliases: newAliases })
              .eq("codename", suggested_value)
              .then(() => {}, () => {});
          }
        }
      }
      break;
    }
    case "wrong_name": {
      if (suggested_value) {
        await sbAdmin.from("devices").update({ display_name: suggested_value })
          .eq("codename", codename).then(() => {}, () => {});
      }
      break;
    }
    case "wrong_chipset": {
      if (suggested_value) {
        await sbAdmin.from("devices").update({ chipset: suggested_value })
          .eq("codename", codename).then(() => {}, () => {});
      }
      break;
    }
    case "missing_info": {
      // البيانات الناقصة في suggested_value كـ JSON string
      const ALLOWED_COLS = ['display_name', 'chipset', 'released', 'image_url', 'brand', 'storage', 'ram'] as const;
      try {
        const raw = JSON.parse(suggested_value) as Record<string, unknown>;
        const updates: Record<string, unknown> = {};
        for (const key of ALLOWED_COLS) {
          if (key in raw && raw[key] !== undefined) updates[key] = raw[key];
        }
        if (Object.keys(updates).length > 0) {
          await sbAdmin.from("devices").update(updates)
            .eq("codename", codename).then(() => {}, () => {});
        }
      } catch { /* ignore parse error */ }
      break;
    }
    case "wrong_rom": {
      // ROM في أرشيف غلط — صحّح الكودنيم في الـ ROM المحدد
      if (rom_id && suggested_value) {
        await sbAdmin.from("roms").update({ device_codename: suggested_value })
          .eq("id", rom_id).then(() => {}, () => {});
      }
      break;
    }
    case "duplicate": {
      // أرشيف مكرر — دمج الـ ROMs من الكودنيم الخاطئ إلى الصحيح
      if (codename && suggested_value) {
        // نقل الـ ROMs من الكودنيم القديم للجديد
        await sbAdmin.from("roms")
          .update({ device_codename: suggested_value })
          .eq("device_codename", codename)
          .then(() => {}, () => {});
        // حذف الجهاز المكرر لو مفيش ROMs تانية بيه
        const { count } = await sbAdmin.from("roms")
          .select("id", { count: "exact", head: true })
          .eq("device_codename", codename)
          .then(r => r, () => ({ count: 1 }));
        if (!count || count === 0) {
          await sbAdmin.from("devices").delete()
            .eq("codename", codename)
            .then(() => {}, () => {});
        }
      }
      break;
    }
    default:
      // "other" → نتجاهلها (مش فيها action محدد)
      break;
  }
}
