/**
 * lib/server/smart-device-engine.ts  — v2 IMPROVED
 *
 * التحسينات في هذا الإصدار:
 *  ✅ Phase order مُعاد ترتيبه: Exact → Alias → Consensus → Fuzzy
 *     (Exact match من cache = لا DB call — أسرع بكتير)
 *  ✅ Weighted Jaccard: أرقام الموديل وزنهم 3x، variants 2x
 *  ✅ Levenshtein للـ codename: typo tolerance (edit distance ≤ 2)
 *  ✅ Pre-normalization: S25Ultra → S25 Ultra قبل الـ tokenize
 *  ✅ Brand-only fallback: لو كل الـ tokens هي stop words مش ترجع صفر
 *  ✅ Popularity boost في الـ scoring (romCount يأثر على الترتيب)
 */

import { sbAdmin } from "@/lib/supabase/admin";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface DeviceMatch {
  codename:    string;
  displayName: string;
  brand:       string;
  confidence:  number;
  source:      "exact" | "alias" | "typo" | "consensus" | "fuzzy" | "new";
  voteCount:   number;
  warning?:    string;
}

export interface MatchResult {
  best:        DeviceMatch | null;
  suggestions: DeviceMatch[];
  isNew:       boolean;
  isAmbiguous: boolean;
  warning?:    string;
}

interface DbDevice {
  codename:      string;
  display_name:  string;
  brand:         string;
  aliases:       string[];
  variant_words: string[];
  rom_count?:    number; // اختياري — يُستخدم في popularity boost
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Vocabulary
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// كلمات تدل على جهاز مختلف — لو اختلفت = score صفر
const VARIANT_WORDS = new Set([
  "pro","plus","ultra","lite","se","max","mini",
  "prime","neo","fe","fold","flip","note","edge",
  "5g","4g","lte","play","racing","turbo","speed",
  "zoom","power","active","sport","go","fusion",
]);

// كلمات تُتجاهل في المقارنة
const STOP_WORDS = new Set([
  "samsung","galaxy","google","xiaomi","poco","redmi",
  "oneplus","nothing","realme","motorola","moto","asus",
  "huawei","honor","vivo","oppo","iqoo","tecno","infinix",
  "phone","mobile","smartphone","device","series",
]);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Cache (in-memory, 10 دقائق)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let _cache: DbDevice[] | null = null;
let _cacheAt = 0;
const CACHE_MS = 10 * 60 * 1000;

async function getDevices(): Promise<DbDevice[]> {
  if (_cache && Date.now() - _cacheAt < CACHE_MS) return _cache;
  try {
    // limit رفعناه لـ 5000 عشان يشمل الأجهزة المستوردة من LineageOS
    const { data } = await sbAdmin
      .from("devices")
      .select("codename,display_name,brand,aliases,variant_words")
      .order("brand").limit(5000);
    _cache   = (data || []) as DbDevice[];
    _cacheAt = Date.now();
    return _cache;
  } catch {
    return _cache || [];
  }
}

export function invalidateCache() { _cache = null; }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function cleanCodename(raw: string): string {
  return raw.toLowerCase().trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_\-\.]/g, "")
    .replace(/_+/g, "_").replace(/^_|_$/, "");
}

/**
 * Pre-normalization: يفصل الأرقام عن الحروف الملتصقة
 * S25Ultra → S25 Ultra | RedmiNote14Pro → Redmi Note 14 Pro
 */
function preNormalize(s: string): string {
  return s
    // حرف صغير يليه حرف كبير → أضف مسافة (camelCase)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    // رقم يليه حرف → مسافة (S25Ultra → S25 Ultra)
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    // حرف يليه رقم → مسافة (Note14 → Note 14)
    .replace(/([a-zA-Z])(\d)/g, "$1 $2");
}

function tokenize(s: string): string[] {
  return preNormalize(s)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 0);
}

function extractVariants(tokens: string[]): Set<string> {
  return new Set(tokens.filter(w => VARIANT_WORDS.has(w) || /^\d+[a-z]?$/.test(w)));
}

/**
 * Weighted Jaccard Similarity
 * أرقام الموديل (14, x7, s25) → وزن 3x
 * variant words (pro, ultra)  → وزن 2x
 * باقي الكلمات                → وزن 1x
 */
function calcScore(queryTokens: string[], device: DbDevice): number {
  const candTokens  = tokenize(device.display_name);
  const queryVars   = extractVariants(queryTokens);
  const candVars    = extractVariants(candTokens);
  const deviceVars  = new Set((device.variant_words || []).map(w => w.toLowerCase()));

  // قاعدة صارمة: variant/رقم في الاستعلام لازم يكون في الجهاز وبالعكس
  for (const v of queryVars) {
    if (!candVars.has(v) && !deviceVars.has(v)) return 0;
  }
  for (const v of candVars) {
    if (!queryVars.has(v)) return 0;
  }

  // Weighted token comparison
  const qFiltered = queryTokens.filter(w => !STOP_WORDS.has(w) && w.length > 1);
  const cFiltered = candTokens.filter(w => !STOP_WORDS.has(w) && w.length > 1);

  // Brand-only fallback: لو مفيش meaningful tokens مش نرجع صفر
  if (qFiltered.length === 0 && cFiltered.length === 0) return 0.5;
  if (qFiltered.length === 0) return 0;

  // احسب الأوزان
  function weight(w: string): number {
    if (/^\d+[a-z]?$/.test(w)) return 3; // رقم موديل
    if (VARIANT_WORDS.has(w))  return 2; // variant word
    return 1;
  }

  const qSet = new Map<string, number>();
  const cSet = new Map<string, number>();
  qFiltered.forEach(w => qSet.set(w, weight(w)));
  cFiltered.forEach(w => cSet.set(w, weight(w)));

  let intersection = 0, qTotal = 0, cTotal = 0;
  qSet.forEach((w, k) => {
    qTotal += w;
    if (cSet.has(k)) intersection += w;
  });
  cSet.forEach(w => cTotal += w);

  const union = qTotal + cTotal - intersection;
  if (union === 0) return 0;
  const j = intersection / union;

  // bonus لو نفس الترتيب والكلمات بالظبط
  const perfect = qFiltered.sort().join(" ") === cFiltered.sort().join(" ") ? 0.15 : 0;
  return Math.min(1.0, j + perfect);
}

/**
 * Levenshtein Distance — لكشف typos في الـ codename
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[a.length][b.length];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// resolveDevice — الدالة الرئيسية
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function resolveDevice(
  inputCodename: string,
  deviceName:    string,
  brand?:        string,
): Promise<MatchResult> {
  const devices   = await getDevices();
  const cleanCN   = cleanCodename(inputCodename);
  const cleanName = deviceName.trim();

  // ─── Phase 1: Exact codename match (من cache — بدون DB call) ────────
  if (cleanCN) {
    const exact = devices.find(d => d.codename === cleanCN);
    if (exact) {
      const nameScore = cleanName ? calcScore(tokenize(cleanName), exact) : 1.0;
      if (!cleanName || nameScore > 0.35) {
        return {
          best: {
            codename: exact.codename, displayName: exact.display_name,
            brand: exact.brand, confidence: 1.0, source: "exact", voteCount: 0,
          },
          suggestions: [], isNew: false, isAmbiguous: false,
        };
      }
    }
  }

  // ─── Phase 2: Alias match (من cache — بدون DB call) ─────────────────
  const searchTerm = cleanName || inputCodename;
  if (searchTerm) {
    const norm = searchTerm.toLowerCase().trim().replace(/\s+/g, " ");
    const aliasMatch = devices.find(d =>
      (!brand || d.brand.toLowerCase() === brand.toLowerCase()) &&
      (d.aliases || []).some(a => a.toLowerCase() === norm)
    );
    if (aliasMatch) {
      return {
        best: {
          codename: aliasMatch.codename, displayName: aliasMatch.display_name,
          brand: aliasMatch.brand, confidence: 0.95, source: "alias", voteCount: 0,
          warning: cleanCN && cleanCN !== aliasMatch.codename
            ? `الكودنيم الصحيح هو "${aliasMatch.codename}"`
            : undefined,
        },
        suggestions: [], isNew: false, isAmbiguous: false,
      };
    }
  }

  // ─── Phase 3: Typo tolerance على الـ codename (Levenshtein ≤ 2) ─────
  if (cleanCN && cleanCN.length >= 3) {
    let bestTypo: DbDevice | null = null;
    let bestDist = 3; // threshold
    for (const d of devices) {
      const dist = levenshtein(cleanCN, d.codename);
      if (dist < bestDist) { bestDist = dist; bestTypo = d; }
    }
    if (bestTypo) {
      return {
        best: {
          codename: bestTypo.codename, displayName: bestTypo.display_name,
          brand: bestTypo.brand, confidence: 0.85 - bestDist * 0.1,
          source: "typo", voteCount: 0,
          warning: `هل تقصد "${bestTypo.codename}"؟ (الكودنيم "${cleanCN}" يبدو مكتوباً بخطأ)`,
        },
        suggestions: [], isNew: false, isAmbiguous: false,
      };
    }
  }

  // ─── Phase 4: Consensus من DB ────────────────────────────────────────
  if (cleanName) {
    const { data: voteData } = await sbAdmin.rpc("resolve_device_codename", {
      p_device_name:    cleanName,
      p_brand:          brand || "",
      p_input_codename: cleanCN,
    }).maybeSingle();

    if (voteData) {
      const v      = voteData as Record<string, unknown>;
      const votes  = Number(v.winner_votes)      || 0;
      const conf   = Number(v.winner_confidence) || 0;
      const winner = v.winner_codename as string;

      if (winner && (votes >= 2 || conf >= 1.4)) {
        const dbDev     = devices.find(d => d.codename === winner);
        const isWrongCN = cleanCN && cleanCN !== winner;
        return {
          best: {
            codename: winner, displayName: dbDev?.display_name ?? cleanName,
            brand: dbDev?.brand ?? brand ?? "", confidence: Math.min(1, conf / Math.max(votes, 1)),
            source: "consensus", voteCount: votes,
            warning: isWrongCN ? `${votes} مطور استخدموا "${winner}" — هل تقصد "${winner}"؟` : undefined,
          },
          suggestions: [], isNew: !dbDev, isAmbiguous: false,
        };
      }
    }
  }

  // ─── Phase 5: Weighted Fuzzy Scoring ────────────────────────────────
  if (!searchTerm) {
    return { best: null, suggestions: [], isNew: true, isAmbiguous: false,
      warning: "أدخل اسم الجهاز أو الكودنيم" };
  }

  const tokens = tokenize(searchTerm);
  // ── Brand filtering صارم ────────────────────────────────────────────
  // لو المستخدم اختار brand معين → نفلتر بيه فقط ولا نعمل fallback
  // BRAND_ALIAS: Poco/Redmi → Xiaomi | iQOO → Vivo | Nubia → ZTE
  const BRAND_ALIAS: Record<string, string> = {
    poco: "xiaomi", redmi: "xiaomi", iqoo: "vivo", nubia: "zte",
  };
  const normalizedBrand = brand
    ? (BRAND_ALIAS[brand.toLowerCase()] || brand.toLowerCase())
    : null;

  const pool = normalizedBrand
    ? devices.filter(d =>
        d.brand.toLowerCase() === normalizedBrand ||
        BRAND_ALIAS[d.brand.toLowerCase()] === normalizedBrand
      )
    : devices;

  // لو البراند موجود بس مفيش أجهزة محلية → ابعت رسالة واضحة
  // مش نعمل fallback لبراند تاني
  const scored = (pool.length > 0 ? pool : (brand ? [] : devices))
    .map(d => {
      const s = calcScore(tokens, d);
      // popularity boost: لو الجهاز عنده ROMs كتير → رفع طفيف
      const boost = s > 0 ? Math.min(0.05, (d.rom_count ?? 0) * 0.001) : 0;
      return { d, s: Math.min(1.0, s + boost) };
    })
    .filter(r => r.s > 0)
    .sort((a, b) => b.s - a.s);

  const top4  = scored.slice(0, 4);
  if (top4.length === 0) {
    return {
      best: {
        codename: cleanCN || cleanCodename(searchTerm), displayName: cleanName,
        brand: brand || "", confidence: 0.3, source: "new", voteCount: 0,
      },
      suggestions: [], isNew: true, isAmbiguous: false,
    };
  }

  const best   = top4[0];
  const second = top4[1];
  const isAmbig = !!second && second.s >= best.s * 0.85;

  const suggestions: DeviceMatch[] = top4.map(r => ({
    codename: r.d.codename, displayName: r.d.display_name,
    brand: r.d.brand, confidence: r.s, source: "fuzzy" as const, voteCount: 0,
  }));

  let warning: string | undefined;
  if (cleanCN && best.d.codename !== cleanCN && best.s >= 0.7) {
    warning = `الكودنيم الصحيح لهذا الجهاز هو "${best.d.codename}"`;
  } else if (isAmbig) {
    warning = "يوجد أجهزة متشابهة — اختر الصحيح من الاقتراحات";
  }

  const finalCN = best.s >= 0.65
    ? best.d.codename
    : (cleanCN || cleanCodename(searchTerm));

  return {
    best: {
      codename: finalCN, displayName: best.d.display_name,
      brand: best.d.brand, confidence: best.s, source: "fuzzy", voteCount: 0,
      warning,
    },
    suggestions, isNew: best.s < 0.55, isAmbiguous: isAmbig, warning,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// recordDeviceVote — يُستدعى عند كل رفع ROM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function recordDeviceVote(
  romId:         string,
  deviceName:    string,
  brand:         string,
  inputCodename: string,
  maintainerUid: string,
): Promise<void> {
  if (!deviceName?.trim()) return;

  // الكودنيم اللي كتبه المطور هو الأساس دائماً — مش نغيره أبداً
  const finalCN = inputCodename?.trim()
    ? cleanCodename(inputCodename)
    : cleanCodename(deviceName);

  if (!finalCN) return;

  // سجّل الصوت في consensus table (fire-and-forget)
  void sbAdmin.from("device_codename_votes").upsert({
    rom_id:         romId,
    device_name:    deviceName.trim(),
    brand:          brand?.trim() || "",
    codename:       finalCN,
    maintainer_uid: maintainerUid,
    confidence:     inputCodename?.trim() ? 1.0 : 0.5,
    source:         inputCodename?.trim() ? "manual" : "auto",
  }, { onConflict: "rom_id" }).then(undefined, err =>
    console.error("[recordDeviceVote]", err)
  );

  // تصحيح الـ brand تلقائياً لو الاسم يكشف brand أصح
  // مثال: name="Samsung Galaxy S25" + brand="Xiaomi" → brand صح = "Samsung"
  const KNOWN_BRANDS_LIST = [
    "samsung","google","sony","motorola","moto","asus","oneplus",
    "nothing","realme","vivo","oppo","huawei","honor","xiaomi",
    "poco","redmi","nokia","htc","lg","tcl","zte","nubia",
  ];
  const nameLowerDB = deviceName.toLowerCase().trim();
  let correctedBrand = brand?.trim() || "";
  for (const b of KNOWN_BRANDS_LIST) {
    if (nameLowerDB.startsWith(b + " ") || nameLowerDB === b) {
      correctedBrand = b.charAt(0).toUpperCase() + b.slice(1);
      break;
    }
  }

  // أضف الجهاز في devices table تلقائياً لو مش موجود
  // هذا هو قلب نظام الأرشيف التلقائي:
  // أي ROM يترفع → جهازه يظهر في الأرشيف فوراً حتى لو جديد كلياً
  const nameTokens = tokenize(deviceName);
  void sbAdmin.from("devices").upsert({
    codename:      finalCN,
    display_name:  deviceName.trim(),
    brand:         correctedBrand,
    aliases:       buildAliases(deviceName, brand),
    variant_words: Array.from(extractVariants(nameTokens)),
    // image_url فاضي → DeviceImage component هيجيبها تلقائياً من browser
    // وبعد أول request ناجح بيتحفظ في Supabase للأبد
    updated_at:    new Date().toISOString(),
  }, {
    onConflict:      "codename",
    ignoreDuplicates: false,  // تحديث لو موجود بالفعل (يضيف aliases جديدة مثلاً)
  }).then(undefined, () => {});
}

/**
 * بناء aliases تلقائية من اسم الجهاز
 * مثال: "Samsung Galaxy S25 Ultra" →
 *   ["galaxy s25 ultra", "s25 ultra", "samsung s25 ultra", "s25u"]
 */
function buildAliases(deviceName: string, brand: string): string[] {
  const aliases: string[] = [];
  const nameLower  = deviceName.toLowerCase().trim();
  const brandLower = brand.toLowerCase().trim();

  aliases.push(nameLower); // الاسم الكامل

  // بدون الـ brand
  const withoutBrand = nameLower.replace(new RegExp("^" + brandLower + "\\s*", "i"), "").trim();
  if (withoutBrand && withoutBrand !== nameLower) aliases.push(withoutBrand);

  // اختصار: أول حرف من كل كلمة (لو أكثر من 2 كلمات)
  const words = nameLower.split(/\s+/).filter(w => w.length > 1);
  if (words.length >= 3) {
    // آخر كلمتين بس (مثلاً "s25 ultra" من "galaxy s25 ultra")
    aliases.push(words.slice(-2).join(" "));
    // آخر كلمة لو رقم/موديل
    if (/\d/.test(words[words.length - 2] || "")) {
      aliases.push(words.slice(-2).join(""));  // "s25ultra"
    }
  }

  return [...new Set(aliases)].filter(a => a.length > 1).slice(0, 8);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Consolidation (يشتغل في الـ cron)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function runConsolidation(): Promise<{ fixed: number; devices: number }> {
  const { data } = await sbAdmin.rpc("consolidate_all_devices");
  const rows  = (data || []) as { fixed: number }[];
  const fixed = rows.reduce((s, r) => s + (r.fixed || 0), 0);
  const devs  = rows.filter(r => r.fixed > 0).length;
  return { fixed, devices: devs };
}
