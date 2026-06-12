"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { apiListRoms } from "@/lib/api/client";
import type { RomItem } from "@/lib/types";
import { RomCard, RomCardSkeleton } from "@/components/rom/rom-card";
import Link from "next/link";
import { Heart, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import PageHero from "@/components/shared/page-hero";

export default function FavoritesPage() {
  const { user, isLoggedIn } = useAuth();
  const { t } = useTranslation();
  const [roms, setRoms] = useState<RomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);
  const [allFavoriteIds, setAllFavoriteIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    setLoading(true);

    async function fetchFavorites() {
      try {
        // Fetch user's liked ROM IDs via the API, then load those ROMs
        const res = await fetch(`/api/roms?action=myLikes`, {
          headers: {
            Authorization: `Bearer ${await user!.getIdToken()}`,
          },
        });
        if (!res.ok) { setRoms([]); return; }
        const data = await res.json();
        const ids: string[] = data.items || [];
        setAllFavoriteIds(ids);
        if (ids.length === 0) { setRoms([]); return; }

        const result = await apiListRoms({ ids: ids.slice(0, 24) });
        setRoms(result.items || []);
        setHasMore(ids.length > 24);
      } catch {
        setRoms([]);
      } finally {
        setLoading(false);
      }
    }

    fetchFavorites();
  }, [user]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextBatchIds = allFavoriteIds.slice(roms.length, roms.length + 24);
      if (nextBatchIds.length > 0) {
        const result = await apiListRoms({ ids: nextBatchIds });
        setRoms((prev) => [...prev, ...(result.items || [])]);
        setHasMore(allFavoriteIds.length > roms.length + nextBatchIds.length);
      } else {
        setHasMore(false);
      }
    } finally { setLoadingMore(false); }
  }, [hasMore, loadingMore, roms.length, allFavoriteIds]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) loadMore();
    }, { threshold: 0.1 });
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, loadMore]);

  if (!isLoggedIn) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center py-24 text-center px-4">
        <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-border bg-card/50 relative overflow-hidden group shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <Heart className="h-10 w-10 text-muted-foreground/30 transition-transform duration-500 group-hover:scale-110 group-hover:text-primary/60" />
        </div>
        <h3 className="text-xl font-black text-foreground mb-2">
          {t("auth.signInPrompt") || "Join the Elite"}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed mb-6">
          {t("auth.signInDesc") || "Sign in to construct your personal armory of legendary ROMs, track your XP, and join the leaderboards."}
        </p>
        <Link href="/login" 
          className="group relative inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-white overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 shadow-[0_4px_16px_rgba(29,155,240,0.3)]" 
          style={{ background: "linear-gradient(135deg, var(--primary) 0%, #3b82f6 100%)" }}>
          <span className="absolute inset-0 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-500 bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-12" />
          {t("auth.signIn")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6 xl:px-8">
      <PageHero
        icon={Heart}
        accent="#fb7185"
        title={t("nav.favorites")}
        description={t("favorites.subtitle")}
        compact
        className="mb-5"
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (<RomCardSkeleton key={i} />))}
        </div>
      ) : roms.length === 0 ? (
        <div className="animate-fade-in flex flex-col items-center justify-center py-24 text-center px-4">
          <div className="mb-5 flex h-24 w-24 flex-col items-center justify-center rounded-[2rem] border border-dashed border-border bg-card/50 relative group shadow-sm">
            <Heart className="h-10 w-10 text-muted-foreground/30 transition-transform duration-500 group-hover:scale-110 group-hover:text-rose-400" />
            <div className="absolute -top-2 -end-2 h-7 w-7 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center animate-bounce-slow">
              <span className="text-[10px]">💔</span>
            </div>
          </div>
          <h3 className="text-lg font-black text-foreground mb-2">
            {t("favorites.emptyTitle") || "No Favorites Yet"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">
            {t("favorites.empty") || "Your vault is empty. Time to hunt down some legendary ROMs and bring them here."}
          </p>
          <Link href="/explore" 
            className="group relative inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-white overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95"
            style={{ background: "linear-gradient(135deg, var(--primary) 0%, #3b82f6 100%)", boxShadow: "0 4px 14px color-mix(in srgb, var(--primary) 28%, transparent)" }}>
            <span className="absolute inset-0 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-500 bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-12" />
            <Heart className="h-4 w-4" />
            {t("favorites.browse") || "Start Hunting"}
          </Link>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {roms.map((rom) => (<RomCard key={rom.id} rom={rom} />))}
        </div>
        {hasMore && (
          <div ref={observerTarget} className="flex justify-center py-4 mt-2">
            {loadingMore && (
              <div className="flex items-center gap-2 text-muted-foreground font-bold text-sm">
                <Loader2 className="h-5 w-5 animate-spin" />
                {t("common.loading") || "Loading..."}
              </div>
            )}
          </div>
        )}
        </>
      )}
    </div>
  );
}
