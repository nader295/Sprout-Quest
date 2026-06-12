// Timestamp can be a Firestore Timestamp object, an ISO string from the API, or null
export type FireTimestamp =
  | { seconds: number; _seconds?: number; nanoseconds: number; toMillis?: () => number; toDate?: () => Date }
  | string
  | null;

// ── Content Types ─────────────────────────────────────
export type ContentType = "rom" | "kernel" | "recovery" | "module" | "gsi";

export interface Collaborator {
  uid: string;
  name: string;
  photo?: string;
  username?: string;
  role: "editor" | "maintainer";
  addedAt: string;
}

export interface RomVariant {
  name: string;
  downloadUrl: string;
  size?: string;
  mirrors?: string[];
  checksumMd5?: string;
}

export interface RomItem {
  id: string;
  contentType: ContentType;
  name: string;
  brand?: string;
  device?: string;
  android: string;
  version: string;
  description: string;
  changelog: string;
  thumbnail: string;
  screenshots: string[];
  downloadUrl: string;
  mirrorUrl: string;
  size: string;
  maintainerUid: string;
  maintainerName: string;
  maintainerPhoto: string;
  // Stats
  likesCount: number;
  downloads: number;
  total_views: number;
  commentsCount: number;
  ratingAvg: number;
  ratingCount: number;
  ratingSum: number;
  trendScore: number;
  healthScore?: number;    // 0-100 composite score
  supportCount?: number;   // عدد مرات دعم المستخدمين للمطور من خلال هذا الـ ROM
  linkvertiseEnabled?: boolean; // هل المطور فعّل إعلان Linkvertise على هذا التحميل
  deviceCodename?: string; // codename طبيعي للجهاز (e.g. "shiva")
  versionCount?: number;
  // Metadata
  tags: string[];
  romStatus: "active" | "beta" | "testing" | "discontinued";
  romType: "device" | "gsi" | "treble";
  featured: boolean;
  compatibleDevices: string[];
  installGuide: string;
  checksumMd5: string;
  checksumSha256: string;
  mirrors: string[];
  variants?: RomVariant[];
  // Kernel-specific
  kernelVersion?: string;
  kernelType?: "" | "device" | "anykernel3";
  anyKernelTargets?: string;
  supportedRoms?: string[];
  // Recovery-specific
  recoveryType?: "twrp" | "orangefox" | "pitchblack" | "shrp" | "sky" | "other" | "";
  // Module-specific
  moduleId?: string;
  minMagisk?: string;
  moduleManager?: "magisk" | "ksu" | "apatch" | "any";
  moduleScope?: "universal" | "android" | "device" | "soc";
  moduleManagers?: string[];
  socFamily?: string;
  // GSI-specific
  trebleType?: "" | "a-only" | "ab" | "both";
  gsiArch?: "" | "arm64" | "arm32" | "arm64+arm32" | "x86" | "x86_64";
  gsiType?: "" | "vndklite" | "full" | "go";
  // Extended fields
  telegramUrl?: string;
  xdaUrl?: string;
  sourceUrl?: string;
  supportedFeatures?: string[];
  knownIssues?: string;
  minRam?: string;
  minStorage?: string;
  requiredApps?: string;
  // Timestamps
  createdAt: FireTimestamp | null;
  updatedAt: FireTimestamp | null;
  // Uploader / owner fields (denormalized for display)
  user_id?: string;
  user_details?: {
    username?: string;
    name?: string;
    photo?: string;
  };
}

// ── User Types ────────────────────────────────────────
export type UserRole = "owner" | "admin" | "moderator" | "verifiedDev" | "user";

export interface UserDoc {
  id: string;
  uid: string;
  name: string;
  username: string;
  usernameLower: string;
  email: string;
  photo: string;
  bio: string;
  role: UserRole;
  xp: number;
  achievements: string[];
  subscribersCount: number;
  romsCount: number;
  totalLikesReceived: number;
  totalViewsReceived: number;
  totalDownloads: number;
  unreadNotifications: number;
  followersCount?: number;
  followingCount?: number;
  likedRomIds: string[];
  ratingsGiven?: number;
  commentsGiven?: number;
  banned: boolean;
  blocked: string[];
  lastUsernameChange?: FireTimestamp | null;
  // Suspension / Moderation
  suspended?: boolean;
  suspendedUntil?: FireTimestamp | null;
  suspensionReason?: string;
  validReportsCount?: number;
  falseReportsCount?: number;
  reportBannedUntil?: FireTimestamp | null;
  // Profile Upgrades
  coverImage?: string;
  pinnedRomId?: string;
  hideDownloads?: boolean;
  hideFollowers?: boolean;
  incognitoMode?: boolean;
  hideOwnerSupportButton?: boolean;  // Owner toggle — hide Support Ad button from posts
  linkvertiseGlobalEnabled?: boolean; // تفعيل Linkvertise على كل المنشورات
  linkvertisePublisherId?: string;   // رقم Publisher ID من Linkvertise
  linkvertiseEarnings?: number;      // إجمالي الأرباح من Linkvertise (مُزامَن)
  hideOwnerStudioButton?: boolean;   // Owner toggle — hide Studio button from profile
  privateProfile?: boolean;
  tourSeen?: boolean;
  // Location & Community
  country?: string;          // ISO 3166-1 alpha-2 e.g. "EG", "ID", "US"
  countryName?: string;      // "Egypt", "Indonesia"
  showOnMap?: boolean;       // opt-in to appear on community map
  // Social links
  github?: string;
  telegram?: string;
  xda?: string;
  twitter?: string;
  website?: string;
  youtube?: string;
  // Channel mode (unlocked at Publisher level)
  channelMode?: boolean;
  channelLinks?: ChannelLink[];
  profileLinks?: ProfileLink[];  // unified links array (new system)
  donationLinks?: DonationLink[];
  donationEnabled?: boolean;
  // Earnings & Monetization
  totalSupportsReceived?: number;  // إجمالي مرات الدعم من كل الـ ROMs
  estimatedEarnings?: number;      // أرباح تقديرية بالدولار
  // Ad Support — Primo v5
  adsEnabled?: boolean;              // auto-true at verifiedDev level
  adPlacement?: "profile" | "all";   // profile-only or all posts
  totalAdSupports?: number;          // total valid ad views received
  adSupportEarnings?: number;        // estimated dev earnings (USD) — 90%
  totalWithdrawn?: number;           // total USD successfully withdrawn (lifetime)
  pendingWithdrawal?: number;        // total USD currently locked in processing
  adSupportPoints?: number;          // gamification points for VIEWER
  defaultPaymentMethod?: PaymentMethod;
  defaultWalletAddress?: string;
  createdAt: FireTimestamp | null;
  updatedAt: FireTimestamp | null;
}

export interface ChannelLink {
  platform: "youtube" | "telegram" | "github" | "xda" | "twitter" | "website" | "tiktok" | "instagram" | "linkedin" | "custom";
  url: string;
  label: string;
}

export interface ProfileLink {
  id: string;
  platform: "youtube" | "telegram" | "github" | "xda" | "twitter" | "website" | "tiktok" | "instagram" | "linkedin" | "custom";
  url: string;
  label: string;
  isChannel?: boolean; // appears on every release
}

export interface DonationLink {
  platform: "buymeacoffee" | "paypal" | "patreon" | "kofi" | "custom";
  url: string;
  label: string;
}

// ── Monetization / Ad Settings (Primo v5) ─────────────
export interface AdConfig {
  waterfall: {
    network: "monetag" | "adsterra" | "propellerads" | "outbrain" | "custom";
    weight: number; 
    active: boolean;
    zoneId: string;
  }[];
  revenueSplit: {
    developer: number; // 80
    platform: number;  // 20
  };
  limits: {
    dailyWatchesPerUser: number; // 15
    cooldownMinutes: number;     // 5
    minWatchSeconds: number;     // 12
  };
  gamification: {
    pointsPerWatch: number;      // 50
  };
}

// ── Comment Types ─────────────────────────────────────
export type ReactionEmoji = "❤️" | "🔥" | "👍" | "😂" | "😮" | "🎉";

export interface Reaction {
  emoji: ReactionEmoji;
  count: number;
  reactedByMe: boolean;
}

export interface Comment {
  id: string;
  uid: string;
  name: string;
  photo: string;
  text: string;
  replyCount: number;
  likesCount: number;
  reactions?: Reaction[];
  mentions?: string[];   // array of @usernames
  pinned?: boolean;
  edited?: boolean;
  createdAt: FireTimestamp | null;
}

export interface Reply {
  id: string;
  uid: string;
  name: string;
  photo: string;
  text: string;
  reactions?: Reaction[];
  mentions?: string[];
  edited?: boolean;
  createdAt: FireTimestamp | null;
}

// ── Activity Types ────────────────────────────────────
export type ActivityType = "new_rom" | "new_version" | "like" | "comment" | "follow" | "achievement";

export interface ActivityItem {
  id: string;
  uid: string;
  username: string;
  photo: string;
  type: ActivityType;
  romId: string;
  romName: string;
  targetUid: string;
  createdAt: FireTimestamp | null;
}

// ── Report Types ──────────────────────────────────────
export interface Report {
  id: string;
  reporterUid: string;
  reporterName: string;
  targetType: "rom" | "comment" | "user";
  targetId: string;
  targetOwnerId?: string;
  reason: string;
  description: string;
  screenshotUrl: string;
  status: "pending" | "resolved" | "valid" | "invalid";
  adminNote?: string;
  createdAt: FireTimestamp | null;
  updatedAt: FireTimestamp | null;
}

// ── Appeal Types ──────────────────────────────────────
export interface Appeal {
  id: string;
  uid: string;
  userName: string;
  userEmail: string;
  userPhoto: string;
  suspensionReason: string;
  suspendedUntil: FireTimestamp | null;
  explanation: string;
  evidenceUrl?: string;
  status: "pending" | "approved" | "rejected";
  adminNote?: string;
  reviewedBy?: string;
  createdAt: FireTimestamp | null;
  updatedAt: FireTimestamp | null;
}

// ── Notification Types ────────────────────────────────
export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  link: string;
  authorPhoto: string;
  authorUid?: string;
  authorName?: string;
  type?: "follow" | "like" | "comment" | "download" | "xp" | "rating" | "reply" | "mention" | "system";
  preview?: string;      // comment/reply text preview
  romId?: string;        // for like/comment/download
  romName?: string;      // display name of the ROM
  read: boolean;
  createdAt: FireTimestamp | null;
}

// ── Collection Types ──────────────────────────────────
export interface Collection {
  id: string;
  ownerUid: string;
  name: string;
  description: string;
  isPublic: boolean;
  romIds: string[];
  romCount: number;
  createdAt: FireTimestamp | null;
  updatedAt: FireTimestamp | null;
}

// ── Application Types ─────────────────────────────────
export interface DeveloperApplication {
  id: string;
  uid: string;
  name: string;
  email: string;
  photo: string;
  githubUrl: string;
  xdaUrl?: string;
  telegramUrl?: string;
  sourceUrl?: string;
  supportedFeatures?: string[];
  knownIssues?: string;
  minRam?: string;
  minStorage?: string;
  requiredApps?: string;
  sampleRomUrl: string;
  experience: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  adminNote?: string;
  createdAt: FireTimestamp | null;
  updatedAt: FireTimestamp | null;
}

// ── Announcement Types ────────────────────────────────
export interface Announcement {
  id: string;
  title: string;
  body: string;
  link?: string;
  pinned: boolean;
  createdAt: FireTimestamp | null;
}

// ── Version Types ─────────────────────────────────────
export interface RomVersion {
  id: string;
  version: string;
  changelog: string;
  downloadUrl: string;
  size: string;
  checksumMd5: string;
  createdAt: FireTimestamp | null;
}

// ── Theme Types ───────────────────────────────────────
export type AccentColor = "blue" | "green" | "orange" | "rose" | "gold" | "cyan";
export type ThemeMode = "dark" | "light";

export interface ThemeConfig {
  name: string;
  hex: string;
  dim: string;
  glow: string;
}

// ── Achievement Types ─────────────────────────────────
export interface Achievement {
  id: string;
  icon: string;
  label: string;
  desc: string;
  xp: number;
}

export interface XPLevel {
  level: number;
  xp: number;
  label: string;
}

// ── Sort & Filter ─────────────────────────────────────
export type SortOption = "newest" | "likes" | "views" | "downloads" | "rating" | "trending";

// ── Admin Log Types ───────────────────────────────────
export type LogLevel = "error" | "warning" | "info" | "success";
export type LogCategory = "auth" | "database" | "upload" | "moderation" | "system" | "api" | "security";

export interface AdminLogEntry {
  id: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: string;
  userId?: string;
  userName?: string;
  metadata?: Record<string, unknown>;
  timestamp: FireTimestamp | null;
}

// ── Migration Types ───────────────────────────────────
export interface MigrationInfo {
  id: string;
  name: string;
  description: string;
  risk: "safe" | "moderate" | "destructive";
  lastRun: { ranAt: string; affected: number; ranBy: string } | null;
}

// ── Payout System Types ───────────────────────────────
export type PaymentMethod = "binance_pay" | "usdt_trc20" | "usdt_bep20" | "paypal" | "vodafone_cash";
export type PayoutStatus = "pending" | "approved" | "processing" | "paid" | "failed" | "rejected" | "on_hold";
export type DevTrustLevel = "new" | "trusted" | "vip" | "flagged";

export interface PayoutStatusTransition {
  from: string;
  to: string;
  by: string;
  reason: string;
  at: FireTimestamp | null;
}

export interface PayoutRequest {
  id: string;
  uid: string;
  name: string;
  email: string;
  username: string;
  photo: string;
  amount: number;
  adjustedAmount?: number;
  finalAmount: number;
  paymentMethod: PaymentMethod;
  walletAddress: string;
  status: PayoutStatus;
  trustLevel: DevTrustLevel;
  adminNote?: string;
  txHash?: string;
  processedBy?: string;
  ip?: string;
  statusHistory: PayoutStatusTransition[];
  createdAt: FireTimestamp | null;
  updatedAt: FireTimestamp | null;
  paidAt?: FireTimestamp | null;
}

export interface OwnerClaim {
  id: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  note?: string;
  claimedBy: string;
  claimedAt: FireTimestamp | null;
}

export interface FinancialAuditEntry {
  id: string;
  action: string;
  actorUid: string;
  targetUid?: string;
  payoutId?: string;
  amount: number;
  details?: Record<string, unknown>;
  ip?: string;
  timestamp: FireTimestamp | null;
}
