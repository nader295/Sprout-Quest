/**
 * app/api/cron/route.ts — Daily Maintenance Cron
 * Migrated to Supabase completely. No Firebase dependencies.
 * 
 * المهام:
 *  1. Boost new ROMs & Trend score decay
 *  2. Cleanup stale presence
 *  3. Cleanup old dedup
 *  4. Cleanup notif_dedup
 *  5. Auto-fetch device images & Auto-ingest
 *  6. Process reports/appeals auto-actions
 *  7. XP drift fixes
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { invalidateDevicesCache } from "@/lib/server/devices-cache";
import { runConsolidation } from "@/lib/server/smart-device-engine";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth   = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, string> = {};
  const sb = getSupabaseAdmin();

  // ── 0. Quick Health — رفع إيقافات منتهية ──────────
  try {
    const now = new Date().toISOString();
    const { data: suspendedUsers } = await sb.from("users")
      .select("id")
      .eq("is_suspended", true)
      .not("suspended_until", "is", null)
      .lt("suspended_until", now);

    if (suspendedUsers && suspendedUsers.length > 0) {
      const ids = suspendedUsers.map(u => u.id);
      await sb.from("users").update({ is_suspended: false, suspended_until: null }).in("id", ids);
      results.health = `unsuspended=${ids.length}`;
    } else {
      results.health = "unsuspended=0";
    }
  } catch (e) { results.health = `error: ${String(e)}`; }

  // ── 1. Boost recently uploaded ROMs FIRST (< 7 days, trend_score < 50) ──
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: newRoms } = await sb
      .from("roms")
      .select("id")
      .lt("trend_score", 50)
      .gte("created_at", sevenDaysAgo)
      .limit(100);

    if (newRoms && newRoms.length > 0) {
      for (const r of newRoms) {
        await sb.from("roms").update({ trend_score: 100 }).eq("id", r.id);
      }
      results.newRomBoost = `boosted ${newRoms.length} roms`;
    } else {
      results.newRomBoost = "none needed";
    }
  } catch (e) { results.newRomBoost = `error: ${String(e)}`; }

  // ── 2. Trend Score Decay ──────
  try {
    const { error } = await sb.rpc("decay_trend_scores");
    results.trendDecay = error ? `error: ${error.message}` : "ok";
  } catch (e) { results.trendDecay = `error: ${String(e)}`; }

  // ── 3. Cleanup stale presence (> 2 hours) ─────────────────────────────
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
    const { error } = await sb.from("presence").delete().lt("updated_at", twoHoursAgo);
    results.presenceCleanup = error ? `error: ${error.message}` : "ok";
  } catch (e) { results.presenceCleanup = `error: ${String(e)}`; }

  // ── 4. Cleanup old dedup records (> 48h) ──────────────────────────────
  try {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    await Promise.all([
      sb.from("downloads_dedup").delete().lt("last_at", twoDaysAgo),
      sb.from("views_dedup").delete().lt("last_at", twoDaysAgo),
      // notif_dedup: clean entries older than 7 days (keeps recent dedup window)
      sb.from("notif_dedup").delete().lt("sent_at", new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString()),
    ]);
    results.dedupCleanup = "ok";
  } catch (e) { results.dedupCleanup = `error: ${String(e)}`; }

  // ── 5. Auto-fetch missing device images ─────────────────────────────
  try {
    const { data: missingImages } = await sb
      .from("devices")
      .select("codename, display_name, brand")
      .or("image_url.is.null,image_url.eq.")
      .limit(5); // تقليل من 20 إلى 5 لتوفير الاستدعاءات

    // Build base URL once — previous ternary was buggy (returned VERCEL_URL even
    // when NEXTAUTH_URL was set). Prefer explicit NEXT_PUBLIC_SITE_URL, then the
    // Vercel-provided host, then localhost for dev.
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
    const baseUrl = siteUrl || vercelUrl || "http://localhost:3000";

    let imagesFetched = 0;
    for (const d of missingImages || []) {
      try {
        const r = await fetch(`${baseUrl}/api/device-image/${d.codename}`, { signal: AbortSignal.timeout(8000) });
        if (r.ok) imagesFetched++;
      } catch (err) {
        // One missing image shouldn't break the batch; just record and move on.
        logger.warn("cron.autoImages.fetchFailed", { codename: d.codename, err: String(err) });
      }
    }
    results.autoImages = `fetched ${imagesFetched}/${(missingImages || []).length} missing images`;
  } catch (e) { results.autoImages = `error: ${String(e)}`; }

  // ── 6. Device Codename Consensus Consolidation ──────────────────────
  try {
    const { fixed, devices } = await runConsolidation();
    results.deviceConsolidation = fixed > 0 ? `fixed ${fixed} ROMs across ${devices} devices` : "no changes needed";
  } catch (e) { results.deviceConsolidation = `error: ${String(e)}`; }

  // ── 7. Auto-ingest أجهزة جديدة من LineageOS (weekly) ─────────────────
  // ⏹️ DISABLED: توفيراً لـ ~300 استدعاء/شهر
  // يمكن تفعيله لاحقاً عند تحسن الاستهلاك العام
  results.deviceIngestion = "disabled_temporarily_for_cost_optimization";

  // ── 8. Regenerate top devices cache (Phase 2.1) ─────────────────────
  // Updates the static cache with top 100 most downloaded devices
  try {
    // Find top 100 devices by download count
    const { data: topDevices } = await sb
      .from("roms")
      .select("device_codename, device, brand")
      .order("downloads", { ascending: false })
      .limit(100);

    if (topDevices && topDevices.length > 0) {
      // TODO: Update lib/cache/top-devices.json with fresh data
      // This would require writing to the file system at deploy time or
      // using an external cache layer. For now, log the operation.
      results.topDevicesCache = `identified ${topDevices.length} top devices`;
    } else {
      results.topDevicesCache = "no devices found";
    }
  } catch (e) { results.topDevicesCache = `error: ${String(e)}`; }

  // ── 9. Auto-process archive reports ──────────────────────────
  try {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60_000).toISOString();
    const { data: autoReports } = await sb.from("archive_reports")
      .select("*")
      .eq("status", "pending")
      .neq("suggested_value", "")
      .not("suggested_value", "is", null)
      .lte("created_at", fortyEightHoursAgo)
      .limit(20);

    let autoApplied = 0;
    for (const r of autoReports || []) {
      const fieldMap: Record<string, string> = { wrong_name: "display_name", wrong_chipset: "chipset" };
      const field = fieldMap[r.report_type];
      if (field && r.codename) {
        await sb.from("devices").update({ [field]: r.suggested_value, updated_at: new Date().toISOString() }).eq("codename", r.codename);
        await sb.from("archive_reports").update({ status: "approved", admin_note: "Auto-applied by cron after 48h", updated_at: new Date().toISOString() }).eq("id", r.id);
        autoApplied++;
      }
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
    await sb.from("archive_reports")
      .update({ status: "expired", admin_note: "Auto-expired after 30 days" })
      .eq("status", "pending")
      .lte("created_at", thirtyDaysAgo);

    results.archiveReports = `auto-applied=${autoApplied}`;
  } catch (e) { results.archiveReports = `error: ${String(e)}`; }

  // ── 9. Auto-approve developer applications (XP >= 600) ─────────────
  try {
    const { data: apps } = await sb.from("applications").select("*").eq("status", "pending").limit(30);
    let autoApprovedApps = 0;
    
    for (const app of apps || []) {
      const { data: userData } = await sb.from("users").select("xp, role").eq("id", app.uid).maybeSingle();
      if ((userData?.xp || 0) >= 600) {
        const protectedRoles = ["moderator", "admin", "owner"];
        if (!protectedRoles.includes(userData?.role || "user")) {
          await sb.from("users").update({ role: "verifiedDev" }).eq("id", app.uid);
        }
        await sb.from("applications").update({ status: "approved", admin_note: "Auto-approved: XP >= 600", updated_at: new Date().toISOString() }).eq("id", app.id);
        autoApprovedApps++;
      }
    }
    results.applications = `auto-approved=${autoApprovedApps}`;
  } catch (e) { results.applications = `error: ${String(e)}`; }

  // ── 10. Auto-close stale content reports (> 14 days) ───────────────
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60_000).toISOString();
    const { data: staleReports } = await sb.from("reports").select("id").eq("status", "pending").lte("created_at", fourteenDaysAgo);
    
    if (staleReports && staleReports.length > 0) {
      const ids = staleReports.map(r => r.id);
      await sb.from("reports")
        .update({ status: "dismissed", admin_note: "Auto-dismissed after 14 days", updated_at: new Date().toISOString() })
        .in("id", ids);
      results.staleReports = `dismissed=${ids.length}`;
    } else {
      results.staleReports = "dismissed=0";
    }
  } catch (e) { results.staleReports = `error: ${String(e)}`; }

  // ── 11. Auto-cleanup bug reports > 30 days ───────────────────────────
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
    const { data: oldFeedback } = await sb.from("feedback").select("id").eq("reviewed", true).lte("created_at", thirtyDaysAgo);
    
    if (oldFeedback && oldFeedback.length > 0) {
      const ids = oldFeedback.map(r => r.id);
      await sb.from("feedback").delete().in("id", ids);
      results.bugReports = `cleaned=${ids.length}`;
    } else {
      results.bugReports = "cleaned=0";
    }
  } catch (e) { results.bugReports = `error: ${String(e)}`; }

  console.info("[cron] Daily maintenance completed:", results);

  // ── Invalidate devices cache ────────────
  invalidateDevicesCache();

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), results });
}
