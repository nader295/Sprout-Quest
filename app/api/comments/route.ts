// app/api/comments/route.ts — Supabase فقط
import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, getClientIp, rateLimit, rateLimitUserOrIp, rateLimitedResponse } from "@/lib/api/middleware";
import { verifyRequest, isAdmin } from "@/lib/firebase/auth-verify";
import { sendNotif } from "@/lib/server/notifications";
import { checkAndAwardAchievements } from "@/lib/server/achievements";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

// ── Normalize: Supabase snake_case → Comment interface ──────
// الـ DB بيخزن: user_id, user_name, user_photo, content, likes_count, created_at
// الـ component بيقرأ: uid, name, photo, text, likesCount, createdAt
function normalizeComment(row: Record<string, unknown>) {
  return {
    id:         row.id         ?? "",
    uid:        row.user_id    ?? row.uid    ?? "",
    name:       row.user_name  ?? row.name   ?? "",
    photo:      row.user_photo ?? row.photo  ?? "",
    text:       row.content    ?? row.text   ?? "",
    replyCount: (row.reply_count  as number) ?? 0,
    likesCount: (row.likes_count  as number) ?? 0,
    reactions:  row.reactions  ?? [],
    pinned:     row.pinned     ?? false,
    edited:     !!(row.updated_at && row.updated_at !== row.created_at),
    createdAt:  row.created_at ?? null,
  };
}

// ── GET ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 60)) return rateLimitedResponse(req);

  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const romId     = searchParams.get("romId");
  const commentId = searchParams.get("commentId");
  const action    = searchParams.get("action");
  const cursor    = searchParams.get("cursor");
  const limit     = Math.min(Number(searchParams.get("limit")) || 20, 50);

  if (!romId) return errorResponse("Missing romId", 400);

  // ── Check if liked ─────────────────────────────────────
  if (action === "checkLiked" && commentId) {
    const user = await verifyRequest(req);
    if (!user) return jsonResponse({ liked: false });

    const { data } = await sb.from("comment_likes")
      .select("comment_id").eq("comment_id", commentId).eq("user_id", user.uid).maybeSingle();
    return jsonResponse({ liked: !!data });
  }

  // ── List replies ───────────────────────────────────────
  if (commentId && !action) {
    const { data } = await sb.from("comments")
      .select("*").eq("rom_id", romId).eq("parent_id", commentId)
      .eq("is_deleted", false).order("created_at", { ascending: true }).limit(50);
    return jsonResponse({ items: (data ?? []).map(r => normalizeComment(r as Record<string, unknown>)) });
  }

  // ── List top-level comments with cursor pagination ─────
  let q = sb.from("comments")
    .select("*")
    .eq("rom_id", romId)
    .is("parent_id", null)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true })
    .limit(limit + 1);

  if (cursor) q = q.gt("created_at", cursor);

  const { data, error } = await q;
  if (error) return errorResponse(error.message, 500);

  const hasMore    = (data?.length ?? 0) > limit;
  const items      = hasMore ? data!.slice(0, limit) : (data ?? []);
  const nextCursor = hasMore ? items[items.length - 1].created_at : null;

  return jsonResponse({ items: items.map(r => normalizeComment(r as Record<string, unknown>)), nextCursor, hasMore });
}

// ── POST ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  // Cheap IP-only pre-check to shed traffic before we spend a Firebase verify call.
  if (!await rateLimit(`comments:${ip}`, 60, 60_000)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user) return errorResponse("Unauthorized", 401);

  // Post-auth dual limit: stops both VPN-switchers (per-uid) and bot farms (per-ip).
  // 15 writes/user/min matches the old limit; 60/ip/min accommodates shared offices/NAT.
  if (!(await rateLimitUserOrIp(user.uid, ip, { perUser: 15, perIp: 60, scope: "comments" }))) {
    return rateLimitedResponse(req);
  }

  const sb   = getSupabaseAdmin();
  const body = await req.json();
  const { romId, commentId, text, action: bodyAction } = body;

  // ── Toggle Like ──────────────────────────────────────────
  // Uses atomic RPCs (scripts/903) instead of read-then-write, which previously
  // lost increments under concurrent likes (A and B both read 5 → both write 6).
  if (bodyAction === "toggleLike" && romId && commentId) {
    const { data: existing } = await sb.from("comment_likes")
      .select("comment_id").eq("comment_id", commentId).eq("user_id", user.uid).maybeSingle();

    if (existing) {
      await sb.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", user.uid);
      await sb.rpc("decrement_comment_likes", { p_comment_id: commentId });
      return jsonResponse({ liked: false });
    }

    await sb.from("comment_likes").upsert(
      { comment_id: commentId, user_id: user.uid, created_at: new Date().toISOString() },
      { ignoreDuplicates: true }
    );
    await sb.rpc("increment_comment_likes", { p_comment_id: commentId });
    return jsonResponse({ liked: true });
  }

  // ── Add Comment or Reply ────────────────────────────────
  if (!romId || !text?.trim()) return errorResponse("Missing romId or text", 400);

  const { data: userData } = await sb.from("users")
    .select("name, photo, is_suspended, role").eq("id", user.uid).single();

  if (!userData) return errorResponse("User not found", 404);
  if ((userData as Record<string, unknown>).is_suspended) return errorResponse("Account suspended", 403);
  if ((userData as Record<string, string>).role === "banned") return errorResponse("Account banned", 403);

  const name      = (userData as Record<string, string>).name  ?? "";
  const photo     = (userData as Record<string, string>).photo ?? "";
  const safeText  = text.trim().slice(0, 2000);
  const isReply   = !!commentId;
  const parentId  = isReply ? commentId : null;

  const { data: inserted, error } = await sb.from("comments").insert({
    rom_id:     romId,
    user_id:    user.uid,
    user_name:  name,
    user_photo: photo,
    content:    safeText,
    parent_id:  parentId,
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select("id").single();

  if (error) return errorResponse(error.message, 500);

  // Update counts
  if (isReply && parentId) {
    const { data: parent } = await sb.from("comments").select("likes_count").eq("id", parentId).single();
    // reply_count not in schema — use comments_count on ROM
  } else {
    const { data: rom } = await sb.from("roms").select("comments_count").eq("id", romId).single();
    await sb.from("roms").update({
      comments_count: ((rom as Record<string, number>)?.comments_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq("id", romId);
  }

  // Background: notifications + XP + achievements
  Promise.all([
    // Notify ROM owner
    sb.from("roms").select("maintainer_uid, name").eq("id", romId).single().then(({ data: rom }) => {
      if (!rom) return;
      const maintainer = (rom as Record<string, string>).maintainer_uid;
      const romName    = (rom as Record<string, string>).name;
      if (maintainer && maintainer !== user.uid) {
        sendNotif({
          recipientUid: maintainer, type: "comment",
          title: `💬 ${name} علّق على ${romName || "ROM بتاعك"}`,
          body: safeText.slice(0, 80) + (safeText.length > 80 ? "..." : ""),
          link: `/rom/${romId}`, authorPhoto: photo,
          dedupKey: `comment_${romId}_${user.uid}_${Date.now().toString().slice(0, -4)}`,
        }).catch((err) => logger.error("comments.post.notifyMaintainer", err, { maintainer, romId, fromUid: user.uid }));

        // XP: first comment only
        import("@/lib/server/xp").then(({ awardXPFirstCommentOnly }) =>
          awardXPFirstCommentOnly(maintainer, user.uid, romId)
        ).catch((err) => logger.error("comments.post.xpFirstComment", err, { maintainer, romId }));
      }
    }),
    // Update commentsGiven counter + trigger achievement check.
    // Achievement failures here were previously masked by `() => {}` — a user
    // who should have unlocked "100 comments" could silently miss the award.
    sb.from("users").select("comments_given").eq("id", user.uid).single().then(({ data: u }) => {
      const newCount = ((u as Record<string, number>)?.comments_given ?? 0) + 1;
      sb.from("users").update({ comments_given: newCount, updated_at: new Date().toISOString() }).eq("id", user.uid)
        .then(
          () => { void checkAndAwardAchievements(user.uid, { commentsGiven: newCount }); },
          (err) => logger.error("comments.post.updateCounter", err, { uid: user.uid, newCount }),
        );
    }),
  ]).catch((err) => logger.error("comments.post.sideEffects", err, { romId, uid: user.uid }));

  return jsonResponse(normalizeComment({
    id: inserted?.id, user_id: user.uid, user_name: name, user_photo: photo,
    content: safeText, likes_count: 0, created_at: new Date().toISOString(),
  }), 201);
}

// ── PATCH (edit) ────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 15, 60_000)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user) return errorResponse("Unauthorized", 401);

  const sb = getSupabaseAdmin();
  const { commentId, text } = await req.json();
  if (!commentId || !text?.trim()) return errorResponse("Missing fields", 400);

  const { data: comment } = await sb.from("comments").select("user_id").eq("id", commentId).single();
  if (!comment) return errorResponse("Not found", 404);
  if ((comment as Record<string, string>).user_id !== user.uid) return errorResponse("Forbidden", 403);

  const safeText = text.trim().slice(0, 2000);
  await sb.from("comments").update({
    content: safeText, updated_at: new Date().toISOString(),
  }).eq("id", commentId);

  return jsonResponse({ success: true, content: safeText });
}

// ── DELETE ──────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 20, 60_000)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user) return errorResponse("Unauthorized", 401);

  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const commentId = searchParams.get("commentId");
  const romId     = searchParams.get("romId");

  if (!commentId) return errorResponse("Missing commentId", 400);

  const { data: comment } = await sb.from("comments").select("user_id, parent_id").eq("id", commentId).single();
  if (!comment) return errorResponse("Not found", 404);

  const data = comment as Record<string, unknown>;
  if (data.user_id !== user.uid && !isAdmin(user)) return errorResponse("Forbidden", 403);

  // Soft delete
  await sb.from("comments").update({ is_deleted: true, updated_at: new Date().toISOString() }).eq("id", commentId);

  // Decrement ROM comment count if top-level
  if (!data.parent_id && romId) {
    const { data: rom } = await sb.from("roms").select("comments_count").eq("id", romId).single();
    await sb.from("roms").update({
      comments_count: Math.max(0, ((rom as Record<string, number>)?.comments_count ?? 1) - 1),
      updated_at: new Date().toISOString(),
    }).eq("id", romId);
  }

  // Deduct XP if own comment
  if (data.user_id === user.uid) {
    import("@/lib/server/xp").then(({ deductXP }) => deductXP(user.uid, 3))
      .catch((err) => logger.error("comments.delete.deductXP", err, { uid: user.uid, commentId }));
  }

  return jsonResponse({ success: true });
}

// ── PUT (reactions) ─────────────────────────────────────────
export async function PUT(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 30, 60_000)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user) return errorResponse("Unauthorized", 401);

  const sb = getSupabaseAdmin();
  const { commentId, emoji } = await req.json();
  if (!commentId || !emoji) return errorResponse("Missing fields", 400);

  const VALID = ["❤️", "🔥", "👍", "😂", "😮", "🎉"];
  if (!VALID.includes(emoji)) return errorResponse("Invalid emoji", 400);

  const { data: comment } = await sb.from("comments").select("reactions").eq("id", commentId).single();
  if (!comment) return errorResponse("Not found", 404);

  const reactions: { emoji: string; count: number; uids: string[] }[] =
    ((comment as Record<string, unknown>).reactions as typeof reactions) ?? [];

  // Remove user from any existing reaction
  const cleaned = reactions
    .map(r => ({ ...r, uids: r.uids.filter(u => u !== user.uid) }))
    .map(r => ({ ...r, count: r.uids.length }))
    .filter(r => r.count > 0);

  // Toggle: if same emoji → remove, else add
  const prevEmoji = reactions.find(r => r.uids.includes(user.uid))?.emoji;
  if (prevEmoji !== emoji) {
    const existing = cleaned.find(r => r.emoji === emoji);
    if (existing) { existing.uids.push(user.uid); existing.count = existing.uids.length; }
    else cleaned.push({ emoji, count: 1, uids: [user.uid] });
  }

  await sb.from("comments").update({ reactions: cleaned, updated_at: new Date().toISOString() }).eq("id", commentId);
  return jsonResponse({ success: true });
}

export async function OPTIONS() { return jsonResponse({}); }
