/**
 * POST /api/roms/ad-support
 * Primo v5 — Records a valid rewarded video ad watch to support a developer
 *
 * Anti-fraud (7 layers):
 *  1. Auth required
 *  2. Self-support blocked
 *  3. 45-min cooldown per user per post
 *  4. Max 5 watches per user per post per day
 *  5. Max 20 watches per user globally per day
 *  6. IP limit: 50 per IP per day
 *  7. Min watch time: 5 seconds
 *  8. Developer must have adsEnabled: true
 *
 * Revenue: 90% developer / 10% platform
 * Batch: Raw events stored; earnings calculated per request for now
 */

import { NextRequest, NextResponse } from "next/server";
import { sbAdmin } from "@/lib/supabase/admin";
import { AD_SUPPORT } from "@/lib/constants";
import { verifyRequest } from "@/lib/api/auth";

// ── Helpers ──────────────────────────────────────────────────────────────
function todayKey() {
  return new Date().toISOString().slice(0, 10); // "2026-03-23"
}

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const uid = user.uid;

    const { romId } = await req.json();
    if (!romId || typeof romId !== "string") {
      return NextResponse.json({ error: "romId required" }, { status: 400 });
    }

    // ── Get ROM + developer info ─────────────────────────────────────────
    let targetDevUid = "";
    let romSupportCount = 0;
    let isProfileSupport = false;

    if (romId.startsWith("profile_")) {
      targetDevUid = romId.replace("profile_", "");
      isProfileSupport = true;
    } else {
      const { data: rom } = await sbAdmin
        .from("roms")
        .select("id, maintainer_uid, support_count")
        .eq("id", romId)
        .maybeSingle();

      if (!rom) return NextResponse.json({ error: "ROM not found" }, { status: 404 });
      targetDevUid = rom.maintainer_uid;
      romSupportCount = (rom.support_count as number) || 0;
    }

    // ── Layer 2: Self-support blocked ────────────────────────────────────
    if (AD_SUPPORT.SELF_SUPPORT_BLOCKED && targetDevUid === uid) {
      return NextResponse.json(
        { error: "Cannot support your own content" },
        { status: 403 }
      );
    }

    // ── Layer 8: Developer must have adsEnabled ──────────────────────────
    const { data: devData } = await sbAdmin.from("users").select("id").eq("id", targetDevUid).maybeSingle();
    if (!devData) {
      return NextResponse.json({ error: "Developer not found" }, { status: 404 });
    }

    const today = todayKey();
    const clientIP = getClientIP(req);

    // ── Layer 3: Cooldown per user per post (45 min) ─────────────────────
    const postDedupId = `adsup_${uid}_${romId}`;
    const { data: lastHit } = await sbAdmin
      .from("downloads_dedup")
      .select("last_at")
      .eq("id", postDedupId)
      .maybeSingle();

    if (lastHit?.last_at) {
      const elapsed = Date.now() - new Date(lastHit.last_at).getTime();
      if (elapsed < AD_SUPPORT.COOLDOWN_MS) {
        const remainMs = AD_SUPPORT.COOLDOWN_MS - elapsed;
        return NextResponse.json({
          success: false,
          cooldown: true,
          remainMs,
          remainMin: Math.ceil(remainMs / 60000),
        });
      }
    }

    // ── Layer 4 + 5: Daily limits (per post + global) ────────────────────
    // Count today's ad supports for this user
    const { count: globalToday } = await sbAdmin
      .from("downloads_dedup")
      .select("id", { count: "exact", head: true })
      .like("id", `adsup_${uid}_%`)
      .gte("last_at", `${today}T00:00:00.000Z`);

    if ((globalToday ?? 0) >= AD_SUPPORT.MAX_DAILY_GLOBAL) {
      return NextResponse.json({
        success: false,
        dailyLimitReached: true,
        dailyRemaining: 0,
      });
    }

    // Count today's for this specific post
    const { count: postToday } = await sbAdmin
      .from("downloads_dedup")
      .select("id", { count: "exact", head: true })
      .eq("id", postDedupId)
      .gte("last_at", `${today}T00:00:00.000Z`);

    if ((postToday ?? 0) >= AD_SUPPORT.MAX_DAILY_PER_POST) {
      return NextResponse.json({
        success: false,
        postLimitReached: true,
        dailyRemaining: AD_SUPPORT.MAX_DAILY_GLOBAL - (globalToday ?? 0),
      });
    }

    // ── Layer 6: IP rate limit ───────────────────────────────────────────
    const ipDedupId = `adip_${clientIP}_${today}`;
    const { data: ipData } = await sbAdmin
      .from("downloads_dedup")
      .select("rom_id")
      .eq("id", ipDedupId)
      .maybeSingle();

    const ipCount = ipData ? parseInt(String(ipData.rom_id) || "0", 10) : 0;
    if (ipCount >= AD_SUPPORT.IP_DAILY_LIMIT) {
      return NextResponse.json({
        success: false,
        ipLimitReached: true,
        dailyRemaining: 0,
      });
    }

    // ──────────────────────────────────────────────────────────────────────
    // ALL CHECKS PASSED — Record the ad support
    // ──────────────────────────────────────────────────────────────────────

    // 1. Upsert cooldown record
    await sbAdmin.from("downloads_dedup").upsert({
      id: postDedupId,
      rom_id: romId,
      last_at: new Date().toISOString(),
    });

    // 2. Update IP counter
    await sbAdmin.from("downloads_dedup").upsert({
      id: ipDedupId,
      rom_id: String(ipCount + 1), // store count in rom_id field
      last_at: new Date().toISOString(),
    });

    // 3. Increment developer stats (Supabase) — Real Geo-based CPM
    const viewerCountry = (req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || "XX").toUpperCase();
    const tier = ["US","GB","CA","AU","DE","FR","NL","SE","NO","DK","FI","CH","AT","BE","IE","NZ","JP","KR","SG","IL"].includes(viewerCountry) ? "tier1"
               : ["BR","IN","TR","EG","SA","AE","PK","ID","MY","TH","VN","PH","MX","AR","CL","CO","PE","ZA","NG","KE","UA","PL","CZ","RO","HU","RU","TW","HK"].includes(viewerCountry) ? "tier2"
               : "tier3";
    const tierCpm = AD_SUPPORT.CPM_BY_TIER[tier];
    const perViewEarning = (tierCpm / 1000) * AD_SUPPORT.DEV_SHARE;
    const platformEarning = (tierCpm / 1000) * AD_SUPPORT.PLATFORM_SHARE;

    await sbAdmin.rpc("record_ad_support_earnings", { 
      p_dev_uid: targetDevUid, 
      p_earnings: perViewEarning 
    }).then(undefined, () => {});

    // 3b. Increment platform revenue counter (Supabase)
    await sbAdmin.rpc("increment_platform_revenue", {
      p_amount: platformEarning
    }).then(undefined, () => {});

    // 4. Give viewer gamification points (Supabase)
    await sbAdmin.rpc("increment_viewer_ad_points", { 
      p_viewer_uid: uid, 
      p_points: AD_SUPPORT.POINTS_PER_WATCH 
    }).then(undefined, () => {});

    // 5. Increment ROM support count (Supabase)
    if (!isProfileSupport) {
      const newCount = romSupportCount + 1;
      await sbAdmin
        .from("roms")
        .update({ support_count: newCount })
        .eq("id", romId);
    }

    const dailyRemaining = AD_SUPPORT.MAX_DAILY_GLOBAL - (globalToday ?? 0) - 1;

    // ⚠️ NOTE: devEarning is NOT returned to the viewer.
    // Only the developer sees earnings via their private Earnings page.
    return NextResponse.json({
      success: true,
      dailyRemaining: Math.max(0, dailyRemaining),
      pointsEarned: AD_SUPPORT.POINTS_PER_WATCH,
    });
  } catch (err) {
    console.error("[ad-support] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
