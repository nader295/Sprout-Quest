"use client";

import { useEffect, useState } from "react";
import { apiGetLeaderboard } from "@/lib/api/client";
import { cachedFetch, CacheKeys } from "@/lib/cache";
import type { UserDoc } from "@/lib/types";
import { formatCount, safeImg, cn } from "@/lib/utils";
import { getLevel, DEFAULT_AVATAR } from "@/lib/constants";
import Image from "next/image";
import Link from "next/link";
import { Trophy, Medal, Crown, Heart, Download, Star, Package, Loader2, BadgeCheck, Users, Target, Eye, Flame } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/lib/hooks/use-auth";
import PageHero from "@/components/shared/page-hero";

function isDeveloper(u: UserDoc) {
  return u.role === "verifiedDev" || u.role === "admin" || u.role === "owner";
}

function getRankBorder(idx: number) {
  if (idx === 0) return "border-amber-400/40 bg-gradient-to-r from-amber-400/8 to-transparent";
  if (idx === 1) return "border-gray-300/30 bg-gradient-to-r from-gray-300/8 to-transparent";
  if (idx === 2) return "border-amber-600/30 bg-gradient-to-r from-amber-600/8 to-transparent";
  return "border-border";
}

export default function LeaderboardPage() {
  const [cat, setCat] = useState<string>("xp");
  const [userType, setUserType] = useState<"developers" | "all">("developers");
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState<{ rank: number, value: number } | null>(null);
  const [loadingRank, setLoadingRank] = useState(false);
  const { t } = useTranslation();
  const { user } = useAuth();

  const TABS = [
    { id: "developers", label: t("leaderboard.topDevelopers") },
    { id: "all",        label: t("leaderboard.allDevelopers") },
  ];

  const CATEGORIES = [
    { id: "xp",                  label: t("profile.karma"),     icon: Trophy },
    { id: "totalLikesReceived",  label: t("profile.likes"),     icon: Heart },
    { id: "totalDownloads",      label: t("profile.downloads"), icon: Download },
    { id: "totalViewsReceived",  label: t("profile.views") || "Views", icon: Eye },
    { id: "subscribersCount",    label: t("profile.followers"), icon: Users },
    { id: "romsCount",           label: t("profile.releases"),  icon: Package },
  ];

  useEffect(() => {
    setLoading(true);
    cachedFetch(
      CacheKeys.leaderboard(`${cat}_${userType}`),
      () => apiGetLeaderboard(cat, 50),
      30 * 1000
    )  // Leaderboard: 30s cache
      .then((all) => {
        if (userType === "all") {
          // Tab 2: Show only Developers / Publishers
          setUsers(all.filter((u) => u.role === "verifiedDev" || u.role === "admin" || u.role === "owner" || (u.romsCount ?? 0) > 0));
        } else {
          // Tab 1: Top 50 globally across all normal users and developers
          setUsers(all);
        }
      })
      .finally(() => setLoading(false));
  }, [cat, userType]);

  const valueForCat = (u: UserDoc) => {
    if (cat === "totalDownloads" && u.hideDownloads) return null;
    if (cat === "subscribersCount" && u.hideFollowers) return null;
    const map: Record<string, number> = {
      xp: u.xp ?? 0,
      totalLikesReceived: u.totalLikesReceived ?? 0,
      totalDownloads: u.totalDownloads ?? 0,
      totalViewsReceived: (u as unknown as Record<string,number>).totalViewsReceived ?? 0,
      subscribersCount: u.subscribersCount ?? 0,
      romsCount: u.romsCount ?? 0,
    };
    return map[cat] ?? 0;
  };

  const fetchMyRank = async () => {
    if (!user) return;
    setLoadingRank(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/users?action=myRank&by=${cat}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.rank) setMyRank(data);
    } catch {}
    setLoadingRank(false);
  };

  const top3 = users.slice(0, 3);
  const rest = users.slice(3);

  const podiumOrder = top3.length === 3
    ? [top3[1], top3[0], top3[2]]
    : top3;

  const podiumConfig = [
    { height: "h-20", label: "2nd", color: "text-gray-300", icon: <Medal className="h-4 w-4 text-gray-300" />, idx: 1 },
    { height: "h-28", label: "1st", color: "text-amber-400", icon: <Crown className="h-5 w-5 text-amber-400" />, idx: 0 },
    { height: "h-16", label: "3rd", color: "text-amber-600", icon: <Medal className="h-4 w-4 text-amber-600" />, idx: 2 },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6 pb-24">

      {/* Holographic Header */}
      <PageHero
        icon={Trophy}
        accent="#f59e0b"
        eyebrow={t("leaderboard.weeklyBest")}
        title={t("leaderboard.title")}
        badge={
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
            style={{ color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>
            <Flame className="h-2.5 w-2.5" /> {t("explore.trending")}
          </span>
        }
        className="mb-5"
      />

      {user && (
        <div className="mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center gap-2 text-sm">
            <Target className="h-5 w-5 text-emerald-400" />
            <span className="font-semibold text-foreground">معرفة ترتيبك الشخصي</span>
          </div>
          {myRank ? (
            <div className="flex items-center gap-3 bg-[var(--primary-dim)] px-4 py-2 rounded-xl border border-[var(--primary)]/30">
              <span className="text-xs text-[var(--primary)] font-bold">التصنيف: #{myRank.rank}</span>
              <span className="text-xs text-[var(--primary)] opacity-70">|</span>
              <span className="text-xs text-[var(--primary)] font-bold">النقاط: {formatCount(myRank.value)}</span>
            </div>
          ) : (
            <button onClick={fetchMyRank} disabled={loadingRank}
              className="w-full sm:w-auto rounded-xl px-5 py-2 text-xs font-bold text-white transition-all shadow-md flex justify-center items-center gap-2"
              style={{ background: "linear-gradient(135deg, var(--primary), #3b82f6)" }}>
              {loadingRank ? <Loader2 className="h-4 w-4 animate-spin" /> : "أين مكاني في السيرفر؟"}
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center rounded-2xl border border-border bg-card p-1 mb-3">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setUserType(tab.id as "developers" | "all")}
            className={cn("flex-1 rounded-xl px-3 py-2.5 text-xs font-black transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]",
              userType === tab.id ? "text-white shadow-md" : "text-muted-foreground hover:text-foreground"
            )}
            style={userType === tab.id ? { background: "linear-gradient(135deg, var(--primary), #3b82f6)", boxShadow: "0 4px 12px rgba(29,155,240,0.3)" } : undefined}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Categories */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none mb-4">
        {CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)}
            className={cn("shrink-0 flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-black transition-all hover:scale-105 active:scale-95",
              cat === c.id ? "text-white shadow-lg" : "border border-border text-muted-foreground hover:text-foreground hover:border-[var(--primary)]/30"
            )}
            style={cat === c.id ? { background: "linear-gradient(135deg, var(--primary), #3b82f6)", boxShadow: "0 3px 10px rgba(29,155,240,0.22)" } : undefined}>
            <c.icon className={`h-3.5 w-3.5 transition-transform ${cat === c.id ? "scale-110" : ""}`} />
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--primary)" }} />
            <div className="absolute inset-0 rounded-2xl dragon-breathe" style={{ border: "1px solid rgba(29,155,240,0.25)" }} />
          </div>
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-3xl border border-border bg-card">
            <Trophy className="h-7 w-7 text-muted-foreground/30" />
          </div>
          <p className="text-sm font-black text-muted-foreground">{t("home.noResults")}</p>
        </div>
      ) : (
        <>
          {/* ── Podium ── */}
          {top3.length >= 2 && (
            <div className="relative mb-5 flex items-end justify-center gap-3 overflow-hidden rounded-3xl border border-border bg-card p-5 pt-6">
              {/* Podium ambient */}
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: "radial-gradient(ellipse 100% 60% at 50% 0%, rgba(245,158,11,0.06) 0%, transparent 60%)" }} />
              <div className="absolute inset-x-0 top-0 h-px"
                style={{ background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.4), transparent)" }} />

              {(top3.length === 3 ? podiumOrder : top3).map((u, podiumIdx) => {
                const realIdx = top3.length === 3 ? [1, 0, 2][podiumIdx] : podiumIdx;
                const conf = podiumConfig[podiumIdx];
                const level = getLevel(u.xp);
                const val = valueForCat(u);

                const ringColors = ["ring-amber-400/60", "ring-gray-300/40", "ring-amber-600/40"];
                const podiumBgs = [
                  "bg-gray-300/10 border-gray-300/20",
                  "bg-amber-400/20 border-amber-400/40",
                  "bg-amber-600/10 border-amber-600/20",
                ];

                return (
                  <Link key={u.id} href={`/u/${u.id}`}
                    className="group flex flex-col items-center gap-2 flex-1 max-w-[100px] transition-transform hover:-translate-y-1">
                    {/* Crown/Medal with glow */}
                    <div className={`flex h-8 items-center justify-center transition-transform group-hover:scale-125 group-hover:rotate-[-5deg] duration-300 ${realIdx === 0 ? "drop-shadow-[0_0_6px_rgba(245,158,11,0.35)]" : ""}`}>
                      {conf.icon}
                    </div>
                    {/* Avatar */}
                    <div className={cn("relative rounded-2xl ring-2 transition-all group-hover:scale-110 group-hover:shadow-xl", ringColors[podiumIdx])}>
                      <Image src={safeImg(u.photo, DEFAULT_AVATAR)} alt={u.name} width={52} height={52}
                        className="rounded-2xl object-cover" crossOrigin="anonymous" />
                      {isDeveloper(u) && (
                        <div className="absolute -bottom-1.5 -end-1.5 rounded-full bg-card p-0.5 ring-1 ring-card">
                          <BadgeCheck className="h-4 w-4" style={{ color: "var(--primary)", filter: "drop-shadow(0 0 3px rgba(29,155,240,0.28))" }} />
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] font-black text-foreground text-center line-clamp-1 w-full">{u.name}</p>
                    <p className={cn("text-xs font-black tabular-nums", conf.color)}>
                      {val === null ? "—" : formatCount(val)}
                    </p>
                    {/* Podium base */}
                    <div className={cn("w-full rounded-t-2xl border transition-all duration-300", conf.height, podiumBgs[podiumIdx])} />
                  </Link>
                );
              })}
            </div>
          )}

          {/* ── Rest of list ── */}
          {rest.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {rest.map((u, i) => {
                const idx = i + 3;
                const level = getLevel(u.xp);
                const val = valueForCat(u);
                return (
                  <Link key={u.id} href={`/u/${u.id}`}
                    className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-all hover:border-[var(--primary)]/30 hover:bg-muted/30 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] overflow-hidden relative">
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: "radial-gradient(ellipse 60% 60% at 0% 50%, rgba(29,155,240,0.04) 0%, transparent 70%)" }} />
                    {/* Rank number */}
                    <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-muted text-[10px] font-black text-muted-foreground">
                      {idx + 1}
                    </span>
                    <Image src={safeImg(u.photo, DEFAULT_AVATAR)} alt={u.name} width={38} height={38}
                      className="relative shrink-0 rounded-2xl ring-1 ring-border transition-transform group-hover:scale-110" crossOrigin="anonymous" />
                    <div className="relative flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-black text-foreground truncate">{u.name}</p>
                        {isDeveloper(u) && (
                          <BadgeCheck className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:scale-110"
                            style={{ color: "var(--primary)", filter: "drop-shadow(0 0 3px rgba(29,155,240,0.25))" }} />
                        )}
                        <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black"
                          style={{ color: "var(--primary)", backgroundColor: "var(--primary-dim)" }}>
                          Lv.{level.level}
                        </span>
                      </div>
                      {u.username && <p className="text-[10px] text-muted-foreground font-mono">@{u.username}</p>}
                    </div>
                    <div className="relative shrink-0 text-end">
                      <p className="text-sm font-black text-foreground tabular-nums">{val === null ? <span className="text-muted-foreground/40">—</span> : formatCount(val)}</p>
                      <p className="text-[9px] text-muted-foreground/60">{CATEGORIES.find((c) => c.id === cat)?.label}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
