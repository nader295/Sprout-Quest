/**
 * setup-firestore.mjs
 * بيشتغل تلقائياً مع كل Vercel build (postbuild)
 * المهام:
 *   1. ينشئ settings/stats doc لو مش موجود
 *   2. يفعّل TTL policy على presence.expireAt
 */

// ── Helper: قراءة credentials ─────────────────────────────────────────────
function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    console.warn("[setup] FIREBASE_SERVICE_ACCOUNT_KEY غير موجود — skip");
    process.exit(0);
  }
  try { return JSON.parse(raw); }
  catch { console.error("[setup] FIREBASE_SERVICE_ACCOUNT_KEY مش JSON صحيح"); process.exit(1); }
}

// ── Helper: Google Access Token ───────────────────────────────────────────
async function getAccessToken(sa) {
  const header  = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const now     = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })).toString("base64url");

  const signingInput = `${header}.${payload}`;
  const keyData = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", Buffer.from(keyData, "base64"),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, Buffer.from(signingInput));
  const jwt = `${signingInput}.${Buffer.from(sig).toString("base64url")}`;

  const res  = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("فشل Token: " + JSON.stringify(data));
  return data.access_token;
}

// ── 1. أنشئ settings/stats لو مش موجود ──────────────────────────────────
async function ensureStatsDoc(token, projectId) {
  const base    = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const docUrl  = `${base}/settings/stats`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // تحقق هل الـ doc موجود
  const getRes = await fetch(docUrl, { headers });
  if (getRes.ok) {
    const doc = await getRes.json();
    const fields = doc.fields || {};
    // لو موجود وعنده totalRoms — مش محتاج نعمل حاجة
    if (fields.totalRoms) {
      console.log("[setup] settings/stats موجود بالفعل ✓");
      return;
    }
  }

  // احسب الأرقام الحقيقية من collections
  console.log("[setup] جاري حساب الأرقام من Firestore...");

  let totalRoms = 0, totalUsers = 0, totalDevs = 0;
  let totalKernels = 0, totalModules = 0, totalRecoveries = 0;

  // جلب الـ ROMs
  let romsNext = null;
  do {
    const url = romsNext || `${base}/roms?pageSize=300`;
    const res  = await fetch(url, { headers });
    if (!res.ok) break;
    const data = await res.json();
    for (const doc of data.documents || []) {
      totalRoms++;
      const ct = doc.fields?.contentType?.stringValue || "rom";
      if (ct === "kernel")   totalKernels++;
      else if (ct === "module")   totalModules++;
      else if (ct === "recovery") totalRecoveries++;
    }
    romsNext = data.nextPageToken ? `${base}/roms?pageSize=300&pageToken=${data.nextPageToken}` : null;
  } while (romsNext);

  // جلب الـ Users
  const devRoles = ["verifiedDev", "admin", "owner"];
  let usersNext = null;
  do {
    const url = usersNext || `${base}/users?pageSize=300`;
    const res  = await fetch(url, { headers });
    if (!res.ok) break;
    const data = await res.json();
    for (const doc of data.documents || []) {
      totalUsers++;
      const role = doc.fields?.role?.stringValue || "user";
      if (devRoles.includes(role)) { totalDevs++; totalUsers--; }
    }
    usersNext = data.nextPageToken ? `${base}/users?pageSize=300&pageToken=${data.nextPageToken}` : null;
  } while (usersNext);

  // اكتب الـ doc
  const body = {
    fields: {
      totalRoms:       { integerValue: String(totalRoms) },
      totalUsers:      { integerValue: String(totalUsers) },
      totalDevs:       { integerValue: String(totalDevs) },
      totalKernels:    { integerValue: String(totalKernels) },
      totalModules:    { integerValue: String(totalModules) },
      totalRecoveries: { integerValue: String(totalRecoveries) },
      onlineCount:     { integerValue: "0" },
    },
  };

  const patchRes = await fetch(`${docUrl}?updateMask.fieldPaths=totalRoms&updateMask.fieldPaths=totalUsers&updateMask.fieldPaths=totalDevs&updateMask.fieldPaths=totalKernels&updateMask.fieldPaths=totalModules&updateMask.fieldPaths=totalRecoveries&updateMask.fieldPaths=onlineCount`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });

  if (patchRes.ok) {
    console.log(`[setup] ✅ settings/stats تم إنشاؤه:`);
    console.log(`         ROMs: ${totalRoms} | Users: ${totalUsers} | Devs: ${totalDevs}`);
    console.log(`         Kernels: ${totalKernels} | Modules: ${totalModules} | Recoveries: ${totalRecoveries}`);
  } else {
    const err = await patchRes.text();
    console.error("[setup] ❌ فشل إنشاء settings/stats:", err.slice(0, 200));
  }
}

// ── 2. فعّل TTL Policy على presence.expireAt ──────────────────────────────
async function ensureTTLPolicy(token, projectId) {
  const base    = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // تحقق هل موجود بالفعل
  const listRes = await fetch(`${base}/collectionGroups/presence/fields`, { headers });
  if (listRes.ok) {
    const data = await listRes.json();
    const hasExpireAt = (data.fields || []).some(
      (f) => f.name?.endsWith("/expireAt") && f.ttlConfig?.state === "ACTIVE"
    );
    if (hasExpireAt) {
      console.log("[setup] TTL policy على presence.expireAt موجود بالفعل ✓");
      return;
    }
  }

  // أنشئ TTL policy
  const fieldUrl = `${base}/collectionGroups/presence/fields/expireAt`;
  const createRes = await fetch(fieldUrl, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ ttlConfig: {} }),
  });

  if (createRes.ok) {
    console.log("[setup] ✅ TTL policy على presence.expireAt تم تفعيله");
    console.log("         سيبدأ حذف docs القديمة خلال 24 ساعة تلقائياً");
  } else {
    const err = await createRes.text();
    console.warn("[setup] ⚠️  TTL error كامل:", err.slice(0, 400));
    console.warn("[setup] ⚠️  فعّله يدوياً: Firestore → TTL Policies → collection: presence → field: expireAt");
  }
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🔧 [setup] بدء إعداد Firestore...\n");

  const sa        = getServiceAccount();
  const projectId = sa.project_id;

  let token;
  try {
    token = await getAccessToken(sa);
  } catch (e) {
    console.error("[setup] فشل التوثيق:", e.message);
    process.exit(0); // مش هنوقف الـ build
  }

  await ensureStatsDoc(token, projectId);
  await ensureTTLPolicy(token, projectId);

  console.log("\n[setup] انتهى ✅\n");
}

main().catch((e) => {
  console.error("[setup] خطأ:", e.message);
  process.exit(0); // مش هنوقف الـ build أبداً
});
