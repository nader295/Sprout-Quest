"use client";

import { useEffect, useState } from "react";
import { BarChart2, DollarSign, Download, Eye, Heart, Loader2, Lock, Package, TrendingUp, Youtube, Zap } from "lucide-react";
import { apiGetDeveloperAnalytics } from "@/lib/api/client";
import { formatCount } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import type { UserDoc } from "@/lib/types";
import { logger } from "@/lib/logger";

// ── RomX Studio (Analytics Tab) ─────────────────────────────────────────────
// Self-contained: fetches its own analytics. Requires Developer level (600 XP)
// to render; otherwise shows a paywall-style locked card.
export function AnalyticsTab({ profile }: { profile: UserDoc }) {
  const { t } = useTranslation();

  // Developer level required (XP >= 600)
  const isDev = (profile.xp ?? 0) >= 600;

  const [data, setData] = useState<{
    totalViews: number; totalDownloads: number; totalLikes: number; totalRoms?: number;
    totalAdSupports: number; adSupportEarnings: number;
    topRoms: { id: string; name: string; views: number; downloads: number }[];
    viewsByDay?: { date: string; views: number }[];
    downloadsByDay?: { date: string; downloads: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(isDev);
  const [chartMode, setChartMode] = useState<"views" | "downloads">("views");

  useEffect(() => {
    if (isDev) {
      apiGetDeveloperAnalytics()
        .then(setData)
        .catch((err) => logger.error("profile.analytics.load", err))
        .finally(() => setLoading(false));
    }
  }, [isDev]);

  if (!isDev) {
    return (
      <div className="relative rounded-3xl overflow-hidden gradient-border bg-card/60 p-8 flex flex-col items-center justify-center text-center min-h-[360px] animate-in fade-in duration-700">
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(6,182,212,0.4), transparent)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 10%, rgba(6,182,212,0.06) 0%, transparent 60%)" }} />

        {/* Fake blurred interface */}
        <div className="absolute inset-0 pointer-events-none opacity-20" style={{ filter: "blur(12px) grayscale(70%)" }}>
          <div className="absolute top-10 start-10 h-16 w-32 bg-cyan-500/20 rounded-xl" />
          <div className="absolute top-10 end-10 h-16 w-32 bg-purple-500/20 rounded-xl" />
          <div className="absolute bottom-10 inset-x-10 h-32 bg-blue-500/20 rounded-xl" />
        </div>

        <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-3xl mb-5 shadow-2xl"
          style={{ background: "linear-gradient(135deg, rgba(8,145,178,0.2), rgba(139,92,246,0.15))", border: "1px solid rgba(8,145,178,0.3)" }}>
          <Lock className="h-8 w-8 text-cyan-400 drop-shadow-md" />
        </div>

        <h3 className="relative z-10 text-2xl font-black text-foreground mb-3 tracking-tight">RomX Studio</h3>
        <p className="relative z-10 text-sm text-muted-foreground/80 max-w-sm leading-relaxed mb-8">
          {t("analytics.lockedDesc") || "Unlock the ultimate creator dashboard. Track real-time algorithmic impressions, engagement sources, and daily trends for all your releases."}
        </p>

        <div className="relative z-10 flex items-center gap-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 px-5 py-3 shadow-inner">
          <Zap className="h-4 w-4 text-cyan-400 drop-shadow-md" />
          <span className="text-xs font-black tracking-wide text-cyan-400">
            {t("analytics.unlockReq") || "Unlocks at Developer Level (600 XP)"}
          </span>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--primary)" }} />
      <p className="text-xs font-bold text-muted-foreground animate-pulse">{t("common.loading") || "Loading Studio..."}</p>
    </div>
  );
  if (!data) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <BarChart2 className="h-8 w-8 text-muted-foreground/30 mb-4" />
      <p className="text-sm font-bold text-muted-foreground">{t("analytics.failed") || "Failed to load Analytics"}</p>
    </div>
  );

  const chartData = chartMode === "views" ? data.viewsByDay : data.downloadsByDay;
  const maxVal = Math.max(...(chartData?.map((d: { views?: number; downloads?: number }) => d.views || d.downloads || 0) || [1]), 1);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Studio Header */}
      <div className="flex items-center gap-3 px-2 mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-[0_0_15px_rgba(29,155,240,0.4)]"
          style={{ background: "linear-gradient(135deg, var(--primary), #3b82f6)", border: "1px solid rgba(255,255,255,0.2)" }}>
          <BarChart2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-black text-foreground leading-tight tracking-tight">RomX Studio</h2>
          <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-widest">{t("analytics.dashboard") || "Creator Dashboard"}</p>
        </div>
        <div className="ms-auto flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-1 border border-emerald-500/20 shadow-inner">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse drop-shadow-md" />
          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Live</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
        {[
          { label: t("analytics.totalViews"),     value: data.totalViews,     icon: Eye,      color: "#38bdf8", bg: "rgba(56,189,248,0.08)",   border: "rgba(56,189,248,0.2)"  },
          { label: t("analytics.totalDownloads"), value: data.totalDownloads, icon: Download, color: "#34d399", bg: "rgba(52,211,153,0.08)",   border: "rgba(52,211,153,0.2)"  },
          { label: t("analytics.totalLikes"),     value: data.totalLikes,     icon: Heart,    color: "#fb7185", bg: "rgba(251,113,133,0.08)",  border: "rgba(251,113,133,0.2)" },
          { label: t("profile.releases"),         value: data.totalRoms || 0, icon: Package,  color: "#a855f7", bg: "rgba(168,85,247,0.08)",   border: "rgba(168,85,247,0.2)" },
          { label: "Ad Supports",                 value: data.totalAdSupports || 0, icon: Youtube, color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)" },
          { label: "Est. Revenue",                value: data.adSupportEarnings || 0, isCurrency: true, icon: DollarSign, color: "#22c55e", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)" },
        ].map((s) => (
          <div key={s.label}
            className="group relative flex flex-col items-center justify-center gap-2 rounded-3xl py-5 transition-all hover:scale-[1.03] cursor-default overflow-hidden gradient-border card-shadow"
            style={{ background: `linear-gradient(135deg, ${s.bg} 0%, transparent 100%)` }}>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-duration-500" style={{ background: `radial-gradient(circle at 50% 10%, ${s.color}20 0%, transparent 70%)` }} />
            <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl transition-transform group-hover:scale-110 shadow-inner"
              style={{ background: `${s.color}20`, border: `1px solid ${s.color}40`, filter: `drop-shadow(0 4px 12px ${s.color}30)` }}>
              <s.icon className="h-5 w-5" style={{ color: s.color }} />
            </div>
            <span className="relative text-2xl font-black tabular-nums leading-none tracking-tight" style={{ color: s.color }}>
              {s.isCurrency ? `$${Number(s.value).toFixed(2)}` : formatCount(s.value)}
            </span>
            <span className="relative text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 text-center px-2">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Daily chart — last 30 days */}
      {chartData && chartData.length > 0 && (
        <div className="relative rounded-2xl border border-border bg-card overflow-hidden p-4">
          <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(29,155,240,0.3), transparent)" }} />
          {/* Chart header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black text-foreground flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />
              {t("analytics.last30Days")}
            </h3>
            <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-0.5">
              {(["views", "downloads"] as const).map(m => (
                <button key={m} onClick={() => setChartMode(m)}
                  className="rounded-lg px-2.5 py-1 text-[10px] font-black transition-all"
                  style={chartMode === m ? { background: "linear-gradient(135deg, var(--primary), #6366f1)", color: "white", boxShadow: "0 2px 8px rgba(29,155,240,0.3)" }
                    : { color: "rgb(var(--muted-foreground))" }}>
                  {m === "views" ? t("analytics.views") : t("analytics.downloads")}
                </button>
              ))}
            </div>
          </div>

          {/* Mini bar chart */}
          <div className="flex items-end gap-0.5 h-24">
            {chartData.slice(-30).map((d: { date: string; views?: number; downloads?: number }, i: number) => {
              const val = d.views || d.downloads || 0;
              const h = Math.max(2, (val / maxVal) * 100);
              const color = chartMode === "views" ? "#38bdf8" : "#34d399";
              return (
                <div key={i} className="group/bar flex-1 flex flex-col items-center justify-end relative"
                  title={`${d.date}: ${val}`}>
                  <div className="w-full rounded-t-sm transition-all hover:opacity-80"
                    style={{ height: `${h}%`, background: `${color}${i === 29 ? "ff" : "80"}`, minHeight: 2 }} />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-muted-foreground/40">
            <span>{chartData[0]?.date?.slice(5)}</span>
            <span>{t("profile.today")}</span>
          </div>
        </div>
      )}

      {/* Top ROMs */}
      {data.topRoms.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
            <BarChart2 className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />
            <span className="text-xs font-black text-foreground">{t("analytics.topReleases")}</span>
          </div>
          <div className="divide-y divide-border/30">
            {data.topRoms.slice(0, 5).map((rom, i) => (
              <div key={rom.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                <span className="text-xs font-black tabular-nums text-muted-foreground/40 w-4">#{i+1}</span>
                <p className="flex-1 text-xs font-bold text-foreground truncate">{rom.name}</p>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground shrink-0">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3 text-sky-400" />{formatCount(rom.views)}</span>
                  <span className="flex items-center gap-1"><Download className="h-3 w-3 text-emerald-400" />{formatCount(rom.downloads)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
