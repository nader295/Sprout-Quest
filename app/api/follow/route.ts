// app/api/follow/route.ts — Supabase فقط
import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, getClientIp, rateLimit, rateLimitUserOrIp, rateLimitedResponse } from "@/lib/api/middleware";
import { verifyRequest } from "@/lib/firebase/auth-verify";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { writeActivity } from "@/lib/server/feed";
import { sendNotif } from "@/lib/server/notifications";
import { awardXP } from "@/lib/server/xp";
import { XP_REWARDS } from "@/lib/constants";
import { checkAndAwardAchievements } from "@/lib/server/achievements";
import { logger } from "@/lib/logger";

// ═══════════════════════════════════════════════════════════════
// app/api/follow/route.ts — Supabase فقط
// ═══════════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 60)) return rateLimitedResponse(req);

  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  const PUBLIC_ACTIONS = ["followers", "followingData"];
  const isPublic = PUBLIC_ACTIONS.includes(action ?? "");
  const user = isPublic ? null : await verifyRequest(req);
  if (!isPublic && !user) return errorResponse("Unauthorized", 401);

  if (action === "list") {
    if (!user) return errorResponse("Unauthorized", 401);
    const max = Math.min(Number(searchParams.get("max")) || 50, 200);
    const { data } = await sb.from("follows")
      .select("following_id")
      .eq("follower_id", user.uid)
      .limit(max);
    return jsonResponse({ items: data?.map(r => r.following_id) ?? [] });
  }

  if (action === "followers") {
    const uid = searchParams.get("uid") ?? user?.uid ?? "";
    if (!uid) return errorResponse("Missing uid", 400);
    const max = Math.min(Number(searchParams.get("max")) || 50, 100);

    const { data: follows } = await sb.from("follows")
      .select("follower_id")
      .eq("following_id", uid)
      .limit(max);

    const ids = follows?.map(f => f.follower_id) ?? [];
    if (ids.length === 0) return jsonResponse({ items: [] });

    const { data: users } = await sb.from("users")
      .select("id, name, username, photo, role")
      .in("id", ids);

    return jsonResponse({ items: users ?? [] });
  }

  if (action === "followingData") {
    const uid = searchParams.get("uid") ?? user?.uid ?? "";
    if (!uid) return errorResponse("Missing uid", 400);
    const max = Math.min(Number(searchParams.get("max")) || 50, 100);

    const { data: follows } = await sb.from("follows")
      .select("following_id")
      .eq("follower_id", uid)
      .limit(max);

    const ids = follows?.map(f => f.following_id) ?? [];
    if (ids.length === 0) return jsonResponse({ items: [] });

    const { data: users } = await sb.from("users")
      .select("id, name, username, photo, role")
      .in("id", ids);

    return jsonResponse({ items: users ?? [] });
  }

  if (action === "isFollowing") {
    if (!user) return jsonResponse({ following: false });
    const targetUid = searchParams.get("uid") ?? searchParams.get("targetUid") ?? "";
    const { data } = await sb.from("follows")
      .select("follower_id").eq("follower_id", user.uid).eq("following_id", targetUid).maybeSingle();
    return jsonResponse({ following: !!data });
  }

  return errorResponse("Unknown action", 400);
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  // Cheap IP-only shed before Firebase verify.
  if (!await rateLimit(`follow:${ip}`, 60)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user) return errorResponse("Unauthorized", 401);

  // Post-auth dual limit: follow-spam abuse has been observed via VPN-rotation,
  // so per-uid (tight) is the main defence; per-ip stays loose for shared NATs.
  if (!(await rateLimitUserOrIp(user.uid, ip, { perUser: 20, perIp: 120, scope: "follow" }))) {
    return rateLimitedResponse(req);
  }

  const sb   = getSupabaseAdmin();
  const body = await req.json().catch(() => ({}));
  const { targetUid, action } = body;
  if (!targetUid || targetUid === user.uid) return errorResponse("Invalid target", 400);

  if (action === "follow") {
    const { error } = await sb.from("follows").upsert({
      follower_id: user.uid, following_id: targetUid,
      created_at: new Date().toISOString(),
    }, { onConflict: "follower_id,following_id", ignoreDuplicates: true });

    if (!error) {
      // ── Recalculate counts directly from follows table — always accurate ──
      // Count queries run AFTER the upsert so they reflect the new state
      const [{ count: myFollowing }, { count: theirFollowers }] = await Promise.all([
        sb.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user.uid),
        sb.from("follows").select("*", { count: "exact", head: true }).eq("following_id", targetUid),
      ]);

      await Promise.all([
        sb.from("users").update({
          following_count: myFollowing ?? 0,
          updated_at: new Date().toISOString(),
        }).eq("id", user.uid),
        sb.from("users").update({
          followers_count:   theirFollowers ?? 0,
          subscribers_count: theirFollowers ?? 0,
          updated_at: new Date().toISOString(),
        }).eq("id", targetUid),
      ]);

      // Notification — uses the static import at the top of the file
      const { data: me } = await sb.from("users").select("name, photo").eq("id", user.uid).single();
      sendNotif({
        recipientUid: targetUid, type: "follow",
        title: `${me?.name ?? "Someone"} بدأ متابعتك`,
        body: "لديك متابع جديد!",
        link: `/u/${user.uid}`,
        authorPhoto: me?.photo ?? "",
        dedupKey: `follow_${user.uid}`,
      }).catch((err) => logger.error("follow.notif", err, { targetUid, fromUid: user.uid }));

      // ── Award XP to the followed user (NEW_FOLLOWER) ──────────
      awardXP(targetUid, XP_REWARDS.NEW_FOLLOWER, "NEW_FOLLOWER")
        .catch((err) => logger.error("follow.awardXP", err, { targetUid }));
      // Check follower-based achievements
      checkAndAwardAchievements(targetUid, {
        subscribersCount: theirFollowers ?? 0,
      }).catch((err) => logger.error("follow.achievements", err, { targetUid }));
    }

  } else if (action === "unfollow") {
    await sb.from("follows")
      .delete().eq("follower_id", user.uid).eq("following_id", targetUid);

    // ── Recalculate counts after delete ──
    const [{ count: myFollowing }, { count: theirFollowers }] = await Promise.all([
      sb.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user.uid),
      sb.from("follows").select("*", { count: "exact", head: true }).eq("following_id", targetUid),
    ]);

    await Promise.all([
      sb.from("users").update({
        following_count: myFollowing ?? 0,
        updated_at: new Date().toISOString(),
      }).eq("id", user.uid),
      sb.from("users").update({
        followers_count:   theirFollowers ?? 0,
        subscribers_count: theirFollowers ?? 0,
        updated_at: new Date().toISOString(),
      }).eq("id", targetUid),
    ]);
  }

  return jsonResponse({ ok: true });
}
