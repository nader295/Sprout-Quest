// lib/server/sync.ts — Firebase Auth only, Supabase for data
import { getAuth } from "firebase-admin/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { reportError } from "@/lib/server/safe";

// ── ensureUserExists: يُنشئ/يحدّث user في Supabase بعد أول login ────────
export async function ensureUserExists(uid: string, tokenData: {
  email?: string;
  name?: string;
  picture?: string;
}): Promise<void> {
  const sb = getSupabaseAdmin();

  const { data: existing } = await sb
    .from("users").select("id, name, photo").eq("id", uid).maybeSingle();

  if (existing) {
    // Update basic info if changed
    const updates: Record<string, string> = { updated_at: new Date().toISOString() };
    if (tokenData.name  && existing.name  !== tokenData.name)  updates.name  = tokenData.name;
    if (tokenData.picture && existing.photo !== tokenData.picture) updates.photo = tokenData.picture;
    if (Object.keys(updates).length > 1) {
      await sb.from("users").update(updates).eq("id", uid);
    }
    return;
  }

  // New user — create profile
  await sb.from("users").insert({
    id:         uid,
    name:       tokenData.name    ?? "",
    email:      tokenData.email   ?? null,
    photo:      tokenData.picture ?? "",
    role:       "user",
    xp:         0,
    level:      1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Increment platform stats
  await sb.rpc("increment_platform_stat", { p_key: "total_users", p_delta: 1 })
    .then(() => {}, () => {});
}

// ── syncProfile: تحديث profile (name, photo, bio, etc.) ────────────────
export async function syncProfile(uid: string, updates: Record<string, unknown>): Promise<void> {
  const sb = getSupabaseAdmin();

  const allowedFields = new Set([
    "name", "bio", "website", "telegram", "github",
    "country", "donation_links", "channel_link", "cover_photo",
  ]);

  const safeUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(updates)) {
    if (allowedFields.has(k)) safeUpdates[k] = v;
  }

  await sb.from("users").update(safeUpdates).eq("id", uid);
}

// ── syncUsername: تحديث username مع dedup check ─────────────────────────
export async function syncUsername(uid: string, username: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseAdmin();
  const lower = username.toLowerCase();

  // Check reserved
  const { data: reserved } = await sb
    .from("reserved_usernames").select("username").eq("username", lower).maybeSingle();
  if (reserved) return { ok: false, error: "username_reserved" };

  // Check taken (exclude self)
  const { data: taken } = await sb
    .from("users").select("id").eq("username_lower", lower).neq("id", uid).maybeSingle();
  if (taken) return { ok: false, error: "username_taken" };

  await sb.from("users").update({
    username, username_lower: lower, updated_at: new Date().toISOString(),
  }).eq("id", uid);

  return { ok: true };
}

// ── updatePhotoEverywhere: يحدّث الصورة في كل الأماكن ─────────────────
export async function updatePhotoEverywhere(uid: string, newPhoto: string): Promise<void> {
  const sb = getSupabaseAdmin();

  // Update users table
  await sb.from("users").update({ photo: newPhoto, updated_at: new Date().toISOString() }).eq("id", uid);

  // Update roms maintainer_photo
  await sb.from("roms").update({ maintainer_photo: newPhoto, updated_at: new Date().toISOString() })
    .eq("maintainer_uid", uid);

  // Update comments user_photo
  await sb.from("comments").update({ user_photo: newPhoto, updated_at: new Date().toISOString() })
    .eq("user_id", uid);
}

// ── deleteUser: حذف شامل ───────────────────────────────────────────────
export async function deleteUser(uid: string): Promise<void> {
  const sb = getSupabaseAdmin();

  try {
    // Firebase Auth deletion. If this silently fails (old behavior: `.catch(() => {})`),
    // the DB row gets deleted but the Auth record lingers — i.e. a zombie account that
    // can still log in. We now route failures through `reportError` so Sentry flags it
    // but deletion continues (UX must not block on this).
    await getAuth().deleteUser(uid).catch((err) => {
      reportError(err, "sync.deleteUser.firebase-auth", { uid });
    });

    // Avatar cleanup — orphaned files = storage billing + potential privacy leak.
    const { data: user } = await sb.from("users").select("photo").eq("id", uid).single();
    if (user?.photo?.includes("supabase.co/storage")) {
      const match = user.photo.match(/avatars\/(.+)$/);
      if (match) {
        await sb.storage.from("avatars").remove([match[1]]).catch((err) => {
          reportError(err, "sync.deleteUser.storage", { uid, file: match[1] });
        });
      }
    }

    // Cascade delete يتعامل مع معظم البيانات تلقائياً
    // لكن نحدّث الإحصاء يدوياً
    await sb.from("users").delete().eq("id", uid);
    await sb.rpc("increment_platform_stat", { p_key: "total_users", p_delta: -1 })
      .then(undefined, (err) => {
        reportError(err, "sync.deleteUser.stat-decrement", { uid });
      });
  } catch (err) {
    reportError(err, "sync.deleteUser", { uid });
    throw err;
  }
}

// ── incrementPlatformStat: helper ────────────────────────────────────────
export async function incrementPlatformStat(key: string, delta: number = 1): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb.rpc("increment_platform_stat", { p_key: key, p_delta: delta }).then(undefined, () => {});
}

// ── ensureUser: alias for ensureUserExists (used by ensure-user.ts) ───────
export const ensureUser = ensureUserExists;

// ── romCreated: increment stats when a ROM is published ──────────────────
export async function romCreated(contentType: string): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb.rpc("increment_platform_stat", { p_key: "total_roms", p_delta: 1 }).then(undefined, () => {});
  console.log("[sync] romCreated:", contentType);
}

// ── romDeleted: decrement stats when a ROM is deleted ─────────────────────
export async function romDeleted(contentType: string): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb.rpc("increment_platform_stat", { p_key: "total_roms", p_delta: -1 }).then(undefined, () => {});
  console.log("[sync] romDeleted:", contentType);
}

// ── romCleanup: remove storage files after ROM deletion ───────────────────
// Deletes orphaned media from BOTH Supabase Storage and Cloudinary.
// Safe to call with missing env vars — each backend fails gracefully.
export async function romCleanup(opts: {
  thumbnail?:   string;
  screenshots?: string[];
}): Promise<void> {
  const sb = getSupabaseAdmin();
  const supaDelete:   string[] = [];
  const cloudDelete:  string[] = [];

  const classify = (url?: string) => {
    if (!url) return;
    // Supabase Storage: extract <bucket>/<path>
    const supaMatch = url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
    if (supaMatch) { supaDelete.push(supaMatch[1]); return; }
    // Cloudinary: extract public_id (folder/name without extension)
    // Example: https://res.cloudinary.com/<cloud>/image/upload/v123/RomX/thumb_abc.jpg
    // → public_id: RomX/thumb_abc
    const cloudMatch = url.match(/res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:[^/]+\/)*v\d+\/(.+?)(?:\.[a-zA-Z0-9]+)?$/);
    if (cloudMatch) { cloudDelete.push(cloudMatch[1]); return; }
  };

  classify(opts.thumbnail);
  (opts.screenshots ?? []).forEach(classify);

  // ── 1. Supabase Storage ──────────────────────────────
  if (supaDelete.length > 0) {
    await sb.storage.from("roms").remove(supaDelete).then(undefined, (err) => {
      console.warn("[romCleanup] supabase remove failed:", err?.message);
    });
  }

  // ── 2. Cloudinary (skip silently if API key absent) ──────────────────
  if (cloudDelete.length > 0) {
    const cloud  = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;

    if (cloud && apiKey && secret) {
      await Promise.all(
        cloudDelete.map(async (publicId) => {
          try {
            // Cloudinary destroy API with HMAC-SHA1 signature
            const timestamp = Math.floor(Date.now() / 1000);
            const toSign    = `public_id=${publicId}&timestamp=${timestamp}${secret}`;
            const crypto    = await import("node:crypto");
            const signature = crypto.createHash("sha1").update(toSign).digest("hex");

            const fd = new FormData();
            fd.append("public_id", publicId);
            fd.append("timestamp", String(timestamp));
            fd.append("api_key",   apiKey);
            fd.append("signature", signature);

            const res = await fetch(
              `https://api.cloudinary.com/v1_1/${cloud}/image/destroy`,
              { method: "POST", body: fd }
            );
            if (!res.ok) {
              console.warn("[romCleanup] cloudinary destroy failed:", publicId, res.status);
            }
          } catch (err) {
            console.warn("[romCleanup] cloudinary destroy error:", publicId, (err as Error).message);
          }
        })
      );
    } else {
      // Env not configured — log for manual cleanup tracking
      console.warn(
        `[romCleanup] Cloudinary env missing, ${cloudDelete.length} asset(s) orphaned:`,
        cloudDelete.slice(0, 3).join(", ") + (cloudDelete.length > 3 ? ", ..." : "")
      );
    }
  }
}
