// lib/server/notifications.ts — Server-only — Supabase فقط
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export type NotifType =
  | "like" | "comment" | "reply" | "follow"
  | "milestone_100" | "milestone_500" | "milestone_1000"
  | "achievement" | "level_up" | "broadcast" | "moderation";

export interface SendNotifParams {
  recipientUid: string;
  type: NotifType;
  title: string;
  body: string;
  link?: string;
  authorPhoto?: string;
  dedupKey?: string;
}

// ─────────────────────────────────────────────────────────────
export async function sendNotif(p: SendNotifParams): Promise<void> {
  try {
    const sb = getSupabaseAdmin();

    // ── Dedup check (24h TTL) ─────────────────────────────
    if (p.dedupKey) {
      const dedupId = `${p.recipientUid}_${p.dedupKey}`.slice(0, 200);
      const { data: existing } = await sb
        .from("notif_dedup").select("sent_at").eq("id", dedupId).maybeSingle();

      if (existing?.sent_at) {
        const age = Date.now() - new Date(existing.sent_at).getTime();
        if (age < 24 * 60 * 60_000) return; // dedup: skip
      }

      // Upsert dedup record (fire-and-forget; don't block notif delivery)
      sb.from("notif_dedup").upsert({
        id:            dedupId,
        recipient_uid: p.recipientUid,
        dedup_key:     p.dedupKey,
        sent_at:       new Date().toISOString(),
      }, { onConflict: "id" }).then(
        () => {},
        (err) => logger.warn("notif.dedup.upsertFailed", { err: String(err), dedupId })
      );
    }

    // ── Insert notification ────────────────────────────────
    const { error: insertErr } = await sb.from("notifications").insert({
      recipient_uid: p.recipientUid,
      type:          p.type,
      title:         p.title,
      body:          p.body,
      link:          p.link         ?? "",
      author_photo:  p.authorPhoto  ?? "",
      read:          false,
      dedup_key:     p.dedupKey     ?? null,
      created_at:    new Date().toISOString(),
    });

    if (insertErr) {
      logger.error("notif.insertFailed", { err: insertErr.message, uid: p.recipientUid, type: p.type });
      return; // skip counter increment if the row itself didn't land
    }

    // ── Atomic increment of unread counter ────────────────
    // Replaces the previous read-then-write pattern which had a race
    // condition: two concurrent notifs would both read N and both
    // write N+1, losing one increment. The RPC uses a single UPDATE
    // with "unread_notifications = unread_notifications + 1".
    const { error: rpcErr } = await sb.rpc("increment_user_unread", { p_uid: p.recipientUid });
    if (rpcErr) {
      logger.warn("notif.incrementUnreadFailed", { err: rpcErr.message, uid: p.recipientUid });
    }

    // ── Trim old notifications (keep last 100) ─────────────
    void trimOldNotifications(p.recipientUid);
  } catch (err) {
    logger.error("notif.sendFailed", { err: err instanceof Error ? err.message : String(err), uid: p.recipientUid, type: p.type });
  }
}

// ─────────────────────────────────────────────────────────────
async function trimOldNotifications(uid: string): Promise<void> {
  const sb = getSupabaseAdmin();
  try {
    const { data } = await sb
      .from("notifications")
      .select("id")
      .eq("recipient_uid", uid)
      .order("created_at", { ascending: false })
      .range(100, 200);

    if (data && data.length > 0) {
      const ids = data.map(d => d.id);
      await sb.from("notifications").delete().in("id", ids);
    }
  } catch (err) {
    logger.warn("notif.trimFailed", { err: String(err), uid });
  }
}

// ─────────────────────────────────────────────────────────────
export async function broadcastNotif(params: Omit<SendNotifParams, "recipientUid">): Promise<number> {
  const sb = getSupabaseAdmin();
  try {
    // Get all active users (limit 400)
    const { data: users } = await sb
      .from("users")
      .select("id")
      .eq("is_suspended", false)
      .order("created_at", { ascending: false })
      .limit(400);

    if (!users?.length) return 0;

    // Batch insert all notifications
    const rows = users.map(u => ({
      recipient_uid: u.id,
      type:          params.type,
      title:         params.title,
      body:          params.body,
      link:          params.link        ?? "",
      author_photo:  params.authorPhoto ?? "",
      read:          false,
      created_at:    new Date().toISOString(),
    }));

    const batchSize = 200;
    let sent = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const { error } = await sb.from("notifications").insert(rows.slice(i, i + batchSize));
      if (!error) sent += Math.min(batchSize, rows.length - i);
      else logger.warn("notif.broadcast.batchFailed", { err: error.message, offset: i });
    }
    return sent;
  } catch (err) {
    logger.error("notif.broadcastFailed", { err: err instanceof Error ? err.message : String(err) });
    return 0;
  }
}
