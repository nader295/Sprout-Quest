// app/api/reports/route.ts — Supabase فقط
import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, getClientIp, rateLimit, rateLimitUserOrIp, rateLimitedResponse } from "@/lib/api/middleware";
import { reportSchema } from "@/lib/api/schemas";
import { verifyRequest, isAdmin } from "@/lib/firebase/auth-verify";
import { MODERATION, XP_REWARDS } from "@/lib/constants";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 30)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user || !isAdmin(user)) return errorResponse("Unauthorized", 401);

  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "pending";
  const max    = Math.min(Number(searchParams.get("limit")) || 20, 50);

  let q = sb.from("reports").select("*").order("created_at", { ascending: false }).limit(max);
  if (status !== "all") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return errorResponse(error.message, 500);
  return jsonResponse({ items: data ?? [], count: data?.length ?? 0 });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  // Reports are a classic harassment vector; keep the IP wall strict.
  if (!await rateLimit(`reports:${ip}`, 10, 60_000)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user) return errorResponse("Unauthorized", 401);

  // Per-uid 5/min matches the legacy per-IP limit and stops a single abuser
  // filing mass reports to trigger auto-hide / auto-suspend on a target.
  if (!(await rateLimitUserOrIp(user.uid, ip, { perUser: 5, perIp: 20, scope: "reports" }))) {
    return rateLimitedResponse(req);
  }

  const sb = getSupabaseAdmin();

  // Check reporter credibility
  const { data: reporter } = await sb
    .from("users").select("created_at, xp, is_suspended").eq("id", user.uid).single();

  const ageDays = reporter?.created_at
    ? (Date.now() - new Date(reporter.created_at).getTime()) / 86_400_000
    : 0;

  if (ageDays < MODERATION.MIN_ACCOUNT_AGE_DAYS && (reporter?.xp ?? 0) < MODERATION.MIN_XP_TO_REPORT) {
    return errorResponse(
      `Your account must be at least ${MODERATION.MIN_ACCOUNT_AGE_DAYS} days old or have ${MODERATION.MIN_XP_TO_REPORT}+ XP to submit reports`,
      403
    );
  }

  const body   = await req.json().catch(() => null);
  if (!body) return errorResponse("Invalid JSON body", 400);
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues.map(i => i.message).join(", "), 400);

  // Get target owner UID
  let targetOwnerId: string | undefined;
  if (parsed.data.targetType === "rom") {
    const { data: rom } = await sb.from("roms").select("maintainer_uid").eq("id", parsed.data.targetId).single();
    targetOwnerId = rom?.maintainer_uid;
  } else if (parsed.data.targetType === "user") {
    targetOwnerId = parsed.data.targetId;
  }

  // Block self-reports (abuse prevention — reporting your own content wastes moderator time)
  if (targetOwnerId && targetOwnerId === user.uid) {
    return errorResponse("You cannot report your own content", 400);
  }

  // Prevent a single user from inflating valid_reports_count by filing
  // multiple reports on the same target. One active report per user/target.
  const { data: existing } = await sb
    .from("reports")
    .select("id")
    .eq("reporter_uid", user.uid)
    .eq("target_type", parsed.data.targetType)
    .eq("target_id", parsed.data.targetId)
    .in("status", ["pending", "valid"])
    .limit(1)
    .maybeSingle();

  if (existing) {
    return errorResponse("You have already reported this item", 409);
  }

  const { data: inserted, error } = await sb.from("reports").insert({
    reporter_uid: user.uid,
    target_type:  parsed.data.targetType,
    target_id:    parsed.data.targetId,
    reason:       parsed.data.reason,
    details:      parsed.data.details ?? "",
    status:       "pending",
    created_at:   new Date().toISOString(),
    updated_at:   new Date().toISOString(),
  }).select("id").single();

  if (error) return errorResponse(error.message, 500);

  // Notify target owner
  if (targetOwnerId && targetOwnerId !== user.uid) {
    const { sendNotif } = await import("@/lib/server/notifications");
    const typeLabel = parsed.data.targetType === "rom" ? "منشور" : "تعليق";
    sendNotif({
      recipientUid: targetOwnerId,
      type: "moderation",
      title: `⚠️ تم الإبلاغ عن ${typeLabel} من محتواك`,
      body: `سبب البلاغ: ${parsed.data.reason}. قيد المراجعة من الإدارة.`,
      link: parsed.data.targetType === "rom" ? `/rom/${parsed.data.targetId}` : "/",
      dedupKey: `report_notif_${inserted?.id}`,
    }).catch((err) => logger.error("reports.post.notifOwner", err, { targetOwnerId, reportId: inserted?.id }));
  }

  return jsonResponse({ id: inserted?.id, message: "Report submitted" }, 201);
}

export async function PUT(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 20, 60_000)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user || !isAdmin(user)) return errorResponse("Unauthorized", 401);

  const sb  = getSupabaseAdmin();
  const { id, status, adminNote } = await req.json();
  if (!id) return errorResponse("Missing id", 400);
  if (!["pending", "resolved", "valid", "invalid", "reviewed", "dismissed", "actioned"].includes(status))
    return errorResponse("Invalid status", 400);

  const { data: report } = await sb.from("reports").select("*").eq("id", id).single();
  if (!report) return errorResponse("Report not found", 404);

  if (status === "valid"   && report.status !== "valid")   await handleValidReport(sb, report);
  if (status === "invalid" && report.status !== "invalid") await handleInvalidReport(sb, report);

  const updates: Record<string, unknown> = {
    status, updated_at: new Date().toISOString(), reviewed_by: user.uid,
  };
  if (adminNote !== undefined) updates.admin_note = adminNote;

  await sb.from("reports").update(updates).eq("id", id);
  return jsonResponse({ success: true });
}

async function handleValidReport(sb: ReturnType<typeof getSupabaseAdmin>, report: Record<string, unknown>) {
  const targetOwnerId = report.target_type === "user"
    ? report.target_id as string
    : undefined;

  if (!targetOwnerId && report.target_type === "rom") {
    const { data: rom } = await sb.from("roms").select("maintainer_uid").eq("id", report.target_id as string).single();
    if (!rom) return;
    const ownerId = rom.maintainer_uid;

    const { data: owner } = await sb.from("users").select("valid_reports_count, xp").eq("id", ownerId).single();
    const validCount = ((owner as Record<string, number>)?.valid_reports_count ?? 0) + 1;

    await sb.from("users").update({ valid_reports_count: validCount, updated_at: new Date().toISOString() }).eq("id", ownerId);

    if (validCount >= MODERATION.REPORTS_TO_HIDE_CONTENT) {
      await sb.from("roms").update({ hidden: true, updated_at: new Date().toISOString() }).eq("id", report.target_id as string);
    }

    const now = new Date();
    if (validCount >= MODERATION.REPORTS_TO_SUSPEND_7D) {
      const until = new Date(now.getTime() + MODERATION.SUSPENSION_7D_MS);
      await sb.from("users").update({
        is_suspended: true, suspended_until: until.toISOString(),
        suspension_reason: `Suspended 7 days due to ${validCount} valid reports`,
      }).eq("id", ownerId);
    } else if (validCount >= MODERATION.REPORTS_TO_SUSPEND_24H) {
      const until = new Date(now.getTime() + MODERATION.SUSPENSION_24H_MS);
      await sb.from("users").update({
        is_suspended: true, suspended_until: until.toISOString(),
        suspension_reason: `Suspended 24h due to ${validCount} valid reports`,
      }).eq("id", ownerId);
    }
  }
}

async function handleInvalidReport(sb: ReturnType<typeof getSupabaseAdmin>, report: Record<string, unknown>) {
  const reporterUid = report.reporter_uid as string;
  if (!reporterUid) return;

  const { data: reporter } = await sb.from("users").select("xp, false_reports_count").eq("id", reporterUid).single();
  const falseCount = ((reporter as Record<string, number>)?.false_reports_count ?? 0) + 1;
  const oldXP = ((reporter as Record<string, number>)?.xp ?? 0);
  const newXP = Math.max(0, oldXP + XP_REWARDS.FALSE_REPORT_PENALTY);

  const updates: Record<string, unknown> = {
    false_reports_count: falseCount, xp: newXP, updated_at: new Date().toISOString(),
  };

  if (falseCount >= MODERATION.FALSE_REPORTS_TO_BAN) {
    updates.report_banned_until = new Date(Date.now() + MODERATION.REPORT_BAN_DURATION_MS).toISOString();
    updates.false_reports_count = 0;
  }

  await sb.from("users").update(updates).eq("id", reporterUid);

  // ── سجّل الخصم في xp_history حتى يُحسب بشكل صحيح عند resetXP ──
  if (newXP !== oldXP) {
    await sb.from("xp_history").insert({
      uid: reporterUid,
      amount: newXP - oldXP, // سالب دايماً
      reason: "FALSE_REPORT_PENALTY",
      before: oldXP,
      after: newXP,
      ts: new Date().toISOString(),
    });
  }
}

export async function OPTIONS() { return jsonResponse({}); }
