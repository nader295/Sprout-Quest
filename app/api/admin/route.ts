// app/api/admin/route.ts — Supabase فقط
import { NextRequest, NextResponse } from "next/server";
import { verifyRequest, isAdmin } from "@/lib/firebase/auth-verify";
import { getClientIp, rateLimit, rateLimitedResponse } from "@/lib/api/middleware";
import { broadcastNotif } from "@/lib/server/notifications";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}
function errorResponse(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(`admin_get:${ip}`, 60)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  // ── List users ───────────────────────────────────────────
  if (action === "listUsers") {
    const max     = Math.min(Number(searchParams.get("max")) || 50, 500);
    const search  = searchParams.get("search") || "";
    const role    = searchParams.get("role") || "";

    let q = sb.from("users").select("*").order("created_at", { ascending: false }).limit(max);
    if (search) q = q.or(`name.ilike.%${search}%,username.ilike.%${search}%,email.ilike.%${search}%`);
    if (role)   q = q.eq("role", role);

    const { data } = await q;
    return NextResponse.json({ items: data ?? [] });
  }

  // ── List applications ─────────────────────────────────────
  if (action === "listApplications") {
    const status = searchParams.get("status") || "pending";
    let q = sb.from("applications").select("*").order("created_at", { ascending: false }).limit(50);
    if (status !== "all") q = q.eq("status", status);
    const { data } = await q;
    return NextResponse.json({ items: data ?? [] });
  }

  // ── List reports ──────────────────────────────────────────
  if (action === "listReports") {
    const { data } = await sb.from("reports").select("*")
      .order("created_at", { ascending: false }).limit(50);
    return NextResponse.json({ items: data ?? [] });
  }

  // ── Dashboard stats ───────────────────────────────────────
  // Reads from real tables (not cached platform_stats) for accurate counts
  if (action === "dashboardStats") {
    const [
      { count: totalRoms },
      { count: totalUsers },
      { count: totalKernels },
      { count: totalRecoveries },
      { count: totalModules },
      { count: totalGsis },
      { count: pendingReports },
    ] = await Promise.all([
      sb.from("roms").select("*", { count: "exact", head: true }),
      sb.from("users").select("*", { count: "exact", head: true }),
      sb.from("roms").select("*", { count: "exact", head: true }).eq("content_type", "kernel"),
      sb.from("roms").select("*", { count: "exact", head: true }).eq("content_type", "recovery"),
      sb.from("roms").select("*", { count: "exact", head: true }).eq("content_type", "module"),
      sb.from("roms").select("*", { count: "exact", head: true }).eq("content_type", "gsi"),
      sb.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    return NextResponse.json({
      roms:       totalRoms       ?? 0,
      kernels:    totalKernels    ?? 0,
      recoveries: totalRecoveries ?? 0,
      modules:    totalModules    ?? 0,
      gsis:       totalGsis       ?? 0,
      users:      totalUsers      ?? 0,
      reports:    pendingReports  ?? 0,
      downloads:  0,
    });
  }

  // ── Health Stats ──────────────────────────────────────────
  if (action === "healthStats") {
    const [{ count: banned }, { count: suspended }, { count: pendingAppeals }] = await Promise.all([
      sb.from("users").select("*", { count: "exact", head: true }).eq("role", "banned"),
      sb.from("users").select("*", { count: "exact", head: true }).eq("is_suspended", true),
      sb.from("appeals").select("*", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    return NextResponse.json({
      banned: banned ?? 0,
      suspended: suspended ?? 0,
      pendingAppeals: pendingAppeals ?? 0,
    });
  }

  // ── List Announcements ────────────────────────────────────
  if (action === "listAnnouncements") {
    const { data } = await sb.from("announcements").select("*").order("created_at", { ascending: false });
    return NextResponse.json({ items: data ?? [] });
  }

  // ── Ad Support Stats ──────────────────────────────────────
  if (action === "adSupportStats") {
    const { data } = await sb.from("platform_stats").select("key, value").like("key", "ad_%");
    const statsMap = Object.fromEntries((data ?? []).map(s => [s.key, s.value]));
    return NextResponse.json(statsMap);
  }

  // ── Get Ad Config ─────────────────────────────────────────
  if (action === "getAdConfig") {
    const { data } = await sb.from("settings").select("value").eq("key", "ad_config").maybeSingle();
    return NextResponse.json(data?.value ?? {});
  }

  // ── Get Owner Vault ───────────────────────────────────────
  if (action === "getOwnerVault") {
    const { data } = await sb.from("settings").select("value").eq("key", "owner_vault").maybeSingle();
    return NextResponse.json(data?.value ?? {});
  }

  // ── Get single user ───────────────────────────────────────
  if (action === "getUser") {
    const uid = searchParams.get("uid");
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });
    const { data } = await sb.from("users").select("*").eq("id", uid).single();
    return NextResponse.json(data ?? null);
  }

  // ── Admin logs ────────────────────────────────────────────
  if (action === "logs") {
    const max  = Math.min(Number(searchParams.get("max")) || 50, 200);
    const type = searchParams.get("type") || "";
    let q = sb.from("admin_logs").select("*").order("created_at", { ascending: false }).limit(max);
    if (type) q = q.eq("type", type);
    const { data } = await q;
    return NextResponse.json({ items: data ?? [] });
  }

  // ── Recent Activity (Owner tab) ──────────────────────
  if (action === "recentActivity") {
    const [{ data: recentRoms }, { data: recentUsers }, { data: recentReports }] = await Promise.all([
      sb.from("roms").select("id, name, device, maintainer_name, created_at").order("created_at", { ascending: false }).limit(5),
      sb.from("users").select("id, name, username, email, photo, created_at").order("created_at", { ascending: false }).limit(5),
      sb.from("reports").select("id, target_type, reason, reporter_name, created_at").order("created_at", { ascending: false }).limit(5),
    ]);
    return jsonResponse({
      recentRoms: (recentRoms ?? []).map(r => ({ id: r.id, name: r.name, device: r.device, maintainerName: r.maintainer_name, createdAt: r.created_at })),
      recentUsers: (recentUsers ?? []).map(u => ({ id: u.id, name: u.name, username: u.username, email: u.email, photo: u.photo, createdAt: u.created_at })),
      recentReports: (recentReports ?? []).map(r => ({ id: r.id, targetType: r.target_type, reason: r.reason, reporterName: r.reporter_name, createdAt: r.created_at })),
    });
  }

  // ── Fraud alerts ──────────────────────────────────────────
  if (action === "fraudAlerts") {
    const { data } = await sb.from("fraud_alerts").select("*")
      .eq("reviewed", false).order("ts", { ascending: false }).limit(50);
    return jsonResponse({ items: data ?? [] });
  }

  return errorResponse("Unknown action");
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(`admin_post:${ip}`, 20)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sb   = getSupabaseAdmin();
  const body = await req.json().catch(() => ({}));

  // ── Broadcast notification ────────────────────────────────
  if (body.action === "broadcast") {
    const { title, message, link } = body;
    if (!title || !message) return NextResponse.json({ error: "title and message required" }, { status: 400 });
    const sent = await broadcastNotif({ type: "broadcast", title, body: message, link });
    return NextResponse.json({ sent });
  }

  // ── Update user role ──────────────────────────────────────
  if (body.action === "setRole") {
    const { uid, role } = body;
    if (!uid || !role) return NextResponse.json({ error: "uid and role required" }, { status: 400 });
    const allowed = ["user", "verifiedDev", "moderator", "admin", "banned"];
    if (!allowed.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

    await sb.from("users").update({ role, updated_at: new Date().toISOString() }).eq("id", uid);
    await sb.from("admin_logs").insert({
      type: "role_change", uid,
      data: { newRole: role, by: user.uid },
      created_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  }

  // ── Suspend user ──────────────────────────────────────────
  if (body.action === "suspend") {
    const { uid, reason, days } = body;
    if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });
    const until = new Date(Date.now() + (days || 1) * 86_400_000).toISOString();

    await sb.from("users").update({
      is_suspended: true, suspended_until: until,
      suspension_reason: reason ?? "Suspended by admin",
      updated_at: new Date().toISOString(),
    }).eq("id", uid);

    await sb.from("admin_logs").insert({
      type: "user_suspended", uid,
      data: { reason, days, until, by: user.uid },
      created_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  }

  // ── Unsuspend user ────────────────────────────────────────
  if (body.action === "unsuspend") {
    const { uid } = body;
    if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

    await sb.from("users").update({
      is_suspended: false, suspended_until: null, suspension_reason: "",
      updated_at: new Date().toISOString(),
    }).eq("id", uid);

    await sb.from("admin_logs").insert({
      type: "user_unsuspended", uid,
      data: { by: user.uid },
      created_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  }

  // ── Update announcement ───────────────────────────────────
  if (body.action === "setAnnouncement") {
    const { text, link, active } = body;
    if (text) {
      await sb.from("announcements").insert({
        text, link: link ?? "", active: active ?? true,
        created_at: new Date().toISOString(),
      });
    } else {
      await sb.from("announcements").update({ active: false }).eq("active", true);
    }
    return NextResponse.json({ ok: true });
  }

  // ── Update settings ───────────────────────────────────────
  if (body.action === "updateSettings") {
    const { key, value } = body;
    if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
    await sb.from("settings").upsert({
      key, value, updated_at: new Date().toISOString(),
    }, { onConflict: "key" });
    return NextResponse.json({ ok: true });
  }

  // ── Mark fraud alert reviewed ─────────────────────────────
  if (body.action === "reviewFraud") {
    const { id } = body;
    await sb.from("fraud_alerts").update({ reviewed: true }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  // ── Admin Adjust XP ───────────────────────────────────────
  if (body.action === "adjustXP") {
    const { uid, amount, reason } = body;
    if (!uid || typeof amount !== "number") return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    
    // Fetch current
    const { data: u } = await sb.from("users").select("xp").eq("id", uid).single();
    const newXp = Math.max(0, (u?.xp || 0) + amount);

    await sb.from("users").update({ xp: newXp, updated_at: new Date().toISOString() }).eq("id", uid);
    await sb.from("xp_history").insert({
      uid, amount, reason: reason || "admin_adjustment",
      before: u?.xp || 0, after: newXp, ts: new Date().toISOString()
    });
    return NextResponse.json({ ok: true });
  }

  // ═══════════════════════════════════════════════════════════
  // ── XP Helpers ───────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════
  const ROM_PUBLISH_XP_MAP: Record<string, number> = {
    rom: 30, kernel: 25, recovery: 20, module: 15, gsi: 20,
  };
  const ACHIEVEMENT_XP_MAP: Record<string, number> = {
    first_rom: 50,  rom_5: 100,        rom_20: 300,
    likes_10: 30,   likes_100: 100,    likes_1000: 500,
    dl_100: 75,     dl_1000: 300,      dl_5000: 800,
    followers_10: 50, followers_100: 200, followers_500: 600,
    views_1000: 50, views_10000: 200,  views_100000: 1000,
    rated_10: 25,   commenter_10: 20,
    verified_dev: 150, early_adopter: 100,
  };

  // حساب XP لمستخدم واحد — هجين:
  // ✅ ROMs data  → publish, likes, downloads, views, milestones  (دايماً دقيقة)
  // ✅ xp_history → VERSION_UPDATE, COMMENT_FIRST, NEW_FOLLOWER   (سُجّلت وقت الحدث الفعلي)
  // ✅ achievements array → XP الإنجازات
  async function computeXPForUser(uid: string, achievements: string[], roms: {
    id: string; content_type: string; likes_count: number; downloads: number;
    total_views: number; milestone_100_awarded: boolean; milestone_500_awarded: boolean;
    milestone_1000_awarded: boolean;
  }[]): Promise<{ calcXP: number; breakdown: Record<string, number> }> {
    const breakdown: Record<string, number> = {
      publish: 0, likes: 0, downloads: 0, views: 0,
      milestones: 0, versions: 0, comments: 0, followers: 0,
      achievements: 0, adjustments: 0,
    };

    // ── من بيانات الـ ROMs (دايماً دقيقة) ─────────────────────
    for (const rom of roms) {
      breakdown.publish   += ROM_PUBLISH_XP_MAP[rom.content_type] ?? 20;
      breakdown.likes     += (rom.likes_count ?? 0) * 3;
      breakdown.downloads += Math.floor((rom.downloads ?? 0) / 10) * 2;
      breakdown.views     += Math.floor((rom.total_views ?? 0) / 100);
      if (rom.milestone_100_awarded)  breakdown.milestones += 20;
      if (rom.milestone_500_awarded)  breakdown.milestones += 50;
      if (rom.milestone_1000_awarded) breakdown.milestones += 100;
    }

    // ── من xp_history: فقط الأحداث اللي ما نقدرش نحسبها من بيانات الـ ROMs ──
    // VERSION_UPDATE  → يتمنح في put.ts لما يتغير حقل version في الـ ROM
    // COMMENT_FIRST   → يتمنح مرة واحدة لأول تعليق فريد
    // NEW_FOLLOWER    → يتمنح عند كل متابعة جديدة
    // admin_adjustment → تعديل يدوي من الأدمن (إيجابي أو سلبي)
    // FALSE_REPORT_PENALTY → خصم بسبب بلاغ كاذب
    // deduction       → خصم عام (مثل حذف تعليق)
    const { data: historyRows } = await sb
      .from("xp_history")
      .select("amount, reason")
      .eq("uid", uid)
      .in("reason", ["VERSION_UPDATE", "COMMENT_FIRST", "NEW_FOLLOWER",
                     "admin_adjustment", "FALSE_REPORT_PENALTY", "deduction"]);

    for (const row of historyRows ?? []) {
      const amt = row.amount ?? 0;
      if (row.reason === "VERSION_UPDATE")        breakdown.versions      += amt;
      else if (row.reason === "COMMENT_FIRST")    breakdown.comments      += amt;
      else if (row.reason === "NEW_FOLLOWER")     breakdown.followers     += amt;
      else if (row.reason === "admin_adjustment"
            || row.reason === "FALSE_REPORT_PENALTY"
            || row.reason === "deduction")        breakdown.adjustments   = (breakdown.adjustments ?? 0) + amt;
    }

    // ── XP الإنجازات من مصفوفة achievements ─────────────────
    for (const achId of achievements) {
      breakdown.achievements += ACHIEVEMENT_XP_MAP[achId] ?? 0;
    }

    const calcXP = Math.max(0,
      breakdown.publish + breakdown.likes + breakdown.downloads +
      breakdown.views + breakdown.milestones + breakdown.versions +
      breakdown.comments + breakdown.followers + breakdown.achievements +
      breakdown.adjustments
    );
    return { calcXP, breakdown };
  }

  // ── Admin Reset/Recalculate XP (single user) ──────────────
  if (body.action === "resetXP") {
    const { uid } = body;
    if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

    try {
      const { data: u } = await sb.from("users").select("xp, achievements").eq("id", uid).single();
      const oldXP = u?.xp ?? 0;

      const { data: roms } = await sb.from("roms")
        .select("id, content_type, likes_count, downloads, total_views, milestone_100_awarded, milestone_500_awarded, milestone_1000_awarded")
        .eq("maintainer_uid", uid);

      const { calcXP, breakdown } = await computeXPForUser(
        uid,
        (u?.achievements ?? []) as string[],
        (roms ?? []) as Parameters<typeof computeXPForUser>[2]
      );

      await sb.from("users").update({ xp: calcXP, updated_at: new Date().toISOString() }).eq("id", uid);

      if (calcXP !== oldXP) {
        await sb.from("xp_history").insert({
          uid, amount: calcXP - oldXP, reason: "admin_recalculate_xp",
          before: oldXP, after: calcXP, ts: new Date().toISOString(),
        });
      }

      await sb.from("admin_logs").insert({
        type: "xp_reset", uid,
        data: { by: user.uid, oldXp: oldXP, newXp: calcXP, breakdown },
        created_at: new Date().toISOString(),
      });

      return NextResponse.json({ ok: true, recalculatedXp: calcXP, breakdown });
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: "Recalculation failed" }, { status: 500 });
    }
  }

  // ── Admin Reset ALL users XP at once ──────────────────────
  if (body.action === "resetAllXP") {
    try {
      // جلب كل المستخدمين
      const { data: allUsers } = await sb
        .from("users")
        .select("id, xp, achievements")
        .order("id");

      if (!allUsers?.length) return NextResponse.json({ ok: true, updated: 0 });

      // جلب كل الـ ROMs دفعة واحدة
      const { data: allRoms } = await sb
        .from("roms")
        .select("id, maintainer_uid, content_type, likes_count, downloads, total_views, milestone_100_awarded, milestone_500_awarded, milestone_1000_awarded");

      // تجميع الـ ROMs حسب المستخدم
      const romsByUid: Record<string, typeof allRoms> = {};
      for (const rom of allRoms ?? []) {
        const uid = rom.maintainer_uid as string;
        if (!romsByUid[uid]) romsByUid[uid] = [];
        romsByUid[uid]!.push(rom);
      }

      let updated = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const u of allUsers) {
        try {
          const userRoms = (romsByUid[u.id] ?? []) as Parameters<typeof computeXPForUser>[2];
          const { calcXP, breakdown } = await computeXPForUser(
            u.id,
            (u.achievements ?? []) as string[],
            userRoms
          );

          const oldXP = u.xp ?? 0;
          if (calcXP === oldXP) { skipped++; continue; }

          await sb.from("users")
            .update({ xp: calcXP, updated_at: new Date().toISOString() })
            .eq("id", u.id);

          await sb.from("xp_history").insert({
            uid: u.id, amount: calcXP - oldXP,
            reason: "admin_recalculate_xp",
            before: oldXP, after: calcXP,
            ts: new Date().toISOString(),
          });

          updated++;
        } catch (err) {
          errors.push(`${u.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      await sb.from("admin_logs").insert({
        type: "xp_reset_all",
        uid: user.uid,
        data: { by: user.uid, total: allUsers.length, updated, skipped, errors: errors.slice(0, 10) },
        created_at: new Date().toISOString(),
      });

      return NextResponse.json({ ok: true, total: allUsers.length, updated, skipped, errors: errors.slice(0, 10) });
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: "Bulk recalculation failed" }, { status: 500 });
    }
  }

  // ── Bulk patch country for users without one ──────────────────
  // يستخدم x-vercel-ip-country header إذا كان المستخدم يطلب من IP معروف
  // لكن هذا endpoint يُشغَّل من الأدمن مش من المستخدم، فمش هيجيب IP صح
  // الحل: نمسح عَلَم الـ sessionStorage من الـ DB (أو نحط flag) حتى يُعاد patch لكل مستخدم
  // في الواقع: نحدّث Supabase بـ show_on_map=true + country من أي بيانات موجودة
  if (body.action === "clearCountryPatchFlags") {
    // هذا الـ action يمسح حقل show_on_map ويضع country = null
    // للمستخدمين الذين عندهم show_on_map=true لكن country فارغة
    // حتى يُعيد use-auth.tsx patch عليهم في الزيارة القادمة
    try {
      const { data: brokenUsers, count } = await sb
        .from("users")
        .select("id", { count: "exact" })
        .or("country.is.null,country.eq.")
        .eq("show_on_map", true);

      if (!brokenUsers?.length) {
        return NextResponse.json({ ok: true, fixed: 0, message: "No users with missing country" });
      }

      const ids = brokenUsers.map(u => u.id);
      // أعد تصفير show_on_map حتى يُعيد use-auth.tsx تحديد الدولة لهم
      await sb.from("users")
        .update({ show_on_map: false, updated_at: new Date().toISOString() })
        .in("id", ids);

      await sb.from("admin_logs").insert({
        type: "country_patch_reset", uid: user.uid,
        data: { by: user.uid, count: ids.length },
        created_at: new Date().toISOString(),
      });

      return NextResponse.json({ ok: true, fixed: ids.length,
        message: `${ids.length} users will be re-patched on next login` });
    } catch (e) {
      console.error(e);
      return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
  }
  if (body.action === "createAnnouncement") {
    const { title, body: msgBody, link, pinned } = body;
    if (!title || !msgBody) return errorResponse("title and body required");
    await sb.from("announcements").insert({
      title, body: msgBody, link: link ?? null, pinned: pinned ?? false,
      active: true, created_at: new Date().toISOString(),
    });
    return jsonResponse({ ok: true });
  }

  // ── Update announcement ────────────────────────────────────
  if (body.action === "updateAnnouncement") {
    const { id, title, body: msgBody, link, pinned } = body;
    if (!id) return errorResponse("id required");
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (title !== undefined) update.title = title;
    if (msgBody !== undefined) update.body = msgBody;
    if (link !== undefined) update.link = link;
    if (pinned !== undefined) update.pinned = pinned;
    await sb.from("announcements").update(update).eq("id", id);
    return jsonResponse({ ok: true });
  }

  // ── Toggle pin announcement ────────────────────────────────
  if (body.action === "togglePinAnnouncement") {
    const { id, pinned } = body;
    if (!id) return errorResponse("id required");
    await sb.from("announcements").update({ pinned: !pinned, updated_at: new Date().toISOString() }).eq("id", id);
    return jsonResponse({ ok: true });
  }

  // ── Delete announcement ────────────────────────────────────
  if (body.action === "deleteAnnouncement") {
    const { id } = body;
    if (!id) return errorResponse("id required");
    await sb.from("announcements").delete().eq("id", id);
    return jsonResponse({ ok: true });
  }

  // ── Handle application (approve/reject) ────────────────────
  if (body.action === "handleApplication") {
    const { id, status, note } = body;
    if (!id || !status) return errorResponse("id and status required");
    const { data: app } = await sb.from("applications").select("uid").eq("id", id).single();
    await sb.from("applications").update({
      status, admin_note: note ?? null, reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (status === "approved" && app?.uid) {
      await sb.from("users").update({ role: "verifiedDev", updated_at: new Date().toISOString() }).eq("id", app.uid);
    }
    await sb.from("admin_logs").insert({
      type: "application_" + status, uid: app?.uid ?? id,
      data: { applicationId: id, status, note, by: user.uid },
      created_at: new Date().toISOString(),
    });
    return jsonResponse({ ok: true });
  }

  // ── Ban/unban user ─────────────────────────────────────────
  if (body.action === "ban") {
    const { uid, ban } = body;
    if (!uid) return errorResponse("uid required");
    const newRole = ban ? "banned" : "user";
    await sb.from("users").update({ role: newRole, updated_at: new Date().toISOString() }).eq("id", uid);
    await sb.from("admin_logs").insert({
      type: ban ? "user_banned" : "user_unbanned", uid,
      data: { by: user.uid }, created_at: new Date().toISOString(),
    });
    return jsonResponse({ ok: true });
  }

  // ── Set featured ROM ───────────────────────────────────────
  if (body.action === "setFeatured") {
    const { romId, featured } = body;
    if (!romId) return errorResponse("romId required");
    await sb.from("roms").update({ featured: featured ?? false, updated_at: new Date().toISOString() }).eq("id", romId);
    return jsonResponse({ ok: true });
  }

  // ── Admin delete ROM ───────────────────────────────────────
  if (body.action === "deleteRom") {
    const { romId } = body;
    if (!romId) return errorResponse("romId required");
    await sb.from("roms").delete().eq("id", romId);
    await sb.from("admin_logs").insert({
      type: "rom_deleted", uid: user.uid,
      data: { romId, by: user.uid }, created_at: new Date().toISOString(),
    });
    return jsonResponse({ ok: true });
  }

  // ── Bulk resolve reports ───────────────────────────────────
  if (body.action === "bulkResolveReports") {
    const { ids, resolution } = body;
    if (!ids?.length || !resolution) return errorResponse("ids and resolution required");
    await sb.from("reports").update({
      status: resolution, reviewed_by: user.uid,
      reviewed_at: new Date().toISOString(),
    }).in("id", ids);
    return jsonResponse({ ok: true });
  }

  // ── Wipe resolved reports ──────────────────────────────────
  if (body.action === "wipeResolvedReports") {
    const { count } = await sb.from("reports").select("*", { count: "exact", head: true }).neq("status", "pending");
    await sb.from("reports").delete().neq("status", "pending");
    return jsonResponse({ ok: true, deleted: count ?? 0 });
  }

  // ── Export users as CSV ────────────────────────────────────
  if (body.action === "exportUsers") {
    const { data: users } = await sb.from("users").select("id, name, username, email, role, xp, created_at").order("created_at", { ascending: false });
    const rows = (users ?? []).map(u => `${u.id},${(u.name || "").replace(/,/g, "")},${u.username || ""},${u.email || ""},${u.role || ""},${u.xp || 0},${u.created_at || ""}`);
    const csv = "id,name,username,email,role,xp,created_at\n" + rows.join("\n");
    return new NextResponse(csv, {
      status: 200,
      headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=romx_users.csv" },
    });
  }

  // ── Recalculate platform stats ─────────────────────────────
  if (body.action === "recalcStats") {
    const [{ count: totalRoms }, { count: totalUsers }, { count: totalKernels }, { count: totalRecoveries }, { count: totalModules }, { count: totalGsis }] = await Promise.all([
      sb.from("roms").select("*", { count: "exact", head: true }),
      sb.from("users").select("*", { count: "exact", head: true }),
      sb.from("roms").select("*", { count: "exact", head: true }).eq("content_type", "kernel"),
      sb.from("roms").select("*", { count: "exact", head: true }).eq("content_type", "recovery"),
      sb.from("roms").select("*", { count: "exact", head: true }).eq("content_type", "module"),
      sb.from("roms").select("*", { count: "exact", head: true }).eq("content_type", "gsi"),
    ]);
    const stats: Record<string, number> = {
      total_roms: totalRoms ?? 0, total_users: totalUsers ?? 0,
      total_kernels: totalKernels ?? 0, total_recoveries: totalRecoveries ?? 0,
      total_modules: totalModules ?? 0, total_gsis: totalGsis ?? 0,
    };
    for (const [key, value] of Object.entries(stats)) {
      await sb.from("platform_stats").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    }
    return jsonResponse({ ok: true, totalRoms: stats.total_roms, totalUsers: stats.total_users });
  }

  // ── Update Ad Config ───────────────────────────────────────
  if (body.action === "updateAdConfig") {
    const { config } = body;
    if (!config) return errorResponse("config required");
    await sb.from("settings").upsert({
      key: "ad_config", value: config, updated_at: new Date().toISOString(),
    }, { onConflict: "key" });
    return jsonResponse({ ok: true });
  }

  // ── Claim Owner Revenue ────────────────────────────────────
  if (body.action === "claimOwnerRevenue") {
    const { note } = body;
    const { data: vault } = await sb.from("settings").select("value").eq("key", "owner_vault").maybeSingle();
    const vaultData = (vault?.value as Record<string, unknown>) ?? {};
    const unclaimed = Number(vaultData.unclaimedPlatformShare ?? 0);
    if (unclaimed <= 0) return jsonResponse({ claimed: 0 });
    const claim = { amount: unclaimed, claimedAt: new Date().toISOString(), note: note ?? "Manual claim" };
    const claims = Array.isArray(vaultData.claims) ? [...vaultData.claims, claim] : [claim];
    await sb.from("settings").upsert({
      key: "owner_vault",
      value: { ...vaultData, unclaimedPlatformShare: 0, totalClaimed: Number(vaultData.totalClaimed ?? 0) + unclaimed, claims },
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });
    return jsonResponse({ claimed: unclaimed });
  }

  // ── Settle Month (pro-rata revenue) ────────────────────────
  if (body.action === "settleMonth") {
    const { month, actualRevenue, note } = body;
    if (!month || typeof actualRevenue !== "number") return errorResponse("month and actualRevenue required");
    await sb.from("admin_logs").insert({
      type: "revenue_settlement", uid: user.uid,
      data: { month, actualRevenue, note, by: user.uid },
      created_at: new Date().toISOString(),
    });
    return jsonResponse({ settled: actualRevenue, devPayouts: [] });
  }

  return errorResponse("Unknown action");
}
