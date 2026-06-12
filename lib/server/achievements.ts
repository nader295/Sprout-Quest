// lib/server/achievements.ts — Server-only — Supabase فقط
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getLevel } from "@/lib/constants";
import { sendNotif } from "./notifications";

const ACHIEVEMENT_CHECKS: {
  id: string; label: string; icon: string; xp: number;
  check: (stats: UserAchievementStats) => boolean;
}[] = [
  { id: "first_rom",     label: "First Launch 🚀",      icon: "🚀", xp: 50,   check: s => s.romsCount >= 1 },
  { id: "rom_5",         label: "ROM Pack 📦",           icon: "📦", xp: 100,  check: s => s.romsCount >= 5 },
  { id: "rom_20",        label: "ROM Factory 🏭",        icon: "🏭", xp: 300,  check: s => s.romsCount >= 20 },
  { id: "likes_10",      label: "Liked ❤️",              icon: "❤️", xp: 30,   check: s => s.totalLikesReceived >= 10 },
  { id: "likes_100",     label: "Popular 💜",            icon: "💜", xp: 100,  check: s => s.totalLikesReceived >= 100 },
  { id: "likes_1000",    label: "Legendary 💎",          icon: "💎", xp: 500,  check: s => s.totalLikesReceived >= 1000 },
  { id: "dl_100",        label: "Hit Release ⬇️",        icon: "⬇️", xp: 75,   check: s => s.totalDownloads >= 100 },
  { id: "dl_1000",       label: "Top Release 📡",        icon: "📡", xp: 300,  check: s => s.totalDownloads >= 1000 },
  { id: "dl_5000",       label: "Mega Release 🌟",       icon: "🌟", xp: 800,  check: s => s.totalDownloads >= 5000 },
  { id: "followers_10",  label: "Rising Dev 👥",         icon: "👥", xp: 50,   check: s => s.subscribersCount >= 10 },
  { id: "followers_100", label: "Star Dev ⭐",           icon: "⭐", xp: 200,  check: s => s.subscribersCount >= 100 },
  { id: "followers_500", label: "Legend Dev 👑",         icon: "👑", xp: 600,  check: s => s.subscribersCount >= 500 },
  { id: "rated_10",      label: "Critic 🌟",             icon: "🌟", xp: 25,   check: s => s.ratingsGiven >= 10 },
  { id: "commenter_10",  label: "Commentator 💬",        icon: "💬", xp: 20,   check: s => s.commentsGiven >= 10 },
  { id: "verified_dev",  label: "Verified Dev ✔️",       icon: "✔️", xp: 150,  check: s => s.role === "verifiedDev" || s.xp >= 600 },
  { id: "xp_500",        label: "XP Grinder ⚡",         icon: "⚡", xp: 0,    check: s => s.xp >= 500 },
  { id: "xp_2000",       label: "XP Hunter 🔥",          icon: "🔥", xp: 0,    check: s => s.xp >= 2000 },
  { id: "early_adopter", label: "Early Adopter 🌱",      icon: "🌱", xp: 100,  check: s => s.isEarlyAdopter === true },
  { id: "views_1000",    label: "Getting Noticed 👁️",    icon: "👁️", xp: 50,   check: s => (s.totalViewsReceived ?? 0) >= 1000 },
  { id: "views_10000",   label: "Viral ROM 🔥",          icon: "🔥", xp: 200,  check: s => (s.totalViewsReceived ?? 0) >= 10000 },
  { id: "views_100000",  label: "ROM Legend 🌟",         icon: "🌟", xp: 1000, check: s => (s.totalViewsReceived ?? 0) >= 100000 },
];

interface UserAchievementStats {
  uid: string; xp: number; role: string; romsCount: number;
  totalLikesReceived: number; totalDownloads: number; totalViewsReceived: number;
  subscribersCount: number; ratingsGiven: number; commentsGiven: number;
  achievements: string[]; isEarlyAdopter?: boolean;
}

// ─────────────────────────────────────────────────────────────
export async function checkAndAwardAchievements(
  uid: string,
  hints?: Partial<UserAchievementStats>
): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    const { data: user } = await sb.from("users").select("*").eq("id", uid).single();
    if (!user) return;

    const stats: UserAchievementStats = {
      uid,
      xp:                 hints?.xp                 ?? user.xp                 ?? 0,
      role:               hints?.role               ?? user.role               ?? "user",
      romsCount:          hints?.romsCount          ?? user.roms_count         ?? 0,
      totalLikesReceived: hints?.totalLikesReceived ?? user.total_likes_received ?? 0,
      totalDownloads:     hints?.totalDownloads     ?? user.total_downloads    ?? 0,
      totalViewsReceived: hints?.totalViewsReceived ?? user.total_views_received ?? 0,
      subscribersCount:   hints?.subscribersCount   ?? user.subscribers_count  ?? 0,
      ratingsGiven:       hints?.ratingsGiven       ?? user.ratings_given      ?? 0,
      commentsGiven:      hints?.commentsGiven      ?? user.comments_given     ?? 0,
      achievements:       user.achievements         ?? [],
      isEarlyAdopter:     user.is_early_adopter     ?? false,
    };

    const current = new Set(stats.achievements);
    const newlyEarned = ACHIEVEMENT_CHECKS.filter(a => !current.has(a.id) && a.check(stats));

    if (newlyEarned.length === 0) {
      await checkAutoVerify(uid, stats);
      return;
    }

    const totalBonusXP = newlyEarned.reduce((s, a) => s + a.xp, 0);
    const newAchievements = [...stats.achievements, ...newlyEarned.map(a => a.id)];

    const updateData: Record<string, unknown> = { achievements: newAchievements };
    if (totalBonusXP > 0) updateData.xp = (stats.xp + totalBonusXP);
    updateData.updated_at = new Date().toISOString();

    await sb.from("users").update(updateData).eq("id", uid);

    // XP history
    if (totalBonusXP > 0) {
      await sb.from("xp_history").insert({
        uid, amount: totalBonusXP,
        reason: `achievements:${newlyEarned.map(a => a.id).join(",")}`,
        before: stats.xp, after: stats.xp + totalBonusXP,
        ts: new Date().toISOString(),
      });
    }

    // Notifications + admin_logs
    for (const ach of newlyEarned) {
      sendNotif({
        recipientUid: uid, type: "achievement",
        title: `🏆 إنجاز جديد: ${ach.label}`,
        body: ach.xp > 0 ? `حصلت على ${ach.xp} XP مكافأة!` : "أحسنت! استمر في التقدم.",
        link: `/u/${uid}`,
        dedupKey: `achievement_${ach.id}`,
      }).then(undefined, () => {});

      sb.from("admin_logs").insert({
        type: "achievement_earned",
        uid,
        data: { achievementId: ach.id, label: ach.label, icon: ach.icon, userName: user.name },
        created_at: new Date().toISOString(),
      }).then(() => {}, () => {});
    }

    // Level-up notification
    const oldLevel = getLevel(stats.xp);
    const newLevel = getLevel(stats.xp + totalBonusXP);
    if (newLevel.level > oldLevel.level) {
      sendNotif({
        recipientUid: uid, type: "level_up",
        title: `⬆️ وصلت للمستوى ${newLevel.level}: ${newLevel.label}!`,
        body: `تهانينا! أنت الآن ${newLevel.label}.`,
        link: `/u/${uid}`,
        dedupKey: `level_up_${newLevel.level}`,
      }).then(undefined, () => {});
    }

    await checkAutoVerify(uid, { ...stats, xp: stats.xp + totalBonusXP });
  } catch (err) {
    console.error("[achievements] error:", err);
  }
}

// ─────────────────────────────────────────────────────────────
const AUTO_VERIFY = true;

async function checkAutoVerify(
  uid: string,
  stats: Pick<UserAchievementStats, "xp" | "role">
): Promise<void> {
  const sb = getSupabaseAdmin();
  const protectedRoles = new Set(["owner", "admin", "moderator"]);
  if (protectedRoles.has(stats.role)) return;

  if (stats.xp >= 600 && stats.role !== "verifiedDev" && AUTO_VERIFY) {
    await Promise.all([
      sb.from("users").update({
        role: "verifiedDev", ads_enabled: true, ad_placement: "all",
        updated_at: new Date().toISOString(),
      }).eq("id", uid),
    ]);
    sendNotif({
      recipientUid: uid, type: "achievement",
      title: "✅ تم توثيقك تلقائياً!",
      body: "وصلت لـ Developer level وحصلت على علامة التوثيق + تم تفعيل الربح.",
      link: `/u/${uid}`, dedupKey: "auto_verified",
    }).then(undefined, () => {});
  }

  if (stats.xp < 600 && stats.role === "verifiedDev" && AUTO_VERIFY) {
    const { data: u } = await sb.from("users").select("manual_verified").eq("id", uid).single();
    if (!u?.manual_verified) {
      await sb.from("users").update({ role: "user", updated_at: new Date().toISOString() }).eq("id", uid);
    }
  }
}

// ─────────────────────────────────────────────────────────────
export async function revokeAchievements(uid: string): Promise<string[]> {
  try {
    const sb = getSupabaseAdmin();
    const { data: user } = await sb.from("users").select("*").eq("id", uid).single();
    if (!user) return [];

    const stats: UserAchievementStats = {
      uid,
      xp:                 user.xp ?? 0,
      role:               user.role ?? "user",
      romsCount:          user.roms_count ?? 0,
      totalLikesReceived: user.total_likes_received ?? 0,
      totalDownloads:     user.total_downloads ?? 0,
      totalViewsReceived: user.total_views_received ?? 0,
      subscribersCount:   user.subscribers_count ?? 0,
      ratingsGiven:       user.ratings_given ?? 0,
      commentsGiven:      user.comments_given ?? 0,
      achievements:       user.achievements ?? [],
      isEarlyAdopter:     user.is_early_adopter ?? false,
    };

    const toRevoke = ACHIEVEMENT_CHECKS
      .filter(a => !a.id.startsWith("xp_") && a.id !== "early_adopter" && a.id !== "verified_dev")
      .filter(a => stats.achievements.includes(a.id) && !a.check(stats))
      .map(a => a.id);

    if (toRevoke.length === 0) return [];

    const xpToDeduct = toRevoke.reduce((s, id) => {
      return s + (ACHIEVEMENT_CHECKS.find(a => a.id === id)?.xp ?? 0);
    }, 0);

    const newAchievements = stats.achievements.filter(a => !toRevoke.includes(a));
    const updateData: Record<string, unknown> = {
      achievements: newAchievements,
      updated_at: new Date().toISOString(),
    };
    if (xpToDeduct > 0) {
      updateData.xp = Math.max(0, (user.xp ?? 0) - xpToDeduct);
    }

    await sb.from("users").update(updateData).eq("id", uid);

    if (xpToDeduct > 0) {
      await sb.from("xp_history").insert({
        uid, amount: -xpToDeduct,
        reason: `revoke_achievements:${toRevoke.join(",")}`,
        before: user.xp ?? 0,
        after:  Math.max(0, (user.xp ?? 0) - xpToDeduct),
        ts: new Date().toISOString(),
      });
    }

    return toRevoke;
  } catch (err) {
    console.error("[revokeAchievements] error:", err);
    return [];
  }
}
