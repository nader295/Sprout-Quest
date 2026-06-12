"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { apiListRoms } from "@/lib/api/client";
import { cachedFetch, CacheKeys } from "@/lib/cache";
import { RomCard, RomCardSkeleton } from "@/components/rom/rom-card";
import StatsBar from "@/components/shared/stats-bar-v2";
import { MarketplaceHomeBanner } from "@/components/marketplace/home-banner";
// HeroCyber pulls in framer-motion + lazy-loaded three.js chunk. Splitting it
// off the main bundle shaves ~180 KB gzipped from the initial home-page payload
// and lets the rest of the page hydrate (ROM list, filters) before the 3D scene.
const HeroCyber = dynamic(() => import("@/components/home/hero-cyber"), {
  ssr: false,
  loading: () => (
    <div className="mx-3 mt-2 h-[360px] animate-pulse rounded-3xl bg-white/[0.03]" aria-hidden />
  ),
});
import { BRANDS, ANDROID_VERSIONS } from "@/lib/constants";
import type { RomItem, ContentType, SortOption } from "@/lib/types";
import {
  SlidersHorizontal, Clock, Heart, Eye, Package,
  Download, TrendingUp, Star, X, Zap, Flame, Loader2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";


const SORT_OPTIONS: { value: SortOption; labelKey: string; icon: typeof Clock }[] = [
  { value: "newest",    labelKey: "sort.newest",         icon: Clock },
  { value: "trending",  labelKey: "sort.trending",       icon: TrendingUp },
  { value: "likes",     labelKey: "sort.mostLiked",      icon: Heart },
  { value: "views",     labelKey: "sort.mostViewed",     icon: Eye },
  { value: "downloads", labelKey: "sort.mostDownloaded", icon: Download },
];

export default function HomePage() {
  const [roms, setRoms] = useState<RomItem[]>([]);
  const observerTarget = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [contentType, setContentType] = useState<ContentType | "all">("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [brand, setBrand] = useState("");
  const [android, setAndroid] = useState("");
  const [device, setDevice] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [announcement, setAnnouncement] = useState<{ text: string } | null>(null);
  const [romOfWeek, setRomOfWeek] = useState<{ romId: string; romName: string } | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const { t, dir: layoutDir } = useTranslation();

  const fetchRoms = useCallback(async () => {
    setLoading(true);
    setNextCursor(null);
    try {
      const cacheKey = CacheKeys.roms(sort, contentType !== "all" ? contentType : "", brand, android);
      const res = await cachedFetch(cacheKey, () => apiListRoms({
        max: 24, sortBy: sort,
        contentType: contentType !== "all" ? contentType : undefined,
        brand: brand || undefined, android: android || undefined, device: device || undefined,
      }), 2 * 60 * 1000);
      setRoms(res.items);
      setNextCursor(res.nextCursor || null);
    } catch {
      try { const res = await apiListRoms({ max: 24 }); setRoms(res.items); setNextCursor(res.nextCursor || null); } catch {}
    } finally { setLoading(false); }
  }, [contentType, sort, brand, android, device]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await apiListRoms({ max: 24, sortBy: sort, contentType: contentType !== "all" ? contentType : undefined, brand: brand || undefined, android: android || undefined, device: device || undefined, cursor: nextCursor });
      setRoms((prev) => [...prev, ...res.items]);
      setNextCursor(res.nextCursor || null);
    } catch {}
    setLoadingMore(false);
  }, [nextCursor, loadingMore, sort, contentType, brand, android, device]);

  useEffect(() => { fetchRoms(); }, [fetchRoms]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor && !loadingMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [nextCursor, loadingMore, loading, loadMore]);

  const hasActiveFilters = contentType !== "all" || brand || android || device;
  const activeFilterCount = [contentType !== "all", brand, android, device].filter(Boolean).length;

  return (
    <div className="mx-auto w-full max-w-7xl">

      {announcement?.text && (
        <div className="animate-fade-in mx-3 mt-2 mb-3 flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-bold"
          style={{ borderColor: "var(--primary)", backgroundColor: "var(--primary-dim)", color: "var(--primary)" }}>
          <Zap className="h-4 w-4 shrink-0" /><p className="flex-1">{announcement.text}</p>
        </div>
      )}

      <HeroCyber>
        <StatsBar />
      </HeroCyber>

      {/* Marketplace banner — surfaces the new commercial market right under the hero */}
      <MarketplaceHomeBanner />

      {/* Latest ROMs section header */}
      <div className="px-3 sm:px-4 lg:px-6 xl:px-8 mt-2 mb-3 flex items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--primary)" }}>
              {t("home.latest") || "Latest"}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            {t("home.latestTitle") || "Fresh releases"}
          </h2>
        </div>
        <Link href="/explore" className="hidden sm:inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
          {t("home.viewAll") || "View all"}
          <span className="rtl:rotate-180">→</span>
        </Link>
      </div>

      <div className="px-3 pb-4 sm:px-4 lg:px-6 xl:px-8">

        {romOfWeek && (
          <Link href={`/rom/${romOfWeek.romId}`}
            className="animate-fade-in mb-4 flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-transparent p-3.5 transition-all hover:border-amber-500/60">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)" }}>
              <Flame className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400">{t("spotlight.thisWeek")}</p>
              <p className="text-sm font-black text-foreground truncate">{romOfWeek.romName}</p>
            </div>
            <Star className="h-5 w-5 fill-amber-400 text-amber-400 flex-shrink-0" />
          </Link>
        )}

        {/* Content type tabs */}
        <div className="relative mb-2">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none rounded-2xl border border-border bg-card p-1">
            <button onClick={() => setContentType("all")} className={cn(
              "shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all duration-200",
              contentType === "all" ? "text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )} style={contentType === "all" ? { background: "var(--primary)" } : undefined}>
              {t("content.all")}
            </button>
            {([
              { value: "rom",      labelKey: "content.roms"       },
              { value: "kernel",   labelKey: "content.kernels"    },
              { value: "recovery", labelKey: "content.recoveries" },
              { value: "module",   labelKey: "content.modules"    },
              { value: "gsi",      labelKey: "content.gsi"        },
            ] as const).map((ct) => (
              <button key={ct.value} onClick={() => setContentType(ct.value as ContentType)} className={cn(
                "shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all duration-200",
                contentType === ct.value ? "text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )} style={contentType === ct.value ? { background: "var(--primary)" } : undefined}>
                {t(ct.labelKey)}
              </button>
            ))}
          </div>
          {/* Left fade */}
          <div className="pointer-events-none absolute inset-y-0 start-0 w-10 rounded-s-2xl z-10"
            style={{ background: layoutDir === "rtl" ? "linear-gradient(to left, rgb(var(--card)) 0%, transparent 100%)" : "linear-gradient(to right, rgb(var(--card)) 0%, transparent 100%)" }} />
          {/* Right fade */}
          <div className="pointer-events-none absolute inset-y-0 end-0 w-10 rounded-e-2xl z-10"
            style={{ background: layoutDir === "rtl" ? "linear-gradient(to right, rgb(var(--card)) 0%, transparent 100%)" : "linear-gradient(to left, rgb(var(--card)) 0%, transparent 100%)" }} />
        </div>

        {/* Sort & Filter */}
        <div className="relative mb-3">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1 -mb-1">
            {SORT_OPTIONS.map((s) => (
              <button key={s.value} onClick={() => setSort(s.value)} className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all",
                sort === s.value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}>
                <s.icon className="h-3 w-3 shrink-0" />
                <span>{t(s.labelKey)}</span>
              </button>
            ))}
            <div className="flex-1" />
            <button onClick={() => setShowFilters(!showFilters)} className={cn(
              "relative shrink-0 flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all",
              showFilters || hasActiveFilters ? "border-[var(--primary)]/50 bg-primary-dim text-[var(--primary)]" : "border-border text-muted-foreground hover:text-foreground"
            )}>
              <SlidersHorizontal className="h-3 w-3" />
              {activeFilterCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black text-white"
                  style={{ backgroundColor: "var(--primary)" }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

      {showFilters && (
        <div className="mb-3 animate-fade-in flex flex-wrap gap-3 rounded-2xl border border-border bg-card p-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("filter.brand")}</label>
            <select value={brand} onChange={(e) => setBrand(e.target.value)} className="h-9 rounded-xl border border-border bg-background px-2 text-xs text-foreground">
              <option value="">{t("filter.allBrands")}</option>
              {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("filter.android")}</label>
            <select value={android} onChange={(e) => setAndroid(e.target.value)} className="h-9 rounded-xl border border-border bg-background px-2 text-xs text-foreground">
              <option value="">{t("filter.allVersions")}</option>
              {ANDROID_VERSIONS.map((v) => <option key={v} value={v}>Android {v}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("filter.device") || "Device"}</label>
            <input value={device} onChange={(e) => setDevice(e.target.value)} placeholder={t("filter.devicePlaceholder") || "e.g. Redmi Note 12"}
              className="h-9 rounded-xl border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-[var(--primary)]" />
          </div>
          {hasActiveFilters && (
            <button onClick={() => { setContentType("all"); setBrand(""); setAndroid(""); setDevice(""); }}
              className="mt-auto flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors">
              <X className="h-3 w-3" /> {t("filter.clearAll")}
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="grid gap-3 grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 stagger-children">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <RomCardSkeleton key={i} />)
          : roms.flatMap((rom, i) => {
               const els = [<RomCard key={rom.id} rom={rom} />];
               return els;
            })
        }
      </div>

      {!loading && roms.length === 0 && (
        <div className="animate-fade-in flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-card">
            <Package className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-base font-black text-foreground mb-1">{t("home.noResults")}</h3>
          <p className="text-sm text-muted-foreground mb-5">{t("home.noResultsDesc")}</p>
          {hasActiveFilters && (
            <button onClick={() => { setContentType("all"); setBrand(""); setAndroid(""); setDevice(""); }}
              className="rounded-2xl px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 hover:scale-105 active:scale-95 transition-all"
              style={{ backgroundColor: "var(--primary)" }}>
              {t("filter.clearAll")}
            </button>
          )}
        </div>
      )}

      {!loading && nextCursor && roms.length > 0 && (
        <div ref={observerTarget} className="mt-8 flex justify-center py-4">
          {loadingMore && (
            <div className="flex items-center gap-2 text-muted-foreground font-bold text-sm">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("common.loading")}
            </div>
          )}
        </div>
      )}

      {/* SEO Content Block for AdSense.
          NOTE on the fallback pattern: the `t()` helper returns the key
          string itself when the key is missing from the active locale AND
          from English. That meant the previous `t(key) || fallback` pattern
          NEVER fell back — the truthy key string short-circuited the `||`
          and the raw `"seo.home.title"` was rendered. We now guard with
          `!== key` so unknown-key results cleanly fall through to the
          English default instead of leaking debug strings to users. */}
      {!loading && (() => {
        const seoTitle = t("seo.home.title");
        const seoP1 = t("seo.home.p1");
        const seoP2 = t("seo.home.p2");
        return (
          <div className="mt-12 mb-6 rounded-3xl border border-border/50 bg-card/40 p-6 sm:p-8 text-center sm:text-start transition-all hover:border-[var(--primary)]/40 hover:bg-card/70 group">
            <h2 className="text-xl font-black text-foreground mb-3 leading-tight group-hover:text-[var(--primary)] transition-colors">
              {seoTitle !== "seo.home.title" ? seoTitle : "The Ultimate Destination for Android ROMs and Custom Mods"}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              {seoP1 !== "seo.home.p1" ? seoP1 : "RomX is a community-driven platform designed to centralize and archive the best custom Android ROMs, Kernels, Modules, and Recoveries. Our platform empowers developers to share their work with thousands of enthusiasts worldwide while providing users with a safe, verified, and easy-to-navigate repository of Android modifications."}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {seoP2 !== "seo.home.p2" ? seoP2 : "Whether you're looking to breathe new life into an old device with a performance-optimized custom ROM, tweak your system using Magisk modules, or flash the latest experimental builds, RomX provides dynamic, real-time analytics to help you quickly assess the stability and popularity of any release. Join us and discover the power of open-source Android development."}
            </p>
          </div>
        );
      })()}

      {/* ── Site footer ─────────────────────────────────────────────────
          Sits above the fixed bottom nav. Provides:
          • brand + tagline row with the animated RomX wordmark
          • quick-link row (auto-wraps on narrow screens)
          • divider + copyright line with the current year
          Uses the same token palette as the rest of the site (no hardcoded
          colours) so it adapts to theme + accent changes. Extra bottom
          padding keeps the copyright line above the fixed bottom nav. */}
      {!loading && (
        <footer className="mt-4 rounded-3xl border border-border/50 bg-card/30 p-5 sm:p-6 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:justify-between sm:text-start">
            <div className="flex flex-col items-center gap-1 sm:items-start">
              <div className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{
                    background: "linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 65%, #3b82f6) 100%)",
                    boxShadow: "0 2px 10px color-mix(in srgb, var(--primary) 35%, transparent)",
                  }}
                >
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <span className="text-lg font-black tracking-tight text-foreground">
                  Rom<span style={{ color: "var(--primary)" }}>X</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("footer.tagline")}
              </p>
            </div>

            {/* Quick links */}
            <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs font-medium">
              <Link href="/rules" className="text-muted-foreground transition-colors hover:text-foreground">
                {t("footer.links.rules")}
              </Link>
              <Link href="/privacy" className="text-muted-foreground transition-colors hover:text-foreground">
                {t("footer.links.privacy")}
              </Link>
              <Link href="/terms" className="text-muted-foreground transition-colors hover:text-foreground">
                {t("footer.links.terms")}
              </Link>
              <Link href="/contact" className="text-muted-foreground transition-colors hover:text-foreground">
                {t("footer.links.contact")}
              </Link>
              <Link href="/dmca" className="text-muted-foreground transition-colors hover:text-foreground">
                {t("footer.links.dmca")}
              </Link>
            </nav>
          </div>

          {/* Divider — thin gradient line for visual polish */}
          <div
            aria-hidden
            className="my-4 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--border) 80%, transparent) 50%, transparent 100%)",
            }}
          />

          {/* Copyright line — uses the current year so it never goes stale */}
          <div className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground sm:flex-row sm:justify-between">
            <p>
              © {new Date().getFullYear()} RomX. {t("footer.rights")}
            </p>
            <p className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" style={{ color: "var(--primary)" }} />
              <span>{t("footer.made")}</span>
            </p>
          </div>
        </footer>
      )}

      {/* Bottom spacer — keeps the footer clear of the fixed bottom nav */}
      <div className="h-6" />
      </div>  {/* end px-3 inner div */}
    </div>
  );
}
