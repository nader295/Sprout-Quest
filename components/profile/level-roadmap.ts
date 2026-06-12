// ── XP roadmap & level metadata ─────────────────────────────────────
// Shared between XpLevelCard, LevelBadge tooltips, and analytics displays.

export const XP_EARN_WAYS = [
  { icon: "🚀", labelKey: "xp.earnPublish",    xp: 30,  color: "text-emerald-400" },
  { icon: "🔄", labelKey: "xp.earnUpdate",     xp: 10,  color: "text-blue-400"    },
  { icon: "❤️", labelKey: "xp.earnLike",       xp: 3,   color: "text-rose-400"    },
  { icon: "📥", labelKey: "xp.earnDownloads",  xp: 2,   color: "text-violet-400"  },
  { icon: "👤", labelKey: "xp.earnFollower",   xp: 5,   color: "text-amber-400"   },
  { icon: "🏆", labelKey: "xp.earnMilestone",  xp: 20,  color: "text-amber-400"   },
];

export const LEVEL_ROADMAP = [
  { level: 1,  xp: 0,      labelKey: "level.label.member",      icon: "👤", unlockKeys: ["level.unlock.uploadContent"] },
  { level: 3,  xp: 150,    labelKey: "level.label.publisher",   icon: "📌", unlockKeys: ["level.unlock.customLinks", "level.unlock.pinRelease"] },
  { level: 7,  xp: 600,    labelKey: "level.label.developer",   icon: "⚡", unlockKeys: ["level.unlock.channelMode", "level.unlock.channelLinks", "level.unlock.donation", "level.unlock.cover", "level.unlock.analytics"] },
  { level: 10, xp: 1800,   labelKey: "level.label.topDev",      icon: "💎", unlockKeys: ["level.unlock.priority", "level.unlock.customStatus"] },
  { level: 15, xp: 4000,   labelKey: "level.label.proDev",      icon: "🌟", unlockKeys: ["level.unlock.earlyAccess"] },
  { level: 20, xp: 9000,   labelKey: "level.label.expertDev",   icon: "🔮", unlockKeys: ["level.unlock.expertBadge", "level.unlock.distinctionBadge"] },
  { level: 30, xp: 25000,  labelKey: "level.label.legendaryDev",icon: "👑", unlockKeys: ["level.unlock.featured", "level.unlock.legendaryBadge"] },
];

// Maps English level labels from getLevel() to i18n keys
export const LEVEL_KEY_MAP: Record<string, string> = {
  "Member": "level.label.member",
  "Publisher": "level.label.publisher",
  "Developer": "level.label.developer",
  "Top Developer": "level.label.topDev",
  "Pro Developer": "level.label.proDev",
  "Expert Developer": "level.label.expertDev",
  "Legendary Developer": "level.label.legendaryDev",
};
