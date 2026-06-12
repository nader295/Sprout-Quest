"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import type { ActivityItem } from "@/lib/types";
import { safeImg, timeAgo, cn } from "@/lib/utils";
import { DEFAULT_AVATAR } from "@/lib/constants";
import { appCache } from "@/lib/cache";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
import Link from "next/link";
import {
  Rss, Package, Heart, MessageSquare, UserPlus, Award, Loader2,
  ChevronRight, Globe2, Flame, Users, Sparkles,
} from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { useTranslation } from "@/lib/i18n";
import { Skeleton } from "@/components/shared/Skeleton";
import PageHero from "@/components/shared/page-hero";

const TYPE_META: Record<string, {
  icon: React.ElementType;
  labelKey: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
}> = {
  new_rom:     { icon: Package,       labelKey: "feed.labelPublished", color: "#34d399", bg: "rgba(52,211,153,0.10)",  border: "rgba(52,211,153,0.20)",  glow: "rgba(52,211,153,0.35)"  },
  new_version: { icon: Package,       labelKey: "feed.labelUpdated", color: "#60a5fa", bg: "rgba(96,165,250,0.10)",  border: "rgba(96,165,250,0.20)",  glow: "rgba(96,165,250,0.35)"  },
  like:        { icon: Heart,         labelKey: "feed.labelLiked", color: "#fb7185", bg: "rgba(251,113,133,0.10)", border: "rgba(251,113,133,0.20)", glow: "rgba(251,113,133,0.35)" },
  comment:     { icon: MessageSquare, labelKey: "feed.labelCommented", color: "#fbbf24", bg: "rgba(251,191,36,0.10)",  border: "rgba(251,191,36,0.20)",  glow: "rgba(251,191,36,0.35)"  },
  follow:      { icon: UserPlus,      labelKey: "feed.labelFollowed", color: "#22d3ee", bg: "rgba(34,211,238,0.10)",  border: "rgba(34,211,238,0.20)",  glow: "rgba(34,211,238,0.35)"  },
  achievement: { icon: Award,         labelKey: "feed.labelEarned", color: "#a78bfa", bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.20)", glow: "rgba(167,139,250,0.35)" },
};
const DEFAULT_META = TYPE_META.new_rom;

async function fetchActivity(mode: "global" | "following"): Promise<ActivityItem[]> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const params = new URLSearchParams();
  params.set("limit", "25");
  params.set("mode", mode === "following" ? "feed" : "global");
  try {
    const res = await fetch(`/api/activity?${params.toString()}`, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch { return []; }
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-border bg-card p-3.5"
          style={{ opacity: Math.max(0.3, 1 - i * 0.15) }}>
          <Skeleton variant="circular" className="h-10 w-10 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="h-3.5 w-3/5" />
            <Skeleton variant="text" className="h-2.5 w-1/4" />
          </div>
          <Skeleton variant="circular" className="h-10 w-10 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export default function FeedPage() {
  const { user, isLoggedIn } = useAuth();
  const [feed, setFeed] = useState<ActivityItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(15);
  const loaderRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"following" | "global">("global");
  const { t } = useTranslation();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(p => p + 15); },
      { rootMargin: "200px" }
    );
    const el = loaderRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, []);

  useEffect(() => {
    const cacheKey = `feed:${mode}:${user?.uid || "guest"}`;
    const cached = appCache.get<ActivityItem[]>(cacheKey);
    if (cached) { setFeed(cached); setLoading(false); return; }
    setLoading(true);
    fetchActivity(mode)
      .then((items) => { setFeed(items); appCache.set(cacheKey, items, 45_000); })
      .catch(() => setFeed([]))
      .finally(() => setLoading(false));
  }, [mode, user?.uid]);

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-4 sm:px-4 lg:px-6 pb-28">

      {/* Holographic Header */}
      <PageHero
        icon={Rss}
        title={t("feed.title")}
        description={t("feed.lastActivitySubtitle")}
        compact
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-400">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
            Live
          </span>
        }
        className="mb-5"
      />

      {/* Mode Toggle */}
      <div className="flex items-center gap-1.5 mb-5 rounded-2xl border border-border bg-card/50 p-1.5">
        {([
          { id: "global"    as const, icon: Globe2, label: t("feed.globalMode"),    sub: t("feed.globalModeSub")  },
          { id: "following" as const, icon: Users,  label: t("feed.following"), sub: t("feed.followingModeSub") },
        ]).map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-2 py-2.5 px-4 rounded-xl transition-all duration-300 overflow-hidden",
              mode === m.id ? "text-white shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
            style={mode === m.id ? { background: "linear-gradient(135deg, var(--primary), #6366f1)", boxShadow: "0 4px 16px rgba(29,155,240,0.35)" } : undefined}>
            {mode === m.id && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />}
            <m.icon className="h-4 w-4 relative shrink-0" />
            <div className="relative text-start hidden sm:block">
              <p className="text-xs font-black leading-none">{m.label}</p>
              <p className={cn("text-[9px] leading-none mt-0.5 font-medium", mode === m.id ? "text-white/60" : "text-muted-foreground/40")}>{m.sub}</p>
            </div>
            <span className="relative text-xs font-black sm:hidden">{m.label}</span>
          </button>
        ))}
      </div>

      {/* Feed Content */}
      {loading ? <FeedSkeleton /> : feed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl border border-border bg-card mb-5 overflow-hidden">
            <Sparkles className="h-10 w-10 text-muted-foreground/20" />
            <div className="absolute inset-0 dragon-breathe" style={{ border: "1px solid rgba(29,155,240,0.15)" }} />
          </div>
          <p className="text-base font-black text-foreground mb-2">
            {mode === "following" ? t("feed.noFollowingActivity") : t("feed.noActivity")}
          </p>
          <p className="text-sm text-muted-foreground mb-5 max-w-xs leading-relaxed">
            {mode === "following" ? t("feed.emptyDesc") : t("feed.communityComingSoon")}
          </p>
          {mode === "following" && (
            <button onClick={() => setMode("global")}
              className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-black text-white transition-all hover:scale-105 active:scale-95"
              style={{ background: "linear-gradient(135deg, var(--primary), #6366f1)", boxShadow: "0 3px 12px rgba(29,155,240,0.22)" }}>
              <Flame className="h-4 w-4" /> {t("feed.discoverCommunity")}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {feed.slice(0, visibleCount).map((a, idx) => {
            const meta = TYPE_META[a.type] || DEFAULT_META;
            const Icon = meta.icon;
            return (
              <div key={a.id}
                className="group relative flex items-center gap-3.5 rounded-2xl border bg-card p-3.5 transition-all duration-300 overflow-hidden hover:shadow-lg hover:-translate-y-px cursor-default"
                style={{ borderColor: "rgb(var(--border))", animationDelay: `${idx * 0.03}s` }}>

                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{ background: `radial-gradient(ellipse 70% 80% at 0% 50%, ${meta.glow.replace("0.35", "0.06")} 0%, transparent 70%)` }} />

                {/* Left accent bar */}
                <div className="absolute start-0 top-4 bottom-4 w-0.5 rounded-full scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-center"
                  style={{ backgroundColor: meta.color, boxShadow: `0 0 8px ${meta.color}` }} />

                {/* Type icon */}
                <div className="relative shrink-0 flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-110 group-hover:shadow-md"
                  style={{ background: meta.bg, border: `1px solid ${meta.border}`, boxShadow: `0 0 0 0 ${meta.glow}` }}>
                  <Icon className="h-4.5 w-4.5" style={{ color: meta.color, filter: `drop-shadow(0 0 5px ${meta.glow})` }} />
                </div>

                {/* Text */}
                <div className="relative flex-1 min-w-0">
                  <p className="text-sm leading-snug">
                    <Link href={`/u/${a.uid}`}
                      className="font-black text-foreground hover:text-[var(--primary)] transition-colors">
                      {a.username || t("feed.unknownUser")}
                    </Link>
                    <span className="text-muted-foreground font-medium mx-1.5 text-xs">{t(meta.labelKey)}</span>
                    {a.romName && a.romId && (
                      <Link href={`/rom/${a.romId}`}
                        className="font-bold transition-colors hover:underline text-sm"
                        style={{ color: meta.color }}>
                        {a.romName}
                      </Link>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground/40 font-mono mt-1 leading-none">{timeAgo(a.createdAt)}</p>
                </div>

                {/* Avatar */}
                <div className="relative shrink-0 flex items-center gap-1.5">
                  <Link href={`/u/${a.uid}`} className="relative block h-[38px] w-[38px] transition-transform group-hover:scale-105">
                    <OptimizedImage src={safeImg(a.photo, DEFAULT_AVATAR)} alt={a.username || ""} width={38} height={38}
                      className="rounded-xl border border-border" crossOrigin="anonymous" />
                  </Link>
                  {a.romId && (
                    <Link href={`/rom/${a.romId}`}
                      className="opacity-0 group-hover:opacity-100 transition-all duration-200 flex h-7 w-7 items-center justify-center rounded-lg border border-border hover:border-[var(--primary)]/40 hover:bg-muted"
                      style={{ color: meta.color }}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-center gap-2 pt-4 pb-2">
            {/* Infinite scroll sentinel */}
          {visibleCount < feed.length && (
            <div ref={loaderRef} className="flex justify-center py-4 w-full">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-3.5 w-3.5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
                {t("feed.loadingMore") || "Loading more..."}
              </div>
            </div>
          )}
          <div className="h-px flex-1 bg-border/30" />
            <span className="text-[10px] text-muted-foreground/30 font-mono">{t("feed.activityCount", { n: feed.length })}</span>
            <div className="h-px flex-1 bg-border/30" />
          </div>
        </div>
      )}
    </div>
  );
}
