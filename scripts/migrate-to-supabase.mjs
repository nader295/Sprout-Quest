#!/usr/bin/env node
/**
 * scripts/migrate-to-supabase.mjs
 * ─────────────────────────────────────────────────────────────────
 *  يهاجر بيانات RomX من Firebase Firestore إلى Supabase
 *
 *  الجداول المنقولة:
 *    ✅ roms       (الرومات — الأهم)
 *    ✅ users      (المستخدمين)
 *    ✅ collections (المجموعات)
 *    ✅ devices    (الأجهزة)
 *    ✅ likes      (إعجابات — من likedRomIds في كل يوزر)
 *
 *  الاستخدام:
 *    node scripts/migrate-to-supabase.mjs
 *    node scripts/migrate-to-supabase.mjs --dry-run       # معاينة بدون كتابة
 *    node scripts/migrate-to-supabase.mjs --only=roms     # ترحيل الرومات فقط
 *    node scripts/migrate-to-supabase.mjs --only=users    # ترحيل اليوزرز فقط
 *    node scripts/migrate-to-supabase.mjs --batch=50      # حجم الـ batch (افتراضي 100)
 *
 *  متطلبات:
 *    npm install firebase-admin @supabase/supabase-js dotenv
 *    ملف .env.local يحتوي على المفاتيح (أو export المتغيرات يدوياً)
 * ─────────────────────────────────────────────────────────────────
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── تحميل متغيرات البيئة من .env.local ─────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env.local");

if (!existsSync(envPath)) {
  console.error("❌  .env.local مش موجود — انسخ .env.example وعبيه أولاً");
  process.exit(1);
}

// قراءة .env.local يدوياً بدون مكتبة خارجية
const envContent = readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
  if (key && !process.env[key]) process.env[key] = val;
}

// ── Args ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN   = args.includes("--dry-run");
const ONLY      = args.find(a => a.startsWith("--only="))?.split("=")[1];
const BATCH_ARG = args.find(a => a.startsWith("--batch="))?.split("=")[1];
const BATCH_SIZE = BATCH_ARG ? parseInt(BATCH_ARG) : 100;

// ── Validate Env ────────────────────────────────────────────────
const required = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`❌  متغيرات ناقصة في .env.local:\n   ${missing.join("\n   ")}`);
  process.exit(1);
}

// ── Dynamic Imports ─────────────────────────────────────────────
let initializeApp, cert, getFirestore, createClient;

try {
  ({ initializeApp, cert } = await import("firebase-admin/app"));
  ({ getFirestore } = await import("firebase-admin/firestore"));
} catch {
  console.error("❌  firebase-admin غير مثبت — شغّل: npm install firebase-admin");
  process.exit(1);
}

try {
  ({ createClient } = await import("@supabase/supabase-js"));
} catch {
  console.error("❌  @supabase/supabase-js غير مثبت — شغّل: npm install @supabase/supabase-js");
  process.exit(1);
}

// ── Init Clients ─────────────────────────────────────────────────
initializeApp({
  credential: cert({
    projectId:    process.env.FIREBASE_PROJECT_ID,
    clientEmail:  process.env.FIREBASE_CLIENT_EMAIL,
    privateKey:   process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore();
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ── Helpers ──────────────────────────────────────────────────────
function ts(val) {
  if (!val) return null;
  if (val?.toDate) return val.toDate().toISOString();
  if (val?.seconds) return new Date(val.seconds * 1000).toISOString();
  if (typeof val === "string") return val;
  return null;
}

function chunks(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

async function upsertBatch(table, rows) {
  if (DRY_RUN) {
    console.log(`   [DRY-RUN] سيُضاف ${rows.length} صف إلى جدول ${table}`);
    return { count: rows.length, errors: 0 };
  }

  let errors = 0;
  for (const chunk of chunks(rows, 50)) {
    const { error } = await sb.from(table).upsert(chunk, { onConflict: "id" });
    if (error) {
      console.error(`   ⚠️  ${table}: ${error.message}`);
      errors += chunk.length;
    }
  }
  return { count: rows.length - errors, errors };
}

// ═══════════════════════════════════════════════════════════════
// MIGRATE ROMS
// ═══════════════════════════════════════════════════════════════
async function migrateRoms() {
  console.log("\n📦 ترحيل الرومات...");

  const snap = await db.collection("roms").get();
  if (snap.empty) { console.log("   لا توجد رومات في Firestore"); return; }

  const rows = snap.docs.map(doc => {
    const d = doc.data();
    return {
      id:                  doc.id,
      name:                d.name             ?? "",
      content_type:        d.contentType       ?? "rom",
      brand:               d.brand             ?? "",
      device:              d.device            ?? "",
      android:             d.android           ?? "",
      version:             d.version           ?? "",
      size:                d.size              ?? "",
      description:         d.description       ?? "",
      changelog:           d.changelog         ?? "",
      download_url:        d.downloadUrl        ?? "",
      mirror_url:          d.mirrorUrl          ?? "",
      thumbnail:           d.thumbnail          ?? "",
      screenshots:         d.screenshots        ?? [],
      tags:                d.tags               ?? [],
      rom_status:          d.romStatus          ?? "active",
      rom_type:            d.romType            ?? "",
      install_guide:       d.installGuide       ?? "",
      checksum_md5:        d.checksumMd5        ?? "",
      checksum_sha256:     d.checksumSha256     ?? "",
      kernel_version:      d.kernelVersion      ?? "",
      recovery_type:       d.recoveryType       ?? "",
      module_id:           d.moduleId           ?? "",
      min_magisk:          d.minMagisk          ?? "",
      compatible_devices:  d.compatibleDevices  ?? [],
      mirrors:             d.mirrors            ?? [],
      // Stats
      downloads:           d.downloads          ?? 0,
      total_views:         d.total_views        ?? 0,
      likes_count:         d.likesCount         ?? 0,
      comments_count:      d.commentsCount      ?? 0,
      rating_avg:          d.ratingAvg          ?? 0,
      rating_count:        d.ratingCount        ?? 0,
      rating_sum:          d.ratingSum          ?? 0,
      trend_score:         d.trendScore         ?? 0,
      version_count:       d.versionCount       ?? 1,
      // Maintainer
      maintainer_uid:      d.maintainerUid      ?? "",
      maintainer_name:     d.maintainerName     ?? "",
      maintainer_photo:    d.maintainerPhoto    ?? "",
      featured:            d.featured           ?? false,
      // Timestamps
      created_at:          ts(d.createdAt),
      updated_at:          ts(d.updatedAt),
    };
  });

  const { count, errors } = await upsertBatch("roms", rows);
  console.log(`   ✅ ${count} رومة مرحّلة${errors ? ` | ⚠️ ${errors} فشلت` : ""}`);
}

// ═══════════════════════════════════════════════════════════════
// MIGRATE USERS
// ═══════════════════════════════════════════════════════════════
async function migrateUsers() {
  console.log("\n👤 ترحيل المستخدمين...");

  const snap = await db.collection("users").get();
  if (snap.empty) { console.log("   لا يوجد مستخدمين في Firestore"); return; }

  const rows = snap.docs.map(doc => {
    const d = doc.data();
    // تحويل الـ role — Supabase لا يقبل "owner"
    let role = d.role ?? "user";
    if (role === "owner") role = "admin";

    // جمع الـ social links
    const donationLinks = d.donationLinks ?? [];

    return {
      id:               doc.id,
      name:             d.name            ?? "",
      username:         d.username        ?? null,
      email:            d.email           ?? null,
      photo:            d.photo           ?? "",
      cover_photo:      d.coverImage       ?? "",
      bio:              d.bio              ?? "",
      role,
      xp:               d.xp               ?? 0,
      level:            Math.max(1, Math.floor((d.xp ?? 0) / 100) + 1),
      roms_count:       d.romsCount         ?? 0,
      followers_count:  d.subscribersCount  ?? 0,
      following_count:  d.followingCount    ?? 0,
      downloads_total:  d.totalDownloads    ?? 0,
      likes_received:   d.totalLikesReceived ?? 0,
      country:          d.country           ?? "",
      website:          d.website           ?? "",
      telegram:         d.telegram          ?? "",
      github:           d.github            ?? "",
      donation_links:   donationLinks,
      badges:           d.achievements      ?? [],
      is_suspended:     d.banned || d.suspended || false,
      created_at:       ts(d.createdAt),
      updated_at:       ts(d.updatedAt),
    };
  });

  const { count, errors } = await upsertBatch("users", rows);
  console.log(`   ✅ ${count} مستخدم مرحّل${errors ? ` | ⚠️ ${errors} فشلوا` : ""}`);

  // ترحيل الـ likes من likedRomIds
  console.log("\n❤️  ترحيل الإعجابات...");
  const likesRows = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    const uid = doc.id;
    if (Array.isArray(d.likedRomIds)) {
      for (const romId of d.likedRomIds) {
        likesRows.push({ user_id: uid, rom_id: romId });
      }
    }
  }

  if (likesRows.length === 0) {
    console.log("   لا توجد إعجابات");
    return;
  }

  const { count: lCount, errors: lErrors } = await upsertBatch("likes", likesRows);
  console.log(`   ✅ ${lCount} إعجاب مرحّل${lErrors ? ` | ⚠️ ${lErrors} فشلوا` : ""}`);
}

// ═══════════════════════════════════════════════════════════════
// MIGRATE COLLECTIONS
// ═══════════════════════════════════════════════════════════════
async function migrateCollections() {
  console.log("\n📁 ترحيل المجموعات...");

  const snap = await db.collection("collections").get();
  if (snap.empty) { console.log("   لا توجد مجموعات"); return; }

  const rows = snap.docs.map(doc => {
    const d = doc.data();
    return {
      id:          doc.id,
      owner_uid:   d.ownerUid    ?? "",
      name:        d.name         ?? "",
      description: d.description  ?? "",
      is_public:   d.isPublic     ?? true,
      rom_ids:     d.romIds        ?? [],
      rom_count:   d.romCount      ?? (d.romIds?.length ?? 0),
      created_at:  ts(d.createdAt),
      updated_at:  ts(d.updatedAt),
    };
  });

  const { count, errors } = await upsertBatch("collections", rows);
  console.log(`   ✅ ${count} مجموعة مرحّلة${errors ? ` | ⚠️ ${errors} فشلت` : ""}`);
}

// ═══════════════════════════════════════════════════════════════
// MIGRATE DEVICES
// ═══════════════════════════════════════════════════════════════
async function migrateDevices() {
  console.log("\n📱 ترحيل الأجهزة...");

  const snap = await db.collection("devices").get();
  if (snap.empty) { console.log("   لا توجد أجهزة"); return; }

  const rows = snap.docs.map(doc => {
    const d = doc.data();
    return {
      id:         doc.id,
      brand:      d.brand       ?? "",
      model:      d.model       ?? "",
      codename:   d.codename    ?? "",
      created_at: ts(d.createdAt),
    };
  });

  const { count, errors } = await upsertBatch("devices", rows);
  console.log(`   ✅ ${count} جهاز مرحّل${errors ? ` | ⚠️ ${errors} فشل` : ""}`);
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  RomX — أداة الترحيل Firestore → Supabase");
  console.log("═══════════════════════════════════════════════");

  if (DRY_RUN) console.log("⚠️  وضع المعاينة (DRY-RUN) — لن يُكتب شيء في Supabase\n");

  const start = Date.now();

  try {
    if (!ONLY || ONLY === "roms")        await migrateRoms();
    if (!ONLY || ONLY === "users")       await migrateUsers();
    if (!ONLY || ONLY === "collections") await migrateCollections();
    if (!ONLY || ONLY === "devices")     await migrateDevices();
  } catch (err) {
    console.error("\n❌  خطأ غير متوقع:", err.message);
    process.exit(1);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log("\n═══════════════════════════════════════════════");
  console.log(`  ✅  اكتمل الترحيل في ${elapsed}s`);
  if (DRY_RUN) console.log("  ⚠️  DRY-RUN — لم يُكتب أي شيء فعلياً");
  console.log("═══════════════════════════════════════════════\n");

  console.log("الخطوات التالية:");
  console.log("  1. افتح Supabase Dashboard وتحقق من البيانات");
  console.log("  2. شغّل npm run dev وتأكد أن الرومات تظهر");
  console.log("  3. تحقق من صفحة Admin لمشاهدة المستخدمين");
  console.log("  4. اختبر البحث (يشتغل عن طريق Supabase FTS)\n");

  process.exit(0);
}

main();
