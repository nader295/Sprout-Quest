"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { apiListRoms } from "@/lib/api/client";
import { cachedFetch, CacheKeys } from "@/lib/cache";
import { BRANDS, CONTENT_TYPES, ANDROID_VERSIONS } from "@/lib/constants";
import type { RomItem, ContentType } from "@/lib/types";
import { RomCard } from "@/components/rom/rom-card";
import { cn } from "@/lib/utils";
import { Smartphone, Cpu, HardDrive, Puzzle, Globe, TrendingUp, Star, Zap, Filter, X, Loader2, Compass } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { FeaturedDevelopers } from "@/components/shared/featured-developers";
import PageHero from "@/components/shared/page-hero";

const TYPE_ICONS: Record<string, React.ElementType> = { rom: Smartphone, kernel: Cpu, recovery: HardDrive, module: Puzzle, gsi: Globe };

export default function ExplorePage() {
  const [section, setSection] = useState<"trending" | "featured" | "browse">("trending");
  const [trending, setTrending] = useState<RomItem[]>([]);
  const [featured, setFeatured] = useState<RomItem[]>([]);
  const [browse, setBrowse] = useState<RomItem[]>([]);
  const [nextCursorBrowse, setNextCursorBrowse] = useState<string | null>(null);
  const [loadingMoreBrowse, setLoadingMoreBrowse] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState<ContentType | "">("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterAndroid, setFilterAndroid] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  // Infinite scroll
  const [visibleCount, setVisibleCount] = useState(12);
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { 
        if (entry.isIntersecting) {
          setVisibleCount(p => p + 12); 
          if (section === "browse" && nextCursorBrowse && !loadingMoreBrowse && !loading) {
            loadMoreBrowse();
          }
        }
      },
      { rootMargin: "200px" }
    );
    const el = loaderRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [section, nextCursorBrowse, loadingMoreBrowse, loading]);

  useEffect(() => { setVisibleCount(12); }, [section, filterType, filterBrand, filterAndroid]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      cachedFetch("explore:trending", () => apiListRoms({ max: 20, sortBy: "trending" }), 5 * 60 * 1000),
      cachedFetch("explore:featured", () => apiListRoms({ max: 16, featured: true }), 10 * 60 * 1000),
    ])
      .then(([t, f]) => { setTrending(t.items); setFeatured(f.items); })
      .finally(() => setLoading(false));
  }, []);

  const loadMoreBrowse = useCallback(async () => {
    if (!nextCursorBrowse || loadingMoreBrowse) return;
    setLoadingMoreBrowse(true);
    try {
      const res = await apiListRoms({
        max: 24,
        sortBy: "newest",
        contentType: filterType || undefined,
        brand: filterBrand || undefined,
        android: filterAndroid || undefined,
        cursor: nextCursorBrowse
      });
      setBrowse(prev => [...prev, ...res.items]);
      setNextCursorBrowse(res.nextCursor || null);
    } catch {} finally { setLoadingMoreBrowse(false); }
  }, [nextCursorBrowse, loadingMoreBrowse, filterType, filterBrand, filterAndroid]);

  useEffect(() => {
    if (section !== "browse") return;
    setLoading(true); setNextCursorBrowse(null);
    const browseKey = CacheKeys.roms("newest", filterType, filterBrand, filterAndroid);
    cachedFetch(
      browseKey,
      () => apiListRoms({
        max: 24,
        sortBy: "newest",
        contentType: filterType || undefined,
        brand: filterBrand || undefined,
        android: filterAndroid || undefined,
      }),
      2 * 60 * 1000
    )
      .then((res) => { setBrowse(res.items); setNextCursorBrowse(res.nextCursor || null); })
      .finally(() => setLoading(false));
  }, [section, filterType, filterBrand, filterAndroid]);

  const { t } = useTranslation();
  const activeFilters = [filterType, filterBrand, filterAndroid].filter(Boolean).length;

  const clearFilters = () => {
    setFilterType("");
    setFilterBrand("");
    setFilterAndroid("");
  };

  const currentList = section === "trending" ? trending : section === "featured" ? featured : browse;
  const visibleList = currentList.slice(0, visibleCount);
  const hasMore = section === "browse" ? (visibleCount < currentList.length || !!nextCursorBrowse) : visibleCount < currentList.length;

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6 xl:px-8 pb-24">

      {/* Holographic Header */}
      <PageHero
        icon={Compass}
        eyebrow={t("home.discover")}
        title={t("explore.title")}
        description={t("platform.tagline")}
        className="mb-4"
        stats={[
          { label: t("explore.trending"), value: trending.length || "—", icon: TrendingUp },
          { label: t("explore.featured"), value: featured.length || "—", icon: Star },
        ]}
      />

      {/* Section tabs — legendary */}
      <div className="flex items-center gap-1 rounded-2xl border border-border bg-card p-1 mb-4">
        {([
          { id: "trending", label: t("explore.trending"), icon: TrendingUp },
          { id: "featured", label: t("explore.featured"), icon: Star },
          { id: "browse",   label: t("common.seeAll"),    icon: Zap },
        ] as const).map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-black transition-all duration-200 overflow-hidden hover:scale-[1.02] active:scale-[0.97]",
              section === s.id ? "text-white shadow-md" : "text-muted-foreground hover:text-foreground"
            )}
            style={section === s.id ? {
              background: "linear-gradient(135deg, var(--primary), #3b82f6)",
              boxShadow: "0 3px 10px rgba(29,155,240,0.2)"
            } : undefined}
          >
            {section === s.id && <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />}
            <s.icon className={cn("h-3.5 w-3.5 transition-transform", section === s.id ? "scale-110" : "")} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Browse: filter button */}
      {section === "browse" && (
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "group flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-black transition-all hover:scale-105 active:scale-95 mb-3 overflow-hidden relative",
            showFilters
              ? "border-[var(--primary)] text-white"
              : "border-border text-muted-foreground hover:text-foreground hover:border-[var(--primary)]/40"
          )}
          style={showFilters ? { background: "linear-gradient(135deg, var(--primary), #3b82f6)", boxShadow: "0 3px 10px rgba(29,155,240,0.2)" } : undefined}
        >
          <span className="absolute inset-0 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-500 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12" />
          <Filter className={cn("h-4 w-4 transition-transform", showFilters ? "rotate-180" : "")} />
          {t("filter.filters")}
          {activeFilters > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white"
              style={{ backgroundColor: showFilters ? "rgba(255,255,255,0.25)" : "var(--primary)" }}>
              {activeFilters}
            </span>
          )}
        </button>
      )}

      {/* Filters panel */}
      {section === "browse" && showFilters && (
        <div className="mb-3 rounded-2xl border border-[var(--primary)]/20 bg-card p-4"
          style={{ background: "linear-gradient(135deg, rgba(29,155,240,0.04) 0%, transparent 60%)" }}>
          <div className="flex flex-wrap items-center gap-2">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as ContentType | "")}
              className="h-9 rounded-xl border border-border bg-muted/50 px-3 text-xs text-foreground focus:outline-none focus:border-[var(--primary)] transition-colors hover:border-[var(--primary)]/40">
              <option value="">{t("content.all")}</option>
              {CONTENT_TYPES.map((ct) => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
            </select>
            <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)}
              className="h-9 rounded-xl border border-border bg-muted/50 px-3 text-xs text-foreground focus:outline-none focus:border-[var(--primary)] transition-colors hover:border-[var(--primary)]/40">
              <option value="">{t("filter.allBrands")}</option>
              {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={filterAndroid} onChange={(e) => setFilterAndroid(e.target.value)}
              className="h-9 rounded-xl border border-border bg-muted/50 px-3 text-xs text-foreground focus:outline-none focus:border-[var(--primary)] transition-colors hover:border-[var(--primary)]/40">
              <option value="">{t("filter.allVersions")}</option>
              {ANDROID_VERSIONS.map((v) => <option key={v} value={v}>Android {v}</option>)}
            </select>
            {activeFilters > 0 && (
              <button onClick={clearFilters}
                className="flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/20 transition-all hover:scale-105 active:scale-95">
                <X className="h-3 w-3" /> {t("filter.clearAll")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content type chips (browse) */}
      {section === "browse" && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none mb-4">
          <button onClick={() => setFilterType("")}
            className={cn("shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black transition-all hover:scale-105 active:scale-95",
              !filterType ? "text-white shadow-md" : "border border-border text-muted-foreground hover:text-foreground hover:border-[var(--primary)]/30"
            )}
            style={!filterType ? { background: "linear-gradient(135deg, var(--primary), #3b82f6)", boxShadow: "0 3px 8px rgba(29,155,240,0.2)" } : undefined}>
            {t("content.all")}
          </button>
          {CONTENT_TYPES.map((ct) => {
            const Icon = TYPE_ICONS[ct.value] || Smartphone;
            return (
              <button key={ct.value} onClick={() => setFilterType(ct.value as ContentType)}
                className={cn("shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black transition-all hover:scale-105 active:scale-95",
                  filterType === ct.value ? "text-white shadow-md" : "border border-border text-muted-foreground hover:text-foreground hover:border-[var(--primary)]/30"
                )}
                style={filterType === ct.value ? { background: "linear-gradient(135deg, var(--primary), #3b82f6)", boxShadow: "0 3px 8px rgba(29,155,240,0.2)" } : undefined}>
                <Icon className="h-3 w-3" /> {ct.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Featured Developers */}
      {(section === "trending" || section === "featured") && (
        <div className="mt-4 mb-4">
          <FeaturedDevelopers max={6} />
        </div>
      )}

      {/* Results */}
      <div className="mt-4">
        {loading ? (
          <div className="grid gap-3 grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 stagger-children">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="aspect-[16/9] shimmer" />
                <div className="p-3 space-y-2">
                  <div className="h-3.5 w-3/4 rounded-lg shimmer" />
                  <div className="h-3 w-1/2 rounded-lg shimmer" />
                  <div className="flex gap-2 pt-1 border-t border-border/40">
                    <div className="h-2.5 w-8 rounded shimmer" />
                    <div className="h-2.5 w-8 rounded shimmer" />
                    <div className="h-2.5 w-8 rounded shimmer" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : currentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-3xl border border-border bg-card">
              <Zap className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-black text-muted-foreground">{t("home.noResults")}</p>
            {activeFilters > 0 && (
              <button onClick={clearFilters} className="mt-3 text-xs font-bold hover:scale-105 active:scale-95 transition-transform" style={{ color: "var(--primary)" }}>
                {t("filter.clearAll")}
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 stagger-children">
            {currentList.slice(0, visibleCount).map((r, i) => (
              <div key={r.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${(i % 12) * 60}ms`, animationFillMode: "both" }}>
                <RomCard rom={r} />
              </div>
            ))}
            {/* Infinite scroll sentinel */}
            {hasMore && (
              <div ref={loaderRef} className="col-span-full flex justify-center py-6">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
                  {t("explore.loadMore")}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
