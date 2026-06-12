// lib/server/feed.ts — Fan-out Feed System — Supabase فقط
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import type { ActivityType } from "@/lib/types";

export interface FeedEvent {
  uid:        string;
  username:   string;
  photo:      string;
  type:       ActivityType;
  romId?:     string;
  romName?:   string;
  targetUid?: string;
}

const FANOUT_PAGE_SIZE = 400;
const FEED_ITEM_LIMIT  = 200;

// ─────────────────────────────────────────────────────────────
export async function writeActivity(event: FeedEvent): Promise<void> {
  const sb  = getSupabaseAdmin();
  const now = new Date().toISOString();

  const activityData = {
    uid:        event.uid,
    username:   event.username,
    photo:      event.photo,
    type:       event.type,
    rom_id:     event.romId     ?? "",
    rom_name:   event.romName   ?? "",
    target_uid: event.targetUid ?? "",
    created_at: now,
  };

  try {
    // ── 1. اكتب في global activity ──────────────────────────
    const { data: actRow } = await sb
      .from("activity")
      .insert({
        uid:        event.uid,
        type:       event.type,
        data:       activityData,
        created_at: now,
      })
      .select("id")
      .single();

    if (!actRow) return;
    const activityId = actRow.id as string;

    // ── 2. Fan-out to all followers (paginated) ─────────────
    await fanOutToAllFollowers(event.uid, activityId, activityData, now);

    // ── 3. Trim old feed items for owner ────────────────────
    trimOldFeedItems(event.uid).then(undefined, (err) =>
      logger.warn("feed.trimFailed", { err: String(err), uid: event.uid })
    );
  } catch (e) {
    logger.error("feed.writeActivityFailed", {
      err: e instanceof Error ? e.message : String(e),
      uid: event.uid,
      type: event.type,
    });
  }
}

// ─────────────────────────────────────────────────────────────
async function fanOutToAllFollowers(
  uid: string,
  activityId: string,
  activityData: Record<string, unknown>,
  now: string
): Promise<void> {
  const sb = getSupabaseAdmin();
  let offset = 0;
  let totalWritten = 0;

  while (true) {
    const { data: followers } = await sb
      .from("follows")
      .select("follower_id")
      .eq("following_id", uid)
      .range(offset, offset + FANOUT_PAGE_SIZE - 1);

    if (!followers?.length) break;

    const rows = followers
      .filter(f => f.follower_id !== uid)
      .map(f => ({
        owner_uid:  f.follower_id,
        actor_uid:  uid,
        type:       activityData.type as string,
        data:       { ...activityData, global_activity_id: activityId },
        created_at: now,
      }));

    if (rows.length > 0) {
      // Batch insert in chunks of 200. A single batch failing shouldn't
      // abort fan-out for other followers — log and move on.
      for (let i = 0; i < rows.length; i += 200) {
        await sb.from("feed_items").insert(rows.slice(i, i + 200)).then(
          undefined,
          (err) => logger.warn("feed.fanout.batchFailed", { err: String(err), uid, offset: i })
        );
      }
    }

    totalWritten += followers.length;
    if (followers.length < FANOUT_PAGE_SIZE || totalWritten >= 50_000) break;
    offset += FANOUT_PAGE_SIZE;
  }
}

// ─────────────────────────────────────────────────────────────
async function trimOldFeedItems(uid: string): Promise<void> {
  const sb = getSupabaseAdmin();
  try {
    const { data } = await sb
      .from("feed_items")
      .select("id, created_at")
      .eq("owner_uid", uid)
      .order("created_at", { ascending: false })
      .range(FEED_ITEM_LIMIT, FEED_ITEM_LIMIT + 50);

    if (data?.length) {
      await sb.from("feed_items").delete().in("id", data.map(d => d.id));
    }
  } catch (err) {
    logger.warn("feed.trimOldFailed", { err: String(err), uid });
  }
}

// ─────────────────────────────────────────────────────────────
export async function backfillFeedOnFollow(
  followerId: string,
  followedUid: string
): Promise<void> {
  const sb  = getSupabaseAdmin();
  const now = new Date().toISOString();

  try {
    const { data: recent } = await sb
      .from("activity")
      .select("id, type, data, created_at")
      .eq("uid", followedUid)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!recent?.length) return;

    const rows = recent.map(a => ({
      owner_uid:  followerId,
      actor_uid:  followedUid,
      type:       a.type,
      data:       { ...(a.data as object), global_activity_id: a.id },
      created_at: a.created_at ?? now,
    }));

    await sb.from("feed_items").upsert(rows, { ignoreDuplicates: true });
  } catch (e) {
    logger.error("feed.backfillFailed", {
      err: e instanceof Error ? e.message : String(e),
      followerId,
      followedUid,
    });
  }
}

// ─────────────────────────────────────────────────────────────
export async function removeFeedOnUnfollow(
  followerId: string,
  unfollowedUid: string
): Promise<void> {
  const sb = getSupabaseAdmin();
  try {
    await sb.from("feed_items")
      .delete()
      .eq("owner_uid",  followerId)
      .eq("actor_uid",  unfollowedUid);
  } catch (e) {
    logger.error("feed.removeOnUnfollowFailed", {
      err: e instanceof Error ? e.message : String(e),
      followerId,
      unfollowedUid,
    });
  }
}
