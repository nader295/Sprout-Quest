"use client";
import { useTranslation } from "@/lib/i18n";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Download, Heart, Star, BellRing, Search, X,
  SlidersHorizontal, RefreshCw, AlertCircle, AlertTriangle,
  CheckCircle, ChevronDown, Zap, Globe, HardDrive, Puzzle,
  Loader2, Package, Cpu, Calendar, Smartphone, Shield,
  TrendingUp, Clock, Pencil,
} from "lucide-react";
import { RomCard, RomCardSkeleton } from "@/components/rom/rom-card";
import { useAuth } from "@/lib/hooks/use-auth";
import { logger } from "@/lib/logger";
import { useInfiniteScroll } from "@/lib/hooks/use-infinite-scroll";
import type { RomItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DeviceImage } from "@/components/device/device-image";

interface DeviceInfo {
  codename: string; name: string; brand: string;
  chipset?: string; released?: string;
  aliases?: string[]; imageUrl?: string | null;
}
interface PageData {
  device: DeviceInfo | null; items: RomItem[];
  total: number; totalDownloads?: number;
  totalLikes?: number; avgRating?: number;
}

const SORT_OPTIONS = [
  { value: "trend_score", labelKey: "sort.trending",       icon: TrendingUp },
  { value: "downloads",   labelKey: "sort.mostDownloaded",  icon: Download },
  { value: "rating_avg",  labelKey: "sort.rating",           icon: Star },
  { value: "created_at",  labelKey: "sort.newest",           icon: Clock },
] as const;

const TYPE_META = [
  { key:"rom",      label:"ROM",      color:"bg-sky-500/15 text-sky-300 border-sky-500/25",             icon: Smartphone },
  { key:"kernel",   label:"Kernel",   color:"bg-violet-500/15 text-violet-300 border-violet-500/25",    icon: Cpu },
  { key:"recovery", label:"Recovery", color:"bg-amber-500/15 text-amber-300 border-amber-500/25",       icon: HardDrive },
  { key:"module",   label:"Module",   color:"bg-emerald-500/15 text-emerald-300 border-emerald-500/25", icon: Puzzle },
  { key:"gsi",      label:"GSI",      color:"bg-rose-500/15 text-rose-300 border-rose-500/25",          icon: Globe },
];

const BRAND_COLORS: Record<string, { from: string; to: string; accent: string; badge: string; shadow: string }> = {
  Samsung:  { from:"#1428A0", to:"#0A6EFF", accent:"#3b82f6", badge:"bg-blue-500/20 text-blue-300 border-blue-500/30",    shadow:"shadow-blue-500/20"   },
  Xiaomi:   { from:"#FF6900", to:"#FF9800", accent:"#f97316", badge:"bg-orange-500/20 text-orange-300 border-orange-500/30",shadow:"shadow-orange-500/20" },
  OnePlus:  { from:"#EB0029", to:"#FF3050", accent:"#ef4444", badge:"bg-red-500/20 text-red-300 border-red-500/30",        shadow:"shadow-red-500/20"    },
  Google:   { from:"#1a73e8", to:"#34a853", accent:"#22c55e", badge:"bg-green-500/20 text-green-300 border-green-500/30",  shadow:"shadow-green-500/20"  },
  Nothing:  { from:"#555",    to:"#888",    accent:"#9ca3af", badge:"bg-white/10 text-gray-300 border-white/20",           shadow:"shadow-gray-400/20"   },
  Realme:   { from:"#FFD800", to:"#FF6D00", accent:"#eab308", badge:"bg-yellow-500/20 text-yellow-300 border-yellow-500/30",shadow:"shadow-yellow-500/20" },
  Motorola: { from:"#5C2D91", to:"#9C27B0", accent:"#a855f7", badge:"bg-purple-500/20 text-purple-300 border-purple-500/30",shadow:"shadow-purple-500/20" },
  ASUS:     { from:"#00AEEF", to:"#0078D4", accent:"#06b6d4", badge:"bg-cyan-500/20 text-cyan-300 border-cyan-500/30",    shadow:"shadow-cyan-500/20"   },
  ZTE:      { from:"#4CAF50", to:"#2E7D32", accent:"#84cc16", badge:"bg-lime-500/20 text-lime-300 border-lime-500/30",    shadow:"shadow-lime-500/20"   },
  Nubia:    { from:"#4CAF50", to:"#2E7D32", accent:"#84cc16", badge:"bg-lime-500/20 text-lime-300 border-lime-500/30",    shadow:"shadow-lime-500/20"   },
  Sony:     { from:"#003087", to:"#0057B7", accent:"#64748b", badge:"bg-slate-500/20 text-slate-300 border-slate-500/30", shadow:"shadow-slate-400/20"  },
  Huawei:   { from:"#CF0A2C", to:"#E53935", accent:"#e11d48", badge:"bg-rose-500/20 text-rose-300 border-rose-500/30",   shadow:"shadow-rose-500/20"   },
  Vivo:     { from:"#415FFF", to:"#7B8CFF", accent:"#7c3aed", badge:"bg-violet-500/20 text-violet-300 border-violet-500/30",shadow:"shadow-violet-500/20"},
};
const DB = BRAND_COLORS.Samsung;

export default function DeviceDetailPage() {
  const { t } = useTranslation();
  const { codename } = useParams<{ codename: string }>();
  const router = useRouter();
  const { user, isAdmin, isOwner } = useAuth();

  const [data, setData]           = useState<PageData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [sort, setSort]           = useState("trend_score");
  const [watching, setWatching]   = useState(false);
  const [watchLoading, setWatchLoading] = useState(false);
  const [error, setError]         = useState("");
  const [reportOpen, setReportOpen]   = useState(false);
  const [reportType, setReportType]   = useState("wrong_codename");
  const [editOpen, setEditOpen]       = useState(false);
  const [editForm, setEditForm]       = useState({ name: "", chipset: "", released: "", aliases: "" });
  const [editSaving, setEditSaving]   = useState(false);
  const [editSaved, setEditSaved]     = useState(false);
  const [reportSuggested, setReportSuggested] = useState("");
  const [reportNote, setReportNote]   = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSent, setReportSent]   = useState(false);
  const [searchQ, setSearchQ]     = useState("");
  const [filterAndroid, setFilterAndroid] = useState("");
  const [filterType, setFilterType]   = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort]   = useState(false);
  const [hasMore, setHasMore]     = useState(true);

  const fetchData = useCallback(async (append = false) => {
    if (!append) setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ codename, page: String(page), limit: "24" });
      if (sort) params.set("sort", sort);
      const res = await fetch(`/api/devices?${params}`);
      if (!res.ok) throw new Error("Failed");
      const result = await res.json() as PageData;
      if (append && data) {
        setData({ ...result, items: [...data.items, ...result.items] });
      } else {
        setData(result);
      }
      setHasMore(result.items.length >= 24);
    } catch { setError(t("devices.loadFailed")); }
    finally { setLoading(false); }
  }, [codename, page, sort, data]);

  useEffect(() => { fetchData(page > 1); }, [page, sort, codename]);

  const { sentinelRef, loading: infiniteLoading } = useInfiniteScroll({
    onLoadMore: () => setPage(p => p + 1),
    enabled: hasMore && !loading && !searchQ && !filterAndroid && !filterType,
  });

  useEffect(() => {
    if (!user) return;
    user.getIdToken().then(token =>
      fetch("/api/devices/watch", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then((d: { devices: string[] }) => setWatching((d.devices || []).includes(codename)))
        // Silent failure here makes the Watch/Unwatch toggle show the wrong
        // state to the user — surface so we catch regressions in /api/devices/watch.
        .catch((err) => logger.error("devices.codename.watchCheck", err, { codename }))
    );
  }, [user, codename]);

  async function toggleWatch() {
    if (!user) { router.push("/login"); return; }
    setWatchLoading(true);
    try {
      const token = await user.getIdToken();
      await fetch("/api/devices/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ device: codename, action: watching ? "unwatch" : "watch" }),
      });
      setWatching(!watching);
    } finally { setWatchLoading(false); }
  }

  async function saveDevice() {
    if (!user) return;
    setEditSaving(true);
    try {
      const token = await user.getIdToken();
      const body: Record<string, string | string[]> = {};
      if (editForm.name.trim())     body.display_name = editForm.name.trim();
      if (editForm.chipset.trim())  body.chipset       = editForm.chipset.trim();
      if (editForm.released.trim()) body.released      = editForm.released.trim();
      if (editForm.aliases.trim())  body.aliases       = editForm.aliases.split(",").map(a => a.trim()).filter(Boolean);

      const res = await fetch(`/api/admin/devices`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ codename, ...body }),
      });
      if (res.ok) {
        setEditSaved(true);
        // Update local device info immediately
        setData(prev => prev ? {
          ...prev,
          device: prev.device ? {
            ...prev.device,
            name:     (body.display_name as string) || prev.device.name,
            chipset:  (body.chipset as string)       || prev.device.chipset,
            released: (body.released as string)      || prev.device.released,
          } : prev.device,
        } : prev);
        setTimeout(() => { setEditSaved(false); setEditOpen(false); }, 2000);
      }
    } catch { /* ignore */ } finally { setEditSaving(false); }
  }

  async function submitReport() {
    if (!user) { router.push("/login"); return; }
    setReportLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/archive-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          codename, report_type: reportType,
          current_value: reportType === "wrong_codename" ? codename : device?.name || "",
          suggested_value: reportSuggested.trim(), note: reportNote.trim(),
        }),
      });
      if (res.ok) {
        setReportSent(true);
        setTimeout(() => { setReportOpen(false); setReportSent(false); setReportSuggested(""); setReportNote(""); }, 2500);
      }
    } finally { setReportLoading(false); }
  }

  const device = data?.device;
  const bc = BRAND_COLORS[device?.brand ?? ""] ?? DB;

  let roms = data?.items ?? [];
  if (searchQ.trim()) {
    const q = searchQ.toLowerCase();
    roms = roms.filter(r =>
      r.name.toLowerCase().includes(q) || r.version?.toLowerCase().includes(q) ||
      r.android?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q)
    );
  }
  if (filterAndroid) roms = roms.filter(r => r.android === filterAndroid);
  if (filterType)    roms = roms.filter(r => r.contentType === filterType);
  roms = [...roms].sort((a, b) => {
    if (sort === "trend_score") return (b.trendScore ?? 0) - (a.trendScore ?? 0);
    if (sort === "downloads")   return (b.downloads ?? 0) - (a.downloads ?? 0);
    if (sort === "rating_avg")  return (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0);
    return new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime();
  });

  const androidVersions = [...new Set((data?.items ?? []).map(r => r.android).filter(Boolean))].sort().reverse();
  const typeBreakdown = TYPE_META.map(m => ({
    ...m, count: (data?.items ?? []).filter(r => r.contentType === m.key).length
  })).filter(m => m.count > 0);
  const total = data?.total ?? 0;

  return (
    <div className="min-h-screen" style={{ background: "#070d1a" }}>

      {/* ── Hero Section ── */}
      <div className="relative overflow-hidden">
        {/* Background: brand gradient mesh */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0" style={{
            background: `radial-gradient(ellipse 80% 60% at 20% 0%, ${bc.from}18 0%, transparent 60%),
                         radial-gradient(ellipse 50% 40% at 80% 100%, ${bc.to}12 0%, transparent 50%)`
          }} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#070d1a]" />
        </div>

        <div className="relative max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 pt-4 pb-6">

          {/* Back */}
          <Link href="/devices" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mb-5">
            <ArrowLeft className="h-3.5 w-3.5" /> {t("devices.backSupported")}
          </Link>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 p-4 mb-4">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
              <p className="text-sm text-red-400 flex-1">{error}</p>
              <button onClick={() => fetchData(false)} className="flex items-center gap-1 text-xs text-white/40 hover:text-white">
                <RefreshCw className="h-3 w-3" /> {t("devices.retry")}
              </button>
            </div>
          )}

          {/* Hero Card */}
          {loading && !device ? (
            <div className="h-56 rounded-3xl border border-white/6 bg-white/3 animate-pulse" />
          ) : device && (
            <div className={cn("relative rounded-3xl border border-white/10 overflow-hidden shadow-2xl", bc.shadow)}>
              {/* Glass bg */}
              <div className="absolute inset-0 bg-white/3 backdrop-blur-sm" />
              <div className="absolute inset-0" style={{
                background:`linear-gradient(135deg, ${bc.from}15 0%, transparent 50%, ${bc.to}08 100%)`
              }} />
              {/* Top accent line */}
              <div className="absolute inset-x-0 top-0 h-px" style={{
                background:`linear-gradient(90deg, transparent 0%, ${bc.accent}60 50%, transparent 100%)`
              }} />

              <div className="relative flex flex-col sm:flex-row min-h-[200px]">

                {/* ── Phone image ── */}
                <div className="relative flex items-end justify-center shrink-0 sm:w-52"
                  style={{ background:`radial-gradient(ellipse 100% 80% at 50% 100%, ${bc.from}20 0%, transparent 70%)` }}>
                  {/* Reflection glow */}
                  <div className="absolute bottom-0 inset-x-0 h-16 pointer-events-none"
                    style={{ background:`radial-gradient(ellipse 60% 100% at 50% 100%, ${bc.accent}25 0%, transparent 80%)` }} />
                  {/* Device image — no frame, clean */}
                  <div className="relative mb-4 mt-4 px-3 rounded-lg overflow-hidden"
                    style={{ filter:`drop-shadow(0 20px 40px ${bc.accent}35)` }}>
                    <DeviceImage
                      codename={codename}
                      displayName={device.name}
                      brand={device.brand ?? ""}
                      storedUrl={device.imageUrl}
                      className="h-48 w-32 rounded-lg overflow-hidden"
                      imgClassName="h-full w-full object-cover"
                      fallbackSize={80}
                    />
                    {/* Report wrong image */}
                    <button
                      onClick={() => setReportOpen(true)}
                      className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-white/20 hover:text-amber-400 transition-colors whitespace-nowrap"
                      title={t("devices.wrongImage")}>
                      {t("devices.report")}
                    </button>
                  </div>
                </div>

                {/* ── Device info ── */}
                <div className="flex-1 p-5 flex flex-col gap-3 min-w-0">

                  {/* Brand + Codename badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-[11px] font-bold px-3 py-1 rounded-full border", bc.badge)}>
                      {device.brand}
                    </span>
                    <code className="text-[10px] text-white/30 bg-white/5 border border-white/8 px-2.5 py-1 rounded-full font-mono">
                      {device.codename}
                    </code>
                  </div>

                  {/* Device name */}
                  <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight">
                    {device.name}
                  </h1>

                  {/* Specs — يظهر بس لو في بيانات */}
                  <div className="flex flex-wrap gap-2">
                    {device.chipset && (
                      <div className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-xl px-3 py-1.5">
                        <Cpu className="h-3.5 w-3.5 shrink-0" style={{ color: bc.accent }} />
                        <span className="text-xs text-white/60 font-medium">{device.chipset}</span>
                      </div>
                    )}
                    {device.released && (
                      <div className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-xl px-3 py-1.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0" style={{ color: bc.accent }} />
                        <span className="text-xs text-white/60 font-medium">{device.released}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-xl px-3 py-1.5">
                      <Package className="h-3.5 w-3.5 shrink-0" style={{ color: bc.accent }} />
                      <span className="text-xs text-white/60 font-medium">{t("devices.nPosts", { n: total })}</span>
                    </div>
                  </div>

                  {/* Stats */}
                  {((data?.totalDownloads ?? 0) > 0 || (data?.totalLikes ?? 0) > 0) && (
                    <div className="flex gap-4 text-xs text-white/35">
                      {(data?.totalDownloads ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <Download className="h-3 w-3" />{t("devices.nDownloads", { total: ((data!.totalDownloads ?? 0) / 1000).toFixed(1) })}
                        </span>
                      )}
                      {(data?.totalLikes ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3" />{t("devices.nLikes", { n: data!.totalLikes ?? 0 })}
                        </span>
                      )}
                      {(data?.avgRating ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3" />{data!.avgRating?.toFixed(1)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Type breakdown */}
                  {typeBreakdown.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {typeBreakdown.map(({ key, label, color, count, icon: Icon }) => (
                        <button key={key}
                          onClick={() => setFilterType(filterType === key ? "" : key)}
                          className={cn(
                            "flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-bold transition-all",
                            filterType === key ? color + " ring-1 ring-current scale-105" : color + " opacity-60 hover:opacity-100"
                          )}>
                          <Icon className="h-2.5 w-2.5" />{count} {label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Actions row */}
                  <div className="flex items-center gap-2 mt-auto pt-1 flex-wrap">
                    <Link
                      href={`/upload?device=${encodeURIComponent(device.name)}&codename=${codename}`}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
                      style={{ background:`linear-gradient(135deg, ${bc.from}, ${bc.to})` }}>
                      <Zap className="h-3 w-3" /> {t("devices.uploadRom")}
                    </Link>
                    <button onClick={toggleWatch} disabled={watchLoading}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all",
                        watching
                          ? "text-white border-transparent"
                          : "bg-white/6 border-white/12 text-white/60 hover:bg-white/10"
                      )}
                      style={watching ? { background:`linear-gradient(135deg, ${bc.from}80, ${bc.to}80)`, borderColor: bc.accent + "40" } : {}}>
                      {watchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
                      {watching ? t("devices.watchingBtn") : t("devices.watchBtn")}
                    </button>
                    <button onClick={() => setReportOpen(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-white/8 text-white/30 hover:text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{t("devices.reportError")}</span>
                    </button>
                    {/* Admin/Owner Edit button */}
                    {(isAdmin || isOwner) && device && (
                      <button
                        onClick={() => {
                          setEditForm({
                            name:     device.name || "",
                            chipset:  device.chipset || "",
                            released: device.released || "",
                            aliases:  (device.aliases || []).join(", "),
                          });
                          setEditOpen(v => !v);
                          setReportOpen(false);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 transition-all">
                        <Pencil className="h-3.5 w-3.5" /> {t("profile.edit")}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Admin Edit panel */}
              {editOpen && (isAdmin || isOwner) && (
                <div className="border-t border-sky-500/20 bg-sky-500/5 p-4 space-y-3">
                  {editSaved ? (
                    <div className="flex items-center justify-center gap-3 py-3">
                      <CheckCircle className="h-6 w-6 text-emerald-400" />
                      <p className="text-sm font-semibold text-emerald-400">{t("devices.savedLabel")}</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <Pencil className="h-4 w-4 text-sky-400 shrink-0" />
                        <p className="text-sm font-bold text-white">{t("devices.editDeviceTitle")}</p>
                        <code className="text-[10px] text-white/30 ms-1">{codename}</code>
                        <button onClick={() => setEditOpen(false)} className="ms-auto text-white/40 hover:text-white">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{t("devices.deviceNameLabel")}</label>
                          <input value={editForm.name}
                            onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                            placeholder={data?.device?.name || t("devices.deviceNameLabel")}
                            className="mt-1 h-9 w-full rounded-xl border border-sky-500/20 bg-white/5 px-3 text-sm text-white focus:outline-none focus:border-sky-400/50" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{t("devices.chipset")}</label>
                          <input value={editForm.chipset}
                            onChange={e => setEditForm(p => ({ ...p, chipset: e.target.value }))}
                            placeholder={data?.device?.chipset || "Snapdragon 8 Gen 3"}
                            className="mt-1 h-9 w-full rounded-xl border border-sky-500/20 bg-white/5 px-3 text-sm text-white focus:outline-none focus:border-sky-400/50" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{t("devices.yearLabel")}</label>
                          <input value={editForm.released}
                            onChange={e => setEditForm(p => ({ ...p, released: e.target.value }))}
                            placeholder={data?.device?.released || "2024"}
                            className="mt-1 h-9 w-full rounded-xl border border-sky-500/20 bg-white/5 px-3 text-sm text-white focus:outline-none focus:border-sky-400/50" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{t("devices.aliasesLabel")}</label>
                          <input value={editForm.aliases}
                            onChange={e => setEditForm(p => ({ ...p, aliases: e.target.value }))}
                            placeholder="Galaxy S25, SM-S925"
                            className="mt-1 h-9 w-full rounded-xl border border-sky-500/20 bg-white/5 px-3 text-sm text-white focus:outline-none focus:border-sky-400/50" />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditOpen(false)}
                          className="rounded-xl border border-white/10 px-4 py-1.5 text-sm text-white/40 hover:text-white">
                          إلغاء
                        </button>
                        <button onClick={saveDevice} disabled={editSaving}
                          className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-1.5 text-sm font-bold text-white disabled:opacity-50 hover:bg-sky-400 transition-colors">
                          {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                          حفظ التعديلات
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Report panel */}
              {reportOpen && (
                <div className="border-t border-white/8 bg-black/20 p-4 space-y-3">
                  {reportSent ? (
                    <div className="flex items-center justify-center gap-3 py-3">
                      <CheckCircle className="h-6 w-6 text-emerald-400" />
                      <p className="text-sm font-semibold text-emerald-400">{t("devices.reportSent")}</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                        <p className="text-sm font-bold text-white">{t("devices.errorReportTitle")}</p>
                        <button onClick={() => setReportOpen(false)} className="ms-auto text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          {id:"wrong_codename",label:t("devices.wrongCodename")},{id:"wrong_name",label:t("devices.wrongName")},
                          {id:"wrong_chipset",label:t("devices.wrongChipset")},{id:"wrong_rom",label:t("devices.wrongRom")},
                          {id:"duplicate",label:t("devices.duplicate")},{id:"other",label:t("devices.other")},
                        ].map(rt => (
                          <button key={rt.id} onClick={() => setReportType(rt.id)}
                            className={cn("rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all text-start",
                              reportType===rt.id ? "border-amber-500/60 bg-amber-500/15 text-amber-400" : "border-white/10 text-white/40 hover:border-amber-500/30")}>
                            {rt.label}
                          </button>
                        ))}
                      </div>
                      {reportType !== "other" && reportType !== "duplicate" && (
                        <input value={reportSuggested} onChange={e => setReportSuggested(e.target.value)}
                          placeholder={t("devices.correctValue")}
                          className="h-9 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:border-amber-500/50" />
                      )}
                      <textarea value={reportNote} onChange={e => setReportNote(e.target.value)}
                        placeholder={t("devices.additionalNotes")} rows={2}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-amber-500/50" />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setReportOpen(false)} className="rounded-xl border border-white/10 px-4 py-1.5 text-sm text-white/40 hover:text-white">{t("common.cancel")}</button>
                        <button onClick={submitReport}
                          disabled={reportLoading || (!reportSuggested.trim() && reportType !== "other" && reportType !== "duplicate")}
                          className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-1.5 text-sm font-bold text-white disabled:opacity-50">
                          {reportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                          {t("common.send")}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>


      {/* ── Content Section ── */}
      <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 pb-8 space-y-4">

        {/* Search + Controls */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder={`${t("devices.searchArchive")} ${device?.name ?? ""}...`}
              className="w-full ps-9 pe-9 h-10 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20" />
            {searchQ && (
              <button onClick={() => setSearchQ("")} className="absolute end-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="relative">
            <button onClick={() => setShowSort(!showSort)}
              className="flex items-center gap-2 h-10 px-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white/50 hover:text-white transition-colors whitespace-nowrap">
              {t(SORT_OPTIONS.find(o => o.value === sort)?.labelKey ?? "") || t("devices.sortLabel")}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showSort && "rotate-180")} />
            </button>
            {showSort && (
              <div className="absolute end-0 top-full mt-1 z-20 w-44 rounded-xl border border-white/10 bg-[#0d1525] shadow-2xl overflow-hidden">
                {SORT_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => { setSort(o.value); setPage(1); setShowSort(false); }}
                    className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 text-start text-sm transition-colors hover:bg-white/8",
                      sort===o.value ? "text-white font-semibold" : "text-white/50")}>
                    <o.icon className="h-3.5 w-3.5 shrink-0" />
                    {t(o.labelKey)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filters */}
          {(androidVersions.length > 1 || typeBreakdown.length > 1) && (
            <button onClick={() => setShowFilters(!showFilters)}
              className={cn("flex items-center gap-2 h-10 px-3 rounded-xl border text-sm font-medium transition-colors",
                showFilters || filterAndroid ? "border-white/25 bg-white/10 text-white" : "border-white/10 bg-white/5 text-white/50 hover:text-white")}>
              <SlidersHorizontal className="h-3.5 w-3.5" />
              فلتر
              {filterAndroid && <span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black bg-white text-black">!</span>}
            </button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="rounded-xl border border-white/10 bg-white/3 p-3 space-y-2.5">
            {androidVersions.length > 1 && (
              <div>
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5">{t("devices.androidFilter")}</p>
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={() => setFilterAndroid("")}
                    className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all",
                      !filterAndroid ? "bg-white text-black border-transparent" : "border-white/10 text-white/50 hover:border-white/25")}>{t("devices.all")}</button>
                  {androidVersions.map(v => (
                    <button key={v} onClick={() => setFilterAndroid(filterAndroid===v?"":v!)}
                      className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all",
                        filterAndroid===v ? "bg-white text-black border-transparent" : "border-white/10 text-white/50 hover:border-white/25")}>
                      Android {v}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {(filterAndroid || filterType) && (
              <button onClick={() => { setFilterAndroid(""); setFilterType(""); }} className="text-xs text-red-400 hover:underline">
                مسح الفلاتر
              </button>
            )}
          </div>
        )}

        {/* Results info */}
        {!loading && (searchQ || filterAndroid || filterType) && (
          <p className="text-xs text-white/30">
            {roms.length} نتيجة
            {searchQ && ` لـ "${searchQ}"`}
            {filterAndroid && ` • Android ${filterAndroid}`}
            {filterType && ` • ${TYPE_META.find(m=>m.key===filterType)?.label}`}
          </p>
        )}

        {/* ROMs */}
        {loading ? (
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
            {Array.from({length:6}).map((_,i)=><RomCardSkeleton key={i}/>)}
          </div>
        ) : roms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/8 bg-white/3 mb-4">
              <Package className="h-8 w-8 text-white/15" strokeWidth={1} />
            </div>
            {searchQ || filterAndroid || filterType ? (
              <>
                <p className="text-white font-semibold">{t("devices.noResultsSearch")}</p>
                <button onClick={() => { setSearchQ(""); setFilterAndroid(""); setFilterType(""); }}
                  className="mt-3 text-xs text-blue-400 hover:underline">{t("devices.clearSearchFilters")}</button>
              </>
            ) : (
              <>
                <p className="text-white font-semibold">{t("devices.noRoms")}</p>
                <p className="text-sm text-white/40 mt-1">{t("devices.beFirstPublish", { name: device?.name || "" })}</p>
                <Link href={`/upload?device=${encodeURIComponent(device?.name??"")}&codename=${codename}`}
                  className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background:`linear-gradient(135deg, ${bc.from}, ${bc.to})` }}>
                  نشر ROM الآن
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 animate-in fade-in duration-500">
              {roms.map(r=><RomCard key={r.id} rom={r}/>)}
            </div>
            {/* Infinite scroll sentinel */}
            {!searchQ && !filterAndroid && !filterType && total > 24 && (
              <>
                <div ref={sentinelRef} className="h-1" />
                {infiniteLoading && (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-white/30" />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
