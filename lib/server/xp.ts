// lib/server/xp.ts — Server-only — Supabase فقط، بدون Firestore
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const FRAUD_THRESHOLDS = {
  ALERT_DAILY_XP:   1000,
  MAX_ROMS_PER_DAY: 5,
};

// Hard caps — defense in depth against bugs or compromised callers
const MAX_SINGLE_AWARD     = 500;
const MAX_SINGLE_DEDUCTION = 500;

export const ROM_PUBLISH_XP: Record<string, number> = {
  rom: 30, kernel: 25, recovery: 20, module: 15, gsi: 20,
};

// ─────────────────────────────────────────────────────────────
export async function awardXP(
  uid: string,
  amount: number,
  reason?: string
): Promise<{ awarded: boolean; reason?: string }> {
  if (!uid || amount <= 0) return { awarded: false };
  if (!Number.isFinite(amount) || amount > MAX_SINGLE_AWARD) {
    console.warn(`[awardXP] Rejected excessive award`, { uid, amount, reason });
    return { awarded: false, reason: "amount_exceeds_cap" };
  }
  amount = Math.floor(amount);

  const sb    = getSupabaseAdmin();
  const today = new Date().toISOString().split("T")[0];
  const logId = `${uid}_${today}`;

  try {
    // ── Atomic award via SQL function ──────────────────────────────────
    // atomic_award_xp handles XP update + xp_log upsert in one transaction
    // No race condition possible — both fields updated atomically
    const { data: rows, error: rpcErr } = await sb.rpc("atomic_award_xp", {
      p_uid:    uid,
      p_amount: amount,
      p_reason: reason ?? null,
      p_log_id: logId,
      p_today:  today,
    });

    // ── Fallback: if RPC not deployed yet, use read-then-write ────────────
    let finalXP  = 0;
    let beforeXP = 0;
    let logTotal = 0;

    if (rpcErr || !rows?.[0]) {
      console.warn("[awardXP] atomic_award_xp RPC unavailable, using fallback:", rpcErr?.message);

      const [{ data: user }, { data: logRow }] = await Promise.all([
        sb.from("users").select("xp").eq("id", uid).single(),
        sb.from("xp_log").select("total, data").eq("id", logId).maybeSingle(),
      ]);

      if (!user) return { awarded: false, reason: "user_not_found" };

      beforeXP = user.xp ?? 0;
      finalXP  = beforeXP + amount;
      const logData    = (logRow?.data ?? {}) as Record<string, number>;
      const todayTotal = logRow?.total ?? 0;
      logTotal = todayTotal + amount;

      const newLogData = { ...logData };
      if (reason) {
        newLogData[`count_${reason}`] = (logData[`count_${reason}`] ?? 0) + 1;
        newLogData[`xp_${reason}`]    = (logData[`xp_${reason}`]    ?? 0) + amount;
      }

      await Promise.all([
        sb.from("users").update({ xp: finalXP, updated_at: new Date().toISOString() }).eq("id", uid),
        sb.from("xp_log").upsert({
          id: logId, uid, date: today,
          total: logTotal, data: newLogData,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" }),
      ]);
    } else {
      finalXP  = rows[0].new_xp    as number;
      beforeXP = rows[0].before_xp as number;
      logTotal = rows[0].log_total as number;
    }

    // ── 3. XP history (fire and forget) ──────────────────────────────────
    sb.from("xp_history").insert({
      uid, amount,
      reason: reason ?? "manual",
      before: beforeXP,
      after:  finalXP,
      ts:     new Date().toISOString(),
    }).then(() => {}, () => {});

    // ── 4. Fraud alert ────────────────────────────────────────────────────
    if (logTotal >= FRAUD_THRESHOLDS.ALERT_DAILY_XP) {
      sb.from("fraud_alerts").insert({
        uid, date: today,
        reasons: [`XP يومي مرتفع: ${logTotal} XP في يوم واحد`],
        ts: new Date().toISOString(),
        reviewed: false, type: "monitoring",
      }).then(() => {}, () => {});
    }

    return { awarded: true };
  } catch (err) {
    console.error("[awardXP] Failed:", err);
    return { awarded: false };
  }
}

// ─────────────────────────────────────────────────────────────
export async function awardXPFirstCommentOnly(
  maintainerUid: string,
  commenterUid:  string,
  romId:         string
): Promise<{ awarded: boolean }> {
  if (!maintainerUid || !commenterUid || !romId) return { awarded: false };
  if (maintainerUid === commenterUid) return { awarded: false };

  const sb      = getSupabaseAdmin();
  const dedupId = `${romId}_${commenterUid}`;

  try {
    // Atomic dedup: rely on unique primary key (id) instead of check-then-insert.
    // If the row already exists, insert fails with conflict and we skip the award.
    const { error: insertErr } = await sb.from("xp_comments_dedup").insert({
      id: dedupId,
      rom_id: romId,
      commenter_uid: commenterUid,
      maintainer_uid: maintainerUid,
      ts: new Date().toISOString(),
    });

    if (insertErr) {
      // Postgres unique-violation code is 23505; treat conflict as "already awarded"
      if (insertErr.code === "23505") return { awarded: false };
      console.error("[awardXPFirstCommentOnly] Dedup insert failed:", insertErr);
      return { awarded: false };
    }

    await awardXP(maintainerUid, 3, "COMMENT_FIRST");
    return { awarded: true };
  } catch (err) {
    console.error("[awardXPFirstCommentOnly] Failed:", err);
    return { awarded: false };
  }
}

// ─────────────────────────────────────────────────────────────
export async function deductXP(
  uid: string, amount: number, reason?: string
): Promise<{ deducted: number }> {
  if (!uid || amount <= 0) return { deducted: 0 };
  if (!Number.isFinite(amount) || amount > MAX_SINGLE_DEDUCTION) {
    console.warn(`[deductXP] Rejected excessive deduction`, { uid, amount, reason });
    return { deducted: 0 };
  }
  amount = Math.floor(amount);

  const sb = getSupabaseAdmin();
  try {
    // ── Atomic deduction via SQL function ────────────────────────────────
    const { data: rows, error: rpcErr } = await sb.rpc("deduct_xp", {
      p_uid:    uid,
      p_amount: amount,
    });

    let current = 0;
    let newXP   = 0;
    let actual  = 0;

    if (rpcErr || !rows?.[0]) {
      console.warn("[deductXP] deduct_xp RPC unavailable, using fallback:", rpcErr?.message);
      const { data: user } = await sb.from("users").select("xp").eq("id", uid).single();
      current = user?.xp ?? 0;
      newXP   = Math.max(0, current - amount);
      actual  = current - newXP;
      await sb.from("users").update({ xp: newXP, updated_at: new Date().toISOString() }).eq("id", uid);
    } else {
      current = rows[0].before_xp       as number;
      newXP   = rows[0].new_xp          as number;
      actual  = rows[0].actual_deducted as number;
    }

    if (actual > 0) {
      sb.from("xp_history").insert({
        uid, amount: -actual,
        reason: reason ?? "deduction",
        before: current, after: newXP,
        ts: new Date().toISOString(),
      }).then(() => {}, () => {});
    }

    return { deducted: actual };
  } catch (err) {
    console.error("[deductXP] Failed:", err);
    return { deducted: 0 };
  }
}

// ─────────────────────────────────────────────────────────────
export function computeRomXP(opts: {
  contentType: string; likesCount: number; downloads: number;
  totalViews: number; uniqueCommenters: number;
  milestone100: boolean; milestone500: boolean; milestone1000: boolean;
}): { total: number; breakdown: Record<string, number> } {
  const publish  = ROM_PUBLISH_XP[opts.contentType] ?? 20;
  const likes    = opts.likesCount * 3;
  const dlXP     = Math.floor(opts.downloads / 10) * 2;
  const viewsXP  = Math.floor((opts.totalViews ?? 0) / 100) * 1;
  const comments = opts.uniqueCommenters * 3;
  const m100     = opts.milestone100  ? 20  : 0;
  const m500     = opts.milestone500  ? 50  : 0;
  const m1000    = opts.milestone1000 ? 100 : 0;
  const total    = publish + likes + dlXP + viewsXP + comments + m100 + m500 + m1000;
  return { total, breakdown: { publish, likes, dlXP, viewsXP, comments, m100, m500, m1000 } };
}

// ─────────────────────────────────────────────────────────────
export async function checkFraud(uid: string): Promise<void> {
  const sb    = getSupabaseAdmin();
  const today = new Date().toISOString().split("T")[0];
  try {
    const { data } = await sb.from("xp_log").select("total, data").eq("id", `${uid}_${today}`).maybeSingle();
    if (!data) return;
    const suspicious: string[] = [];
    const logData = data.data as Record<string, number>;
    if ((logData.count_ROM_PUBLISH ?? 0) > FRAUD_THRESHOLDS.MAX_ROMS_PER_DAY)
      suspicious.push(`نشر ${logData.count_ROM_PUBLISH} روم اليوم`);
    if ((data.total ?? 0) > FRAUD_THRESHOLDS.ALERT_DAILY_XP)
      suspicious.push(`XP يومي مرتفع: ${data.total}`);
    if (suspicious.length > 0) {
      await sb.from("fraud_alerts").insert({
        uid, date: today, reasons: suspicious,
        ts: new Date().toISOString(), reviewed: false, type: "auto",
      });
    }
  } catch { /* ignore */ }
}

export function getXPDeductionInfo(contentType: string): { amount: number; label: string } {
  return { amount: ROM_PUBLISH_XP[contentType] ?? 20, label: `نشر ${contentType}` };
}
