/**
 * lib/server/device-normalize.ts  — SERVER ONLY
 *
 * النظام الجديد — ٣ مراحل:
 *
 *  1. DB-first: يجيب الأجهزة من Supabase (devices table + consensus votes)
 *     - devices table: الأجهزة المعروفة مع aliases وvariant_words
 *     - device_codename_votes: ما صوّت عليه المطورون فعلاً
 *
 *  2. fuzzy matching على البيانات الحية (مش قائمة ثابتة)
 *     - variant words (pro/ultra/plus) لازم تتطابق 100%
 *     - أرقام الموديل لازم تتطابق
 *
 *  3. consensus override: لو فيه >= 2 أصوات → ثق في الأغلبية
 *
 * device-db.ts باقي كـ cold-start fallback بس
 * (لو Supabase فاضية → seed منه)
 */

import { sbAdmin } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────────

export interface MatchResult {
  codename: string;
  displayName: string;
  brand: string;
  confidence: number;
  matchType: "exact_codename" | "exact_name" | "alias" | "fuzzy" | "consensus" | "none";
  voteCount?: number;
}

export interface NormalizeResult {
  codename: string;
  canonicalName: string;
  brand: string;
  confidence: number;
  matched: boolean;
  suggestions: MatchResult[];
  isAmbiguous: boolean;
  warning?: string;
}

import { UnifiedDeviceCache } from "./device-cache-unified";

// ── In-memory cache (server process lifetime) ─────────────────────────────────
interface DeviceRow {
  codename: string;
  display_name: string;
  brand: string;
  aliases: string[];
  variant_words: string[];
}

async function loadDevices(): Promise<DeviceRow[]> {
  const cache = UnifiedDeviceCache.get();
  const rows = await cache.getDevices();
  return rows.map(r => ({
    codename: r.codename,
    display_name: r.display_name || r.name || "",
    brand: r.brand || "",
    aliases: Array.isArray(r.aliases) ? r.aliases : [],
    variant_words: Array.isArray(r.variant_words) ? r.variant_words : [],
  }));
}


// ── كلمات الـ variant اللي لو اختلفت = جهاز مختلف ──────────────────────────
const VARIANT_WORDS = new Set([
  "pro", "plus", "ultra", "lite", "se", "max", "mini", "prime", "neo",
  "fe", "edge", "fold", "flip", "note", "play",
]);

// ── كلمات يجب تجاهلها عند المقارنة ────────────────────────────────────────
const STOP_WORDS = new Set([
  "samsung", "galaxy", "google", "xiaomi", "poco", "redmi",
  "oneplus", "nothing", "realme", "motorola", "moto", "asus",
  "phone", "mobile", "smartphone", "5g", "4g", "lte",
]);

// ─────────────────────────────────────────────────────────────────────────────

export function cleanCodename(input: string): string {
  if (!input?.trim()) return "";
  return input
    .toLowerCase().trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_\-\.]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function tokenize(input: string): string[] {
  return input.toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function scoreMatch(queryTokens: string[], device: DeviceRow): number {
  const candidateTokens = tokenize(device.display_name);
  const entryVariants   = new Set((device.variant_words || []).map((w) => w.toLowerCase()));

  // variant words + numbers لازم تتطابق تماماً
  const queryVariants = queryTokens.filter(
    (w) => VARIANT_WORDS.has(w) || /^\d+[a-z]?$/.test(w)
  );
  const candVariants = candidateTokens.filter(
    (w) => VARIANT_WORDS.has(w) || /^\d+[a-z]?$/.test(w)
  );

  for (const qv of queryVariants) {
    if (!candVariants.includes(qv) && !entryVariants.has(qv)) return 0;
  }
  for (const cv of candVariants) {
    if (!queryVariants.includes(cv)) return 0;
  }

  const qFiltered = queryTokens.filter((w) => !STOP_WORDS.has(w) && w.length > 1);
  const cFiltered = candidateTokens.filter((w) => !STOP_WORDS.has(w) && w.length > 1);
  if (qFiltered.length === 0) return 0;

  const qSet = new Set(qFiltered);
  const cSet = new Set(cFiltered);
  const intersection = [...qSet].filter((w) => cSet.has(w)).length;
  const union = new Set([...qSet, ...cSet]).size;
  const jaccard = union === 0 ? 0 : intersection / union;

  const perfectBonus =
    qFiltered.sort().join(" ") === cFiltered.sort().join(" ") ? 0.2 : 0;

  return Math.min(1.0, jaccard + perfectBonus);
}

// ─────────────────────────────────────────────────────────────────────────────
// الدالة الرئيسية — async لأنها بتقرأ من Supabase
// ─────────────────────────────────────────────────────────────────────────────

export async function smartMatch(
  codenameInput: string,
  deviceName:    string,
  brand?:        string,
): Promise<NormalizeResult> {

  const devices    = await loadDevices();
  const cleanedCN  = cleanCodename(codenameInput);
  const cleanedDev = deviceName?.trim() || "";

  // ── Phase 1: exact codename match ──────────────────────────────────────
  if (cleanedCN) {
    const exact = devices.find((d) => d.codename.toLowerCase() === cleanedCN);
    if (exact) {
      const brandOk = !brand || exact.brand.toLowerCase() === brand.toLowerCase();

      // تحقق إن الكودنيم مطابق للجهاز المكتوب
      if (!cleanedDev || brandOk) {
        return {
          codename:      exact.codename,
          canonicalName: exact.display_name,
          brand:         exact.brand,
          confidence:    1.0,
          matched:       true,
          suggestions:   [],
          isAmbiguous:   false,
        };
      }

      // الكودنيم موجود لكن اسم الجهاز مختلف
      const score = scoreMatch(tokenize(cleanedDev), exact);
      if (score > 0.5) {
        return {
          codename:      exact.codename,
          canonicalName: exact.display_name,
          brand:         exact.brand,
          confidence:    1.0,
          matched:       true,
          suggestions:   [],
          isAmbiguous:   false,
        };
      }
      // اسم الجهاز مش متوافق — كمّل للـ Phase 2 لاقتراح الصح
    }
  }

  // ── Phase 2: alias match ────────────────────────────────────────────────
  const searchTerm = cleanedDev || codenameInput;
  if (searchTerm) {
    const aliasNorm = searchTerm.toLowerCase().trim().replace(/\s+/g, " ");
    for (const d of devices) {
      const brandOk = !brand || d.brand.toLowerCase() === brand.toLowerCase();
      if (!brandOk) continue;
      const hit = (d.aliases || []).some(
        (a) => a.toLowerCase().replace(/\s+/g, " ") === aliasNorm
      );
      if (hit) {
        const warning = cleanedCN && cleanedCN !== d.codename
          ? `الكودنيم "${cleanedCN}" قد يكون خاطئاً — المقترح: "${d.codename}"`
          : undefined;
        return {
          codename:      d.codename,
          canonicalName: d.display_name,
          brand:         d.brand,
          confidence:    0.95,
          matched:       true,
          suggestions:   [],
          isAmbiguous:   false,
          warning,
        };
      }
    }
  }

  // ── Phase 3: fuzzy scoring ──────────────────────────────────────────────
  if (!searchTerm) {
    return {
      codename: cleanedCN || "",
      canonicalName: "", brand: brand || "",
      confidence: 0, matched: false, suggestions: [], isAmbiguous: false,
      warning: "أدخل اسم الجهاز أو الكودنيم",
    };
  }

  const queryTokens = tokenize(searchTerm);
  const filtered    = brand
    ? devices.filter((d) => d.brand.toLowerCase() === brand.toLowerCase())
    : devices;

  const scores = (filtered.length > 0 ? filtered : devices)
    .map((d) => ({ d, s: scoreMatch(queryTokens, d) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s);

  const top3 = scores.slice(0, 3);

  if (top3.length === 0) {
    return {
      codename:      cleanedCN || cleanCodename(searchTerm),
      canonicalName: cleanedDev,
      brand:         brand || "",
      confidence:    0.3,
      matched:       false,
      suggestions:   [],
      isAmbiguous:   false,
      warning: cleanedCN
        ? `الكودنيم "${cleanedCN}" غير موجود في قاعدة البيانات`
        : "الجهاز غير موجود — أدخل الكودنيم الرسمي يدوياً",
    };
  }

  const best    = top3[0];
  const second  = top3[1];
  const isAmbig = second !== undefined && second.s >= best.s * 0.85;

  const suggestions: MatchResult[] = top3.map((r) => ({
    codename:    r.d.codename,
    displayName: r.d.display_name,
    brand:       r.d.brand,
    confidence:  r.s,
    matchType:   r.s >= 0.95 ? "exact_name" : "fuzzy",
  }));

  let warning: string | undefined;
  if (cleanedCN && best.d.codename !== cleanedCN) {
    warning = `الكودنيم "${cleanedCN}" قد لا يكون صحيحاً — المقترح: "${best.d.codename}"`;
  } else if (isAmbig) {
    warning = "تم العثور على أجهزة متشابهة — اختر الجهاز الصحيح";
  }

  const finalCodename = best.s >= 0.7
    ? best.d.codename
    : (cleanedCN || cleanCodename(cleanedDev));

  return {
    codename:      finalCodename,
    canonicalName: best.d.display_name,
    brand:         best.d.brand,
    confidence:    best.s,
    matched:       best.s >= 0.7,
    suggestions,
    isAmbiguous:   isAmbig,
    warning,
  };
}

/** invalidate cache — يُستدعى بعد إضافة جهاز جديد */
export function invalidateDeviceCache(): void {
  UnifiedDeviceCache.get().invalidate();
}

/** للتوافق مع الكود القديم (sync wrapper) */
export function normalizeDevice(input: string) {
  const codename = cleanCodename(input);
  return {
    codename,
    canonicalName: input?.trim() || "",
    brand: "",
    confidence: codename ? 0.5 : 0,
    matched: !!codename,
  };
}
