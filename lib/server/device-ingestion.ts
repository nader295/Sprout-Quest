/**
 * lib/server/device-ingestion.ts
 *
 * نظام الاستيعاب التلقائي للأجهزة من مصادر موثوقة:
 *  1. LineageOS devices.json  — codenames رسمية + أسماء موثوقة
 *  2. TWRP device list        — أجهزة recovery رسمية
 *  3. Android certified list  — أجهزة معتمدة من Google
 *  4. Wikipedia API           — تفاصيل + صور
 *
 * يُستدعى من:
 *  - /api/cron (مرة يومياً)
 *  - /api/admin/backfill-devices
 *  - عند رفع ROM بجهاز غير موجود
 */

import { sbAdmin } from "@/lib/supabase/admin";

export interface IngestedDevice {
  codename: string;
  display_name: string;
  brand: string;
  chipset?: string;
  released?: string;
  image_url?: string;
  aliases: string[];
  variant_words: string[];
  source: string;
}

// ── Brand normalization ───────────────────────────────────────────────
const BRAND_MAP: Record<string, string> = {
  samsung: "Samsung", google: "Google", xiaomi: "Xiaomi", poco: "Xiaomi",
  redmi: "Xiaomi", oneplus: "OnePlus", nothing: "Nothing", realme: "Realme",
  motorola: "Motorola", moto: "Motorola", asus: "ASUS", oppo: "OPPO",
  vivo: "Vivo", iqoo: "Vivo", huawei: "Huawei", honor: "Honor",
  sony: "Sony", nokia: "Nokia", tcl: "TCL", zte: "ZTE",
  nubia: "ZTE", "red magic": "ZTE", tecno: "Tecno", infinix: "Infinix",
  fairphone: "Fairphone", shift: "SHIFT", cat: "CAT", blackview: "Blackview",
};

function normalizeBrand(raw: string): string {
  const l = raw.toLowerCase().trim();
  for (const [k, v] of Object.entries(BRAND_MAP)) {
    if (l === k || l.startsWith(k + " ") || l.startsWith(k + "_")) return v;
  }
  return raw.split(/[\s_]/)[0].replace(/^\w/, c => c.toUpperCase());
}

// ── Build display name from codename (fallback) ────────────────────────
function buildDisplayName(codename: string, brand: string, raw?: string): string {
  if (raw && raw.length > 2 && !raw.match(/^[a-z0-9_]+$/)) return raw;
  // استنتاج اسم من الكودنيم (آخر خيار)
  return `${brand} (${codename})`;
}

// ── Generate aliases from device name ─────────────────────────────────
function generateAliases(name: string, brand: string, codename: string): string[] {
  const aliases: string[] = [];
  const nl = name.toLowerCase().trim();
  const bl = brand.toLowerCase();

  aliases.push(nl);

  // بدون اسم الـ brand
  const withoutBrand = nl.replace(bl, "").replace(/\s+/g, " ").trim();
  if (withoutBrand && withoutBrand !== nl) aliases.push(withoutBrand);

  // بدون مسافات
  aliases.push(nl.replace(/\s+/g, ""));

  // تقصير رقم الموديل: "Galaxy S25 Ultra" → "s25u", "s25 ultra"
  const modelMatch = nl.match(/([a-z])(\d+)\s*(ultra|pro|plus|\+|max|lite|fe|note|fold|flip)?/i);
  if (modelMatch) {
    const [, letter, num, suffix] = modelMatch;
    if (suffix) {
      aliases.push(`${letter}${num}${suffix[0]}`); // s25u
      aliases.push(`${letter}${num} ${suffix}`);    // s25 ultra
    }
    aliases.push(`${letter}${num}`); // s25
  }

  // أضف الكودنيم كـ alias
  if (codename) aliases.push(codename);

  return [...new Set(aliases.filter(a => a.length > 1))].slice(0, 8);
}

// ── Extract variant words ─────────────────────────────────────────────
function extractVariantWords(name: string): string[] {
  const variants = ["pro", "ultra", "plus", "max", "lite", "se", "fe", "note",
    "fold", "flip", "mini", "edge", "neo", "play", "turbo", "speed", "active"];
  const words = name.toLowerCase().split(/\s+/);
  const result: string[] = [];

  for (const w of words) {
    if (variants.includes(w)) result.push(w);
    if (/^[a-z]\d+[a-z]?$/.test(w)) result.push(w); // s25, a55, x7
    if (/^\d+$/.test(w) && parseInt(w) > 1 && parseInt(w) < 100) result.push(w); // 13, 14
  }
  return [...new Set(result)];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SOURCE 1: LineageOS devices (GitHub JSON)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface LineageDevice {
  codename: string;
  vendor: string;
  name: string;
  models?: string[];
  cpu?: string;
  versions?: number[];
}

async function fetchLineageOS(): Promise<IngestedDevice[]> {
  try {
    // مصدر رسمي: LineageOS website devices.json
    const res = await fetch(
      "https://raw.githubusercontent.com/lineageos/lineageos.github.io/main/_data/devices.json",
      { signal: AbortSignal.timeout(15000), next: { revalidate: 86400 } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();

    // الملف عبارة عن object بمفاتيح codenames
    let data: Record<string, LineageDevice | LineageDevice[]>;
    try { data = JSON.parse(raw); } catch { return []; }

    const devices: IngestedDevice[] = [];

    for (const [key, val] of Object.entries(data)) {
      // قد يكون array أو object واحد
      const entries = Array.isArray(val) ? val : [val];
      for (const d of entries) {
        if (!d.codename || !d.vendor || !d.name) continue;

        const brand = normalizeBrand(d.vendor);
        const codename = d.codename.toLowerCase().trim();
        const name = d.name.trim();

        devices.push({
          codename,
          display_name: name,
          brand,
          chipset: d.cpu || "",
          released: d.versions ? `${Math.max(...d.versions.map(v => 2013 + (v - 11)))}` : "",
          aliases: generateAliases(name, brand, codename),
          variant_words: extractVariantWords(name),
          source: "lineageos",
        });
      }
    }

    return devices;
  } catch (e) {
    console.warn("[DeviceIngestion] LineageOS fetch failed:", e);
    return [];
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SOURCE 2: TWRP Device List (GitHub)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function fetchTWRP(): Promise<IngestedDevice[]> {
  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/TeamWin/twrp_device_database/master/devices.json",
      { signal: AbortSignal.timeout(10000), next: { revalidate: 86400 } }
    );
    if (!res.ok) return [];
    const data = await res.json() as Array<{
      codename?: string; oem?: string; name?: string; cpu?: string
    }>;
    if (!Array.isArray(data)) return [];

    return data
      .filter(d => d.codename && d.oem && d.name)
      .map(d => {
        const brand = normalizeBrand(d.oem!);
        const codename = d.codename!.toLowerCase().trim();
        const name = d.name!.trim();
        return {
          codename,
          display_name: name,
          brand,
          chipset: d.cpu || "",
          aliases: generateAliases(name, brand, codename),
          variant_words: extractVariantWords(name),
          source: "twrp",
        };
      });
  } catch {
    return [];
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SOURCE 3: PhoneScraper (GitHub open dataset)
// أجهزة 2023-2025 من datasets مفتوحة
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function fetchOpenDataset(): Promise<IngestedDevice[]> {
  const sources = [
    // Dataset من مطوري Android مجتمع
    "https://raw.githubusercontent.com/androidtrackers/certified-android-devices/master/by_device.json",
  ];

  for (const url of sources) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(12000),
        next: { revalidate: 86400 }
      });
      if (!res.ok) continue;
      const data = await res.json() as Record<string, Array<{
        brand?: string; name?: string; model?: string
      }>>;
      if (typeof data !== "object") continue;

      const devices: IngestedDevice[] = [];
      for (const [codename, entries] of Object.entries(data)) {
        if (!Array.isArray(entries) || entries.length === 0) continue;
        const entry = entries[0];
        if (!entry.brand || !entry.name) continue;

        const brand = normalizeBrand(entry.brand);
        const cn = codename.toLowerCase().trim();
        const name = entry.name.trim();

        devices.push({
          codename: cn,
          display_name: name,
          brand,
          aliases: generateAliases(name, brand, cn),
          variant_words: extractVariantWords(name),
          source: "certified-android",
        });
      }
      if (devices.length > 10) return devices;
    } catch { continue; }
  }
  return [];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SOURCE 4: Wikipedia — صورة لجهاز محدد
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function fetchWikipediaImageForDevice(deviceName: string): Promise<string | null> {
  const queries = [
    deviceName,
    `${deviceName} (smartphone)`,
    deviceName.replace(/\s+/g, "_"),
  ];

  for (const q of queries) {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(q)}&prop=pageimages&format=json&pithumbsize=600&piprop=thumbnail&redirects=1`;
      const res = await fetch(url, {
        headers: { "User-Agent": "RomX/2.0 (romx.app)" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const data = await res.json() as {
        query?: { pages?: Record<string, { thumbnail?: { source?: string } }> }
      };
      for (const page of Object.values(data.query?.pages ?? {})) {
        const src = page.thumbnail?.source;
        if (src && !src.includes("Flag_") && !src.includes("Logo_") && !src.includes("Wikimedia")) {
          return src;
        }
      }
    } catch { continue; }
  }
  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN: runDeviceIngestion
// يجمع كل المصادر ويحفظ في Supabase
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function runDeviceIngestion(opts: {
  sources?: ("lineageos" | "twrp" | "certified")[];
  limit?: number;
  skipExisting?: boolean;
} = {}): Promise<{ added: number; updated: number; total: number; errors: string[] }> {

  const {
    sources = ["lineageos", "twrp", "certified"],
    limit = 500,
    skipExisting = true,
  } = opts;

  const errors: string[] = [];
  const allDevices: IngestedDevice[] = [];

  // ── جمع الأجهزة من المصادر بالتوازي ─────────────────────────────────
  const fetches: Promise<IngestedDevice[]>[] = [];
  if (sources.includes("lineageos")) fetches.push(fetchLineageOS().catch(e => { errors.push(`lineageos: ${e}`); return []; }));
  if (sources.includes("twrp"))      fetches.push(fetchTWRP().catch(e => { errors.push(`twrp: ${e}`); return []; }));
  if (sources.includes("certified")) fetches.push(fetchOpenDataset().catch(e => { errors.push(`certified: ${e}`); return []; }));

  const results = await Promise.all(fetches);
  for (const r of results) allDevices.push(...r);

  if (allDevices.length === 0) {
    return { added: 0, updated: 0, total: 0, errors };
  }

  // ── إزالة التكرارات (codename فريد) ──────────────────────────────────
  const uniqueMap = new Map<string, IngestedDevice>();
  for (const d of allDevices) {
    if (!uniqueMap.has(d.codename)) uniqueMap.set(d.codename, d);
    else {
      // دمج الـ aliases
      const existing = uniqueMap.get(d.codename)!;
      existing.aliases = [...new Set([...existing.aliases, ...d.aliases])];
      // اختر المصدر الأقوى (lineageos > certified > twrp)
      if (d.source === "lineageos") uniqueMap.set(d.codename, { ...d, aliases: existing.aliases });
    }
  }

  const devices = Array.from(uniqueMap.values()).slice(0, limit);

  // ── جلب codenames الموجودة في Supabase ───────────────────────────────
  let existingCodes = new Set<string>();
  if (skipExisting) {
    try {
      const { data } = await sbAdmin.from("devices").select("codename").limit(5000);
      existingCodes = new Set((data || []).map((d: { codename: string }) => d.codename));
    } catch (e) { errors.push(`fetch existing: ${e}`); }
  }

  // ── Upsert في Supabase (batch لتقليل الـ writes) ─────────────────────
  const toInsert = skipExisting
    ? devices.filter(d => !existingCodes.has(d.codename))
    : devices;

  let added = 0, updated = 0;
  const BATCH = 50; // 50 في كل مرة

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH).map(d => ({
      codename:      d.codename,
      display_name:  d.display_name,
      brand:         d.brand,
      chipset:       d.chipset || "",
      released:      d.released || "",
      image_url:     d.image_url || null,
      aliases:       d.aliases,
      variant_words: d.variant_words,
      updated_at:    new Date().toISOString(),
    }));

    try {
      const { error } = await sbAdmin
        .from("devices")
        .upsert(batch, { onConflict: "codename", ignoreDuplicates: skipExisting });

      if (error) { errors.push(`batch ${i}: ${error.message}`); continue; }

      added += skipExisting ? batch.length : 0;
      updated += skipExisting ? 0 : batch.length;
    } catch (e) {
      errors.push(`batch ${i}: ${e}`);
    }
  }

  if (!skipExisting) {
    updated = toInsert.length;
    added   = 0;
  } else {
    added = toInsert.length - errors.length;
  }

  return { added, updated, total: devices.length, errors };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Auto-ingest device عند رفع ROM بجهاز غير معروف
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function autoIngestDevice(
  codename: string,
  deviceName: string,
  brand: string
): Promise<void> {
  if (!codename || !deviceName) return;

  try {
    // تحقق لو موجود أصلاً
    const { data } = await sbAdmin
      .from("devices")
      .select("codename")
      .eq("codename", codename)
      .maybeSingle();
    if (data) return; // موجود — مش محتاج نضيف

    // حاول تجيب صورة من Wikipedia
    const imageUrl = await fetchWikipediaImageForDevice(deviceName).catch(() => null);

    const normalizedBrand = normalizeBrand(brand || deviceName.split(" ")[0]);

    await sbAdmin.from("devices").upsert({
      codename,
      display_name:  deviceName,
      brand:         normalizedBrand,
      chipset:       "",
      released:      new Date().getFullYear().toString(),
      image_url:     imageUrl,
      aliases:       generateAliases(deviceName, normalizedBrand, codename),
      variant_words: extractVariantWords(deviceName),
      updated_at:    new Date().toISOString(),
    }, { onConflict: "codename", ignoreDuplicates: true });

  } catch (e) {
    console.warn("[AutoIngest] failed for", codename, e);
  }
}
