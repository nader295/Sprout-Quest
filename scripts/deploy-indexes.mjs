/**
 * deploy-indexes.mjs
 * بيشتغل تلقائياً مع كل Vercel build (postbuild)
 * بيعمل deploy للـ Firestore indexes عن طريق Google REST API
 * مش محتاج Firebase CLI
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 1. جلب الـ credentials ──────────────────────────────────────────────────
function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    console.warn("[indexes] FIREBASE_SERVICE_ACCOUNT_KEY غير موجود — skip");
    process.exit(0);
  }
  try {
    return JSON.parse(raw);
  } catch {
    console.error("[indexes] FIREBASE_SERVICE_ACCOUNT_KEY مش JSON صحيح");
    process.exit(1);
  }
}

// ── 2. عمل JWT للـ Google API ───────────────────────────────────────────────
async function getAccessToken(sa) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })).toString("base64url");

  const signingInput = `${header}.${payload}`;

  // استخدام Web Crypto API (موجودة في Node 18+)
  const privateKey = sa.private_key;
  const keyData = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const binaryKey = Buffer.from(keyData, "base64");
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    Buffer.from(signingInput)
  );

  const jwt = `${signingInput}.${Buffer.from(signature).toString("base64url")}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error("فشل الحصول على access token: " + JSON.stringify(data));
  return data.access_token;
}

// ── 3. قراءة الـ indexes من الملف ──────────────────────────────────────────
function loadIndexes() {
  const path = resolve(__dirname, "../firestore.indexes.json");
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return raw.indexes || [];
}

// ── 4. تحويل index لـ format الـ REST API ──────────────────────────────────
function toApiFormat(index) {
  return {
    queryScope: index.queryScope || "COLLECTION",
    fields: index.fields.map((f) => ({
      fieldPath: f.fieldPath,
      ...(f.order ? { order: f.order } : {}),
      ...(f.arrayConfig ? { arrayConfig: f.arrayConfig } : {}),
    })),
  };
}

// ── 5. جلب الـ indexes الموجودة ─────────────────────────────────────────────
async function listExistingIndexes(token, projectId, collectionId) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/collectionGroups/${collectionId}/indexes`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const data = await res.json();
  return data.indexes || [];
}

// ── 6. إنشاء index واحد ────────────────────────────────────────────────────
async function createIndex(token, projectId, collectionId, index) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/collectionGroups/${collectionId}/indexes`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(toApiFormat(index)),
  });

  if (res.status === 409) return "exists"; // موجود بالفعل
  if (!res.ok) {
    const err = await res.text();
    if (err.includes("already exists")) return "exists";
    // طبع أول خطأ كامل للتشخيص
    if (!global._firstIndexError) {
      global._firstIndexError = true;
      console.error("\n[indexes] ❌ أول خطأ كامل:", err.slice(0, 500));
    }
    return `error: ${err.slice(0, 100)}`;
  }
  return "created";
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🔥 [indexes] بدء deploy الـ Firestore indexes...\n");

  const sa = getServiceAccount();
  const projectId = sa.project_id;

  let token;
  try {
    token = await getAccessToken(sa);
  } catch (e) {
    console.error("[indexes] فشل التوثيق:", e.message);
    process.exit(0); // مش هنوقف الـ build بسببه
  }

  const indexes = loadIndexes();
  console.log(`[indexes] ${indexes.length} index هيتم معالجتهم\n`);

  // تجميع الـ indexes حسب collection
  const byCollection = {};
  for (const idx of indexes) {
    const col = idx.collectionGroup;
    if (!byCollection[col]) byCollection[col] = [];
    byCollection[col].push(idx);
  }

  let created = 0, exists = 0, errors = 0;

  for (const [collectionId, colIndexes] of Object.entries(byCollection)) {
    for (const index of colIndexes) {
      const result = await createIndex(token, projectId, collectionId, index);
      if (result === "created") { created++; process.stdout.write("✅"); }
      else if (result === "exists") { exists++; process.stdout.write("·"); }
      else { errors++; process.stdout.write("❌"); }
    }
  }

  console.log(`\n\n[indexes] انتهى:`);
  console.log(`  ✅ تم إنشاء: ${created}`);
  console.log(`  · موجود بالفعل: ${exists}`);
  console.log(`  ❌ أخطاء: ${errors}`);
  console.log("\nالـ indexes هتبقى جاهزة خلال 5-15 دقيقة على Firebase.\n");
}

main().catch((e) => {
  console.error("[indexes] خطأ غير متوقع:", e.message);
  process.exit(0); // مش هنوقف الـ build
});
