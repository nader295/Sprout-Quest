#!/usr/bin/env node
/**
 * scripts/migrate-firestore-to-supabase.mjs
 *
 * سكربت نقل البيانات من Firestore → Supabase
 *
 * الاستخدام:
 *   node scripts/migrate-firestore-to-supabase.mjs
 *   node scripts/migrate-firestore-to-supabase.mjs --collection=users
 *   node scripts/migrate-firestore-to-supabase.mjs --dry-run
 *
 * متطلبات:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *   FIREBASE_SERVICE_ACCOUNT_JSON=... (base64 or path)
 *
 * npm install @supabase/supabase-js firebase-admin dotenv
 */

import { createClient } from "@supabase/supabase-js";
import admin from "firebase-admin";
import { readFileSync } from "fs";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env.local") });

// ── CLI args ────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN   = args.includes("--dry-run");
const ONLY_COL  = args.find(a => a.startsWith("--collection="))?.split("=")[1];
const BATCH_SIZE = 250;

// ── Colors ──────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m", green: "\x1b[32m", yellow: "\x1b[33m",
  red: "\x1b[31m", blue: "\x1b[34m", cyan: "\x1b[36m", dim: "\x1b[2m",
};
const log   = (m) => console.log(`${C.blue}[migrate]${C.reset} ${m}`);
const ok    = (m) => console.log(`${C.green}  ✓${C.reset} ${m}`);
const warn  = (m) => console.log(`${C.yellow}  ⚠${C.reset} ${m}`);
const err   = (m) => console.error(`${C.red}  ✗${C.reset} ${m}`);
const dim   = (m) => console.log(`${C.dim}    ${m}${C.reset}`);

// ── Init Firebase Admin ──────────────────────────────────────
function initFirebase() {
  if (admin.apps.length) return admin.firestore();

  let serviceAccount;
  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const envPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (envJson) {
    const raw = Buffer.from(envJson, "base64").toString("utf-8");
    serviceAccount = JSON.parse(raw);
  } else if (envPath) {
    serviceAccount = JSON.parse(readFileSync(envPath, "utf-8"));
  } else {
    throw new Error(
      "Set FIREBASE_SERVICE_ACCOUNT_JSON (base64) or FIREBASE_SERVICE_ACCOUNT_PATH"
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return admin.firestore();
}

// ── Init Supabase ────────────────────────────────────────────
function initSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// ── Helper: serialize Firestore Timestamp → ISO string ───────
function serializeValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val?.toDate === "function") return val.toDate().toISOString();
  if (val instanceof Date) return val.toISOString();
  if (Array.isArray(val)) return val.map(serializeValue);
  if (typeof val === "object") {
    const out = {};
    for (const [k, v] of Object.entries(val)) out[k] = serializeValue(v);
    return out;
  }
  return val;
}

function serializeDoc(doc) {
  const data = doc.data();
  const out = { id: doc.id };
  for (const [k, v] of Object.entries(data)) {
    out[k] = serializeValue(v);
  }
  return out;
}

// ── Batch upsert helper ──────────────────────────────────────
async function upsertBatch(sb, table, rows, onConflict = "id") {
  if (DRY_RUN) { dim(`[dry-run] would upsert ${rows.length} rows into ${table}`); return 0; }
  const { error, count } = await sb
    .from(table)
    .upsert(rows, { onConflict, ignoreDuplicates: false })
    .select("id");
  if (error) {
    err(`upsert ${table}: ${error.message}`);
    return 0;
  }
  return rows.length;
}

// ══════════════════════════════════════════════════════════════
//  MIGRATION FUNCTIONS
// ══════════════════════════════════════════════════════════════

// ── 1. USERS ─────────────────────────────────────────────────
async function migrateUsers(db, sb) {
  log("Migrating users...");
  let total = 0, page = 0;
  let lastDoc = null;

  while (true) {
    let q = db.collection("users").orderBy("__name__").limit(BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;
    lastDoc = snap.docs[snap.docs.length - 1];
    page++;

    const rows = snap.docs.map(doc => {
      const d = serializeDoc(doc);
      return {
        id:                    d.id,
        name:                  d.name             ?? "",
        username:              d.username          ?? null,
        username_lower:        d.usernameLower     ?? d.username?.toLowerCase() ?? null,
        email:                 d.email             ?? null,
        photo:                 d.photo             ?? "",
        cover_photo:           d.coverPhoto        ?? "",
        bio:                   d.bio               ?? "",
        role:                  d.role              ?? "user",
        xp:                    d.xp                ?? 0,
        level:                 d.level             ?? 1,
        roms_count:            d.romsCount         ?? 0,
        followers_count:       d.subscribersCount  ?? d.followersCount ?? 0,
        following_count:       d.followingCount    ?? 0,
        subscribers_count:     d.subscribersCount  ?? 0,
        downloads_total:       d.totalDownloads    ?? 0,
        likes_received:        d.totalLikesReceived ?? 0,
        total_likes_received:  d.totalLikesReceived ?? 0,
        total_downloads:       d.totalDownloads    ?? 0,
        total_views_received:  d.totalViewsReceived ?? 0,
        country:               d.country           ?? "",
        website:               d.website           ?? "",
        telegram:              d.telegram          ?? "",
        github:                d.github            ?? "",
        channel_link:          d.channelLink       ?? "",
        donation_links:        d.donationLinks     ?? [],
        badges:                d.badges            ?? [],
        achievements:          d.achievements      ?? [],
        unread_notifications:  d.unreadNotifications ?? 0,
        ratings_given:         d.ratingsGiven      ?? 0,
        comments_given:        d.commentsGiven     ?? 0,
        is_early_adopter:      d.isEarlyAdopter    ?? false,
        manual_verified:       d.manualVerified    ?? false,
        ads_enabled:           d.adsEnabled        ?? false,
        ad_placement:          d.adPlacement       ?? "",
        total_earned:          d.totalEarned       ?? 0,
        available_balance:     d.availableBalance  ?? 0,
        suspended_until:       d.suspendedUntil    ?? null,
        suspension_reason:     d.suspensionReason  ?? "",
        is_suspended:          d.isSuspended       ?? false,
        created_at:            d.createdAt         ?? new Date().toISOString(),
        updated_at:            d.updatedAt         ?? new Date().toISOString(),
      };
    });

    const inserted = await upsertBatch(sb, "users", rows, "id");
    total += inserted;
    dim(`  Page ${page}: ${rows.length} users (total: ${total})`);
  }

  ok(`Users: ${total} migrated`);
  return total;
}

// ── 2. NOTIFICATIONS (subcollection) ─────────────────────────
async function migrateNotifications(db, sb) {
  log("Migrating notifications...");
  let total = 0;

  // Get all users first
  const usersSnap = await db.collection("users").select().get();
  const uids = usersSnap.docs.map(d => d.id);
  dim(`  Found ${uids.length} users to check notifications for`);

  for (const uid of uids) {
    const snap = await db
      .collection("users").doc(uid)
      .collection("notifications")
      .orderBy("createdAt", "desc")
      .limit(100)  // last 100 per user
      .get();

    if (snap.empty) continue;

    const rows = snap.docs.map(doc => {
      const d = serializeDoc(doc);
      return {
        id:            d.id,
        recipient_uid: uid,
        type:          d.type          ?? "broadcast",
        title:         d.title         ?? "",
        body:          d.body          ?? "",
        link:          d.link          ?? "",
        author_photo:  d.authorPhoto   ?? "",
        read:          d.read          ?? false,
        dedup_key:     d.dedupKey      ?? null,
        created_at:    d.createdAt     ?? new Date().toISOString(),
      };
    });

    const inserted = await upsertBatch(sb, "notifications", rows, "id");
    total += inserted;
  }

  ok(`Notifications: ${total} migrated`);
  return total;
}

// ── 3. FOLLOWS (subcollections: users/{uid}/following) ───────
async function migrateFollows(db, sb) {
  log("Migrating follows...");
  let total = 0;

  const usersSnap = await db.collection("users").select().get();
  const uids = usersSnap.docs.map(d => d.id);

  for (const uid of uids) {
    const snap = await db
      .collection("users").doc(uid)
      .collection("following")
      .get();

    if (snap.empty) continue;

    const rows = snap.docs.map(doc => ({
      follower_id:  uid,
      following_id: doc.id,
      created_at:   serializeValue(doc.data()?.createdAt) ?? new Date().toISOString(),
    }));

    const inserted = await upsertBatch(
      sb, "follows", rows, "follower_id,following_id"
    );
    total += inserted;
  }

  ok(`Follows: ${total} migrated`);
  return total;
}

// ── 4. REPORTS ────────────────────────────────────────────────
async function migrateReports(db, sb) {
  log("Migrating reports...");
  const snap = await db.collection("reports").orderBy("createdAt", "desc").limit(2000).get();
  if (snap.empty) { ok("Reports: 0 (empty)"); return 0; }

  const rows = snap.docs.map(doc => {
    const d = serializeDoc(doc);
    return {
      id:           d.id,
      reporter_uid: d.reporterUid ?? d.uid ?? "",
      target_type:  d.targetType  ?? "rom",
      target_id:    d.targetId    ?? d.romId ?? "",
      reason:       d.reason      ?? "",
      details:      d.details     ?? d.description ?? "",
      status:       d.status      ?? "pending",
      admin_note:   d.adminNote   ?? "",
      reviewed_by:  d.reviewedBy  ?? null,
      created_at:   d.createdAt   ?? new Date().toISOString(),
      updated_at:   d.updatedAt   ?? d.createdAt ?? new Date().toISOString(),
    };
  });

  const total = await upsertBatch(sb, "reports", rows, "id");
  ok(`Reports: ${total} migrated`);
  return total;
}

// ── 5. ADMIN LOGS ─────────────────────────────────────────────
async function migrateAdminLogs(db, sb) {
  log("Migrating admin_logs...");
  const snap = await db.collection("admin_logs").orderBy("createdAt", "desc").limit(5000).get();
  if (snap.empty) { ok("Admin logs: 0 (empty)"); return 0; }

  const rows = snap.docs.map(doc => {
    const d = serializeDoc(doc);
    const { id, type, uid, createdAt, ...rest } = d;
    return {
      id:         d.id,
      type:       d.type       ?? "unknown",
      uid:        d.uid        ?? null,
      data:       rest,
      created_at: d.createdAt  ?? new Date().toISOString(),
    };
  });

  const total = await upsertBatch(sb, "admin_logs", rows, "id");
  ok(`Admin logs: ${total} migrated`);
  return total;
}

// ── 6. APPLICATIONS ────────────────────────────────────────────
async function migrateApplications(db, sb) {
  log("Migrating applications...");
  const snap = await db.collection("applications").get();
  if (snap.empty) { ok("Applications: 0 (empty)"); return 0; }

  const rows = snap.docs.map(doc => {
    const d = serializeDoc(doc);
    return {
      id:          d.id,
      uid:         d.uid        ?? "",
      name:        d.name       ?? "",
      links:       d.links      ?? [],
      message:     d.message    ?? d.description ?? "",
      status:      d.status     ?? "pending",
      admin_note:  d.adminNote  ?? "",
      reviewed_by: d.reviewedBy ?? null,
      created_at:  d.createdAt  ?? new Date().toISOString(),
      updated_at:  d.updatedAt  ?? d.createdAt ?? new Date().toISOString(),
    };
  });

  const total = await upsertBatch(sb, "applications", rows, "id");
  ok(`Applications: ${total} migrated`);
  return total;
}

// ── 7. APPEALS ─────────────────────────────────────────────────
async function migrateAppeals(db, sb) {
  log("Migrating appeals...");
  const snap = await db.collection("appeals").get();
  if (snap.empty) { ok("Appeals: 0 (empty)"); return 0; }

  const rows = snap.docs.map(doc => {
    const d = serializeDoc(doc);
    return {
      id:         d.id,
      uid:        d.uid       ?? "",
      reason:     d.reason    ?? "",
      details:    d.details   ?? "",
      status:     d.status    ?? "pending",
      admin_note: d.adminNote ?? "",
      created_at: d.createdAt ?? new Date().toISOString(),
      updated_at: d.updatedAt ?? d.createdAt ?? new Date().toISOString(),
    };
  });

  const total = await upsertBatch(sb, "appeals", rows, "id");
  ok(`Appeals: ${total} migrated`);
  return total;
}

// ── 8. PAYOUT REQUESTS ─────────────────────────────────────────
async function migratePayouts(db, sb) {
  log("Migrating payout_requests...");
  const snap = await db.collection("payout_requests").get();
  if (snap.empty) { ok("Payouts: 0 (empty)"); return 0; }

  const rows = snap.docs.map(doc => {
    const d = serializeDoc(doc);
    return {
      id:             d.id,
      uid:            d.uid            ?? "",
      amount:         d.amount         ?? 0,
      currency:       d.currency       ?? "USD",
      payment_method: d.paymentMethod  ?? d.method ?? "",
      wallet_address: d.walletAddress  ?? d.wallet ?? "",
      status:         d.status         ?? "pending",
      admin_note:     d.adminNote      ?? "",
      processed_by:   d.processedBy    ?? null,
      ip:             d.ip             ?? "",
      trust_level:    d.trustLevel     ?? "standard",
      data:           { ...d },
      created_at:     d.createdAt      ?? new Date().toISOString(),
      updated_at:     d.updatedAt      ?? d.createdAt ?? new Date().toISOString(),
    };
  });

  const total = await upsertBatch(sb, "payout_requests", rows, "id");
  ok(`Payouts: ${total} migrated`);
  return total;
}

// ── 9. XP HISTORY ──────────────────────────────────────────────
async function migrateXpHistory(db, sb) {
  log("Migrating xp_history...");
  const snap = await db.collection("xp_history").orderBy("ts", "desc").limit(10000).get();
  if (snap.empty) { ok("XP history: 0 (empty)"); return 0; }

  const rows = snap.docs.map(doc => {
    const d = serializeDoc(doc);
    return {
      id:     d.id,
      uid:    d.uid    ?? "",
      amount: d.amount ?? 0,
      reason: d.reason ?? "",
      before: d.before ?? 0,
      after:  d.after  ?? 0,
      ts:     d.ts     ?? new Date().toISOString(),
    };
  });

  const total = await upsertBatch(sb, "xp_history", rows, "id");
  ok(`XP history: ${total} migrated`);
  return total;
}

// ── 10. FRAUD ALERTS ────────────────────────────────────────────
async function migrateFraudAlerts(db, sb) {
  log("Migrating fraud_alerts...");
  const snap = await db.collection("fraud_alerts").get();
  if (snap.empty) { ok("Fraud alerts: 0 (empty)"); return 0; }

  const rows = snap.docs.map(doc => {
    const d = serializeDoc(doc);
    return {
      id:       d.id,
      uid:      d.uid      ?? "",
      date:     d.date     ?? new Date().toISOString().split("T")[0],
      reasons:  d.reasons  ?? [],
      type:     d.type     ?? "auto",
      reviewed: d.reviewed ?? false,
      ts:       d.ts       ?? new Date().toISOString(),
    };
  });

  const total = await upsertBatch(sb, "fraud_alerts", rows, "id");
  ok(`Fraud alerts: ${total} migrated`);
  return total;
}

// ── 11. COLLABORATORS ──────────────────────────────────────────
async function migrateCollaborators(db, sb) {
  log("Migrating collaborators...");
  const snap = await db.collection("collaborators").get();
  if (snap.empty) { ok("Collaborators: 0 (empty)"); return 0; }

  const rows = snap.docs.map(doc => {
    const d = serializeDoc(doc);
    return {
      rom_id:   d.romId  ?? d.id.split("_")[0] ?? "",
      user_id:  d.userId ?? d.uid ?? "",
      role:     d.role   ?? "collaborator",
      added_at: d.createdAt ?? new Date().toISOString(),
    };
  }).filter(r => r.rom_id && r.user_id);

  const total = await upsertBatch(sb, "collaborators", rows, "rom_id,user_id");
  ok(`Collaborators: ${total} migrated`);
  return total;
}

// ── 12. DEVICE WATCHES ─────────────────────────────────────────
async function migrateDeviceWatches(db, sb) {
  log("Migrating device_watches...");
  const snap = await db.collection("device_watches").get();
  if (snap.empty) { ok("Device watches: 0 (empty)"); return 0; }

  const rows = snap.docs.map(doc => {
    const d = serializeDoc(doc);
    return {
      user_id:    d.userId   ?? d.uid ?? "",
      codename:   d.codename ?? "",
      created_at: d.createdAt ?? new Date().toISOString(),
    };
  }).filter(r => r.user_id && r.codename);

  const total = await upsertBatch(sb, "device_watches", rows, "user_id,codename");
  ok(`Device watches: ${total} migrated`);
  return total;
}

// ── 13. PUSH TOKENS ────────────────────────────────────────────
async function migratePushTokens(db, sb) {
  log("Migrating push_tokens...");
  const snap = await db.collection("push_tokens").get();
  if (snap.empty) { ok("Push tokens: 0 (empty)"); return 0; }

  const rows = snap.docs.map(doc => {
    const d = serializeDoc(doc);
    return {
      id:         d.id,
      uid:        d.uid      ?? "",
      token:      d.token    ?? d.id,
      platform:   d.platform ?? "web",
      created_at: d.createdAt ?? new Date().toISOString(),
      updated_at: d.updatedAt ?? d.createdAt ?? new Date().toISOString(),
    };
  });

  const total = await upsertBatch(sb, "push_tokens", rows, "token");
  ok(`Push tokens: ${total} migrated`);
  return total;
}

// ── 14. SETTINGS ──────────────────────────────────────────────
async function migrateSettings(db, sb) {
  log("Migrating settings...");
  const snap = await db.collection("settings").get();
  if (snap.empty) { ok("Settings: 0 (empty)"); return 0; }

  const rows = snap.docs.map(doc => {
    const d = doc.data();
    return {
      key:        doc.id,
      value:      serializeValue(d),
      updated_at: new Date().toISOString(),
    };
  });

  const total = await upsertBatch(sb, "settings", rows, "key");
  ok(`Settings: ${total} migrated`);
  return total;
}

// ── 15. ACTIVITY ──────────────────────────────────────────────
async function migrateActivity(db, sb) {
  log("Migrating activity...");
  const snap = await db.collection("activity").orderBy("createdAt", "desc").limit(5000).get();
  if (snap.empty) { ok("Activity: 0 (empty)"); return 0; }

  const rows = snap.docs.map(doc => {
    const d = serializeDoc(doc);
    const { id, type, uid, createdAt, ...rest } = d;
    return {
      id:         d.id,
      uid:        d.uid ?? d.maintainerUid ?? null,
      type:       d.type ?? "unknown",
      data:       rest,
      created_at: d.createdAt ?? new Date().toISOString(),
    };
  });

  const total = await upsertBatch(sb, "activity", rows, "id");
  ok(`Activity: ${total} migrated`);
  return total;
}

// ── 16. RESERVED USERNAMES ─────────────────────────────────────
async function migrateReservedUsernames(db, sb) {
  log("Migrating reserved_usernames...");
  const snap = await db.collection("reserved_usernames").get();
  if (snap.empty) { ok("Reserved usernames: 0 (empty)"); return 0; }

  const rows = snap.docs.map(doc => ({
    username:   doc.id,
    reason:     doc.data()?.reason ?? "",
    created_at: serializeValue(doc.data()?.createdAt) ?? new Date().toISOString(),
  }));

  const total = await upsertBatch(sb, "reserved_usernames", rows, "username");
  ok(`Reserved usernames: ${total} migrated`);
  return total;
}

// ── 17. FINANCIAL AUDIT LOG ────────────────────────────────────
async function migrateFinancialAuditLog(db, sb) {
  log("Migrating financial_audit_log...");
  const snap = await db.collection("financial_audit_log").orderBy("ts", "desc").limit(5000).get();
  if (snap.empty) { ok("Financial audit: 0 (empty)"); return 0; }

  const rows = snap.docs.map(doc => {
    const d = serializeDoc(doc);
    return {
      id:     d.id,
      uid:    d.uid    ?? null,
      action: d.action ?? d.type ?? "unknown",
      amount: d.amount ?? null,
      data:   d,
      ts:     d.ts     ?? d.createdAt ?? new Date().toISOString(),
    };
  });

  const total = await upsertBatch(sb, "financial_audit_log", rows, "id");
  ok(`Financial audit: ${total} migrated`);
  return total;
}

// ── 18. MONTHLY SETTLEMENTS ────────────────────────────────────
async function migrateMonthlySettlements(db, sb) {
  log("Migrating monthly_settlements...");
  const snap = await db.collection("monthly_settlements").get();
  if (snap.empty) { ok("Monthly settlements: 0 (empty)"); return 0; }

  const rows = snap.docs.map(doc => {
    const d = serializeDoc(doc);
    return {
      id:         d.id,
      uid:        d.uid    ?? "",
      month:      d.month  ?? "",
      amount:     d.amount ?? 0,
      status:     d.status ?? "pending",
      data:       d,
      created_at: d.createdAt ?? new Date().toISOString(),
    };
  });

  const total = await upsertBatch(sb, "monthly_settlements", rows, "id");
  ok(`Monthly settlements: ${total} migrated`);
  return total;
}

// ── 19. COMMENTS (Firestore subcollections → Supabase) ────────
async function migrateComments(db, sb) {
  log("Migrating comments (Firestore subcollection)...");
  let total = 0;

  // Check if already in Supabase
  const { count } = await sb.from("comments").select("*", { count: "exact", head: true });
  if (count > 0) {
    warn(`Comments: ${count} already in Supabase — skipping (use --force to override)`);
    return count;
  }

  // Use collectionGroup to get all comments across roms
  const snap = await db.collectionGroup("comments").orderBy("createdAt", "asc").limit(10000).get();
  if (snap.empty) { ok("Comments: 0 (empty)"); return 0; }

  const rows = snap.docs.map(doc => {
    const d = serializeDoc(doc);
    // Extract romId from path: roms/{romId}/comments/{commentId}
    const romId = doc.ref.parent.parent?.id ?? d.romId ?? "";
    return {
      id:          d.id,
      rom_id:      romId,
      user_id:     d.uid       ?? d.userId ?? "",
      user_name:   d.userName  ?? d.name   ?? "",
      user_photo:  d.userPhoto ?? d.photo  ?? "",
      content:     d.content   ?? d.text   ?? "",
      likes_count: d.likesCount ?? 0,
      parent_id:   d.parentId   ?? null,
      is_deleted:  d.isDeleted  ?? false,
      created_at:  d.createdAt  ?? new Date().toISOString(),
      updated_at:  d.updatedAt  ?? d.createdAt ?? new Date().toISOString(),
    };
  }).filter(r => r.rom_id && r.user_id && r.content);

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const inserted = await upsertBatch(sb, "comments", batch, "id");
    total += inserted;
  }

  ok(`Comments: ${total} migrated`);
  return total;
}

// ══════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════

const MIGRATIONS = {
  users:                 migrateUsers,
  notifications:         migrateNotifications,
  follows:               migrateFollows,
  reports:               migrateReports,
  admin_logs:            migrateAdminLogs,
  applications:          migrateApplications,
  appeals:               migrateAppeals,
  payout_requests:       migratePayouts,
  xp_history:            migrateXpHistory,
  fraud_alerts:          migrateFraudAlerts,
  collaborators:         migrateCollaborators,
  device_watches:        migrateDeviceWatches,
  push_tokens:           migratePushTokens,
  settings:              migrateSettings,
  activity:              migrateActivity,
  reserved_usernames:    migrateReservedUsernames,
  financial_audit_log:   migrateFinancialAuditLog,
  monthly_settlements:   migrateMonthlySettlements,
  comments:              migrateComments,
};

async function main() {
  console.log(`\n${C.cyan}══════════════════════════════════════════${C.reset}`);
  console.log(`${C.cyan}  RomX — Firestore → Supabase Migration${C.reset}`);
  console.log(`${C.cyan}══════════════════════════════════════════${C.reset}`);
  if (DRY_RUN) warn("DRY RUN MODE — no data will be written\n");

  const db = initFirebase();
  const sb = initSupabase();
  log(`Connected to Firebase & Supabase ✓\n`);

  const toRun = ONLY_COL
    ? { [ONLY_COL]: MIGRATIONS[ONLY_COL] }
    : MIGRATIONS;

  if (ONLY_COL && !MIGRATIONS[ONLY_COL]) {
    err(`Unknown collection: ${ONLY_COL}`);
    err(`Available: ${Object.keys(MIGRATIONS).join(", ")}`);
    process.exit(1);
  }

  const results = {};
  const startTime = Date.now();

  for (const [name, fn] of Object.entries(toRun)) {
    try {
      const count = await fn(db, sb);
      results[name] = { count, status: "ok" };
    } catch (e) {
      err(`${name} failed: ${e.message}`);
      results[name] = { count: 0, status: "error", error: e.message };
    }
    console.log();
  }

  // ── Record migration in Supabase ──
  if (!DRY_RUN) {
    await sb.from("migration_history").upsert({
      name:    `firestore_migration_${new Date().toISOString().split("T")[0]}`,
      status:  "done",
      records: Object.values(results).reduce((s, r) => s + r.count, 0),
      ran_at:  new Date().toISOString(),
    }, { onConflict: "name" });
  }

  // ── Summary ──────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${C.cyan}══════ Summary (${elapsed}s) ══════${C.reset}`);
  let totalMigrated = 0;
  for (const [name, { count, status, error }] of Object.entries(results)) {
    const icon = status === "ok" ? C.green + "✓" : C.red + "✗";
    console.log(`  ${icon}${C.reset} ${name.padEnd(25)} ${count.toString().padStart(6)} records${error ? ` — ${C.red}${error}${C.reset}` : ""}`);
    totalMigrated += count;
  }
  console.log(`\n  Total: ${C.green}${totalMigrated}${C.reset} records migrated\n`);
}

main().catch(e => { err(e.message); process.exit(1); });
