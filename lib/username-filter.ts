// ══════════════════════════════════════════════════════════
//  RomX — Username Filter (Shared: Frontend + Backend)
//  ⚠️ هذا الملف يُستخدم في كلا الطرفين — لا تحذف منه
// ══════════════════════════════════════════════════════════

// ── Reserved ─────────────────────────────────────────────
export const RESERVED_USERNAMES = new Set([
  "login","register","signup","logout","settings","profile","upload","explore",
  "search","leaderboard","feed","admin","api","about","help","terms","privacy",
  "support","contact","apply","compare","devices","collections","favorites",
  "notifications","rules","not-found","404","500","home","index","null","undefined",
]);

// ── Brands ───────────────────────────────────────────────
export const BRAND_PREFIXES = [
  "xiaomi","samsung","oneplus","google","realme","nothing","motorola","asus",
  "vivo","oppo","sony","huawei","nokia","poco","redmi","iqoo","lenovo","apple",
  "microsoft","amazon","meta","netflix","android","qualcomm","mediatek",
];

// ── Blocked (hard deny) ───────────────────────────────────
export const BLOCKED_WORDS = [
  "romx","admin","administrator","moderator","staff","official","support",
  "superuser","root","owner","master","system",
  "nigger","nigga","faggot","rape","nazi","porn","nude","naked","fuck",
  "sharmouta","sharmota","gahba","kahba","kahhba","metnak","metniak","neek",
];

// ── Warning (allow but flag) ──────────────────────────────
export const WARNING_WORDS = [
  "shit","ass","bitch","dick","cock","pussy","cunt","whore","slut","bastard",
  "retard","kill","sex","kos","ks","kuss","teez","tiz","ayir","zbr","zbir",
  "khra","khara","manyak","zebi","nayak","nayek","ahbal","ahmak","ibn","kalb",
  "kelb","hmar","laban","god","allah","prophet","jesus",
  // ← "nik" نقلت هنا بدل blocked عشان مش تحجب: nikolai, nikita, nick
  "nik",
];

// ── Smart Normalize ───────────────────────────────────────
export function normalizeUsername(input: string): string {
  return input
    .toLowerCase()
    .replace(/0/g,"o").replace(/1/g,"i").replace(/3/g,"e")
    .replace(/4/g,"a").replace(/5/g,"s").replace(/7/g,"t")
    .replace(/8/g,"b").replace(/\$/g,"s").replace(/@/g,"a")
    // Cyrillic / Greek homographs
    .replace(/а/g,"a").replace(/е/g,"e").replace(/о/g,"o")
    .replace(/р/g,"p").replace(/с/g,"c").replace(/х/g,"x")
    .replace(/і/g,"i").replace(/ї/g,"i").replace(/ё/g,"e")
    // separators used for bypass: a.d.m.i.n
    .replace(/[.\-_*·•]/g,"")
    // zero-width chars
    .replace(/[\u200B-\u200D\uFEFF]/g,"");
}

// ── Main Check ────────────────────────────────────────────
export type UsernameCheckResult =
  | { status: "clean" }
  | { status: "warning"; message: string }
  | { status: "blocked"; message: string };

export function checkUsername(raw: string): UsernameCheckResult {
  const lower = raw.toLowerCase();
  const norm  = normalizeUsername(raw);

  // 1) Reserved routes
  if (RESERVED_USERNAMES.has(lower)) {
    return { status: "blocked", message: "This username is reserved by the platform" };
  }

  // 2) Official suffix (nader_official, samsungofficial...)
  if (norm.endsWith("official")) {
    return { status: "blocked", message: "This username violates platform rules" };
  }

  // 3) Brand impersonation
  for (const brand of BRAND_PREFIXES) {
    if (norm.startsWith(brand) || lower.startsWith(brand)) {
      return { status: "blocked", message: "Usernames that imitate device brands are not allowed" };
    }
  }

  // 4) Hard-blocked words (word boundary + normalized)
  for (const word of BLOCKED_WORDS) {
    const normWord = normalizeUsername(word);
    const rx = new RegExp(`\\b${normWord}\\b`, "i");
    if (rx.test(norm) || rx.test(lower) || norm.includes(normWord)) {
      return { status: "blocked", message: "This username violates platform rules" };
    }
  }

  // 5) Warning words (word boundary only — يمنع false positive)
  for (const word of WARNING_WORDS) {
    const rx = new RegExp(`\\b${word}\\b`, "i");
    if (rx.test(lower) || rx.test(norm)) {
      return {
        status: "warning",
        message: "This username may be considered offensive and could be reviewed by moderators.",
      };
    }
  }

  return { status: "clean" };
}
