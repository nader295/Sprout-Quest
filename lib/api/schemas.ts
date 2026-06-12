import { z } from "zod";

// ── URL Security Helper ────────────────────────────────────────────────────
// Blocklist approach بدل Allowlist — يسمح بأي hosting platform
// مع حجب SSRF vectors و short links و non-HTTPS
function isSafeDownloadUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    // HTTPS فقط
    if (protocol !== "https:") return false;
    // حجب private IPs و localhost — منع SSRF
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|::1)/i.test(hostname)) return false;
    // لازم يحتوي على نقطة (مش internal hostnames)
    if (!hostname.includes(".")) return false;
    // حجب short link services — مش واضح وين بتودّي
    const BLOCKED_SHORTENERS = ["bit.ly","tinyurl.com","t.co","goo.gl","ow.ly","short.link","rb.gy","cutt.ly","is.gd","v.gd","tiny.cc"];
    if (BLOCKED_SHORTENERS.some((d) => hostname === d || hostname.endsWith("." + d))) return false;
    return true;
  } catch {
    return false;
  }
}

// MD5: 32 hex chars — SHA256: 64 hex chars
const md5Regex    = /^[a-f0-9]{32}$/i;
const sha256Regex = /^[a-f0-9]{64}$/i;

export const romSchema = z.object({
  contentType: z.enum(["rom", "kernel", "recovery", "module", "gsi"]),
  name: z.string().min(2).max(120),
  brand: z.string().max(50).optional(),
  device: z.string().max(80).optional(),
  android: z.string().max(10).optional(),
  version: z.string().max(30).optional(),
  size: z.string().max(20).optional(),
  downloadUrl: z.string().refine((v) => v === "" || (z.string().url().safeParse(v).success && isSafeDownloadUrl(v)), {
    message: "الرابط يجب أن يكون HTTPS صحيح ولا يشير لـ IP داخلي أو رابط مختصر",
  }).optional(),
  mirrorUrl: z.string().refine((v) => !v || isSafeDownloadUrl(v), {
    message: "Mirror URL غير آمن",
  }).optional(),
  mirrors: z.array(
    z.string().refine((v) => !v || isSafeDownloadUrl(v), { message: "Mirror URL غير آمن" })
  ).max(3).optional(),
  variants: z.array(z.object({
    name: z.string().min(1).max(50),
    downloadUrl: z.string().url().refine(isSafeDownloadUrl, { message: "الرابط غير آمن" }),
    mirrors: z.array(z.string().refine((v) => !v || isSafeDownloadUrl(v))).max(3).optional(),
    size: z.string().max(20).optional(),
    checksumMd5: z.string().refine((v) => !v || md5Regex.test(v), { message: "MD5 غير صحيح" }).optional(),
  })).max(10).optional(),
  description: z.string().min(10).max(10_000).refine(v => v.trim().length >= 10, { message: "الوصف قصير جداً (10 حروف على الأقل)" }).optional(),
  changelog: z.string().max(10_000).optional(),
  thumbnail: z.string().url().or(z.literal("")).optional(),
  screenshots: z.array(z.string().url()).max(10).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  romStatus: z.enum(["active", "beta", "testing", "discontinued"]).optional(),
  romType: z.enum(["device", "gsi", "treble"]).optional(),
  installGuide: z.string().max(10_000).optional(),
  checksumMd5: z.string().refine((v) => !v || md5Regex.test(v), {
    message: "MD5 يجب أن يكون 32 حرف hex",
  }).optional(),
  checksumSha256: z.string().refine((v) => !v || sha256Regex.test(v), {
    message: "SHA256 يجب أن يكون 64 حرف hex",
  }).optional(),
  kernelVersion: z.string().max(50).optional(),
  // Recovery Type مطلوب للـ recovery — مش optional
  recoveryType: z.enum(["twrp", "orangefox", "pitchblack", "shrp"]).optional(),
  // Module ID مطلوب للـ module — مش optional
  moduleId: z.string().max(100).optional(),
  minMagisk: z.string().max(20).optional(), // Legacy: used for Magisk logic
  moduleManager: z.enum(["magisk", "ksu", "apatch", "any"]).optional(), // Modern standard
  compatibleDevices: z.array(z.string()).optional(),
  maintainerUid: z.string().optional(),
  maintainerName: z.string().optional(),
  maintainerPhoto: z.string().optional(),
});

export const commentSchema = z.object({
  romId: z.string().min(1),
  text: z.string().min(1).max(2000),
  parentId: z.string().optional(),
});

export const reportSchema = z.object({
  targetType: z.enum(["rom", "comment", "user"]),
  targetId: z.string().min(1),
  reason: z.enum(["spam", "harmful", "copy", "fake", "other"]),
  description: z.string().max(2000).optional(),
  details: z.string().max(2000).optional(),
  screenshotUrl: z.string().url().or(z.literal("")).optional(),
});

export const profileSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  bio: z.string().max(1000).optional(),
  username: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/).or(z.literal("")).optional(),
  github: z.string().max(100).optional(),
  telegram: z.string().max(100).optional(),
  xda: z.string().max(500).optional(),
  twitter: z.string().max(100).optional(),
  website: z.string().max(500).optional(),
  youtube: z.string().max(200).optional(),
  photo: z.string().url().or(z.literal("")).optional(),
  channelLinks: z.array(z.object({
    platform: z.enum(["youtube","telegram","github","xda","twitter","website","tiktok","instagram","linkedin","custom"]),
    url: z.string().max(500),
    label: z.string().max(60),
  })).max(5).optional(),
  profileLinks: z.array(z.object({
    id: z.string().max(20),
    platform: z.enum(["youtube","telegram","github","xda","twitter","website","tiktok","instagram","linkedin","custom"]),
    url: z.string().max(500),
    label: z.string().max(60),
    isChannel: z.boolean().optional(),
  })).max(20).optional(),
  donationLinks: z.array(z.object({
    platform: z.enum(["buymeacoffee","paypal","patreon","kofi","custom"]),
    url: z.string().max(500),
    label: z.string().max(60),
  })).max(5).optional(),
  donationEnabled: z.boolean().optional(),
  coverImage: z.string().url().or(z.literal("")).or(z.string().startsWith("__gradient__")).optional(),
  pinnedRomId: z.string().max(100).or(z.literal("")).optional(),
  hideDownloads: z.boolean().optional(),
  hideFollowers: z.boolean().optional(),
  incognitoMode: z.boolean().optional(),
  privateProfile: z.boolean().optional(),
  hideOwnerSupportButton: z.boolean().optional(),
  hideOwnerStudioButton: z.boolean().optional(),
  channelMode: z.boolean().optional(),
  showOnMap: z.boolean().optional(),
  country: z.string().max(10).optional(),
  countryName: z.string().max(100).optional(),
  // Linkvertise monetization
  linkvertiseGlobalEnabled: z.boolean().optional(),
  linkvertisePublisherId: z.string().max(50).optional(),
});

export type RomInput = z.infer<typeof romSchema>;
export type CommentInput = z.infer<typeof commentSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
