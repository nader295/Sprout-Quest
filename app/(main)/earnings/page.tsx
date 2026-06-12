"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { apiGetStats, apiListRoms } from "@/lib/api/client";
import { formatCount, cn } from "@/lib/utils";
import Link from "next/link";
import {
  TrendingUp, Download, Eye, Heart, DollarSign,
  ChevronRight, Zap, Info, RefreshCw, ExternalLink,
  Tv, Users, Package, ArrowUpRight, ArrowDownRight,
  Wallet, BarChart3, Clock, Star, Shield, Award,
} from "lucide-react";
import { getLevel, AD_SUPPORT } from "@/lib/constants";
import type { RomItem } from "@/lib/types";
import PageHero from "@/components/shared/page-hero";
import { useTranslation } from "@/lib/i18n";

// ── Revenue calc ────────────────────────────────────────
function calcEarnings(supports: number, adSupportEarnings: number) {
  const legacySupportRevenue = supports * 0.002;
  const adRevenue = adSupportEarnings;
  const platformFee = adRevenue * (AD_SUPPORT.PLATFORM_SHARE / AD_SUPPORT.DEV_SHARE);
  const total = adRevenue + legacySupportRevenue;
  return {
    adRevenue: +adRevenue.toFixed(4),
    platformFee: +platformFee.toFixed(4),
    supports: +legacySupportRevenue.toFixed(4),
    total: +total.toFixed(4),
  };
}

export default function StudioPage() {
  const { isLoggedIn, userDoc, loading: authLoading } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [roms, setRoms] = useState<RomItem[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "content" | "revenue">("overview");

  const isDev = userDoc?.role === "verifiedDev" || userDoc?.role === "admin" || userDoc?.role === "owner";

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await apiListRoms({ max: 50, sortBy: "newest" });
      if (r?.items) {
        const myRoms = r.items.filter((rom: RomItem) => rom.maintainerUid === userDoc?.uid);
        setRoms(myRoms);
      }
    } catch { /* ignore */ }
    setRefreshing(false);
  }, [userDoc?.uid]);

  useEffect(() => {
    if (!authLoading && !isLoggedIn) router.push("/login?redirect=/earnings");
    if (isLoggedIn && userDoc?.uid) load();
  }, [isLoggedIn, authLoading, userDoc?.uid]);

  if (authLoading) return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
    </div>
  );

  const totalDownloads = userDoc?.totalDownloads ?? 0;
  const totalViews = userDoc?.totalViewsReceived ?? 0;
  const totalSupports = userDoc?.totalSupportsReceived ?? 0;
  const totalAdSupports = userDoc?.totalAdSupports ?? 0;
  const adSupportEarnings = userDoc?.adSupportEarnings ?? 0;
  const earnings = calcEarnings(totalSupports, adSupportEarnings);
  const level = getLevel(userDoc?.xp ?? 0);
  const romsCount = userDoc?.romsCount ?? 0;

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: BarChart3 },
    { id: "content" as const, label: "Content", icon: Package },
    { id: "revenue" as const, label: "Revenue", icon: Wallet },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
        <Link href="/" className="hover:text-[var(--primary)] transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium">RomX Studio</span>
      </nav>

      {/* Holographic Studio Header */}
      <PageHero
        icon={Tv}
        accent="#8b5cf6"
        eyebrow="Creator Dashboard"
        title="RomX Studio"
        description="Track your earnings, performance and payouts — all in one place."
        stats={[
          { label: "Level", value: level.level, icon: Shield },
          { label: "Uploads", value: romsCount, icon: Tv },
          ...(isDev ? [{ label: "Verified", value: "Dev", icon: Star }] : []),
        ]}
        badge={isDev ? (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
            style={{ color: "#10b981", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }}>
            <Star className="h-2.5 w-2.5" /> Pro
          </span>
        ) : undefined}
        actions={
          <button onClick={load} disabled={refreshing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:border-[var(--primary)]/30 transition-all disabled:opacity-50 whitespace-nowrap backdrop-blur-sm bg-card/50">
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </button>
        }
      />

      {/* ── Tab Navigation ───────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-2xl bg-muted/30 border border-border/50">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all",
              activeTab === tab.id
                ? "bg-card text-foreground shadow-sm border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            )}>
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Not Developer Warning ──────────────────────── */}
      {!isDev && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <Award className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-300">Reach Level 7 to Unlock Earnings</p>
            <p className="text-xs text-amber-400/70 mt-1">
              Upload quality ROMs, get views & downloads to level up. Or{" "}
              <Link href="/contact" className="underline hover:text-amber-300">contact us</Link> for early verification.
            </p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          OVERVIEW TAB
      ═══════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Revenue Hero */}
          <div className="relative rounded-2xl border border-[var(--primary)]/30 overflow-hidden"
            style={{ background: "linear-gradient(135deg, rgba(var(--card-rgb),1), rgba(var(--card-rgb),0.95))" }}>
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at top right, var(--primary-glow), transparent 60%)" }} />
            <div className="relative z-10 p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(var(--primary-rgb),0.15)" }}>
                    <DollarSign className="h-4 w-4 text-[var(--primary)]" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--primary)]">Est. Total Earnings</p>
                    <p className="text-[10px] text-muted-foreground">Lifetime revenue</p>
                  </div>
                </div>
                <Link href="#" onClick={(e) => { e.preventDefault(); setActiveTab("revenue"); }}
                  className="flex items-center gap-1 text-[10px] text-[var(--primary)] hover:underline font-medium">
                  Details <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              <p className="text-4xl sm:text-5xl font-black text-foreground tracking-tight">
                ${earnings.total.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {totalAdSupports} ad supports received • 90% revenue share
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Eye, label: "Views", value: formatCount(totalViews), color: "#3b82f6" },
              { icon: Download, label: "Downloads", value: formatCount(totalDownloads), color: "#22c55e" },
              { icon: Heart, label: "Supports", value: formatCount(totalSupports + totalAdSupports), color: "#f43f5e" },
              { icon: Package, label: "Uploads", value: String(romsCount), color: "#f59e0b" },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border border-border bg-card p-3.5 hover:border-[var(--primary)]/20 transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: `${s.color}15` }}>
                    <s.icon className="h-3.5 w-3.5" style={{ color: s.color }} />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</span>
                </div>
                <p className="text-xl font-black text-foreground">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Top Content (mini preview) */}
          {roms.length > 0 && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border/50">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[var(--primary)]" />
                  Top Content
                </h3>
                <button onClick={() => setActiveTab("content")}
                  className="text-[10px] text-[var(--primary)] hover:underline font-medium flex items-center gap-0.5">
                  View All <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              <div className="divide-y divide-border/30">
                {roms.slice(0, 3).map((rom, i) => (
                  <Link key={rom.id} href={`/rom/${rom.id}`}
                    className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors">
                    <span className="text-xs font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{rom.name}</p>
                      <p className="text-[10px] text-muted-foreground">{rom.contentType || "rom"}</p>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Eye className="h-3 w-3" /> {formatCount(rom.total_views ?? 0)}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Download className="h-3 w-3" /> {formatCount(rom.downloads ?? 0)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          CONTENT TAB
      ═══════════════════════════════════════════════════ */}
      {activeTab === "content" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Package className="h-4 w-4 text-[var(--primary)]" />
              Your Uploads ({roms.length})
            </h2>
          </div>

          {roms.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No uploads yet</p>
              <p className="text-xs mt-1">Start uploading to see your content here</p>
              <Link href="/upload"
                className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl text-xs font-bold text-white"
                style={{ background: "linear-gradient(135deg, var(--primary), #3b82f6)" }}>
                Upload Now <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              {/* Table Header */}
              <div className="hidden sm:grid grid-cols-12 gap-2 p-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 bg-muted/20">
                <div className="col-span-5">Content</div>
                <div className="col-span-2 text-center">Views</div>
                <div className="col-span-2 text-center">Downloads</div>
                <div className="col-span-1 text-center">Likes</div>
                <div className="col-span-2 text-center">Supports</div>
              </div>
              <div className="divide-y divide-border/30">
                {roms.map(rom => (
                  <Link key={rom.id} href={`/rom/${rom.id}`}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 hover:bg-muted/20 transition-colors items-center">
                    {/* Name */}
                    <div className="sm:col-span-5 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{rom.name}</p>
                        <p className="text-[10px] text-muted-foreground">{rom.contentType || "rom"} • v{rom.version || "1.0"}</p>
                      </div>
                    </div>
                    {/* Stats (mobile: inline, desktop: columns) */}
                    <div className="sm:col-span-7 grid grid-cols-4 sm:grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-sm font-bold text-foreground">{formatCount(rom.total_views ?? 0)}</p>
                        <p className="text-[9px] text-muted-foreground sm:hidden">Views</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{formatCount(rom.downloads ?? 0)}</p>
                        <p className="text-[9px] text-muted-foreground sm:hidden">Downloads</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{formatCount(rom.likesCount ?? 0)}</p>
                        <p className="text-[9px] text-muted-foreground sm:hidden">Likes</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--primary)]">{formatCount(rom.supportCount ?? 0)}</p>
                        <p className="text-[9px] text-muted-foreground sm:hidden">Supports</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          REVENUE TAB
      ═══════════════════════════════════════════════════ */}
      {activeTab === "revenue" && (
        <LinkvertiseRevenueTab userDoc={userDoc} roms={roms} />
      )}
    </div>
  );
}

// ── Linkvertise Revenue Tab ──────────────────────────────────────────
function LinkvertiseRevenueTab({ userDoc, roms }: { userDoc: import("@/lib/types").UserDoc | null; roms: import("@/lib/types").RomItem[] }) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<{
    earnings: { gross: number; net: number; platform: number; currency: string };
    clicks: { total: number; today: number; month: number };
    lastSync: string | null;
    publisherId: string;
    globalEnabled: boolean;
    syncError: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { apiGetLinkvertiseStats } = await import("@/lib/api/client");
        const data = await apiGetLinkvertiseStats();
        setStats(data);
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    })();
  }, []);

  const lvRoms = roms.filter(r => r.linkvertiseEnabled);
  const net = stats?.earnings.net ?? 0;
  const platform = stats?.earnings.platform ?? 0;

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="space-y-4">

      {/* ── Publisher ID warning ─────────────────────── */}
      {!stats?.publisherId && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4">
          <Zap className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-amber-300">{t("earnings.enterPublisherId")}</p>
            <p className="text-muted-foreground">{t("earnings.syncDesc")}</p>
            <a href="/settings#monetization" className="inline-flex items-center gap-1 text-amber-400 hover:underline mt-1">
              <ExternalLink className="h-3 w-3" /> {t("earnings.goToSettings")}
            </a>
          </div>
        </div>
      )}

      {/* ── Net Earnings Summary ─────────────────────── */}
      <div className="relative rounded-2xl border border-blue-500/20 overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.06), rgba(0,0,0,0))" }}>
        <div className="p-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-1">{t("earnings.netLabel")}</p>
            <p className="text-4xl font-black text-foreground">${net.toFixed(4)}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("earnings.platformFee")}</p>
          </div>
          <div className="text-right space-y-1 shrink-0">
            <p className="text-[10px] text-muted-foreground">{t("earnings.commissionLabel")}</p>
            <p className="text-sm font-black text-muted-foreground">${platform.toFixed(4)}</p>
          </div>
        </div>
        {stats?.lastSync && (
          <div className="border-t border-white/5 px-5 py-2 flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-muted-foreground/60" />
            <p className="text-[10px] text-muted-foreground/60">
              آخر مزامنة: {new Date(stats.lastSync).toLocaleString("ar-EG")}
            </p>
          </div>
        )}
      </div>

      {/* ── Click Stats ──────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t("earnings.clicksToday"),  value: stats?.clicks.today ?? 0,  color: "#3b82f6" },
          { label: t("earnings.clicksMonth"),  value: stats?.clicks.month ?? 0,  color: "#8b5cf6" },
          { label: t("earnings.clicksTotal"), value: stats?.clicks.total ?? 0, color: "#10b981" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4 text-center">
            <p className="text-2xl font-black" style={{ color: s.color }}>{s.value.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── ROMs with Linkvertise enabled ────────────── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-400" />
            منشوراتك المُفعَّل عليها Linkvertise
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
              {lvRoms.length}
            </span>
          </h3>
          <a href="/settings#monetization" className="text-[10px] text-[var(--primary)] hover:underline flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> {t("earnings.goToSettings")}
          </a>
        </div>
        {lvRoms.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">{t("earnings.noPosts")}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">{t("earnings.enableHint")}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {lvRoms.slice(0, 8).map(rom => (
              <a key={rom.id} href={`/rom/${rom.id}`}
                className="flex items-center justify-between p-3 hover:bg-muted/20 transition-colors group">
                <div className="flex items-center gap-3 min-w-0">
                  {rom.thumbnail && (
                    <img src={rom.thumbnail} alt="" className="h-8 w-8 rounded-lg object-cover shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{rom.name}</p>
                    <p className="text-[10px] text-muted-foreground">{rom.downloads.toLocaleString()} {t("earnings.downloads", { n: "" }).replace("{n} ", "")}</p>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full bg-blue-500/12 text-blue-400 border border-blue-500/20 shrink-0">
                  <Zap className="h-2.5 w-2.5" /> {t("earnings.adLabel")}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ── Info ─────────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-2xl border border-border/40 bg-muted/10 p-4">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p>{t("earnings.disclaimer")}</p>
          <a href="https://linkvertise.com/publisher" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[var(--primary)] hover:underline mt-1">
            <ExternalLink className="h-3 w-3" /> {t("earnings.dashboardLink")}
          </a>
        </div>
      </div>

    </div>
  );
}
