import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyRequest } from "@/lib/firebase/auth-verify";
import { FieldValue } from "firebase-admin/firestore";
import type { WriteBatch } from "firebase-admin/firestore";
import { XP_REWARDS, ACHIEVEMENTS } from "@/lib/constants";
import { sbAdmin } from "@/lib/supabase/admin";
import { getClientIp, rateLimit, rateLimitedResponse } from "@/lib/api/middleware";

// ── Only owner can run migrations ──────────────────────────────
async function requireOwner(req: NextRequest) {
  const user = await verifyRequest(req);
  if (!user) return null;
  if (user.role !== "owner") return null;
  return user;
}

// ── Batch helper (Firestore max 500 per batch) ─────────────────
async function runInBatches<T>(
  items: T[],
  batchSize: number,
  fn: (batch: WriteBatch, item: T) => void
): Promise<number> {
  let count = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const slice = (items as T[]).slice(i, i + batchSize);
    const batch = adminDb.batch();
    slice.forEach((item) => { fn(batch, item); count++; });
    await batch.commit();
  }
  return count;
}

// ── Migration registry ─────────────────────────────────────────
// Each migration has an id, description, and run() function.
// run() returns { affected, details }

type MigrationResult = { affected: number; details: string[] };

const MIGRATIONS: Record<string, {
  id: string;
  name: string;
  description: string;
  risk: "safe" | "moderate" | "destructive";
  run: () => Promise<MigrationResult>;
}> = {

  // ── 1. Recalculate XP from scratch ─────────────────────────
  recalc_xp: {
    id: "recalc_xp",
    name: "Recalculate All User XP",
    description: "Recomputes every user's XP based on their actual ROMs, likes, downloads, views and achievements using current reward values.",
    risk: "moderate",
    async run(): Promise<MigrationResult> {
      const details: string[] = [];
      let affected = 0;

      // ── قراءة المستخدمين من Firestore ──────────────────────────────────
      const usersSnap = await adminDb.collection("users").get();

      // ── قراءة الـ ROMs من Supabase (المصدر الحقيقي) ─────────────────────
      const { data: romsData, error: romsError } = await sbAdmin
        .from("roms")
        .select("maintainer_uid, likes_count, downloads, total_views, milestone_100_awarded, milestone_500_awarded, milestone_1000_awarded");

      if (romsError) throw new Error(`Supabase roms fetch failed: ${romsError.message}`);

      // Index ROMs by maintainer
      type RomRow = {
        likesCount: number;
        downloads: number;
        totalViews: number;
        milestone100: boolean;
        milestone500: boolean;
        milestone1000: boolean;
      };
      const romsByUser: Record<string, RomRow[]> = {};
      (romsData || []).forEach((r) => {
        const uid = r.maintainer_uid;
        if (!uid) return;
        if (!romsByUser[uid]) romsByUser[uid] = [];
        romsByUser[uid].push({
          likesCount:   r.likes_count   || 0,
          downloads:    r.downloads     || 0,
          totalViews:   r.total_views   || 0,
          milestone100: r.milestone_100_awarded ?? false,
          milestone500: r.milestone_500_awarded ?? false,
          milestone1000:r.milestone_1000_awarded ?? false,
        });
      });

      const batch = adminDb.batch();
      let batchCount = 0;

      for (const userDoc of usersSnap.docs) {
        const data         = userDoc.data();
        const uid          = userDoc.id;
        const roms         = romsByUser[uid] || [];
        const achievements: string[] = data.achievements || [];

        // XP من النشر — كل روم يكسب XP
        const publishXp = roms.length * XP_REWARDS.ROM_PUBLISH;

        // XP من الإعجابات
        const totalLikes = roms.reduce((s, r) => s + r.likesCount, 0);
        const likesXp    = totalLikes * XP_REWARDS.LIKE_RECEIVED;

        // XP من التحميلات (كل 10)
        const totalDownloads = roms.reduce((s, r) => s + r.downloads, 0);
        const dlXp           = Math.floor(totalDownloads / 10) * XP_REWARDS.DOWNLOADS_PER_10;

        // XP من المشاهدات (كل 100)
        const totalViews = roms.reduce((s, r) => s + r.totalViews, 0);
        const viewsXp    = Math.floor(totalViews / 100) * XP_REWARDS.VIEWS_PER_100;

        // XP من الـ milestones (لو سُجّلت على الروم)
        const milestone100Xp  = roms.some(r => r.milestone100)  ? XP_REWARDS.MILESTONE_100_DL : 0;
        const milestone500Xp  = roms.some(r => r.milestone500)  ? XP_REWARDS.MILESTONE_500_DL : 0;
        const milestone1000Xp = roms.some(r => r.milestone1000) ? 100 : 0; // hardcoded في post.ts

        // XP من الـ followers
        const followersXp = (data.subscribersCount || 0) * XP_REWARDS.NEW_FOLLOWER;

        // CHANNEL_SETUP XP removed — no longer awarded
        const channelSetupXp = 0;

        // XP من الـ achievements (بدون double-count — بس achievements اللي XP تبعها منفصل)
        const achievXp = achievements.reduce((s, id) => {
          const ach = ACHIEVEMENTS[id as keyof typeof ACHIEVEMENTS];
          return s + (ach ? ach.xp : 0);
        }, 0);

        const msXp  = milestone100Xp + milestone500Xp + milestone1000Xp;
        const newXp = publishXp + likesXp + dlXp + viewsXp + msXp + followersXp + channelSetupXp + achievXp;
        const oldXp = data.xp || 0;

        if (newXp !== oldXp) {
          batch.update(userDoc.ref, { xp: newXp });
          details.push(
            `${data.username || uid}: ${oldXp} → ${newXp} XP` +
            ` (pub=${publishXp} lk=${likesXp} dl=${dlXp} vw=${viewsXp} ms=${msXp} flw=${followersXp} ch=${channelSetupXp} ach=${achievXp})`
          );
          affected++;
          batchCount++;

          if (batchCount >= 490) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) await batch.commit();

      return { affected, details: details.slice(0, 50) };
    },
  },

  // ── 2. Remove cover images from users below Level 7 ────────
  enforce_cover_gate: {
    id: "enforce_cover_gate",
    name: "Enforce Cover Image Level Gate",
    description: "Removes coverImage from any user who has less than 1,000 XP (Level 7 requirement).",
    risk: "moderate",
    async run(): Promise<MigrationResult> {
      const details: string[] = [];
      let affected = 0;

      const snap = await adminDb.collection("users")
        .where("coverImage", "!=", "")
        .get();

      const batch = adminDb.batch();
      let batchCount = 0;

      for (const doc of snap.docs) {
        const data = doc.data();
        if ((data.xp || 0) < 1000 && data.coverImage) {
          batch.update(doc.ref, { coverImage: FieldValue.delete() });
          details.push(`Removed cover from @${data.username || doc.id} (${data.xp || 0} XP)`);
          affected++;
          batchCount++;
          if (batchCount >= 490) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) await batch.commit();
      return { affected, details };
    },
  },

  // ── 3. Remove pinnedRomId from users below Level 10 ─────────
  enforce_pinned_gate: {
    id: "enforce_pinned_gate",
    name: "Enforce Pinned ROM Level Gate",
    description: "Removes pinnedRomId from users who have less than 2,500 XP (Level 10 requirement).",
    risk: "moderate",
    async run(): Promise<MigrationResult> {
      const details: string[] = [];
      let affected = 0;

      const snap = await adminDb.collection("users")
        .where("pinnedRomId", "!=", "")
        .get();

      const batch = adminDb.batch();
      let batchCount = 0;

      for (const doc of snap.docs) {
        const data = doc.data();
        if ((data.xp || 0) < 2500 && data.pinnedRomId) {
          batch.update(doc.ref, { pinnedRomId: FieldValue.delete() });
          details.push(`Removed pin from @${data.username || doc.id} (${data.xp || 0} XP)`);
          affected++;
          batchCount++;
          if (batchCount >= 490) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) await batch.commit();
      return { affected, details };
    },
  },

  // ── 4. Remove incognito from non-admin/owner ─────────────────
  enforce_incognito_gate: {
    id: "enforce_incognito_gate",
    name: "Enforce Incognito Mode Permission",
    description: "Removes incognitoMode=true from any user who is not admin or owner.",
    risk: "safe",
    async run(): Promise<MigrationResult> {
      const details: string[] = [];
      let affected = 0;

      const snap = await adminDb.collection("users")
        .where("incognitoMode", "==", true)
        .get();

      const batch = adminDb.batch();
      for (const doc of snap.docs) {
        const data = doc.data();
        if (data.role !== "admin" && data.role !== "owner") {
          batch.update(doc.ref, { incognitoMode: false });
          details.push(`Cleared incognito from @${data.username || doc.id} (role: ${data.role || "user"})`);
          affected++;
        }
      }

      if (affected > 0) await batch.commit();
      return { affected, details };
    },
  },

  // ── 5. Sync user stats from actual ROM data ──────────────────
  sync_user_stats: {
    id: "sync_user_stats",
    name: "Sync User Stats from ROM Data",
    description: "Recomputes romsCount, totalLikesReceived, totalDownloads, totalViewsReceived for every user from actual ROM documents.",
    risk: "safe",
    async run(): Promise<MigrationResult> {
      const details: string[] = [];
      let affected = 0;

      // ── قراءة من Supabase (المصدر الحقيقي للـ ROMs) ─────────────────────
      const { data: romsData2, error: romsError2 } = await sbAdmin
        .from("roms")
        .select("maintainer_uid, likes_count, downloads, total_views");
      if (romsError2) throw new Error(`Supabase roms fetch failed: ${romsError2.message}`);

      // Aggregate per user
      const stats: Record<string, {
        romsCount: number;
        totalLikesReceived: number;
        totalDownloads: number;
        totalViewsReceived: number;
      }> = {};

      (romsData2 || []).forEach((r) => {
        const uid = r.maintainer_uid;
        if (!uid) return;
        if (!stats[uid]) stats[uid] = { romsCount: 0, totalLikesReceived: 0, totalDownloads: 0, totalViewsReceived: 0 };
        stats[uid].romsCount++;
        stats[uid].totalLikesReceived += r.likes_count || 0;
        stats[uid].totalDownloads     += r.downloads   || 0;
        stats[uid].totalViewsReceived += r.total_views || 0;
      });

      // Update only changed users
      const usersSnap = await adminDb.collection("users").get();
      const batch = adminDb.batch();
      let batchCount = 0;

      for (const userDoc of usersSnap.docs) {
        const data    = userDoc.data();
        const uid     = userDoc.id;
        const correct = stats[uid] || { romsCount: 0, totalLikesReceived: 0, totalDownloads: 0, totalViewsReceived: 0 };

        const changed =
          (data.romsCount || 0) !== correct.romsCount ||
          (data.totalLikesReceived || 0) !== correct.totalLikesReceived ||
          (data.totalDownloads || 0) !== correct.totalDownloads ||
          (data.totalViewsReceived || 0) !== correct.totalViewsReceived;

        if (changed) {
          batch.update(userDoc.ref, correct);
          details.push(`@${data.username || uid}: roms=${correct.romsCount} likes=${correct.totalLikesReceived} dl=${correct.totalDownloads}`);
          affected++;
          batchCount++;
          if (batchCount >= 490) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) await batch.commit();
      return { affected, details: details.slice(0, 50) };
    },
  },

  // ── 6. Grant missing achievements ────────────────────────────
  grant_missing_achievements: {
    id: "grant_missing_achievements",
    name: "Grant Missing Achievements",
    description: "Scans all users and awards any achievements they qualify for but never received (e.g. first_rom, dl_100, followers_10).",
    risk: "safe",
    async run(): Promise<MigrationResult> {
      const details: string[] = [];
      let affected = 0;

      const usersSnap = await adminDb.collection("users").get();

      // ── قراءة من Supabase (المصدر الحقيقي للـ ROMs) ─────────────────────
      const { data: romsData3, error: romsError3 } = await sbAdmin
        .from("roms")
        .select("maintainer_uid, likes_count, downloads");
      if (romsError3) throw new Error(`Supabase roms fetch failed: ${romsError3.message}`);

      const romsByUser: Record<string, { likesCount: number; downloads: number }[]> = {};
      (romsData3 || []).forEach((r) => {
        const uid = r.maintainer_uid;
        if (!uid) return;
        if (!romsByUser[uid]) romsByUser[uid] = [];
        romsByUser[uid].push({ likesCount: r.likes_count || 0, downloads: r.downloads || 0 });
      });

      const batch = adminDb.batch();
      let batchCount = 0;

      for (const userDoc of usersSnap.docs) {
        const data   = userDoc.data();
        const uid    = userDoc.id;
        const roms   = romsByUser[uid] || [];
        const existing: string[] = data.achievements || [];

        const totalLikes     = roms.reduce((s, r) => s + r.likesCount, 0);
        const totalDownloads = roms.reduce((s, r) => s + r.downloads, 0);
        const followers      = data.subscribersCount || 0;

        const toGrant: string[] = [];

        if (roms.length >= 1  && !existing.includes("first_rom"))     toGrant.push("first_rom");
        if (roms.length >= 5  && !existing.includes("rom_5"))          toGrant.push("rom_5");
        if (roms.length >= 20 && !existing.includes("rom_20"))         toGrant.push("rom_20");
        if (totalLikes >= 10  && !existing.includes("likes_10"))       toGrant.push("likes_10");
        if (totalLikes >= 100 && !existing.includes("likes_100"))      toGrant.push("likes_100");
        if (totalLikes >= 1000&& !existing.includes("likes_1000"))     toGrant.push("likes_1000");
        if (totalDownloads >= 100  && !existing.includes("dl_100"))    toGrant.push("dl_100");
        if (totalDownloads >= 1000 && !existing.includes("dl_1000"))   toGrant.push("dl_1000");
        if (followers >= 10  && !existing.includes("followers_10"))    toGrant.push("followers_10");
        if (followers >= 100 && !existing.includes("followers_100"))   toGrant.push("followers_100");
        if (data.role === "verifiedDev" && !existing.includes("verified_dev")) toGrant.push("verified_dev");

        if (toGrant.length > 0) {
          const bonusXp = toGrant.reduce((s, id) => s + (ACHIEVEMENTS[id]?.xp || 0), 0);
          batch.update(userDoc.ref, {
            achievements: FieldValue.arrayUnion(...toGrant),
            xp: FieldValue.increment(bonusXp),
          });
          details.push(`@${data.username || uid}: granted [${toGrant.join(", ")}] +${bonusXp} XP`);
          affected++;
          batchCount++;
          if (batchCount >= 490) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) await batch.commit();
      return { affected, details: details.slice(0, 50) };
    },
  },

  // ── 7. Fix missing username fields ───────────────────────────
  fix_missing_usernames: {
    id: "fix_missing_usernames",
    name: "Fix Missing usernameLower",
    description: "Ensures all users have usernameLower field synced with their username.",
    risk: "safe",
    async run(): Promise<MigrationResult> {
      const details: string[] = [];
      let affected = 0;

      const snap = await adminDb.collection("users").get();
      const batch = adminDb.batch();
      let batchCount = 0;

      for (const doc of snap.docs) {
        const data = doc.data();
        const username = data.username || "";
        const expectedLower = username.toLowerCase();

        if (data.usernameLower !== expectedLower && username) {
          batch.update(doc.ref, { usernameLower: expectedLower });
          details.push(`Fixed @${username} → usernameLower="${expectedLower}"`);
          affected++;
          batchCount++;
          if (batchCount >= 490) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) await batch.commit();
      return { affected, details };
    },
  },

  // ── 8. Mark early adopters ────────────────────────────────────
  mark_early_adopters: {
    id: "mark_early_adopters",
    name: "Grant Early Adopter Achievement",
    description: "Awards the 'early_adopter' achievement (+100 XP) to all existing users who don't have it yet.",
    risk: "safe",
    async run(): Promise<MigrationResult> {
      const details: string[] = [];
      let affected = 0;

      const snap = await adminDb.collection("users").get();
      const batch = adminDb.batch();
      let batchCount = 0;

      for (const doc of snap.docs) {
        const data = doc.data();
        const achievements: string[] = data.achievements || [];

        if (!achievements.includes("early_adopter")) {
          batch.update(doc.ref, {
            achievements: FieldValue.arrayUnion("early_adopter"),
            xp: FieldValue.increment(ACHIEVEMENTS.early_adopter.xp),
          });
          details.push(`@${data.username || doc.id} ← early_adopter +${ACHIEVEMENTS.early_adopter.xp} XP`);
          affected++;
          batchCount++;
          if (batchCount >= 490) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) await batch.commit();
      return { affected, details: details.slice(0, 50) };
    },
  },

  // ── 9. Auto-enable ads for Publishers (Devs/Admins) ───────────
  auto_enable_ads_devs: {
    id: "auto_enable_ads_devs",
    name: "Auto-enable Ads for Publishers",
    description: "Sets adsEnabled=true for all users with role verifiedDev, admin, or owner.",
    risk: "safe",
    async run(): Promise<MigrationResult> {
      const details: string[] = [];
      let affected = 0;

      const snap = await adminDb.collection("users").where("role", "in", ["verifiedDev", "admin", "owner"]).get();
      const batch = adminDb.batch();
      let batchCount = 0;

      for (const doc of snap.docs) {
        const data = doc.data();
        if (data.adsEnabled !== true) {
          batch.update(doc.ref, { adsEnabled: true });
          details.push(`Enabled ads for @${data.username || doc.id} (${data.role})`);
          affected++;
          batchCount++;
          if (batchCount >= 490) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) await batch.commit();
      return { affected, details: details.slice(0, 50) };
    },
  },

  // ── 7. Seed Financial & Revenue System ───────────────────────
  seed_revenue_system: {
    id: "seed_revenue_system",
    name: "Initialize Platform Revenue & Dev Wallets",
    description: "Creates settings/revenue doc and adds missing financial fields to developers.",
    risk: "safe",
    run: async () => {
      let affected = 0;
      const details: string[] = [];

      // 1. Initialize platform revenue document
      const revRef = adminDb.collection("settings").doc("revenue");
      const revSnap = await revRef.get();
      if (!revSnap.exists) {
        await revRef.set({
          unclaimedPlatformShare: 0,
          totalClaimed: 0,
          totalAdViews: 0,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        affected++;
        details.push("Created settings/revenue document");
      } else {
        details.push("Platform revenue document already exists");
      }

      // 2. Add missing fields to devs with ad earnings
      const usersSnap = await adminDb.collection("users").where("adSupportEarnings", ">", 0).get();
      const batch = adminDb.batch();
      let batchCount = 0;

      for (const doc of usersSnap.docs) {
        const data = doc.data();
        let needsUpdate = false;
        const updates: any = {};

        if (data.totalWithdrawn === undefined) { updates.totalWithdrawn = 0; needsUpdate = true; }
        if (data.pendingWithdrawal === undefined) { updates.pendingWithdrawal = 0; needsUpdate = true; }

        if (needsUpdate) {
          batch.update(doc.ref, updates);
          affected++;
          batchCount++;
          if (batchCount >= 490) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) {
        await batch.commit();
        details.push(`Updated ${batchCount} developer documents with financial fields`);
      }

      return { affected, details };
    },
  },
  // ── 10. Migrate legacy usernames ───────────────────────────
  migrate_legacy_usernames: {
    id: "migrate_legacy_usernames",
    name: "Migrate Legacy Usernames",
    description: "Recovers missing usernames in Supabase by copying them directly from Firestore.",
    risk: "safe",
    async run(): Promise<MigrationResult> {
      const details: string[] = [];
      let affected = 0;

      // Get all Firestore users that have a username
      const usersSnap = await adminDb.collection("users").get();
      const firebaseUsernames: Record<string, string> = {};
      usersSnap.docs.forEach((doc) => {
        const username = doc.data().username;
        if (username) firebaseUsernames[doc.id] = username;
      });

      // Get all Supabase users
      const { data: supabaseUsers, error } = await sbAdmin.from("users").select("id, username");
      if (error) throw new Error("Could not fetch Supabase users: " + error.message);

      for (const su of supabaseUsers || []) {
        const fbUsername = firebaseUsernames[su.id];
        // If user lacks username in Supabase, but has one in Firebase
        if (!su.username && fbUsername) {
          const lower = fbUsername.toLowerCase();
          
          // Using supabase admin to update one by one
          const { error: updErr } = await sbAdmin.from("users").update({
            username: fbUsername,
            username_lower: lower
          }).eq("id", su.id);

          if (updErr) {
            details.push(`Failed to migrate @${fbUsername} for ${su.id}: ${updErr.message}`);
          } else {
            affected++;
            details.push(`Migrated @${fbUsername} for ${su.id}`);
          }
        }
      }

      return { affected, details: details.slice(0, 50) };
    },
  },
};

// ── GET: list migrations + their last run status ───────────────
export async function GET(req: NextRequest) {
  const _ip = getClientIp(req);
  if (!await rateLimit(_ip, 10)) return rateLimitedResponse(req);

  const user = await requireOwner(req);
  if (!user) return NextResponse.json({ error: "Owner only" }, { status: 403 });

  // Load run history from Firestore
  const historySnap = await adminDb.collection("migration_history").get();
  const history: Record<string, { ranAt: string; affected: number; ranBy: string }> = {};
  historySnap.docs.forEach((d) => {
    const data = d.data();
    history[d.id] = {
      ranAt: data.ranAt?.toDate?.()?.toISOString() || data.ranAt || "",
      affected: data.affected || 0,
      ranBy: data.ranBy || "",
    };
  });

  const list = Object.values(MIGRATIONS).map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    risk: m.risk,
    lastRun: history[m.id] || null,
  }));

  return NextResponse.json({ migrations: list });
}

// ── POST: run a migration ──────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await requireOwner(req);
  if (!user) return NextResponse.json({ error: "Owner only" }, { status: 403 });

  const body = await req.json();
  const { migrationId } = body;

  if (!migrationId) return NextResponse.json({ error: "migrationId required" }, { status: 400 });

  const migration = MIGRATIONS[migrationId];
  if (!migration) return NextResponse.json({ error: "Unknown migration" }, { status: 404 });

  const startedAt = Date.now();

  try {
    const result = await migration.run();
    const duration = Date.now() - startedAt;

    // Record in history
    await adminDb.collection("migration_history").doc(migrationId).set({
      migrationId,
      name: migration.name,
      affected: result.affected,
      duration,
      ranBy: user.uid,
      ranAt: FieldValue.serverTimestamp(),
      details: result.details,
    });

    return NextResponse.json({
      ok: true,
      affected: result.affected,
      duration,
      details: result.details,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Migration failed",
    }, { status: 500 });
  }
}
