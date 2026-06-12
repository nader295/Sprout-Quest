/**
 * lib/supabase/storage.ts — Supabase Storage للصور الشخصية
 *
 * التوزيع المتفق عليه:
 *   Cloudinary  → صور الرومات والكيرنلات والـ Thumbnails (عامة، كثيرة التحميل)
 *   Supabase    → صور البروفايل وصور الغلاف الشخصية (خاصة بمستخدم واحد)
 *
 * Buckets مطلوبة في Supabase:
 *   - avatars (public)
 *   - covers  (public)
 */

import { getSupabaseAdmin } from "./admin";
import { logger } from "@/lib/logger";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

// ── Helpers ──────────────────────────────────────────────────

/** رابط عام مباشر للصورة من Supabase Storage */
export function supabasePublicUrl(bucket: string, path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

/** تحويل حجم الملف لنص مقروء */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Avatar Upload ─────────────────────────────────────────────

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES   = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export interface StorageUploadResult {
  url:   string;
  path:  string;
  error?: string;
}

/**
 * رفع صورة البروفايل لـ Supabase Storage
 * @param userId  Firebase UID
 * @param file    الصورة المرفوعة
 */
export async function uploadAvatar(
  userId: string,
  file: File | Buffer,
  contentType = "image/jpeg"
): Promise<StorageUploadResult> {
  const sb = getSupabaseAdmin();

  // التحقق من النوع والحجم (للـ File فقط)
  if (file instanceof File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { url: "", path: "", error: "نوع الصورة غير مدعوم. استخدم JPEG أو PNG أو WebP" };
    }
    if (file.size > MAX_AVATAR_SIZE) {
      return { url: "", path: "", error: `حجم الصورة كبير جداً (${formatBytes(file.size)}). الحد الأقصى 2 MB` };
    }
    contentType = file.type;
  }

  const ext  = contentType.split("/")[1] || "jpg";
  const path = `${userId}/avatar.${ext}`;

  const { error } = await sb.storage
    .from("avatars")
    .upload(path, file, {
      contentType,
      upsert: true,       // تحديث بدل رفع جديد
      cacheControl: "3600",
    });

  if (error) {
    return { url: "", path: "", error: (error as Error).message };
  }

  const url = supabasePublicUrl("avatars", path);
  return { url, path };
}

/**
 * رفع صورة الغلاف الشخصية لـ Supabase Storage
 * @param userId  Firebase UID
 * @param file    صورة الغلاف
 */
const MAX_COVER_SIZE = 5 * 1024 * 1024; // 5 MB

export async function uploadCover(
  userId: string,
  file: File | Buffer,
  contentType = "image/jpeg"
): Promise<StorageUploadResult> {
  const sb = getSupabaseAdmin();

  if (file instanceof File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { url: "", path: "", error: "نوع الصورة غير مدعوم" };
    }
    if (file.size > MAX_COVER_SIZE) {
      return { url: "", path: "", error: `الحجم كبير جداً (${formatBytes(file.size)}). الحد الأقصى 5 MB` };
    }
    contentType = file.type;
  }

  const ext  = contentType.split("/")[1] || "jpg";
  const path = `${userId}/cover.${ext}`;

  const { error } = await sb.storage
    .from("covers")
    .upload(path, file, {
      contentType,
      upsert: true,
      cacheControl: "3600",
    });

  if (error) {
    return { url: "", path: "", error: (error as Error).message };
  }

  const url = supabasePublicUrl("covers", path);
  return { url, path };
}

/**
 * حذف صورة البروفايل القديمة
 */
export async function deleteAvatar(userId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  for (const ext of ["jpg", "jpeg", "png", "webp", "gif"]) {
    // Orphaned avatars = silent storage cost + potential privacy leak when
    // a user deletes their account but old images linger. Forward to Sentry.
    await sb.storage.from("avatars").remove([`${userId}/avatar.${ext}`])
      .catch((err) => logger.error("storage.deleteAvatar", err, { userId, ext }));
  }
}

/**
 * حذف صورة الغلاف القديمة
 */
export async function deleteCover(userId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  for (const ext of ["jpg", "jpeg", "png", "webp", "gif"]) {
    await sb.storage.from("covers").remove([`${userId}/cover.${ext}`])
      .catch((err) => logger.error("storage.deleteCover", err, { userId, ext }));
  }
}

/**
 * استخراج userId من Supabase Storage URL
 */
export function extractUserIdFromStorageUrl(url: string): string | null {
  const match = url.match(/\/(?:avatars|covers)\/([^/]+)\//);
  return match?.[1] || null;
}

/**
 * هل الرابط من Supabase Storage؟
 */
export function isSupabaseStorageUrl(url: string): boolean {
  return url.includes("supabase.co/storage") || url.includes(SUPABASE_URL + "/storage");
}
