/**
 * lib/server/devices-cache.ts — Server-Side Device Cache
 *
 * المشكلة الأصلية:
 *   كل request لـ /api/devices يعمل 2 queries على Supabase:
 *   1. devices table  (ILIKE scan)
 *   2. roms table
 *   = مئات القراءات يومياً
 *
 * الحل:
 *   - Load مرة واحدة عند أول request
 *   - Refresh تلقائي كل 10 دقايق (في الخلفية)
 *   - كل البحث والفلترة تتم في الذاكرة
 *   - 0 Supabase reads لأي query بعد التحميل
 */

import { sbAdmin } from "@/lib/supabase/admin";

export interface DeviceCacheEntry {
  codename: string;
  name: string;
  brand: string;
  chipset: string;
  released: string;
  imageUrl: string | null;
  romCount: number;
  breakdown: { rom: number; kernel: number; recovery: number; module: number; gsi: number };
  // للبحث السريع
  _search: string; // lowercase: "codename name brand"
}

interface CacheState {
  items: DeviceCacheEntry[];
  total: number;
  loadedAt: number;
  loading: boolean;
}

// Global cache — يعيش طول حياة الـ serverless instance
const _g = global as typeof global & { _devCache?: CacheState };

function getCache(): CacheState {
  if (!_g._devCache) {
    _g._devCache = { items: [], total: 0, loadedAt: 0, loading: false };
  }
  return _g._devCache;
}

const CACHE_TTL = 10 * 60 * 1000; // 10 دقايق

// ── Load من Supabase ──────────────────────────────────────────────────
async function loadFromSupabase(): Promise<DeviceCacheEntry[]> {
  type Breakdown = { rom: number; kernel: number; recovery: number; module: number; gsi: number };

  // جيب الأجهزة و ROMs بالتوازي
  const [devRes, romRes] = await Promise.all([
    sbAdmin
      .from("devices")
      .select("codename, display_name, brand, chipset, released, image_url")
      .limit(500),

    sbAdmin
      .from("roms")
      .select("device_codename, device, brand, content_type")
      .neq("device_codename", "")
      .not("device_codename", "is", null)
      .in("rom_status", ["active", "beta", "testing"])
      .limit(5000),
  ]);

  // فهرسة devices
  type DevRow = { codename: string; display_name: string; brand: string; chipset: string; released: string; image_url: string | null };
  const devIndex = new Map<string, DevRow>(
    ((devRes.data || []) as DevRow[]).map(d => [d.codename.toLowerCase(), d])
  );

  // احسب counts وbreakdown من roms
  const countMap = new Map<string, { name: string; brand: string; romCount: number; breakdown: Breakdown }>();
  for (const row of (romRes.data || []) as { device_codename: string; device: string; brand: string; content_type: string }[]) {
    const cn = row.device_codename?.toLowerCase();
    if (!cn) continue;
    const ct = (row.content_type || "rom") as keyof Breakdown;
    const ex = countMap.get(cn);
    if (ex) {
      ex.romCount++;
      if (ct in ex.breakdown) ex.breakdown[ct]++;
    } else {
      const bd: Breakdown = { rom: 0, kernel: 0, recovery: 0, module: 0, gsi: 0 };
      if (ct in bd) bd[ct] = 1;
      countMap.set(cn, { name: row.device || cn, brand: row.brand || "", romCount: 1, breakdown: bd });
    }
  }

  // ابنِ final list
  const items: DeviceCacheEntry[] = [];
  for (const [cn, cnt] of countMap) {
    const dev = devIndex.get(cn);
    const name = dev?.display_name ?? cnt.name;
    const brand = dev?.brand ?? cnt.brand;
    items.push({
      codename: cn,
      name,
      brand,
      chipset: dev?.chipset ?? "",
      released: dev?.released ?? "",
      imageUrl: dev?.image_url ?? null,
      romCount: cnt.romCount,
      breakdown: cnt.breakdown,
      _search: `${cn} ${name} ${brand}`.toLowerCase(),
    });
  }

  // ترتيب بـ romCount تنازلياً
  items.sort((a, b) => b.romCount - a.romCount);
  return items;
}

// ── Refresh في الخلفية (non-blocking) ─────────────────────────────────
function scheduleRefresh() {
  const cache = getCache();
  if (cache.loading) return;
  cache.loading = true;
  loadFromSupabase()
    .then(items => {
      cache.items = items;
      cache.total = items.length;
      cache.loadedAt = Date.now();
    })
    .catch(err => console.error("[DevicesCache] refresh error:", err))
    .finally(() => { cache.loading = false; });
}

// ── Get — الـ function الرئيسية ────────────────────────────────────────
export async function getDevicesCache(): Promise<CacheState> {
  const cache = getCache();
  const now = Date.now();

  // أول مرة — load بشكل blocking
  if (cache.loadedAt === 0) {
    cache.loading = true;
    try {
      const items = await loadFromSupabase();
      cache.items = items;
      cache.total = items.length;
      cache.loadedAt = now;
    } catch (err) {
      console.error("[DevicesCache] initial load error:", err);
    } finally {
      cache.loading = false;
    }
    return cache;
  }

  // Cache منتهي → refresh في الخلفية، ارجع البيانات القديمة فوراً (SWR)
  if (now - cache.loadedAt > CACHE_TTL) {
    scheduleRefresh();
  }

  return cache;
}

// ── Search في الذاكرة (بدون Supabase) ─────────────────────────────────
export function searchDevicesInMemory(
  items: DeviceCacheEntry[],
  opts: { q?: string; brand?: string; page?: number; limit?: number }
): { items: DeviceCacheEntry[]; total: number; totalPages: number } {
  const { q, brand, page = 1, limit = 24 } = opts;
  const ql = q?.toLowerCase().trim();

  let filtered = items;

  if (brand) {
    const bl = brand.toLowerCase();
    // Brand aliases: Poco/Redmi → Xiaomi, iQOO → Vivo
    const BRAND_ALIASES: Record<string, string> = {
      poco: "xiaomi", redmi: "xiaomi", iqoo: "vivo", nubia: "zte",
    };
    const canonical = BRAND_ALIASES[bl] || bl;
    filtered = filtered.filter(d => {
      const db = d.brand.toLowerCase();
      const dc = BRAND_ALIASES[db] || db;
      return dc === canonical || db === bl;
    });
  }

  if (ql && ql.length >= 2) {
    filtered = filtered.filter(d => d._search.includes(ql));
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  return { items: paginated, total, totalPages };
}

// ── Invalidate — يُستدعى عند رفع ROM جديد ────────────────────────────
export function invalidateDevicesCache() {
  const cache = getCache();
  cache.loadedAt = 0; // force reload عند أول request قادم
}
