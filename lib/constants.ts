import type { AccentColor, ThemeConfig, Achievement, XPLevel } from "./types";

// ── Roles ─────────────────────────────────────────────
export const ROLES: Record<string, number> = {
  owner: 5,
  admin: 4,
  moderator: 3,
  verifiedDev: 2,
  user: 1,
};
export const roleLevel = (r: string) => ROLES[r] || 1;

// ── Theme Colors ──────────────────────────────────────
export const RX_THEMES: Record<AccentColor, ThemeConfig> = {
  blue:   { name: "Blue",   hex: "#1d9bf0", dim: "rgba(29,155,240,0.12)",  glow: "rgba(29,155,240,0.28)" },
  green:  { name: "Green",  hex: "#10b981", dim: "rgba(16,185,129,0.12)",  glow: "rgba(16,185,129,0.28)" },
  orange: { name: "Orange", hex: "#f97316", dim: "rgba(249,115,22,0.12)",  glow: "rgba(249,115,22,0.28)" },
  rose:   { name: "Rose",   hex: "#f43f5e", dim: "rgba(244,63,94,0.12)",   glow: "rgba(244,63,94,0.28)" },
  gold:   { name: "Gold",   hex: "#f59e0b", dim: "rgba(245,158,11,0.12)",  glow: "rgba(245,158,11,0.28)" },
  cyan:   { name: "Cyan",   hex: "#06b6d4", dim: "rgba(6,182,212,0.12)",   glow: "rgba(6,182,212,0.28)" },
};

// ── Content Type Labels ───────────────────────────────
export const CONTENT_TYPES = [
  { value: "rom",      label: "ROMs",       icon: "Smartphone" },
  { value: "kernel",   label: "Kernels",    icon: "Cpu" },
  { value: "recovery", label: "Recoveries", icon: "HardDrive" },
  { value: "module",   label: "Modules",    icon: "Puzzle" },
  { value: "gsi",      label: "GSI",        icon: "Globe" },
] as const;

// ── Brands ────────────────────────────────────────────
// Brands موحّدة في الموقع كله (upload + search + filters)
// Xiaomi = يشمل Poco + Redmi + iQOO تحت Xiaomi
// ZTE = يشمل Nubia + Red Magic
export const BRANDS = [
  "Samsung", "Xiaomi", "Google", "OnePlus", "Nothing",
  "Realme", "Motorola", "ASUS", "Vivo", "OPPO",
  "Sony", "Huawei", "Honor", "ZTE", "Nokia", "Lenovo",
  "Infinix", "Tecno", "Itel", "Meizu", "Micromax", "Fairphone",
];

// خريطة العلامات التجارية الفرعية → الرئيسية
export const BRAND_ALIAS: Record<string, string> = {
  "Poco":  "Xiaomi",
  "Redmi": "Xiaomi",
  "iQOO":  "Vivo",
  "Nubia": "ZTE",
  "Red Magic": "ZTE",
};

// ── Android Versions ──────────────────────────────────
export const ANDROID_VERSIONS = ["16", "15", "14", "13", "12", "11", "10", "9", "8"];

// ── ROM Statuses ──────────────────────────────────────
export const ROM_STATUSES = [
  { value: "active",       label: "Active" },
  { value: "beta",         label: "Beta" },
  { value: "testing",      label: "Testing" },
  { value: "discontinued", label: "Discontinued" },
];

// ── Report Reasons ────────────────────────────────────
export const REPORT_REASONS = [
  { value: "spam",     label: "Spam or Fake" },
  { value: "harmful",  label: "Harmful or Abusive" },
  { value: "copy",     label: "Copyright Violation" },
  { value: "fake",     label: "Fake or Dangerous ROM" },
  { value: "other",    label: "Other" },
];

// ── Achievements ──────────────────────────────────────
export const ACHIEVEMENTS: Record<string, Achievement> = {
  first_rom:     { id: "first_rom",     icon: "Rocket",    label: "First Launch",    desc: "Published first ROM",       xp: 50 },
  rom_5:         { id: "rom_5",         icon: "Package",   label: "ROM Pack",        desc: "5 ROMs published",          xp: 100 },
  rom_20:        { id: "rom_20",        icon: "Factory",   label: "ROM Factory",     desc: "20 ROMs published",         xp: 300 },
  likes_10:      { id: "likes_10",      icon: "Heart",     label: "Liked",           desc: "10 likes received",         xp: 30 },
  likes_100:     { id: "likes_100",     icon: "HeartPulse",label: "Popular",         desc: "100 likes received",        xp: 100 },
  likes_1000:    { id: "likes_1000",    icon: "Gem",       label: "Legendary",       desc: "1000 likes received",       xp: 500 },
  dl_100:        { id: "dl_100",        icon: "Download",  label: "Hit Release",     desc: "100 downloads",             xp: 75 },
  dl_1000:       { id: "dl_1000",       icon: "Satellite",  label: "Top Release",     desc: "1000 downloads",            xp: 300 },
  followers_10:  { id: "followers_10",  icon: "Users",     label: "Rising Dev",      desc: "10 followers",              xp: 50 },
  followers_100: { id: "followers_100", icon: "Star",      label: "Star Dev",        desc: "100 followers",             xp: 200 },
  early_adopter: { id: "early_adopter", icon: "Sprout",    label: "Early Adopter",   desc: "Joined in the first wave",  xp: 100 },
  verified_dev:  { id: "verified_dev",  icon: "BadgeCheck",label: "Verified Dev",    desc: "Verified developer",        xp: 150 },
  rated_10:      { id: "rated_10",      icon: "Star",      label: "Critic",          desc: "Rated 10 ROMs",             xp: 25 },
  commenter_10:  { id: "commenter_10",  icon: "MessageSquare", label: "Commentator", desc: "Posted 10 comments",        xp: 20 },
};

// ── Reputation Levels ─────────────────────────────────
export const XP_LEVELS: XPLevel[] = [
  { level: 1,  xp: 0,      label: "Member" },
  { level: 3,  xp: 150,    label: "Publisher" },
  { level: 7,  xp: 600,    label: "Developer" },
  { level: 10, xp: 1800,   label: "Top Developer" },
  { level: 15, xp: 4000,   label: "Pro Developer" },
  { level: 20, xp: 9000,   label: "Expert Developer" },
  { level: 30, xp: 25000,  label: "Legendary Developer" },
];

// ── XP Reward Values ──────────────────────────────────
// Everyone can upload from day 1. Levels unlock extra features.
export const XP_REWARDS = {
  ROM_PUBLISH: 30,          // publishing content
  VERSION_UPDATE: 10,       // keeping content fresh
  LIKE_RECEIVED: 3,         // community appreciation
  DOWNLOADS_PER_10: 2,      // per 10 downloads
  VIEWS_PER_100: 1,         // per 100 unique views
  NEW_FOLLOWER: 5,          // someone chose to follow you
  MILESTONE_100_DL: 20,     // first major milestone
  MILESTONE_500_DL: 50,     // growing audience
  FALSE_REPORT_PENALTY: -10,
} as const;

// ── Ad Support / Monetization (Primo v5) ──────────────────
export const AD_SUPPORT = {
  ENABLED: true,                          // master switch for ad support feature
  // Revenue split (80% developer / 20% platform)
  DEV_SHARE: 0.80,
  PLATFORM_SHARE: 0.20,
  // Geo-based CPM tiers (USD per 1000 views) — for estimation display only
  CPM_BY_TIER: {
    tier1: 4.00,   // US, UK, CA, AU, DE, JP, etc.
    tier2: 1.00,   // EG, IN, BR, TR, SA, etc.
    tier3: 0.30,   // Rest of world
  },
  ESTIMATED_CPM: 1.00,                    // fallback estimated CPM for display
  MIN_CPM: 0.20,                          // minimum CPM floor
  // Anti-fraud
  COOLDOWN_MS: 15 * 60 * 1000,            // 15min cooldown per user per post
  MAX_DAILY_GLOBAL: 20,                   // max ad views per user per day
  MAX_DAILY_PER_POST: 5,                  // per user per post (or profile) per day
  MIN_WATCH_SECONDS: 15,                  // minimum watch time to count
  IP_DAILY_LIMIT: 50,                     // per IP per day
  SELF_SUPPORT_BLOCKED: false,            // Allow self-support for ad testing
  // Gamification
  POINTS_PER_WATCH: 5,                    // viewer gets points per watch
  POINTS_UNLOCK_THRESHOLD: 50,            // unlock bonus at 50 points
  // Batch
  BATCH_INTERVAL_MS: 60 * 60 * 1000,      // batch earnings every hour
} as const;

// ── Payout System Configuration ───────────────────────────
export const PAYOUT_CONFIG = {
  MIN_PAYOUT_USD: 20,                      // minimum withdrawal amount
  MAX_DAILY_REQUESTS: 3,                   // rate limit payout requests per user per day
  EXPIRY_DAYS: 180,                        // unclaimed balance expires after 6 months of inactivity
  STALE_PROCESSING_MS: 24 * 60 * 60 * 1000, // flag payouts stuck in "processing" > 24h
  // Trust levels for auto-approve
  TRUST_THRESHOLDS: {
    trusted: { minPaidPayouts: 3, minAccountDays: 60, maxAutoApprove: 50 },
    vip:     { minPaidPayouts: 10, minAccountDays: 180, maxAutoApprove: 200 },
  },
  // Payment methods available (crypto-focused for Egypt/MENA)
  PAYMENT_METHODS: [
    { id: "binance_pay",  label: "Binance Pay",    icon: "Wallet",   fee: 0 },
    { id: "usdt_trc20",   label: "USDT (TRC-20)",  icon: "Coins",    fee: 1.0 },
    { id: "usdt_bep20",   label: "USDT (BEP-20)",  icon: "Coins",    fee: 0.5 },
    { id: "paypal",       label: "PayPal",          icon: "CreditCard", fee: 0 },
    { id: "vodafone_cash",label: "Vodafone Cash",   icon: "Phone",    fee: 0 },
  ],
  // Wallet validation regex per method
  WALLET_VALIDATORS: {
    binance_pay:   /^\d{6,12}$/,
    usdt_trc20:    /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
    usdt_bep20:    /^0x[a-fA-F0-9]{40}$/,
    paypal:        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    vodafone_cash: /^01[0-2,5]\d{8}$/,
  } as Record<string, RegExp>,
} as const;

// ── Auto-Moderation Thresholds ────────────────────────
export const MODERATION = {
  // Reports needed to trigger action
  REPORTS_TO_HIDE_CONTENT: 3,
  REPORTS_TO_SUSPEND_24H: 5,
  REPORTS_TO_SUSPEND_7D: 10,
  // Suspension durations (milliseconds)
  SUSPENSION_24H_MS: 24 * 60 * 60 * 1000,
  SUSPENSION_7D_MS: 7 * 24 * 60 * 60 * 1000,
  // Reporter credibility requirements
  MIN_ACCOUNT_AGE_DAYS: 7,
  MIN_XP_TO_REPORT: 100,
  // False reporter penalties
  FALSE_REPORTS_TO_BAN: 3,
  REPORT_BAN_DURATION_MS: 7 * 24 * 60 * 60 * 1000,
} as const;

// ── Level Unlocks ─────────────────────────────────────
export const LEVEL_UNLOCKS = {
  // Level 3 — Publisher (150 XP): social profile links management
  SOCIAL_LINKS:       3,   // Custom social links on profile
  PINNED_ROM:         3,   // Pinned ROM on profile

  // Level 7 — Developer (600 XP): channel tools & monetization
  CHANNEL_MODE:       7,   // Channel links appear on every release
  DONATION_LINKS:     7,   // Donation buttons on profile
  COVER_IMAGE:        7,   // Profile cover image
  ANALYTICS:          7,   // Full analytics dashboard
  AD_SUPPORT:         7,   // Monetization via ad support button

  // Level 10 — Top Developer (1800 XP): visibility boosts
  PRIORITY_LISTING:   10,  // Boosted in explore/search
  CUSTOM_STATUS:      10,  // Custom status text on profile

  // Level 15 — Pro Developer (4000 XP): advanced features
  INCOGNITO_BROWSE:   15,  // Browse incognito mode
  BETA_FEATURES:      15,  // Early access to beta features

  // Level 20 — Expert (9000 XP): distinction
  DISTINCTION_BADGE:  20,  // Special animated distinction badge

  // Level 30 — Legendary (25000 XP): hall of fame
  FEATURED_DEVS:      30,  // Listed in Featured Developers section
} as const;

// Alias for backward compatibility
export const LEVEL_GATES = LEVEL_UNLOCKS;

export function getLevel(xp: number = 0) {
  let lvl = XP_LEVELS[0];
  for (const l of XP_LEVELS) {
    if (xp >= l.xp) lvl = l;
    else break;
  }
  return lvl;
}

export function getNextLevel(xp: number = 0) {
  for (const l of XP_LEVELS) {
    if (xp < l.xp) return l;
  }
  return null;
}

// ── Popular Devices ───────────────────────────────────
export const POPULAR_DEVICES = [
  // Xiaomi / POCO / Redmi
  "Poco X7 Pro", "Poco X7", "Poco X6 Pro", "Poco X6", "Poco X5 Pro",
  "Poco F6 Pro", "Poco F6", "Poco F5 Pro", "Poco F5",
  "Poco M6 Pro",
  "Redmi Note 14 Pro+", "Redmi Note 14 Pro", "Redmi Note 14",
  "Redmi Note 13 Pro+", "Redmi Note 13 Pro", "Redmi Note 13",
  "Xiaomi 15", "Xiaomi 14 Pro", "Xiaomi 14", "Xiaomi 14T Pro", "Xiaomi 14T",
  // Samsung
  "Samsung Galaxy S25 Ultra", "Samsung Galaxy S25+", "Samsung Galaxy S25",
  "Samsung Galaxy S24 Ultra", "Samsung Galaxy S24", "Samsung Galaxy S23 Ultra",
  "Samsung Galaxy Z Fold 6", "Samsung Galaxy Z Flip 6",
  "Samsung Galaxy A55", "Samsung Galaxy A35", "Samsung Galaxy A16",
  // OnePlus
  "OnePlus 15", "OnePlus 13", "OnePlus 13R", "OnePlus 12", "OnePlus 12R", "OnePlus 11",
  "OnePlus Open", "OnePlus Open 2",
  "OnePlus Nord 4", "OnePlus Nord CE4", "OnePlus Nord CE4 Lite", "OnePlus Nord CE3",
  // Google
  "Google Pixel 9 Pro XL", "Google Pixel 9 Pro", "Google Pixel 9",
  "Google Pixel 8 Pro", "Google Pixel 8", "Google Pixel 8a",
  "Google Pixel 7 Pro", "Google Pixel 7", "Google Pixel 7a",
  // Nothing
  "Nothing Phone (2a) Plus", "Nothing Phone (2a)", "Nothing Phone (2)",
  // Realme
  "Realme GT 7 Pro", "Realme GT 6", "Realme 13 Pro+", "Realme 13 Pro",
  // Motorola
  "Motorola Edge 50 Ultra", "Motorola Edge 50 Pro", "Motorola Edge 50 Fusion",
  // ASUS
  "ASUS Zenfone 11 Ultra", "ASUS ROG Phone 8 Pro",
];

// ── Device Database (client-safe) ─────────────────────────────────────────
// المصدر الحقيقي مع الـ aliases هو lib/server/device-normalize.ts (server-only)
export interface DeviceInfo {
  codename: string;
  name: string;
  brand: string;
  chipset: string;
  released: string;
}

export const DEVICE_DATABASE: DeviceInfo[] = [];

// ── Default Values ────────────────────────────────────
export const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/initials/svg?seed=R&backgroundColor=1d9bf0&textColor=ffffff&fontWeight=700";
export function getDefaultAvatar(name?: string | null): string {
  const n = (name || "R").trim();
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(n)}&backgroundColor=1d9bf0&textColor=ffffff&fontWeight=700`;
}

// ADMIN_EMAIL يُقرأ من server-only env var (بدون NEXT_PUBLIC).
// لا يُضاف لأي client bundle — يُستخدم فقط في server-side routes.
// إن لم يُضبط، فلن يمنح أي مستخدم صلاحية owner تلقائياً (آمن افتراضياً).
// لا تضع fallback hardcoded هنا — هذا يعطي مهاجم فرصة انتحال owner في أي fork.
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();

// Cloudinary config — cloudName آمن للـ client، uploadPreset من env var
// ⚠️ يجب استخدام process.env.VAR_NAME مباشرةً (static) — Next.js لا يدعم process.env[name] (dynamic)
export const CLOUDINARY_CONFIG = {
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "",
  uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "",
  folder: "romx",
  maxSizeMB: 5,
};




// ── Languages ─────────────────────────────────────────
export const AVAILABLE_LANGS = [
  { code: "ar", label: "العربية",   dir: "rtl" },
  { code: "en", label: "English",   dir: "ltr" },
  { code: "ru", label: "Русский",   dir: "ltr" },
  { code: "id", label: "Indonesia", dir: "ltr" },
  { code: "es", label: "Español",   dir: "ltr" },
  { code: "tr", label: "Turkce",    dir: "ltr" },
  { code: "fr", label: "Francais",  dir: "ltr" },
  { code: "de", label: "Deutsch",   dir: "ltr" },
  { code: "pt", label: "Portugues", dir: "ltr" },
  { code: "hi", label: "Hindi",     dir: "ltr" },
  { code: "zh", label: "Chinese",   dir: "ltr" },
  { code: "pl", label: "Polski",    dir: "ltr" },
] as const;
