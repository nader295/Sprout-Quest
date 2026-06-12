/**
 * app/api/devices/suggest/route.ts — v3 SMART DEDUP
 *
 * نظام ذكي لمنع التكرار في الاقتراحات:
 *  - dedup بالـ codename (مفتاح أساسي)
 *  - dedup بالاسم المنظّم (normalized name)
 *  - dedup بالتشابه الشديد (Jaccard > 0.85)
 *  - أولوية: DB > Local > Wikipedia
 */

import { NextRequest, NextResponse } from "next/server";
import { getClientIp, rateLimit, rateLimitedResponse } from "@/lib/api/middleware";
import { resolveDevice } from "@/lib/server/smart-device-engine";
import { sbAdmin } from "@/lib/supabase/admin";
import { UnifiedDeviceCache, DeviceRow } from "@/lib/server/device-cache-unified";
import { logger } from "@/lib/logger";

// Local device list removed — unified Supabase schema acts as the single source of truth.

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DEDUPLICATION ENGINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Suggestion {
  codename: string;
  displayName: string;
  brand: string;
  confidence: number;
  source: string;
  voteCount?: number;
  warning?: string;
}

/** تنظيف الاسم للمقارنة: إزالة علامات الترقيم والمسافات */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")  // إزالة كل علامات الترقيم
    .trim();
}

/** حساب Jaccard similarity بين نصين على مستوى الكلمات */
function jaccardSimilarity(a: string, b: string): number {
  // استخدم كلمات مش أحرف — أدق في كشف التكرار
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 1));
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 1));
  if (wordsA.size === 0 || wordsB.size === 0) {
    // fallback للأحرف لو الاسم كلمة واحدة
    const setA = new Set(a.split(""));
    const setB = new Set(b.split(""));
    const inter = new Set([...setA].filter(c => setB.has(c)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : inter.size / union.size;
  }
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/** تطابق variant: لو أحدهم Pro والثاني بدونه → مختلفان */
function sameVariant(a: string, b: string): boolean {
  const VARIANTS = ["pro", "ultra", "plus", "max", "lite", "se", "fe", "fold", "flip", "note"];
  const aTokens = new Set(a.toLowerCase().split(/\s+/));
  const bTokens = new Set(b.toLowerCase().split(/\s+/));
  for (const v of VARIANTS) {
    if (aTokens.has(v) !== bTokens.has(v)) return false; // variant مختلف → جهاز مختلف
  }
  return true;
}

/**
 * deduplicateSuggestions — المحرك الرئيسي لمنع التكرار
 *
 * يدمج المصادر المتعددة بذكاء:
 *  1. Exact codename match → نسخة واحدة فقط (الأعلى ثقة)
 *  2. Normalized name match → نسخة واحدة
 *  3. Jaccard similarity > 0.9 → نفس الجهاز تقريباً → نسخة واحدة
 *  4. أولوية المصادر: exact > consensus > alias > db > local > fuzzy
 */
function deduplicateSuggestions(suggestions: Suggestion[]): Suggestion[] {
  if (suggestions.length <= 1) return suggestions;

  const SOURCE_PRIORITY: Record<string, number> = {
    exact: 100, consensus: 90, alias: 80, typo: 70,
    db: 60, local: 50, fuzzy: 40, wikipedia: 30,
  };

  // ترتيب بالأولوية أولاً
  const sorted = [...suggestions].sort((a, b) => {
    const pa = SOURCE_PRIORITY[a.source] ?? 0;
    const pb = SOURCE_PRIORITY[b.source] ?? 0;
    if (pb !== pa) return pb - pa;
    return (b.confidence ?? 0) - (a.confidence ?? 0);
  });

  const kept: Suggestion[] = [];
  const seenCodenames  = new Set<string>();
  const seenNormNames  = new Set<string>();

  for (const s of sorted) {
    const cn        = s.codename.toLowerCase().trim();
    const normName  = normalizeName(s.displayName);

    // ① تكرار codename مباشر
    if (seenCodenames.has(cn)) continue;

    // ② تكرار اسم منظّم
    if (normName && seenNormNames.has(normName)) continue;

    // ③ تشابه شديد مع إدخال موجود (Jaccard > 0.88)
    const isTooSimilar = kept.some(k => {
      if (k.brand !== s.brand) return false; // brand مختلف = جهاز مختلف
      // تحقق من الـ variant أولاً — Pro وبدون Pro مختلفان دائماً
      if (!sameVariant(k.displayName, s.displayName)) return false;
      const sim = jaccardSimilarity(normalizeName(k.displayName), normName);
      return sim > 0.88;
    });
    if (isTooSimilar) continue;

    // ④ نسخ brand مختلفة لنفس الجهاز (مثلاً "Poco" و"Xiaomi" لـ نفس الجهاز)
    const sameCodeDiffBrand = kept.find(k => k.codename === cn);
    if (sameCodeDiffBrand) {
      // دمج: احتفظ بالنسخة الأعلى ثقة فقط
      continue;
    }

    seenCodenames.add(cn);
    if (normName) seenNormNames.add(normName);
    kept.push(s);
  }

  return kept;
}

// ── Fuzzy search في الـ local list ───────────────────────────────────
const BRAND_ALIAS_MAP: Record<string, string> = {
  "poco":      "Xiaomi",
  "redmi":     "Xiaomi",
  "iqoo":      "Vivo",
  "nubia":     "ZTE",
  "red magic": "ZTE",
};

// يطبّع اسم الـ brand ويرجع كل الـ variants (رئيسي + فرعي)
function normalizeBrandFilter(brand: string): string[] {
  const bl = brand.toLowerCase();
  const parent = BRAND_ALIAS_MAP[bl];
  if (parent) return [brand, parent]; // poco → [poco, Xiaomi]
  // رئيسي → أضف فرعييه
  const subs = Object.entries(BRAND_ALIAS_MAP)
    .filter(([, v]) => v.toLowerCase() === bl)
    .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));
  return [brand, ...subs];
}

function searchLocal(devices: DeviceRow[], q: string, brand?: string) {
  const ql = q.toLowerCase().trim();
  if (!ql || ql.length < 2) return [];

  const brandVariants = brand ? normalizeBrandFilter(brand) : null;
  const scored = devices
    // brand filter صارم — لو اختار OnePlus ما يطلعش Xiaomi
    .filter(d => !brandVariants || brandVariants.some(b => (d.brand || '').toLowerCase() === b.toLowerCase()))
    .map(d => {
      const nl = (d.display_name || d.name || '').toLowerCase();
      const cl = d.codename.toLowerCase();
      let score = 0;
      if (nl === ql || cl === ql)                    score = 100;
      else if (nl.startsWith(ql) || cl === ql)       score = 80;
      else if (nl.includes(ql) || cl.includes(ql))   score = 60;
      else {
        const qWords = ql.split(/\s+/);
        const nWords = nl.split(/\s+/);
        const matched = qWords.filter(w => w.length > 1 && nWords.some(nw => nw.includes(w)));
        score = (matched.length / qWords.length) * 50;
      }
      return { codename: d.codename, name: d.display_name || d.name || '', brand: d.brand || '', score };
    })
    .filter(d => d.score > 20)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 5);
}

// ── GET ───────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 120)) return rateLimitedResponse(req);

  const cache = UnifiedDeviceCache.get();
  const allDevices = await cache.getDevices();

  const { searchParams } = new URL(req.url);
  const q        = (searchParams.get("q")        || "").trim();
  const brand    = (searchParams.get("brand")    || "").trim();
  const codename = (searchParams.get("codename") || "").trim();

  if (!q && !codename) {
    return NextResponse.json({ suggestions: [], best: null });
  }

  // ── 0. Bidirectional lookup ─────────────────────────────────────────
  // لو المستخدم كتب codename في حقل الاسم → اعكسهم
  // مثال: q="rodin" → هذا codename مش اسم جهاز
  let effectiveQ        = q;
  let effectiveCodename = codename;

  if (q && !codename && /^[a-z0-9_\-\.]+$/.test(q) && q.length <= 20 && !q.includes(" ")) {
    // q يشبه codename (lowercase، بدون مسافات) → استخدمه كـ codename أيضاً
    effectiveCodename = q;
  }

  if (codename && !q) {
    // جرب تجيب اسم الجهاز من devices table بناءً على الـ codename
    try {
      const { data: devRow } = await sbAdmin
        .from("devices")
        .select("display_name, brand")
        .eq("codename", codename.toLowerCase())
        .maybeSingle();
      if (devRow) {
        const dr = devRow as { display_name?: string; brand?: string };
        if (dr.display_name) effectiveQ = dr.display_name;
      }
    } catch { /* ignore */ }
  }

  // ── 1. Smart resolve من Supabase ──────────────────────────────────
  const result = await resolveDevice(effectiveCodename, effectiveQ, brand || undefined);

  // ── تحقق: لو brand محدد والـ result جاب brand تاني → تجاهله ──────
  // مثال: اختار OnePlus لكن resolveDevice رجّع Xiaomi → نتجاهل النتيجة
  const BRAND_ALIAS_CHECK: Record<string, string> = {
    poco: "xiaomi", redmi: "xiaomi", iqoo: "vivo", nubia: "zte",
  };
  const userBrandNorm = brand
    ? (BRAND_ALIAS_CHECK[brand.toLowerCase()] || brand.toLowerCase())
    : null;
  const resultBrandNorm = result.best?.brand
    ? (BRAND_ALIAS_CHECK[result.best.brand.toLowerCase()] || result.best.brand.toLowerCase())
    : null;
  const brandMismatch = userBrandNorm && resultBrandNorm && userBrandNorm !== resultBrandNorm;

  const validResult = brandMismatch ? { ...result, best: null, suggestions: [] } : result;

  let bestCodename = validResult.best?.codename;
  if (codename && !bestCodename) bestCodename = codename;

  // ── 2. Local list fallback ─────────────────────────────────────────
  const hasGoodResult = validResult.best && (validResult.best.confidence ?? 0) >= 0.6;
  let localMatches: { codename: string, name: string, brand: string, score: number }[] = [];

  if (!hasGoodResult && (q || codename)) {
    localMatches = searchLocal(allDevices, q || codename, brand || undefined);
    if (localMatches.length > 0 && !bestCodename) {
      bestCodename = localMatches[0].codename;
    }
  }

  // ── 3. إضافية: ROM count + verified status ──────────────────────────
  let romCount = 0, isVerified = false;
  if (bestCodename) {
    const [countRes, devRes] = await Promise.all([
      sbAdmin.from("roms").select("*", { count: "exact", head: true }).eq("device_codename", bestCodename),
      sbAdmin.from("devices").select("codename").eq("codename", bestCodename).maybeSingle(),
    ]);
    romCount   = countRes.count ?? 0;
    isVerified = !!devRes.data;
  }

  // ── 4. جمع الاقتراحات من كل المصادر ──────────────────────────────
  const dbSuggestions: Suggestion[] = (validResult.suggestions || []).map(s => ({
    codename:    s.codename,
    displayName: s.displayName,
    brand:       s.brand,
    confidence:  s.confidence,
    source:      s.source,
    voteCount:   s.voteCount,
    warning:     s.warning,
  }));

  const localSuggestions: Suggestion[] = localMatches.map(d => ({
    codename:    d.codename,
    displayName: d.name,
    brand:       d.brand,
    confidence:  0.75,
    source:      "local",
    voteCount:   0,
  }));

  // ── 5. DEDUP الذكي ─────────────────────────────────────────────────
  const raw = [...dbSuggestions, ...localSuggestions];
  const deduped = deduplicateSuggestions(raw).slice(0, 4);

  // ── 6. Wikipedia enrichment لو مفيش نتيجة ───────────────────────────
  if (!hasGoodResult && localMatches.length === 0 && q.length >= 5) {
    try {
      const { fetchWikipediaImageForDevice } = await import("@/lib/server/device-ingestion");
      const wikiImg = await fetchWikipediaImageForDevice(q);
      if (wikiImg && codename) {
        const { autoIngestDevice } = await import("@/lib/server/device-ingestion");
        autoIngestDevice(codename, q, brand || "")
          .catch((err) => logger.error("devices.suggest.autoIngest", err, { codename, q, brand }));
      }
    } catch { /* non-critical */ }
  }

  const minConfidence = codename ? 0.5 : 0.65;
  const bestLocal = localMatches[0];

  // ── النتيجة النهائية ─────────────────────────────────────────────────
  const finalBest = validResult.best ?? (bestLocal ? {
    codename:    bestLocal.codename,
    displayName: bestLocal.name,
    brand:       bestLocal.brand,
    confidence:  0.75,
    source:      "local",
    voteCount:   0,
  } : null);

  // إزالة الـ best من الـ suggestions لو موجود فيهم (منع التكرار)
  const finalSuggestions = deduped.filter(s => {
    if (!finalBest) return true;
    if (s.codename.toLowerCase() === finalBest.codename.toLowerCase()) return false;
    const sNorm = s.displayName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const bNorm = finalBest.displayName.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (sNorm === bNorm) return false;
    return true;
  });

  return NextResponse.json({
    best: finalBest,
    suggestions: finalSuggestions,
    isNew:       validResult.isNew && localMatches.length === 0,
    isAmbiguous: validResult.isAmbiguous,
    warning:     validResult.warning,
    resolved:    (validResult.best?.confidence ?? 0) >= minConfidence ? bestCodename : null,
    confidence:  validResult.best?.confidence ?? 0,
    romCount,
    isVerified,
    archiveUrl:  romCount > 0 ? `/devices/${bestCodename}` : null,
  }, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" }
  });
}
