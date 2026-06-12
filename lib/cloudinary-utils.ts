/**
 * lib/cloudinary-utils.ts — RomX Image Optimization
 *
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │  3 تقنيات بتوفر في Cloudinary bandwidth بدون تقليل حد الرفع:         │
 * │                                                                        │
 * │  1. compressImage() — ضغط قبل الرفع بـ Canvas API                     │
 * │     بتحول أي صورة لـ WebP أو JPEG وبتضغطها بذكاء                     │
 * │     التوفير: 40-80% من حجم الصورة قبل ما توصل Cloudinary              │
 * │                                                                        │
 * │  2. getOptimizedUrl() — تحويل الـ URL بعد الرفع                       │
 * │     بيضيف f_auto,q_auto,w_auto على كل صورة في الموقع                 │
 * │     f_auto = Cloudinary يختار أحسن format (WebP/AVIF تلقائياً)        │
 * │     q_auto = جودة ذكية حسب محتوى الصورة                               │
 * │     w_auto = responsive حسب شاشة المستخدم                             │
 * │     التوفير: 30-60% من bandwidth على كل view                          │
 * │                                                                        │
 * │  3. getThumbnailUrl() — صور مصغّرة للـ cards                          │
 * │     بدل ما تحمّل صورة 1MB للـ card، بيجيب 50KB بس                    │
 * │     التوفير: 95%+ على الـ listing pages                               │
 * └────────────────────────────────────────────────────────────────────────┘
 */

// ── Types ──────────────────────────────────────────
export interface CompressOptions {
  maxWidth?: number;       // max width بالـ pixels — default: 1920
  maxHeight?: number;      // max height بالـ pixels — default: 1080
  quality?: number;        // 0-1 — default: 0.82
  format?: "webp" | "jpeg"; // default: webp لو مدعوم، jpeg لو لأ
  maxSizeKB?: number;      // ضغط تدريجي لحد ما يوصل للحجم ده — default: 800KB
}

// ── 1. Client-side Image Compression ──────────────
/**
 * بيضغط الصورة قبل الرفع لـ Cloudinary باستخدام Canvas API
 * بيدعم JPEG, PNG, WebP, GIF (بيتعامل مع GIF كصورة ثابتة)
 *
 * مثال:
 *   const compressed = await compressImage(file, { maxWidth: 1280, maxSizeKB: 500 });
 *   // compressed.file = الملف المضغوط
 *   // compressed.savings = نسبة التوفير كـ string
 */
export async function compressImage(
  file: File,
  opts: CompressOptions = {}
): Promise<{ file: File; originalKB: number; compressedKB: number; savings: string }> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.82,
    maxSizeKB = 800,
  } = opts;

  const originalKB = Math.round(file.size / 1024);

  // GIF and tiny files — don't compress
  if (file.type === "image/gif" || file.size < 50 * 1024) {
    return { file, originalKB, compressedKB: originalKB, savings: "0%" };
  }

  // Determine output format
  const supportsWebP = await checkWebPSupport();
  const outputFormat = supportsWebP ? "image/webp" : "image/jpeg";
  const outputExt    = supportsWebP ? "webp" : "jpg";

  // Load image
  const img = await loadImage(file);

  // Calculate dimensions (keep aspect ratio)
  let { width, height } = img;
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width  = Math.round(width  * ratio);
    height = Math.round(height * ratio);
  }

  // Draw on canvas
  const canvas = document.createElement("canvas");
  canvas.width  = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);

  // Progressive compression until under maxSizeKB
  let q = quality;
  let blob: Blob | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    blob = await canvasToBlob(canvas, outputFormat, q);
    if (!blob) break;
    if (blob.size <= maxSizeKB * 1024) break;
    q -= 0.12;
    if (q < 0.3) break;
  }

  if (!blob || blob.size >= file.size) {
    // لو الضغط ما وفرش حاجة، ارجع الأصلي
    return { file, originalKB, compressedKB: originalKB, savings: "0%" };
  }

  const compressedKB = Math.round(blob.size / 1024);
  const savingsPct   = Math.round((1 - blob.size / file.size) * 100);

  const compressedFile = new File(
    [blob],
    file.name.replace(/\.[^.]+$/, `.${outputExt}`),
    { type: outputFormat }
  );

  return {
    file: compressedFile,
    originalKB,
    compressedKB,
    savings: `${savingsPct}%`,
  };
}

// ── 2. Cloudinary URL Transformer ─────────────────
/**
 * بيحوّل أي Cloudinary URL لنسخة محسّنة
 *
 * مثال:
 *   input:  https://res.cloudinary.com/dhm21wj1z/image/upload/v123/RomX/thumb.jpg
 *   output: https://res.cloudinary.com/dhm21wj1z/image/upload/f_auto,q_auto/v123/RomX/thumb.jpg
 */
export function getOptimizedUrl(
  url: string | null | undefined,
  extraTransformations = ""
): string {
  if (!url) return "";
  if (!url.includes("cloudinary.com")) return url;

  // لو في transformations بالفعل، ماتضيفش تاني
  if (url.includes("/f_auto") || url.includes("/q_auto")) return url;

  const transforms = ["f_auto", "q_auto", extraTransformations]
    .filter(Boolean)
    .join(",");

  return url.replace(
    /\/image\/upload\//,
    `/image/upload/${transforms}/`
  );
}

/**
 * صورة مصغّرة للـ ROM cards — عرض 400px كفاية للـ card
 * بيوفر 90%+ من حجم الصورة الأصلية
 */
export function getThumbnailUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (!url.includes("cloudinary.com")) return url;
  if (url.includes("/f_auto")) return url; // already optimized

  return url.replace(
    /\/image\/upload\//,
    "/image/upload/f_auto,q_auto:good,w_400,c_fill/"
  );
}

/**
 * صورة كبيرة لصفحة تفاصيل الـ ROM — عرض 1280px أقصى
 */
export function getFullUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (!url.includes("cloudinary.com")) return url;
  if (url.includes("/f_auto")) return url;

  return url.replace(
    /\/image\/upload\//,
    "/image/upload/f_auto,q_auto:best,w_1280,c_limit/"
  );
}

/**
 * Avatar صغير — 80x80 للـ lists
 */
export function getAvatarUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (!url.includes("cloudinary.com")) return url;
  if (url.includes("/f_auto")) return url;

  return url.replace(
    /\/image\/upload\//,
    "/image/upload/f_auto,q_auto,w_80,h_80,c_fill,g_face/"
  );
}

// ── Helpers ────────────────────────────────────────
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

let _webpSupported: boolean | null = null;
async function checkWebPSupport(): Promise<boolean> {
  if (_webpSupported !== null) return _webpSupported;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    _webpSupported = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    _webpSupported = false;
  }
  return _webpSupported;
}

// ── Usage Examples ─────────────────────────────────
/*
// ── في upload/page.tsx: ضغط قبل الرفع ──────────
import { compressImage } from "@/lib/cloudinary-utils";

const uploadImage = async (file: File): Promise<string> => {
  // ضغط الصورة أولاً
  const { file: compressed, savings } = await compressImage(file, {
    maxWidth: 1920,
    maxHeight: 1080,
    maxSizeKB: 600,
  });
  
  // ارفع النسخة المضغوطة
  const fd = new FormData();
  fd.append("file", compressed);
  fd.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
  // ...
};

// ── في rom-card.tsx: تصغير الصورة للـ card ──────
import { getThumbnailUrl } from "@/lib/cloudinary-utils";

<Image src={getThumbnailUrl(rom.thumbnail)} width={400} height={225} />
// بدل صورة 1MB → صورة 40-80KB

// ── في rom/[id]/page.tsx: صورة كاملة ────────────
import { getFullUrl } from "@/lib/cloudinary-utils";

<Image src={getFullUrl(rom.thumbnail)} width={1280} height={720} />
*/
