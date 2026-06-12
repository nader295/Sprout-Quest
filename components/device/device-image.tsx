"use client";

/**
 * ══════════════════════════════════════════════════════
 * RomX Intelligent Device Image System — Client Layer
 * ══════════════════════════════════════════════════════
 *
 * الفلسفة: لا تخزين، كل حاجة تتجاب live.
 *
 * الترتيب:
 *   ① GSMArena CDN مباشرة (browser request — لا يُبلَك)
 *   ② Wikipedia API (مباشرة من المتصفح)
 *   ③ DuckDuckGo Instant Answer
 *   ④ Wikimedia Commons imageinfo
 *   ⑤ Placeholder ذكي بلون الـ brand
 *
 * كل المصادر تشتغل بالتوازي — أول صورة تنجح تظهر.
 * Memory cache بس لنفس الـ session (يتمسح مع refresh).
 */

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface DeviceImageProps {
  codename:      string;
  displayName:   string;
  brand:         string;
  storedUrl?:    string | null;
  className?:    string;
  imgClassName?: string;
  fallbackSize?: number;
}

// Session-only memory cache
const SESSION = new Map<string, string | null>();

// ── Brand placeholder colors ──────────────────────────────────────────
const BRAND_COLORS: Record<string, [string, string]> = {
  Samsung:  ["#1428A0", "#0A6EFF"],
  Google:   ["#1a73e8", "#34a853"],
  Xiaomi:   ["#FF6900", "#FF9800"],
  OnePlus:  ["#EB0029", "#FF5252"],
  Nothing:  ["#555555", "#888888"],
  Realme:   ["#FFD800", "#FF6D00"],
  Motorola: ["#5C2D91", "#9C27B0"],
  ASUS:     ["#00AEEF", "#0078D4"],
  OPPO:     ["#1D8348", "#27AE60"],
  Vivo:     ["#415FFF", "#7B8CFF"],
  Sony:     ["#003087", "#0057B7"],
  Huawei:   ["#CF0A2C", "#E53935"],
  Honor:    ["#007AFF", "#0A84FF"],
  ZTE:      ["#4CAF50", "#2E7D32"],
  Nokia:    ["#1565C0", "#1976D2"],
};

function SmartPlaceholder({ brand, name, size }: { brand: string; name: string; size: number }) {
  const [c1, c2] = BRAND_COLORS[brand] ?? ["#1e293b", "#334155"];
  const gid = `ph_${(brand + name).replace(/\W/g, "").slice(0, 8)}`;
  const initials = (brand || name).slice(0, 2).toUpperCase();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.45 }}>
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor={c1} stopOpacity="0.4" />
          <stop offset="100%" stopColor={c2} stopOpacity="0.15" />
        </linearGradient>
      </defs>
      {/* Phone body */}
      <rect x="27" y="8"  width="46" height="84" rx="10" fill={`url(#${gid})`} stroke={c1} strokeWidth="1.5" strokeOpacity="0.45" />
      <rect x="34" y="18" width="32" height="56" rx="3"  fill={c1} fillOpacity="0.06" />
      {/* Speaker + home */}
      <rect x="38" y="11" width="24" height="3" rx="1.5" fill={c1} fillOpacity="0.25" />
      <circle cx="50" cy="84" r="4" fill={c1} fillOpacity="0.2" />
      {/* Brand initials */}
      <text x="50" y="52" textAnchor="middle" dominantBaseline="middle"
        fontSize="17" fontWeight="900" fontFamily="monospace"
        fill={c1} fillOpacity="0.55">{initials}</text>
    </svg>
  );
}

// ── Race: جرّب URLs بالتوازي ─────────────────────────────────────────
function raceImageUrls(urls: string[]): Promise<string | null> {
  return new Promise(resolve => {
    if (!urls.length) { resolve(null); return; }
    let settled = false;
    let pending  = urls.length;
    const done = (winner: string | null) => {
      if (!settled) { settled = true; resolve(winner); }
    };
    for (const url of urls) {
      const img = new Image();
      const timer = setTimeout(() => {
        pending--;
        if (pending <= 0) done(null);
      }, 7000);
      img.onload = () => { clearTimeout(timer); done(url); };
      img.onerror = () => {
        clearTimeout(timer);
        pending--;
        if (pending <= 0 && !settled) done(null);
      };
      img.src = url;
    }
  });
}

// ── Image Validator ──────────────────────────────────────────────────
// يتحقق إن الصورة فعلاً صورة هاتف وليس logo أو banner
// يشتغل بعد تحميل الصورة — يفحص dimensions و URL
async function validateDeviceImage(url: string): Promise<boolean> {
  // فلتر URL أولاً — URL patterns اللي مش هواتف
  const low = url.toLowerCase();
  const BAD_PATTERNS = [
    "logo", "icon", "flag", "banner", "badge",
    "avatar", "user", "profile", "header", "thumb/",
    "commons-logo", "wikimedia-logo", "site-",
    "wikipedia-wordmark", "40px", "20px", "30px",
  ];
  if (BAD_PATTERNS.some(p => low.includes(p))) return false;

  // تحقق من الـ dimensions عبر تحميل الصورة
  return new Promise(resolve => {
    const img = new Image();
    const timer = setTimeout(() => resolve(false), 5000);
    img.onload = () => {
      clearTimeout(timer);
      const { naturalWidth: w, naturalHeight: h } = img;
      // رفض صور صغيرة جداً (أقل من 100px)
      if (w < 100 || h < 100) { resolve(false); return; }
      // رفض صور عرضها أكبر بكثير من طولها (banners, logos)
      const ratio = w / h;
      if (ratio > 1.5 || ratio < 0.3) { resolve(false); return; }
      // قبول صور ذات نسبة طول:عرض مناسبة للهاتف (0.4 - 1.2)
      resolve(true);
    };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    img.src = url;
  });
}

// ── Wikipedia: جيب URL الصورة مباشرة ─────────────────────────────────
async function fetchFromWikipedia(endpoint: string): Promise<string | null> {
  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const d = await res.json() as {
      query?: { pages?: Record<string, { thumbnail?: { source?: string }; original?: { source?: string } }> }
    };
    for (const page of Object.values(d.query?.pages ?? {})) {
      const src = page.original?.source || page.thumbnail?.source;
      if (src && src.includes("upload.wikimedia") && !/(logo|icon|flag|banner)/i.test(src)) {
        return src;
      }
    }
  } catch { /* ignore */ }
  return null;
}

// DuckDuckGo removed — CORS blocked from browser

// ── Wikimedia Commons imageinfo ───────────────────────────────────────
async function fetchFromCommons(name: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`${name} smartphone`);
    const searchRes = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${q}&srnamespace=6&srlimit=3&format=json&origin=*`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!searchRes.ok) return null;
    const sd = await searchRes.json() as { query?: { search?: Array<{ title: string }> } };
    const title = sd.query?.search?.[0]?.title;
    if (!title) return null;

    const fn = encodeURIComponent(title.replace("File:", "").replace(/ /g, "_"));
    const infoRes = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${fn}&prop=imageinfo&iiprop=url&iiurlwidth=500&format=json&origin=*`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!infoRes.ok) return null;
    const id = await infoRes.json() as {
      query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string }> }> }
    };
    for (const page of Object.values(id.query?.pages ?? {})) {
      const url = page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url;
      if (url && url.includes("upload.wikimedia") && !/(logo|icon|flag)/i.test(url)) return url;
    }
  } catch { /* ignore */ }
  return null;
}

// ── Main Component ────────────────────────────────────────────────────
export function DeviceImage({
  codename, displayName, brand,
  storedUrl,
  className, imgClassName, fallbackSize = 80,
}: DeviceImageProps) {
  const initSrc = storedUrl || SESSION.get(codename) || null;
  const initFailed = !storedUrl && SESSION.get(codename) === null;

  const [src,     setSrc]     = useState<string | null>(initSrc);
  const [loading, setLoading] = useState(!initSrc && !initFailed);
  const [failed,  setFailed]  = useState(initFailed);
  const alive = useRef(true);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    // storedUrl جاهز → اعرضه فوراً
    if (storedUrl) {
      setSrc(storedUrl); setLoading(false); setFailed(false);
      return;
    }

    // session cache
    if (SESSION.has(codename)) {
      const c = SESSION.get(codename)!;
      setSrc(c); setFailed(!c); setLoading(false);
      return;
    }

    setLoading(true); setSrc(null); setFailed(false);
    let cancelled = false;

    (async () => {
      try {
        // ① جيب القائمة من السيرفر
        const qs = new URLSearchParams({ name: displayName, brand });
        const res = await fetch(`/api/device-image/${encodeURIComponent(codename)}?${qs}`);
        if (!res.ok || cancelled) throw new Error("api");

        const d = await res.json() as {
          gsmaUrls:       string[];
          wikiEndpoints:  string[];
          ddgEndpoint:    string;
        };

        // ② Race بين كل المصادر بالتوازي
        const [gsmaWinner, wikiWinner, , commonsWinner] = await Promise.all([
          // GSMArena — المتصفح يحمّلها مباشرة (لا يُبلَك)
          raceImageUrls(d.gsmaUrls),

          // Wikipedia — أول endpoint
          d.wikiEndpoints[0]
            ? fetchFromWikipedia(d.wikiEndpoints[0])
            : Promise.resolve(null),

          // DuckDuckGo removed (CORS)
          Promise.resolve(null),

          // Wikimedia Commons
          fetchFromCommons(displayName),
        ]);

        if (cancelled || !alive.current) return;

        // الترتيب: GSMArena > Wikipedia > Commons > DDG
        const candidates = [gsmaWinner, wikiWinner, commonsWinner].filter(Boolean) as string[];

        // Validate: جرّب كل candidate بالترتيب لحد ما تلاقي صورة valid
        let winner: string | null = null;
        for (const candidate of candidates) {
          const valid = await validateDeviceImage(candidate);
          if (valid) { winner = candidate; break; }
        }
        // لو كلهم فشلوا في الـ validation — خد أول واحد بدون validation
        if (!winner && candidates.length > 0) winner = candidates[0];

        SESSION.set(codename, winner);
        setSrc(winner);
        setFailed(!winner);
        setLoading(false);

        // ② Save successful URL to Supabase (background - persistent cache)
        // بيخزن الـ URL الناجح عشان ما يتجيبش من برا كل مرة
        if (winner) {
          // Fire & forget: save winning URL to server cache. Repeated failures
          // here would mean every pageview hits external CDNs (cost + latency),
          // so surface the cause to Sentry even though UX continues unaffected.
          fetch(`/api/device-image/${encodeURIComponent(codename)}/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: winner }),
          }).catch((err) => {
            // Lazy import to keep logger out of the critical render path.
            import("@/lib/logger").then(({ logger }) =>
              logger.error("device.image.saveWinner", err, { codename }),
            );
          });
        }

      } catch {
        if (!alive.current) return;
        SESSION.set(codename, null);
        setFailed(true);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codename, displayName, brand, storedUrl]);

  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden", className)}>
      {/* Shimmer أثناء التحميل */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-3/5 w-2/5 rounded-2xl bg-white/5 animate-pulse" />
        </div>
      )}

      {/* الصورة */}
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={displayName}
          loading="lazy"
          decoding="async"
          className={cn(
            "object-contain mix-blend-multiply dark:mix-blend-normal drop-shadow-xl saturate-[1.05] contrast-[1.02] hover:scale-105 transition-all duration-500",
            imgClassName
          )}
          onError={() => {
            SESSION.set(codename, null);
            setSrc(null); setFailed(true);
          }}
        />
      )}

      {/* Placeholder ذكي */}
      {!loading && (failed || !src) && (
        <SmartPlaceholder brand={brand} name={displayName} size={fallbackSize} />
      )}
    </div>
  );
}
