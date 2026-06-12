"use client";
import React from "react";
import { motion } from "framer-motion";
// ── Module-level device image cache (shared across all card instances) ──────
// Prevents multiple simultaneous API calls for the same device
const deviceImgCache = new Map<string, string | null>();
const deviceImgInFlight = new Map<string, Promise<string | null>>();
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Eye, Heart, Download, MessageSquare,
  Star, Cpu, HardDrive, Puzzle, Globe, Smartphone, CheckCircle2,
} from "lucide-react";
import { formatCount, getStatusColor, getContentTypeLabel, timeAgo, cn } from "@/lib/utils";
import { DEFAULT_AVATAR } from "@/lib/constants";
import { safeImg } from "@/lib/utils";
import { getThumbnailUrl, getAvatarUrl } from "@/lib/cloudinary-utils";
import type { RomItem } from "@/lib/types";
import { useTranslation } from "@/lib/i18n";

const TYPE_META: Record<string, { icon: React.ElementType; color: string; bg: string; accent: string; pill: string }> = {
  rom:      { icon: Smartphone, color: "text-sky-300",     bg: "bg-sky-500/10 border-sky-500/25",       accent: "#38bdf8", pill: "#0ea5e920" },
  kernel:   { icon: Cpu,        color: "text-violet-300",  bg: "bg-violet-500/10 border-violet-500/25", accent: "#a78bfa", pill: "#8b5cf620" },
  recovery: { icon: HardDrive,  color: "text-amber-300",   bg: "bg-amber-500/10 border-amber-500/25",   accent: "#fcd34d", pill: "#f59e0b20" },
  module:   { icon: Puzzle,     color: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/25", accent: "#6ee7b7", pill: "#10b98120" },
  gsi:      { icon: Globe,      color: "text-rose-300",    bg: "bg-rose-500/10 border-rose-500/25",     accent: "#fda4af", pill: "#f43f5e20" },
};

// ── Device thumbnail (unchanged logic, improved visuals) ────────────────────
function DeviceThumb({ codename, name, brand, accent }: {
  codename: string; name: string; brand: string; accent: string;
}) {
  const [src, setSrc] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!codename) return;
    const cacheKey = "ri_v3_" + codename;

    // 1. Memory cache (fastest — avoids any async work)
    if (deviceImgCache.has(cacheKey)) {
      setSrc(deviceImgCache.get(cacheKey) ?? null);
      return;
    }

    // 2. sessionStorage cache
    try {
      const stored = sessionStorage?.getItem?.(cacheKey);
      if (stored !== null && stored !== undefined) {
        const val = stored === "null" ? null : stored;
        deviceImgCache.set(cacheKey, val);
        setSrc(val);
        return;
      }
    } catch { /* ignore */ }

    // 3. Dedup in-flight requests for same codename
    const existing = deviceImgInFlight.get(cacheKey);
    if (existing) {
      existing.then(val => { setSrc(val); });
      return;
    }

    // 4. Fetch with dedup
    const fetchPromise = (async (): Promise<string | null> => {
      try {
        const params = new URLSearchParams({ name, brand });
        const d = await fetch(`/api/device-image/${encodeURIComponent(codename)}?${params}`)
          .then(r => r.ok ? r.json() : null);
        if (!d) return null;

        const gsmaUrls: string[] = d.gsmaUrls || [];
        for (const url of gsmaUrls.slice(0, 4)) {
          const ok = await new Promise<boolean>(res => {
            const img = new window.Image();
            img.onload = () => res(true);
            img.onerror = () => res(false);
            img.src = url;
            setTimeout(() => res(false), 3000);
          });
          if (ok) return url;
        }

        if (d.wikiEndpoint) {
          try {
            const wr = await fetch(d.wikiEndpoint, { signal: AbortSignal.timeout(4000) });
            const wd = await wr.json() as { query?: { pages?: Record<string, { thumbnail?: { source?: string } }> } };
            for (const pg of Object.values(wd.query?.pages ?? {})) {
              const wsrc = pg.thumbnail?.source;
              if (wsrc && !/(logo|icon|flag)/i.test(wsrc)) return wsrc;
            }
          } catch { /* ignore */ }
        }
        return null;
      } catch { return null; }
    })();

    deviceImgInFlight.set(cacheKey, fetchPromise);
    fetchPromise.then(val => {
      deviceImgCache.set(cacheKey, val);
      try { sessionStorage.setItem(cacheKey, val ?? "null"); } catch { /* ignore */ }
      deviceImgInFlight.delete(cacheKey);
      setSrc(val);
    });
  }, [codename, name, brand]);

  // ── Fallback: stylized phone outline (replaces the giant single-letter placeholder) ──
  if (!src) return (
    <div className="absolute end-0 top-0 bottom-0 w-2/3 flex items-center justify-center pointer-events-none">
      <svg
        viewBox="0 0 64 112"
        className="h-[72%] w-auto"
        fill="none"
        aria-hidden="true"
        style={{ filter: `drop-shadow(-8px 0 24px ${accent}40)` }}
      >
        {/* Phone body */}
        <rect
          x="4" y="4" width="56" height="104" rx="10"
          stroke={accent}
          strokeOpacity="0.45"
          strokeWidth="1.5"
          fill={`${accent}0c`}
        />
        {/* Inner screen */}
        <rect
          x="8" y="14" width="48" height="84" rx="4"
          stroke={accent}
          strokeOpacity="0.25"
          strokeWidth="1"
          fill={`${accent}08`}
        />
        {/* Speaker slit */}
        <rect x="26" y="8" width="12" height="2" rx="1" fill={accent} fillOpacity="0.5" />
        {/* Home indicator */}
        <rect x="24" y="102" width="16" height="2" rx="1" fill={accent} fillOpacity="0.5" />
        {/* Subtle inner grid hint */}
        <line x1="8" y1="40" x2="56" y2="40" stroke={accent} strokeOpacity="0.12" strokeWidth="1" />
        <line x1="8" y1="64" x2="56" y2="64" stroke={accent} strokeOpacity="0.12" strokeWidth="1" />
      </svg>
    </div>
  );

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name}
      className="absolute end-0 top-0 h-full w-auto max-w-[65%] object-contain object-right drop-shadow-2xl transition-transform duration-500 group-hover:scale-[1.07]"
      style={{ filter: `drop-shadow(-10px 0 28px ${accent}50)` }}
    />
  );
}

// ── Main RomCard ─────────────────────────────────────────────────────────────
function RomCardInner({ rom }: { rom: RomItem }) {
  const { t } = useTranslation();
  const router = useRouter();
  const statusClasses = getStatusColor(rom.romStatus);
  const typeLabel = getContentTypeLabel(rom.contentType || "rom");
  const typeMeta = TYPE_META[rom.contentType || "rom"] || TYPE_META.rom;
  const TypeIcon = typeMeta.icon;
  const hasThumb = !!(rom.thumbnail && rom.thumbnail.includes("cloudinary.com"));
  const showRating = (rom.ratingCount || 0) >= 3;

  // ── Press ripple effect ──
  const [ripple, setRipple] = React.useState<{ x: number; y: number; id: number } | null>(null);
  const cardRef = React.useRef<HTMLElement>(null);
  const triggerRipple = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const id = Date.now();
    setRipple({ x: clientX - rect.left, y: clientY - rect.top, id });
    setTimeout(() => setRipple(r => r?.id === id ? null : r), 550);
  };

  return (
    <motion.article
      ref={cardRef}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.05] bg-[#0a0e17] flex flex-col cursor-pointer"
      style={{
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        contain: "layout style",
      }}
      whileHover={{
        y: -3,
        boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${typeMeta.accent}30`,
        borderColor: `${typeMeta.accent}30`,
        transition: { type: "spring", stiffness: 400, damping: 25 },
      }}
      whileTap={{ scale: 0.985 }}
      onMouseDown={triggerRipple}
      onTouchStart={triggerRipple}
      onMouseEnter={() => router.prefetch(`/rom/${rom.id}`)}
    >
      {/* ── Full-card invisible link ── */}
      <Link href={`/rom/${rom.id}`} className="absolute inset-0 z-[1] focus-visible:outline-none" aria-label={rom.name} tabIndex={-1} />

      {/* ── Glass sheen (Figma-inspired hover micro-interaction) ──
          A diagonal highlight sweeps across the card on hover to suggest depth
          and polish. Decorative only; pointer-events disabled so it never blocks
          the click surface above. Respects reduced-motion via CSS. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[2] overflow-hidden rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 motion-reduce:hidden"
      >
        <span
          className="absolute -inset-y-8 -inset-x-1/2 -translate-x-full group-hover:translate-x-full transition-transform duration-[1100ms] ease-out"
          style={{
            background: "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.07) 50%, transparent 65%)",
          }}
        />
      </span>

      {/* ── Ripple effect ── */}
      {ripple && (
        <span
          key={ripple.id}
          className="pointer-events-none absolute rounded-full"
          style={{
            left: ripple.x - 60,
            top: ripple.y - 60,
            width: 120,
            height: 120,
            background: `radial-gradient(circle, ${typeMeta.accent}35 0%, transparent 70%)`,
            animation: "rc-ripple 0.55s cubic-bezier(0.4,0,0.2,1) forwards",
            zIndex: 50,
          }}
        />
      )}
      {/* ── Thumbnail ── */}
      <Link
        href={`/rom/${rom.id}`}
        className="relative z-[2] block aspect-[16/9] overflow-hidden bg-[#070a12] flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{ focusRingColor: typeMeta.accent } as React.CSSProperties}
        aria-label={rom.name}
        tabIndex={0}
      >
        {hasThumb ? (
          <Image
            src={getThumbnailUrl(rom.thumbnail)}
            alt={rom.name}
            fill
            loading="lazy"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            sizes="(max-width: 480px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div
            className="relative flex h-full w-full items-center justify-end overflow-hidden"
            style={{ background: `linear-gradient(145deg, ${typeMeta.accent}18 0%, #06090f 55%, ${typeMeta.accent}06 100%)` }}
          >
            {/* Dot mesh */}
            <div className="absolute inset-0 opacity-[0.035]"
              style={{ backgroundImage: `radial-gradient(${typeMeta.accent} 1px, transparent 1px)`, backgroundSize: "16px 16px" }} />
            {/* Glow blob */}
            <div className="absolute -top-8 -start-8 h-32 w-32 rounded-full blur-3xl pointer-events-none"
              style={{ background: `${typeMeta.accent}18` }} />
            {/* Watermark icon */}
            <div className="absolute start-4 top-1/2 -translate-y-1/2 opacity-[0.06]">
              <TypeIcon className="h-20 w-20" style={{ color: typeMeta.accent }} />
            </div>
            {/* Device image */}
            {rom.deviceCodename ? (
              <DeviceThumb
                codename={rom.deviceCodename}
                name={rom.device || ""}
                brand={rom.brand || ""}
                accent={typeMeta.accent}
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <TypeIcon className={cn("h-12 w-12", typeMeta.color)} style={{ opacity: 0.1 }} />
              </div>
            )}
            {/* Bottom gradient */}
            <div className="absolute inset-x-0 bottom-0 h-12 pointer-events-none"
              style={{ background: "linear-gradient(to top, rgba(6,9,15,1) 0%, transparent 100%)" }} />
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />

        {/* Top badges */}
        <div className="absolute start-2.5 top-2.5 flex gap-1.5 flex-wrap">
          {rom.featured && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white shadow-lg"
              style={{ boxShadow: "0 0 10px rgba(245,158,11,0.35)" }}>
              ★ {t("rom.featured")}
            </span>
          )}
          <span className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black", typeMeta.bg, typeMeta.color)}>
            <TypeIcon className="h-2.5 w-2.5" /> {typeLabel}
          </span>
        </div>

        {/* Status badge top-end */}
        <span className={cn("absolute end-2.5 top-2.5 rounded-full border px-2 py-0.5 text-[10px] font-black", statusClasses)}>
          {t(`status.${rom.romStatus || "active"}`)}
        </span>

        {/* Bottom: rating */}
        <div className="absolute inset-x-0 bottom-0 p-2.5 flex items-end justify-between">
          {showRating && (
            <div className="flex items-center gap-0.5 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-sm">
              <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
              <span className="text-[10px] font-black text-white">{rom.ratingAvg?.toFixed(1)}</span>
              <span className="text-[9px] text-white/50">({rom.ratingCount})</span>
            </div>
          )}
          {/* Hover pill */}
          <div className="ms-auto flex items-center gap-1.5 rounded-full px-2.5 py-1 translate-y-1.5 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 backdrop-blur-sm"
            style={{ background: `${typeMeta.accent}25`, border: `1px solid ${typeMeta.accent}35` }}>
            <Download className="h-3 w-3" style={{ color: typeMeta.accent }} />
            <span className="text-[10px] font-bold" style={{ color: typeMeta.accent }}>{t("rom.download")}</span>
          </div>
        </div>

        {/* Accent shimmer on hover */}
        <div className="absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
          style={{ background: `linear-gradient(90deg, transparent 5%, ${typeMeta.accent}80 50%, transparent 95%)` }} />
      </Link>

      {/* ── Card Body ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-0 px-3 pt-2.5 pb-3 flex-1">
        {/* Title + meta — also a link */}
        <Link href={`/rom/${rom.id}`} className="block group/title focus-visible:outline-none mb-2">
          <h3 className="text-[13px] font-black text-white line-clamp-1 leading-snug group-hover/title:text-[var(--primary)] transition-colors duration-200">
            {rom.name}
          </h3>
          <p className="mt-0.5 text-xs line-clamp-1 text-muted-foreground">
            {[rom.device, rom.brand && rom.brand !== "Other" && rom.brand, rom.android && `Android ${rom.android}`]
              .filter(Boolean).join(" · ")}
          </p>
        </Link>

        {/* ── Developer row + timestamp ─────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 mt-auto">
          {/* Avatar + name */}
          <Link
            href={`/u/${rom.maintainerUid}`}
            className="relative z-[3] flex items-center gap-1.5 min-w-0 max-w-[80%] focus-visible:outline-none group/dev"
          >
            <div className="relative h-6 w-6 flex-shrink-0 rounded-full overflow-hidden ring-1 ring-white/10 transition-all group-hover/dev:ring-[var(--primary)]/50">
              <Image
                src={getAvatarUrl(safeImg(
                  rom.maintainerPhoto,
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(rom.maintainerName || "R")}&backgroundColor=1d9bf0&textColor=ffffff&fontWeight=700`
                ))}
                alt={rom.maintainerName || "Developer"}
                fill
                className="object-cover"
                onError={e => {
                  (e.target as HTMLImageElement).src =
                    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(rom.maintainerName || "R")}&backgroundColor=1d9bf0&textColor=ffffff&fontWeight=700`;
                }}
              />
            </div>
            <span className="text-xs font-semibold line-clamp-1 text-foreground/80 transition-colors group-hover/dev:text-[var(--primary)]">
              {rom.maintainerName || "Unknown"}
            </span>
          </Link>

          {/* Timestamp — muted but still WCAG-readable */}
          {rom.createdAt && (
            <span className="flex-shrink-0 text-[11px] font-medium tabular-nums text-right text-muted-foreground">
              {timeAgo(rom.createdAt, t)}
            </span>
          )}
        </div>

        {/* ── Stats row ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-border/50 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1 transition-colors cursor-default hover:text-foreground">
            <Eye className="h-3 w-3" />{formatCount(rom.total_views || 0)}
          </span>
          <span className="flex items-center gap-1 transition-colors cursor-default hover:text-foreground">
            <Heart className="h-3 w-3" />{formatCount(rom.likesCount || 0)}
          </span>
          <span
            className="flex items-center gap-1 transition-colors cursor-default hover:text-foreground"
            onMouseEnter={e => (e.currentTarget.style.color = typeMeta.accent)}
            onMouseLeave={e => (e.currentTarget.style.color = "")}
          >
            <Download className="h-3 w-3" />{formatCount(rom.downloads || 0)}
          </span>
          {(rom.commentsCount || 0) > 0 && (
            <span className="flex items-center gap-1 ms-auto transition-colors cursor-default hover:text-foreground">
              <MessageSquare className="h-3 w-3" />{rom.commentsCount}
            </span>
          )}
        </div>
      </div>
    </motion.article>
  );
}

// Memoized export — `RomCard` is rendered in 9 list-style pages (home, explore,
// search, favorites, device/collection/profile pages, ...). Without React.memo,
// any parent state change (filter toggle, infinite-scroll append, counters)
// re-renders the entire list (up to 48 cards with nested DeviceThumb + motion).
// Cards are equal when the same `rom` reference + same top-level fields are passed.
export const RomCard = React.memo(RomCardInner, (prev, next) => {
  const a = prev.rom;
  const b = next.rom;
  if (a === b) return true;
  return (
    a?.id === b?.id &&
    a?.likesCount === b?.likesCount &&
    a?.total_views === b?.total_views &&
    a?.commentsCount === b?.commentsCount &&
    a?.downloads === b?.downloads &&
    a?.ratingAvg === b?.ratingAvg &&
    a?.romStatus === b?.romStatus &&
    a?.updatedAt === b?.updatedAt
  );
});
RomCard.displayName = "RomCard";

// ── Skeleton ─────────────────────────────────────────────────────────────────
export function RomCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.05] bg-[#0a0e17] flex flex-col"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
      <div className="aspect-[16/9] flex-shrink-0 relative overflow-hidden bg-[#070a12]">
        <div className="absolute inset-0 skeleton-shimmer" />
      </div>
      <div className="flex flex-col gap-2 p-3">
        <div className="space-y-1.5">
          <div className="h-3.5 w-3/4 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.07)" }} />
          <div className="h-3 w-1/2 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="h-6 w-6 rounded-full animate-pulse" style={{ background: "rgba(255,255,255,0.07)" }} />
          <div className="h-2.5 w-20 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
          <div className="h-2.5 w-12 rounded-lg ms-auto animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
        </div>
        <div className="flex gap-3 border-t pt-2.5" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {[8, 8, 8].map((w, i) => (
            <div key={i} className="h-2.5 rounded-lg animate-pulse" style={{ width: `${w * 4}px`, background: "rgba(255,255,255,0.05)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Ripple keyframe injected once ──────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("rc-ripple-style")) {
  const s = document.createElement("style");
  s.id = "rc-ripple-style";
  s.textContent = `@keyframes rc-ripple { from { transform: scale(0.3); opacity: 1; } to { transform: scale(3.5); opacity: 0; } }`;
  document.head.appendChild(s);
}

// ── Download toast ────────────────────────────────────────────────────────────
export function DownloadToast({ visible, name }: { visible: boolean; name: string }) {
  const { t } = useTranslation();
  return (
    <div className={cn(
      "fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-xl border border-emerald-500/25 bg-[#0a0e17] px-4 py-2.5 shadow-xl shadow-black/40 transition-all duration-300",
      visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
    )}>
      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
      <span className="text-sm font-medium text-white/80">
        {t("rom.opening")} <span className="text-[var(--primary)]">{name}</span>
      </span>
    </div>
  );
}
