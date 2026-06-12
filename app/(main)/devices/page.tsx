"use client";
import { useTranslation } from "@/lib/i18n";
import PageHero from "@/components/shared/page-hero";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  Smartphone, Search, X, Loader2, Package, ChevronRight,
  Cpu, HardDrive, Puzzle, Globe, ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DeviceImage } from "@/components/device/device-image";
import { logger } from "@/lib/logger";

// ── Types ────────────────────────────────────────────────────────────
interface Breakdown { rom: number; kernel: number; recovery: number; module: number; gsi: number }
interface DeviceEntry {
  codename: string;
  name: string;
  brand: string;
  chipset: string;
  released: string;
  romCount: number;
  imageUrl?: string | null;
  breakdown?: Breakdown;
}
interface ApiResponse {
  items: DeviceEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Constants ────────────────────────────────────────────────────────
const BRANDS = ["Xiaomi", "Samsung", "OnePlus", "Google", "Nothing", "Realme", "Motorola", "ASUS", "Infinix", "Tecno", "Itel", "Meizu", "Micromax", "Fairphone"];

const CONTENT_FILTERS = [
  { id: "",          label: "All",      labelKey: "devices.all", icon: Package },
  { id: "rom",       label: "ROMs",     icon: Smartphone },
  { id: "kernel",    label: "Kernels",  icon: Cpu },
  { id: "recovery",  label: "Recovery", icon: HardDrive },
  { id: "module",    label: "Modules",  icon: Puzzle },
  { id: "gsi",       label: "GSIs",     icon: Globe },
];

const BREAKDOWN_META: { key: keyof Breakdown; label: string; color: string; icon: React.ElementType }[] = [
  { key: "rom",      label: "ROM",     color: "text-sky-400 bg-sky-500/15 border-sky-500/25",       icon: Smartphone },
  { key: "kernel",   label: "Kernel",  color: "text-violet-400 bg-violet-500/15 border-violet-500/25", icon: Cpu },
  { key: "recovery", label: "Rec",     color: "text-amber-400 bg-amber-500/15 border-amber-500/25",  icon: HardDrive },
  { key: "module",   label: "Mod",     color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/25", icon: Puzzle },
  { key: "gsi",      label: "GSI",     color: "text-rose-400 bg-rose-500/15 border-rose-500/25",    icon: Globe },
];

const BRAND_CONFIG: Record<string, { gradient: string; glow: string; badge: string; accent: string; bg: string }> = {
  Samsung:  { gradient: "from-blue-400 to-indigo-600",   glow: "shadow-blue-500/30",   badge: "bg-blue-500/15 text-blue-300 border-blue-500/30",        accent: "#3b82f6", bg: "from-blue-500/8"    },
  Xiaomi:   { gradient: "from-orange-500 to-red-500",    glow: "shadow-orange-500/30", badge: "bg-orange-500/15 text-orange-300 border-orange-500/30",  accent: "#f97316", bg: "from-orange-500/8"  },
  OnePlus:  { gradient: "from-red-400 to-rose-600",      glow: "shadow-red-500/30",    badge: "bg-red-500/15 text-red-300 border-red-500/30",            accent: "#ef4444", bg: "from-red-500/8"     },
  Google:   { gradient: "from-green-400 to-teal-500",    glow: "shadow-green-500/30",  badge: "bg-green-500/15 text-green-300 border-green-500/30",      accent: "#22c55e", bg: "from-green-500/8"   },
  Nothing:  { gradient: "from-muted to-muted-foreground", glow: "shadow-none", badge: "bg-muted text-muted-foreground border-border", accent: "hsl(var(--muted-foreground))", bg: "from-muted/20" },
  Realme:   { gradient: "from-yellow-400 to-orange-500", glow: "shadow-yellow-500/30", badge: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",   accent: "#eab308", bg: "from-yellow-500/8"  },
  Motorola: { gradient: "from-purple-400 to-indigo-500", glow: "shadow-purple-500/30", badge: "bg-purple-500/15 text-purple-300 border-purple-500/30",   accent: "#a855f7", bg: "from-purple-500/8"  },
  ASUS:     { gradient: "from-cyan-400 to-blue-500",     glow: "shadow-cyan-500/30",   badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",         accent: "#06b6d4", bg: "from-cyan-500/8"    },
  Vivo:     { gradient: "from-violet-400 to-blue-500",   glow: "shadow-violet-500/30", badge: "bg-violet-500/15 text-violet-300 border-violet-500/30",   accent: "#7c3aed", bg: "from-violet-500/8"  },
  OPPO:     { gradient: "from-emerald-400 to-teal-500",  glow: "shadow-emerald-500/30",badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",accent: "#10b981", bg: "from-emerald-500/8" },
  Sony:     { gradient: "from-slate-400 to-slate-600",   glow: "shadow-slate-400/30",  badge: "bg-slate-500/15 text-slate-300 border-slate-500/30",      accent: "#64748b", bg: "from-slate-400/8"   },
  Huawei:   { gradient: "from-red-500 to-rose-700",      glow: "shadow-red-600/30",    badge: "bg-rose-500/15 text-rose-300 border-rose-500/30",         accent: "#e11d48", bg: "from-red-600/8"     },
  Honor:    { gradient: "from-sky-400 to-blue-500",      glow: "shadow-sky-500/30",    badge: "bg-sky-500/15 text-sky-300 border-sky-500/30",            accent: "#0ea5e9", bg: "from-sky-500/8"     },
  ZTE:      { gradient: "from-lime-400 to-green-600",    glow: "shadow-lime-500/30",   badge: "bg-lime-500/15 text-lime-300 border-lime-500/30",         accent: "#84cc16", bg: "from-lime-500/8"    },
  Nubia:    { gradient: "from-lime-400 to-green-600",    glow: "shadow-lime-500/30",   badge: "bg-lime-500/15 text-lime-300 border-lime-500/30",         accent: "#84cc16", bg: "from-lime-500/8"    },
  Nokia:    { gradient: "from-blue-500 to-sky-600",      glow: "shadow-blue-600/30",   badge: "bg-blue-600/15 text-blue-200 border-blue-600/30",         accent: "#1d4ed8", bg: "from-blue-600/8"    },
  Lenovo:   { gradient: "from-red-600 to-orange-600",    glow: "shadow-red-600/30",    badge: "bg-red-600/15 text-red-200 border-red-600/30",            accent: "#dc2626", bg: "from-red-600/8"     },
  Infinix:  { gradient: "from-orange-600 to-amber-500",  glow: "shadow-orange-600/30", badge: "bg-orange-600/15 text-orange-200 border-orange-600/30",   accent: "#ea580c", bg: "from-orange-600/8"  },
  Tecno:    { gradient: "from-cyan-500 to-emerald-600",  glow: "shadow-cyan-600/30",   badge: "bg-cyan-600/15 text-cyan-200 border-cyan-600/30",         accent: "#0891b2", bg: "from-cyan-600/8"    },
  Itel:     { gradient: "from-violet-500 to-purple-600", glow: "shadow-violet-600/30", badge: "bg-violet-600/15 text-violet-200 border-violet-600/30",   accent: "#6d28d9", bg: "from-violet-600/8"  },
  Meizu:    { gradient: "from-teal-400 to-blue-600",     glow: "shadow-teal-500/30",   badge: "bg-teal-500/15 text-teal-300 border-teal-500/30",         accent: "#14b8a6", bg: "from-teal-500/8"    },
  Micromax: { gradient: "from-indigo-400 to-purple-600", glow: "shadow-indigo-500/30", badge: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",   accent: "#6366f1", bg: "from-indigo-500/8"  },
  Fairphone:{ gradient: "from-green-600 to-emerald-700", glow: "shadow-green-700/30",  badge: "bg-green-600/15 text-green-200 border-green-600/30",      accent: "#16a34a", bg: "from-green-600/8"   },
};
const DEFAULT_CONFIG = BRAND_CONFIG.Samsung;

// ── Device Card ──────────────────────────────────────────────────────
function DeviceCard({ device }: { device: DeviceEntry }) {
  const { t } = useTranslation();
  const cfg = BRAND_CONFIG[device.brand] ?? DEFAULT_CONFIG;
  const [showInfo, setShowInfo] = useState(false);

  // Breakdown chips — show types that have content
  const activeBreakdown = BREAKDOWN_META.filter(
    (m) => (device.breakdown?.[m.key] ?? 0) > 0
  );

  return (
    <Link
      href={`/devices/${device.codename}`}
      className={cn(
        "group relative flex flex-col rounded-3xl border border-white/6 overflow-hidden",
        "bg-[#080f1e] transition-all duration-300 cursor-pointer",
        "hover:border-white/15 hover:-translate-y-1.5",
        `hover:shadow-2xl hover:${cfg.glow}`
      )}
    >
      {/* Top gradient accent line */}
      <div className={cn(
        "absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300",
        cfg.gradient
      )} />

      {/* ROM count badge — top right */}
      <div className="absolute top-3 end-3 z-10 flex items-center gap-1 rounded-full bg-black/60 border border-white/12 backdrop-blur-sm px-2.5 py-1">
        <span className="text-[9px] font-black text-white leading-none">{device.romCount}</span>
        <span className="text-[8px] font-semibold text-white/40 leading-none">ROM</span>
      </div>
      {/* Info button */}
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setShowInfo(true); }}
        className="absolute top-3 start-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 border border-white/10 text-white/40 hover:text-white hover:bg-white/15 transition-all text-[11px] font-bold backdrop-blur-sm"
        title={t("devices.infoTooltip")}
      >
        ⓘ
      </button>

      {/* Image area — phone centered with padding */}
      <div className="relative h-52 overflow-hidden flex items-center justify-center px-4 pt-3">
        {/* Brand gradient bg */}
        <div className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse at 50% 20%, ${cfg.accent}18 0%, transparent 70%)` }} />
        {/* Bottom fade */}
        <div className="absolute inset-x-0 bottom-0 h-12 pointer-events-none"
          style={{ background: "linear-gradient(to top, #080f1e 0%, transparent 100%)" }} />
        {/* Hover glow */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 50% 60%, ${cfg.accent}15 0%, transparent 60%)` }} />
        {/* Phone image — contained with padding so edges never get cut */}
        <DeviceImage
          codename={device.codename} displayName={device.name} brand={device.brand}
          storedUrl={device.imageUrl}
          className="relative z-10 h-44 w-full"
          imgClassName="h-full w-auto max-w-[62%] mx-auto object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-[1.05] group-hover:-translate-y-1 "
          fallbackSize={64}
        />
      </div>

      {/* Info block — minimal, Android 16 style */}
      <div className="px-3 pt-1 pb-3 text-center">
        {/* Brand pill */}
        <span className={cn(
          "inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full border mb-2",
          cfg.badge
        )}>
          {device.brand}
        </span>

        {/* Device name */}
        <h3 className="text-[13px] font-black text-white/90 leading-tight group-hover:text-white transition-colors line-clamp-2 mb-1.5">
          {device.name}
        </h3>

        {/* Specs row — small chips */}
        {(device.chipset || device.released) && (
          <div className="flex items-center justify-center gap-1 flex-wrap">
            {device.chipset && (
              <span className="text-[9px] text-white/30 bg-white/5 border border-white/8 rounded-full px-2 py-0.5 truncate max-w-[100px]">
                {device.chipset}
              </span>
            )}
            {device.released && (
              <span className="text-[9px] text-white/30 bg-white/5 border border-white/8 rounded-full px-2 py-0.5">
                {device.released}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content breakdown + ROM action */}
      <div className="px-3 pb-3 flex items-center justify-between gap-2">
        {/* Breakdown chips */}
        <div className="flex flex-wrap gap-1 flex-1">
          {activeBreakdown.slice(0, 3).map(({ key, label, color, icon: Icon }) => (
            <span key={key} className={cn(
              "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-bold",
              color
            )}>
              <Icon className="h-2 w-2" />
              {device.breakdown![key]}
            </span>
          ))}
        </div>
        {/* ROM pill button */}
        <div className={cn(
          "flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-black transition-all duration-300",
          "bg-gradient-to-r text-white group-hover:scale-105 group-hover:shadow-lg shrink-0",
          cfg.gradient
        )} style={{ boxShadow: `0 2px 12px ${cfg.accent}30` }}>
          › {device.romCount} ROM
        </div>
      </div>

      {/* Info popup */}
      {showInfo && (
        <div
          className="absolute inset-0 z-20 rounded-2xl bg-[#080f1e]/95 backdrop-blur-sm flex flex-col p-4 gap-3"
          onClick={e => { e.preventDefault(); e.stopPropagation(); }}
        >
          <div className="flex items-center justify-between">
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", cfg.badge)}>{device.brand}</span>
            <button onClick={e => { e.preventDefault(); e.stopPropagation(); setShowInfo(false); }}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-white/8 text-white/50 hover:bg-white/15 hover:text-white transition-all text-xs">
              ✕
            </button>
          </div>
          <div>
            <p className="text-[13px] font-bold text-white/90 leading-snug">{device.name}</p>
            <p className="text-[10px] text-white/40 font-mono mt-0.5">{device.codename}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {device.chipset && (
              <div className="rounded-xl bg-white/5 border border-white/8 p-2.5">
                <p className="text-[8px] text-white/30 uppercase tracking-wider font-bold mb-1">{t("devices.chipset")}</p>
                <p className="text-[10px] text-white/70 font-medium leading-tight">{device.chipset}</p>
              </div>
            )}
            {device.released && (
              <div className="rounded-xl bg-white/5 border border-white/8 p-2.5">
                <p className="text-[8px] text-white/30 uppercase tracking-wider font-bold mb-1">{t("devices.versionLabel")}</p>
                <p className="text-[11px] text-white/70 font-bold">{device.released}</p>
              </div>
            )}
            <div className="rounded-xl bg-white/5 border border-white/8 p-2.5">
              <p className="text-[8px] text-white/30 uppercase tracking-wider font-bold mb-1">{t("devices.postsLabel")}</p>
              <p className="text-[11px] text-white/70 font-bold">{device.romCount}</p>
            </div>
            {device.breakdown && Object.values(device.breakdown).some(v => v > 0) && (
              <div className="rounded-xl bg-white/5 border border-white/8 p-2">
                <p className="text-[8px] text-white/30 uppercase tracking-wider font-bold mb-1">{t("devices.types")}</p>
                <div className="flex flex-wrap gap-0.5">
                  {BREAKDOWN_META.filter(m => (device.breakdown?.[m.key] ?? 0) > 0).map(({key, label, color}) => (
                    <span key={key} className={cn("text-[7px] font-bold px-1 py-0.5 rounded border", color)}>
                      {device.breakdown![key]} {label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Link
            href={`/devices/${device.codename}`}
            className={cn("flex items-center justify-center gap-1.5 w-full rounded-xl py-2 text-[11px] font-bold text-white bg-gradient-to-r", cfg.gradient)}
            onClick={e => e.stopPropagation()}
          >
            <Package className="h-3 w-3" /> {t("devices.viewArchive")}
          </Link>
        </div>
      )}

      {/* CTA + Details button */}
      <div className="px-3 pb-3 pt-2 mt-auto flex flex-col gap-1.5">
        {/* Specs quick view */}
        {(device.chipset || device.released) && (
          <div className="flex items-center justify-center gap-1.5 text-[9px] text-white/25 px-1">
            {device.released && (
              <span className="flex items-center gap-0.5">
                <span className="text-white/15">📅</span>{device.released}
              </span>
            )}
            {device.chipset && device.released && <span className="text-white/10">·</span>}
            {device.chipset && (
              <span className="truncate max-w-[100px]" title={device.chipset}>
                {device.chipset.length > 16 ? device.chipset.slice(0,16)+"…" : device.chipset}
              </span>
            )}
          </div>
        )}
        <div className={cn(
          "flex items-center justify-center gap-1.5 w-full rounded-xl py-2 text-[12px] font-bold text-white",
          "bg-gradient-to-r transition-all duration-200 opacity-75 group-hover:opacity-100",
          cfg.gradient
        )}>
          <Package className="h-3 w-3" />
          {device.romCount === 1 ? t("devices.oneRomShort") : t("devices.nPostsShort", { n: device.romCount })}
          <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

// ── Skeleton ──────────────────────────────────────────────��──────────
function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#080f1e] overflow-hidden animate-pulse">
      <div className="h-44 flex items-center justify-center p-6">
        <div className="h-32 w-22 bg-white/5 rounded-2xl" />
      </div>
      <div className="h-[3px] w-8 bg-white/6 rounded-full mx-auto mb-2.5" />
      <div className="px-3 pb-2 space-y-1.5 text-center">
        <div className="h-3 bg-white/6 rounded-full w-14 mx-auto" />
        <div className="h-[14px] bg-white/6 rounded w-28 mx-auto" />
        <div className="h-2.5 bg-white/4 rounded w-20 mx-auto" />
      </div>
      <div className="px-3 pb-3 pt-2">
        <div className="h-9 bg-white/5 rounded-xl" />
      </div>
    </div>
  );
}

// ── Pagination ───────────────────────────────────────────────────────
function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
    if (totalPages <= 5) return i + 1;
    if (page <= 3) return i + 1;
    if (page >= totalPages - 2) return totalPages - 4 + i;
    return page - 2 + i;
  });

  return (
    <div className="flex items-center justify-center gap-1.5 pt-4">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-30 disabled:pointer-events-none transition-all"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      {pages[0] > 1 && (
        <>
          <button onClick={() => onPage(1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground text-xs transition-all">1</button>
          {pages[0] > 2 && <span className="text-muted-foreground/40 text-xs px-0.5">…</span>}
        </>
      )}
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPage(p)}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition-all",
            p === page
              ? "border-primary bg-primary/15 text-primary"
              : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
          )}
        >{p}</button>
      ))}
      {pages[pages.length - 1] < totalPages && (
        <>
          {pages[pages.length - 1] < totalPages - 1 && <span className="text-muted-foreground/40 text-xs px-0.5">…</span>}
          <button onClick={() => onPage(totalPages)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground text-xs transition-all">{totalPages}</button>
        </>
      )}
      <button
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-30 disabled:pointer-events-none transition-all"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────
export default function DevicesPage() {
  const { t } = useTranslation();
  const [devices, setDevices]       = useState<DeviceEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [searchQ, setSearchQ]       = useState("");
  const [selectedBrand, setSelected]= useState<string | null>(null);
  const [contentType, setContentType] = useState("");
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const LIMIT = 24;

  const fetchDevices = useCallback((p = 1) => {
    const params = new URLSearchParams();
    if (selectedBrand)    params.set("brand", selectedBrand);
    if (searchQ.trim())   params.set("q", searchQ.trim());
    if (contentType)      params.set("contentType", contentType);
    params.set("page",  String(p));
    params.set("limit", String(LIMIT));

    setLoading(true);
    fetch(`/api/devices?${params}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        setDevices(d.items || []);
        setTotal(d.total ?? 0);
        setTotalPages(d.totalPages ?? 1);
        setPage(d.page ?? 1);
      })
      .catch((err) => logger.error("devices.list.fetch", err, {
        brand: selectedBrand, q: searchQ, contentType,
      }))
      .finally(() => setLoading(false));
  }, [selectedBrand, searchQ, contentType]);

  // Debounce search + reset page on filter change
  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); fetchDevices(1); }, 300);
    return () => clearTimeout(timer);
  }, [selectedBrand, searchQ, contentType]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePage = (p: number) => {
    setPage(p);
    fetchDevices(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const hasFilters = !!(selectedBrand || searchQ || contentType);
  const totalRoms  = useMemo(() => devices.reduce((s, d) => s + d.romCount, 0), [devices]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

        {/* Holographic Header */}
        <PageHero
          icon={Smartphone}
          title={t("devices.supported")}
          description={loading ? t("devices.loading") : t("devices.deviceCount", { total, roms: totalRoms })}
          stats={loading ? undefined : [
            { label: t("devices.supported") || "Devices", value: total.toLocaleString(), icon: Smartphone },
            { label: "ROMs", value: totalRoms.toLocaleString(), icon: Package },
          ]}
        />

        {/* Search */}
        <div className="relative max-w-xl">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder={t("devices.searchPlaceholder")}
            className="w-full ps-10 pe-9 py-2.5 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground"
          />
          {searchQ && (
            <button onClick={() => setSearchQ("")} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Content type filter */}
        <div className="flex gap-1.5 flex-wrap">
          {CONTENT_FILTERS.map(({ id, label, icon: Icon, ...rest }) => (
            <button
              key={id}
              onClick={() => setContentType(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                contentType === id
                  ? "bg-primary/15 text-primary border-primary/40 shadow-sm shadow-primary/10"
                  : "bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
              )}
            >
              <Icon className="h-3 w-3" />
              {"labelKey" in rest ? t((rest as any).labelKey) : label}
            </button>
          ))}
        </div>

        {/* Brand pills */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelected(null)}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all",
              !selectedBrand
                ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
            )}
          >{t("devices.all")}</button>
          {BRANDS.map((brand) => {
            const cfg = BRAND_CONFIG[brand];
            return (
              <button
                key={brand}
                onClick={() => setSelected(selectedBrand === brand ? null : brand)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                  selectedBrand === brand
                    ? cfg.badge
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                )}
              >{brand}</button>
            );
          })}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: LIMIT }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/30 border border-border mb-5">
              <Smartphone className="h-10 w-10 text-muted-foreground/30" strokeWidth={1} />
            </div>
            <p className="text-foreground font-semibold text-lg">{t("devices.noDeviceFound")}</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">{t("devices.noResultsTip")}</p>
            {hasFilters && (
              <button
                onClick={() => { setSearchQ(""); setSelected(null); setContentType(""); }}
                className="mt-5 text-xs text-primary hover:underline font-medium"
              >{t("devices.clearFilters")}</button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {devices.map((device) => (
                <DeviceCard key={device.codename} device={device} />
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onPage={handlePage} />
          </>
        )}
      </div>
    </div>
  );
}
