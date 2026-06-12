"use client";

/**
 * search/page.tsx — v6 REDESIGNED
 * ✅ Default view: أرشيف الأجهزة الكاملة فوراً
 * ✅ Swipe left/right: بين الأجهزة والإصدارات
 * ✅ @ prefix → بحث عن مطور مباشرة
 * ✅ Smart device matching (resolveDevice fuzzy+alias+consensus)
 * ✅ Cleaner UX — أقل تعقيداً وأوضح تصميماً
 */

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiListRoms, apiSearchUsers } from "@/lib/api/client";
import { CONTENT_TYPES, BRANDS, ANDROID_VERSIONS } from "@/lib/constants";
import type { RomItem, UserDoc, ContentType } from "@/lib/types";
import { RomCard, RomCardSkeleton } from "@/components/rom/rom-card";
import { DeviceImage } from "@/components/device/device-image";
import { debounce, safeImg, cn, formatCount } from "@/lib/utils";
import { DEFAULT_AVATAR } from "@/lib/constants";
import Link from "next/link";
import Image from "next/image";
import {
  Search, Users, Package, X, SlidersHorizontal,
  Smartphone, Loader2, Cpu, HardDrive, Puzzle, Globe,
  ChevronRight, Zap, ArrowRight, TrendingUp, Download,
  AtSign, AlertTriangle, Filter,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface Breakdown { rom: number; kernel: number; recovery: number; module: number; gsi: number }
interface DeviceResult {
  codename: string; name: string; brand: string;
  chipset: string; released: string;
  imageUrl?: string | null; romCount: number; breakdown?: Breakdown;
}
interface DeviceSuggestion {
  codename: string; displayName: string; brand: string;
  confidence: number; source: string; voteCount?: number; warning?: string;
}
interface ApiDeviceResp { items: DeviceResult[]; total: number; totalPages: number }

const BRAND_CFG: Record<string, { g: string; glow: string; badge: string; accent: string; dot: string }> = {
  Samsung:  { g:"from-blue-400 to-indigo-600",   glow:"hover:shadow-blue-500/15",   badge:"bg-blue-500/12 text-blue-300 border-blue-500/25",        accent:"#3b82f6", dot:"bg-blue-400"    },
  Xiaomi:   { g:"from-orange-500 to-red-500",    glow:"hover:shadow-orange-500/15", badge:"bg-orange-500/12 text-orange-300 border-orange-500/25",  accent:"#f97316", dot:"bg-orange-400"  },
  OnePlus:  { g:"from-red-400 to-rose-600",      glow:"hover:shadow-red-500/15",    badge:"bg-red-500/12 text-red-300 border-red-500/25",            accent:"#ef4444", dot:"bg-red-400"     },
  Google:   { g:"from-green-400 to-teal-500",    glow:"hover:shadow-green-500/15",  badge:"bg-green-500/12 text-green-300 border-green-500/25",      accent:"#22c55e", dot:"bg-green-400"   },
  Nothing:  { g:"from-muted to-border", glow:"hover:shadow-none", badge:"bg-muted/50 text-muted-foreground border-border", accent:"hsl(var(--muted-foreground))", dot:"bg-muted-foreground" },
  Realme:   { g:"from-yellow-400 to-orange-500", glow:"hover:shadow-yellow-500/15", badge:"bg-yellow-500/12 text-yellow-300 border-yellow-500/25",   accent:"#eab308", dot:"bg-yellow-400"  },
  Motorola: { g:"from-purple-400 to-indigo-500", glow:"hover:shadow-purple-500/15", badge:"bg-purple-500/12 text-purple-300 border-purple-500/25",   accent:"#a855f7", dot:"bg-purple-400"  },
  ASUS:     { g:"from-cyan-400 to-blue-500",     glow:"hover:shadow-cyan-500/15",   badge:"bg-cyan-500/12 text-cyan-300 border-cyan-500/25",         accent:"#06b6d4", dot:"bg-cyan-400"    },
  Vivo:     { g:"from-blue-300 to-violet-500",   glow:"hover:shadow-violet-500/15", badge:"bg-violet-500/12 text-violet-300 border-violet-500/25",   accent:"#7c3aed", dot:"bg-violet-400"  },
  OPPO:     { g:"from-emerald-400 to-teal-500",  glow:"hover:shadow-emerald-500/15",badge:"bg-emerald-500/12 text-emerald-300 border-emerald-500/25",accent:"#10b981", dot:"bg-emerald-400" },
  Sony:     { g:"from-slate-400 to-slate-600",   glow:"hover:shadow-slate-400/15",  badge:"bg-slate-500/12 text-slate-300 border-slate-500/25",      accent:"#64748b", dot:"bg-slate-400"   },
  Huawei:   { g:"from-red-500 to-rose-700",      glow:"hover:shadow-red-600/15",    badge:"bg-rose-500/12 text-rose-300 border-rose-500/25",         accent:"#e11d48", dot:"bg-rose-400"    },
  Honor:    { g:"from-sky-400 to-blue-500",      glow:"hover:shadow-sky-500/15",    badge:"bg-sky-500/12 text-sky-300 border-sky-500/25",            accent:"#0ea5e9", dot:"bg-sky-400"     },
  ZTE:      { g:"from-lime-400 to-green-600",    glow:"hover:shadow-lime-500/15",   badge:"bg-lime-500/12 text-lime-300 border-lime-500/25",         accent:"#84cc16", dot:"bg-lime-400"    },
  Nubia:    { g:"from-lime-400 to-green-600",    glow:"hover:shadow-lime-500/15",   badge:"bg-lime-500/12 text-lime-300 border-lime-500/25",         accent:"#84cc16", dot:"bg-lime-400"    },
  Nokia:    { g:"from-blue-500 to-sky-600",      glow:"hover:shadow-blue-600/15",   badge:"bg-blue-600/12 text-blue-200 border-blue-600/25",         accent:"#1d4ed8", dot:"bg-blue-500"    },
  Lenovo:   { g:"from-red-600 to-orange-600",    glow:"hover:shadow-red-600/15",    badge:"bg-red-600/12 text-red-200 border-red-600/25",            accent:"#dc2626", dot:"bg-red-500"     },
  Infinix:  { g:"from-orange-600 to-amber-500",  glow:"hover:shadow-orange-600/15", badge:"bg-orange-600/12 text-orange-200 border-orange-600/25",   accent:"#ea580c", dot:"bg-orange-500"  },
  Tecno:    { g:"from-cyan-500 to-emerald-600",  glow:"hover:shadow-cyan-600/15",   badge:"bg-cyan-600/12 text-cyan-200 border-cyan-600/25",         accent:"#0891b2", dot:"bg-cyan-500"    },
  Itel:     { g:"from-violet-500 to-purple-600", glow:"hover:shadow-violet-600/15", badge:"bg-violet-600/12 text-violet-200 border-violet-600/25",   accent:"#6d28d9", dot:"bg-violet-500"   },
  Meizu:    { g:"from-teal-400 to-blue-600",     glow:"hover:shadow-teal-500/15",   badge:"bg-teal-500/12 text-teal-300 border-teal-500/25",         accent:"#14b8a6", dot:"bg-teal-400"    },
  Micromax: { g:"from-indigo-400 to-purple-600", glow:"hover:shadow-indigo-500/15", badge:"bg-indigo-500/12 text-indigo-300 border-indigo-500/25",   accent:"#6366f1", dot:"bg-indigo-400"  },
  Fairphone:{ g:"from-green-600 to-emerald-700", glow:"hover:shadow-green-700/15",  badge:"bg-green-600/12 text-green-200 border-green-600/25",      accent:"#16a34a", dot:"bg-green-600"   },
};
const DCfg = BRAND_CFG.Samsung;

const BD_META: { key: keyof Breakdown; label: string; color: string; icon: React.ElementType }[] = [
  { key:"rom",      label:"ROM",    color:"text-sky-400 bg-sky-500/12 border-sky-500/20",          icon:Smartphone },
  { key:"kernel",   label:"Kernel", color:"text-violet-400 bg-violet-500/12 border-violet-500/20", icon:Cpu },
  { key:"recovery", label:"Rec",    color:"text-amber-400 bg-amber-500/12 border-amber-500/20",    icon:HardDrive  },
  { key:"module",   label:"Mod",    color:"text-emerald-400 bg-emerald-500/12 border-emerald-500/20", icon:Puzzle },
  { key:"gsi",      label:"GSI",    color:"text-rose-400 bg-rose-500/12 border-rose-500/20",       icon:Globe },
];

// ── Device Card ────────────────────────────────────────────────────────
function DeviceCard({ device }: { device: DeviceResult }) {
  const { t } = useTranslation();
  const c = BRAND_CFG[device.brand] ?? DCfg;
  const active = BD_META.filter(m => (device.breakdown?.[m.key] ?? 0) > 0);
  return (
    <Link href={`/devices/${device.codename}`}
      className={cn(
        "group relative flex flex-col rounded-2xl border border-white/8 overflow-hidden bg-card transition-all duration-300",
        "hover:border-white/12 hover:-translate-y-0.5 hover:shadow-xl",
        c.glow
      )}>
      {/* Top accent bar */}
      <div className={cn("absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300", c.g)} />

      {/* ROM count badge */}
      <div className="absolute top-2.5 end-2.5 z-10 flex flex-col items-center justify-center min-w-[34px] h-9 rounded-lg bg-black/55 border border-white/10 backdrop-blur-sm px-1">
        <span className="text-[6px] font-bold text-white/25 uppercase tracking-widest leading-none">ROMs</span>
        <span className="text-[13px] font-black text-white leading-tight">{device.romCount}</span>
      </div>

      {/* Image — device photo fills the card area */}
      <div className="relative h-32 overflow-hidden flex items-center justify-center">
        {/* Brand gradient bg */}
        <div className="absolute inset-0 opacity-40"
          style={{ background:`radial-gradient(ellipse at 50% 0%, ${c.accent}25 0%, transparent 70%)` }} />
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background:`radial-gradient(ellipse at 50% 100%, ${c.accent}20 0%, transparent 65%)` }} />
        {/* Device image - fills nicely, no frame */}
        <DeviceImage codename={device.codename} displayName={device.name} brand={device.brand}
          storedUrl={device.imageUrl} className="h-full w-full"
          imgClassName="h-28 w-auto max-w-[85%] object-contain drop-shadow-lg transition-transform duration-500 group-hover:scale-[1.08] rounded-sm" fallbackSize={52} />
      </div>

      {/* Info */}
      <div className="px-2.5 pb-2 text-center">
        <span className={cn("inline-block text-[8px] font-bold px-2 py-0.5 rounded-full border mb-1", c.badge)}>{device.brand}</span>
        <h3 className="text-[11px] font-bold text-white/88 group-hover:text-white transition-colors line-clamp-2 leading-tight">{device.name}</h3>
        {/* Chipset + year */}
        {(device.chipset || device.released) && (
          <div className="flex items-center justify-center gap-1 mt-0.5 flex-wrap">
            {device.chipset && (
              <span className="text-[8px] text-white/30 truncate max-w-[80px]" title={device.chipset}>
                {device.chipset.length > 14 ? device.chipset.slice(0, 14) + "…" : device.chipset}
              </span>
            )}
            {device.chipset && device.released && <span className="text-[7px] text-white/15">·</span>}
            {device.released && <span className="text-[8px] text-white/30">{device.released}</span>}
          </div>
        )}
      </div>

      {/* Breakdown pills */}
      {active.length > 1 && (
        <div className="flex flex-wrap justify-center gap-0.5 px-2 pb-1 mt-0.5">
          {active.map(({ key, label, color }) => (
            <span key={key} className={cn("inline-flex items-center rounded px-1 py-0.5 text-[7px] font-bold border", color)}>
              {device.breakdown![key]} {label}
            </span>
          ))}
        </div>
      )}

      {/* CTA — زر الأرشيف */}
      <div className="px-2.5 pb-2.5 pt-1 mt-auto">
        <div className={cn("flex items-center justify-center gap-1 w-full rounded-xl py-1.5 text-[10px] font-bold text-white/80 group-hover:text-white bg-gradient-to-r transition-all", c.g)} style={{ opacity: 0.7 }}>
          <Package className="h-2.5 w-2.5" />
          {device.romCount === 1 ? t("search.oneRomShort") : t("search.nPostsShort", { n: device.romCount })}
        </div>
      </div>
    </Link>
  );
}

function DeviceCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/6 bg-card overflow-hidden animate-pulse">
      <div className="h-32 flex items-center justify-center"><div className="h-20 w-14 bg-white/5 rounded-xl" /></div>
      <div className="px-2.5 pb-2.5 space-y-1.5 text-center">
        <div className="h-2 bg-white/5 rounded-full w-10 mx-auto" />
        <div className="h-3 bg-white/5 rounded w-20 mx-auto" />
        <div className="h-7 bg-white/4 rounded-xl mt-2" />
      </div>
    </div>
  );
}

function SmartRow({ s, onClick }: { s: DeviceSuggestion; onClick: () => void }) {
  const { t } = useTranslation();
  const c = BRAND_CFG[s.brand] ?? DCfg;
  return (
    <button onClick={onClick}
      className="group flex items-center gap-2.5 w-full rounded-xl border border-white/8 bg-card/60 p-2.5 hover:border-white/15 hover:bg-card transition-all text-start">
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br", c.g, "opacity-60")}>
        <Smartphone className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-white/90 truncate">{s.displayName}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-full border", c.badge)}>{s.brand}</span>
          <span className="text-[8px] text-white/25 font-mono">{s.codename}</span>
          {s.confidence >= 0.9 && <span className="text-[8px] text-emerald-400 font-bold">{t("search.exactMatch")}</span>}
          {s.warning && <span className="text-[8px] text-amber-400 flex items-center gap-0.5"><AlertTriangle className="h-2 w-2"/>{s.warning.slice(0,25)}</span>}
        </div>
      </div>
      <ChevronRight className="h-3 w-3 text-white/20 group-hover:text-white/50 shrink-0" />
    </button>
  );
}

// ── Main ───────────────────────────────────────────────────────────────
function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initialQ = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQ);
  const [tab, setTab] = useState<"devices" | "roms" | "users">("devices");
  const [roms, setRoms] = useState<RomItem[]>([]);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [allDevices, setAllDevices] = useState<DeviceResult[]>([]);
  const [searchDevices, setSearchDevices] = useState<DeviceResult[]>([]);
  const [smartSugs, setSmartSugs] = useState<DeviceSuggestion[]>([]);
  const [devPage, setDevPage] = useState(1);
  const [devTotal, setDevTotal] = useState(0);
  const [devTotalPages, setDevTotalPages] = useState(1);
  const observerTargetDevices = useRef<HTMLDivElement>(null);

  const [nextCursorRoms, setNextCursorRoms] = useState<string | null>(null);
  const [loadingMoreRoms, setLoadingMoreRoms] = useState(false);
  const observerTargetRoms = useRef<HTMLDivElement>(null);

  const [romsLoading, setRomsLoading]   = useState(false);
  const [devLoading, setDevLoading]     = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [smartLoading, setSmartLoading] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(true);

  const [showFilters, setShowFilters]   = useState(false);
  const [filterType, setFilterType]     = useState<ContentType | "">("");
  const [filterBrand, setFilterBrand]   = useState("");
  const [filterAndroid, setFilterAndroid] = useState("");

  const isUserSearch = query.startsWith("@");
  const cleanQ = isUserSearch ? query.slice(1).trim() : query.trim();

  const loadArchive = useCallback(async (page = 1, brand = "") => {
    setArchiveLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "24" });
      if (brand) params.set("brand", brand);
      const res = await fetch(`/api/devices?${params}`);
      const data = await res.json() as ApiDeviceResp;
      if (page === 1) setAllDevices(data.items || []);
      else setAllDevices(prev => [...prev, ...(data.items || [])]);
      setDevTotal(data.total ?? 0);
      setDevTotalPages(data.totalPages ?? 1);
    } catch {} finally { setArchiveLoading(false); }
  }, []);

  useEffect(() => { loadArchive(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doSearchRoms = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setRoms([]); setNextCursorRoms(null); return; }
    setRomsLoading(true); setNextCursorRoms(null);
    try {
      const res = await apiListRoms({ max: 24, query: q, contentType: filterType || undefined, brand: filterBrand || undefined, android: filterAndroid || undefined });
      setRoms(res?.items ?? []);
      setNextCursorRoms(res?.nextCursor || null);
    } catch { setRoms([]); setNextCursorRoms(null); } finally { setRomsLoading(false); }
  }, [filterType, filterBrand, filterAndroid]);

  const loadMoreRoms = useCallback(async () => {
    if (!nextCursorRoms || loadingMoreRoms) return;
    setLoadingMoreRoms(true);
    try {
      const res = await apiListRoms({ max: 24, query: cleanQ, contentType: filterType || undefined, brand: filterBrand || undefined, android: filterAndroid || undefined, cursor: nextCursorRoms });
      setRoms(prev => [...prev, ...(res?.items ?? [])]);
      setNextCursorRoms(res?.nextCursor || null);
    } catch {} finally { setLoadingMoreRoms(false); }
  }, [cleanQ, nextCursorRoms, loadingMoreRoms, filterType, filterBrand, filterAndroid]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && nextCursorRoms && !loadingMoreRoms && !romsLoading) loadMoreRoms();
    }, { threshold: 0.1 });
    if (observerTargetRoms.current) observer.observe(observerTargetRoms.current);
    return () => observer.disconnect();
  }, [nextCursorRoms, loadingMoreRoms, romsLoading, loadMoreRoms]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && devPage < devTotalPages && !archiveLoading) {
        const next = devPage + 1;
        setDevPage(next);
        loadArchive(next, filterBrand);
      }
    }, { threshold: 0.1 });
    if (observerTargetDevices.current) observer.observe(observerTargetDevices.current);
    return () => observer.disconnect();
  }, [devPage, devTotalPages, archiveLoading, filterBrand, loadArchive]);

  const doSearchDevices = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setSearchDevices([]); return; }
    setDevLoading(true);
    try {
      const params = new URLSearchParams({ q, limit: "20" });
      if (filterBrand) params.set("brand", filterBrand);
      const data = await fetch(`/api/devices?${params}`).then(r => r.json()) as ApiDeviceResp;
      setSearchDevices(data.items ?? []);
    } catch { setSearchDevices([]); } finally { setDevLoading(false); }
  }, [filterBrand]);

  const doSearchUsers = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setUsers([]); return; }
    setUsersLoading(true);
    try { setUsers((await apiSearchUsers(q)) ?? []); }
    catch { setUsers([]); } finally { setUsersLoading(false); }
  }, []);

  const doSmartSearch = useCallback(async (q: string) => {
    if (!q || q.length < 3) { setSmartSugs([]); return; }
    setSmartLoading(true);
    try {
      const data = await fetch(`/api/devices/suggest?q=${encodeURIComponent(q)}`).then(r => r.json()) as { best?: DeviceSuggestion; suggestions?: DeviceSuggestion[] };
      const all: DeviceSuggestion[] = [];
      if (data.best) all.push(data.best);
      (data.suggestions || []).forEach(s => { if (!all.find(x => x.codename === s.codename)) all.push(s); });
      setSmartSugs(all.slice(0, 3));
    } catch { setSmartSugs([]); } finally { setSmartLoading(false); }
  }, []);

  const searchFnsRef = useRef({ doSearchRoms, doSearchDevices, doSearchUsers, doSmartSearch });
  useEffect(() => { searchFnsRef.current = { doSearchRoms, doSearchDevices, doSearchUsers, doSmartSearch }; });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(debounce((q: string, isUser: boolean) => {
    if (isUser) {
      setTab("users");
      searchFnsRef.current.doSearchUsers(q);
    } else {
      searchFnsRef.current.doSearchRoms(q);
      searchFnsRef.current.doSearchDevices(q);
      searchFnsRef.current.doSmartSearch(q);
    }
  }, 350), []);

  const handleInput = (v: string) => {
    setQuery(v);
    const isAt = v.startsWith("@");
    const cq = isAt ? v.slice(1).trim() : v.trim();
    if (!cq || cq.length < 2) {
      setRoms([]); setSearchDevices([]); setUsers([]); setSmartSugs([]);
      if (!isAt) setTab("devices");
      return;
    }
    debouncedSearch(cq, isAt);
  };

  useEffect(() => {
    if (initialQ) {
      if (initialQ.startsWith("@")) { setTab("users"); doSearchUsers(initialQ.slice(1)); }
      else { doSearchRoms(initialQ); doSearchDevices(initialQ); doSmartSearch(initialQ); }
    }
    // Only focus if the user clicked the icon (which adds focus=1)
    if (searchParams.get("focus") === "1") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filRef = useRef({ filterType, filterBrand, filterAndroid });
  useEffect(() => {
    const prev = filRef.current;
    if (prev.filterType !== filterType || prev.filterBrand !== filterBrand || prev.filterAndroid !== filterAndroid) {
      filRef.current = { filterType, filterBrand, filterAndroid };
      if (!isUserSearch && cleanQ.length >= 2) { doSearchRoms(cleanQ); doSearchDevices(cleanQ); }
      if (!cleanQ) loadArchive(1, filterBrand);
    }
  }, [filterType, filterBrand, filterAndroid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Swipe detection
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (Math.abs(dx) < 80 || dy > Math.abs(dx) * 0.7) return;
    const tabs: Array<"devices" | "roms" | "users"> = isUserSearch ? ["users"] : ["devices", "roms", "users"];
    const idx = tabs.indexOf(tab);
    if (dx < 0 && idx < tabs.length - 1) setTab(tabs[idx + 1]);
    if (dx > 0 && idx > 0) setTab(tabs[idx - 1]);
  };

  const isSearching = cleanQ.length >= 2;
  const shownDevices = isSearching ? searchDevices : allDevices;
  const activeFilters = [filterType, filterBrand, filterAndroid].filter(Boolean).length;

  const TAB_META = isUserSearch
    ? [{ id:"users" as const, icon:Users, label:t("search.developersTab"), count:users.length, loading:usersLoading }]
    : [
        { id:"devices" as const, icon:Smartphone, label:t("search.devicesTab"),           count:isSearching ? searchDevices.length : devTotal, loading:devLoading || archiveLoading },
        { id:"roms"    as const, icon:Package,    label:t("profile.releases"), count:roms.length,    loading:romsLoading },
        { id:"users"   as const, icon:Users,      label:t("search.developersTab"),           count:users.length,   loading:usersLoading },
      ];

  const isAnyLoading = romsLoading || devLoading || smartLoading || archiveLoading;

  return (
    <div className="mx-auto w-full max-w-5xl px-2 py-3 sm:px-4 lg:px-6">

      {/* ── Search Bar ─────────────────────────────────────────── */}
      <div className="mb-4 space-y-2">
        <div className={cn(
          "flex items-center gap-2.5 rounded-2xl border bg-card px-4 h-14 transition-all duration-200",
          isUserSearch
            ? "border-sky-500/35 shadow-[0_0_0_3px_rgba(14,165,233,0.10)]"
            : "border-border focus-within:border-[var(--primary)]/50 focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_10%,transparent)]"
        )}>
          {isUserSearch
            ? <AtSign className="h-4.5 w-4.5 text-sky-400 shrink-0" />
            : <Search className="h-4.5 w-4.5 text-muted-foreground/60 shrink-0" />
          }
          <input
            id="search-input"
            ref={inputRef} value={query} onChange={e => handleInput(e.target.value)}
            placeholder={isUserSearch ? t("search.userPlaceholder") : t("search.romPlaceholder")}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
          />
          {isUserSearch && (
            <div className="flex items-center gap-1 rounded-lg bg-sky-500/10 border border-sky-500/20 px-2 py-1 shrink-0">
              <AtSign className="h-2.5 w-2.5 text-sky-400" />
              <span className="text-[9px] font-bold text-sky-400">{t("search.developerBadge")}</span>
            </div>
          )}
          {isAnyLoading && <Loader2 className="h-4 w-4 text-primary/70 animate-spin shrink-0" />}
          {query && !isAnyLoading && (
            <button onClick={() => { setQuery(""); setRoms([]); setSearchDevices([]); setUsers([]); setSmartSugs([]); if (!isUserSearch) setTab("devices"); }}
              className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter button — row منفصل تحت الـ search bar */}
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold border transition-all",
              showFilters || activeFilters > 0
                ? "border-[var(--primary)]/40 bg-primary/10 text-[var(--primary)]"
                : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
            )}>
            <Filter className="h-3 w-3" />
            <span>{t("search.filterBtn")}</span>
            {activeFilters > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-black text-white" style={{ backgroundColor:"var(--primary)" }}>{activeFilters}</span>
            )}
          </button>
        </div>

      </div>

      {/* ── Filters ─────────────────────────────────────────────── */}
      {showFilters && (
        <div className="mb-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">{t("filter.filters")}</h3>
            {activeFilters > 0 && <button onClick={() => { setFilterType(""); setFilterBrand(""); setFilterAndroid(""); }} className="text-[11px] text-destructive hover:underline">{t("filter.clearAll")}</button>}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {[
              { label:t("rom.type"),       value:filterType,    change:(v:string)=>setFilterType(v as ContentType|""),  opts:[{v:"",l:t("content.all")},...CONTENT_TYPES.map(c=>({v:c.value,l:c.label}))] },
              { label:t("filter.brand"),   value:filterBrand,   change:(v:string)=>setFilterBrand(v),                   opts:[{v:"",l:t("filter.allBrands")},...BRANDS.map(b=>({v:b,l:b}))] },
              { label:t("filter.android"), value:filterAndroid, change:(v:string)=>setFilterAndroid(v),                 opts:[{v:"",l:t("filter.allVersions")},...ANDROID_VERSIONS.map(a=>({v:a,l:`Android ${a}`}))] },
            ].map(({ label, value, change, opts }) => (
              <div key={label}>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
                <select value={value} onChange={e => change(e.target.value)}
                  className="h-9 w-full rounded-xl border border-border bg-muted/40 px-2.5 text-sm text-foreground focus:outline-none focus:border-[var(--primary)]">
                  {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Smart suggestions ──────────────────────────────────── */}
      {isSearching && !isUserSearch && smartSugs.length > 0 && (
        <div className="mb-4 rounded-2xl border border-primary/12 bg-primary/5 p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20">
              <Zap className="h-2.5 w-2.5 text-primary" />
            </div>
            <span className="text-[10px] font-black text-primary/80 uppercase tracking-wider">{t("search.smartMatch")}</span>
            {smartLoading && <Loader2 className="h-3 w-3 text-primary/60 animate-spin ms-auto" />}
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {smartSugs.map(s => (
              <SmartRow key={s.codename} s={s} onClick={() => router.push(`/devices/${s.codename}`)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-4">
        {TAB_META.map(({ id, icon: Icon, label, count, loading }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-semibold transition-all duration-200 border",
              tab === id ? "text-white border-transparent shadow-sm" : "border-border text-muted-foreground hover:text-foreground hover:border-white/12"
            )}
            style={tab === id ? { backgroundColor:"var(--primary)" } : undefined}>
            <Icon className="h-3.5 w-3.5" />
            {label}
            <span className={cn("text-[9px] px-1.5 py-0.5 rounded-md font-black min-w-[18px] text-center",
              tab === id ? "bg-white/20 text-white" : "bg-muted text-muted-foreground")}>
              {loading ? <Loader2 className="h-2.5 w-2.5 animate-spin inline" /> : count}
            </span>
          </button>
        ))}

      </div>

      {/* ── Content ──────────────────────────────────────────────── */}
      <div ref={containerRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="select-none">

        {/* DEVICES */}
        {tab === "devices" && (
          <div>
            {/* Stats + brand filter */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">
                {archiveLoading && !isSearching
                  ? <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" />{t("search.loading")}</span>
                  : isSearching ? `${searchDevices.length} نتيجة` : `${devTotal.toLocaleString()} جهاز مؤرشف`
                }
              </p>
              {!isSearching && devTotalPages > 1 && (
                <span className="text-[10px] text-muted-foreground/40">{devPage} / {devTotalPages}</span>
              )}
            </div>

            {/* Brand pills — archive only */}
            {!isSearching && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide mb-4" dir="rtl">
                <button onClick={() => { setFilterBrand(""); loadArchive(1, ""); setDevPage(1); }}
                  className={cn("shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold border transition-all whitespace-nowrap",
                    !filterBrand ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border-border hover:border-white/15")}>
                  الكل
                </button>
                {Object.entries(BRAND_CFG).map(([brand, cfg]) => (
                  <button key={brand} onClick={() => { const nb = brand === filterBrand ? "" : brand; setFilterBrand(nb); loadArchive(1, nb); setDevPage(1); }}
                    className={cn("shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold border transition-all whitespace-nowrap",
                      filterBrand === brand ? cfg.badge : "bg-card text-muted-foreground border-border hover:border-white/15")}>
                    {brand}
                  </button>
                ))}
              </div>
            )}

            {archiveLoading && !allDevices.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {Array.from({ length: 10 }).map((_, i) => <DeviceCardSkeleton key={i} />)}
              </div>
            ) : shownDevices.length === 0 ? (
              <div className="animate-fade-in flex flex-col items-center justify-center py-20 text-center px-4">
                <div className="mb-5 flex h-24 w-24 flex-col items-center justify-center rounded-[2rem] border border-dashed border-border bg-card/50 relative group shadow-sm">
                  <Smartphone className="h-10 w-10 text-muted-foreground/30 transition-transform duration-500 group-hover:scale-110 group-hover:text-[var(--primary)]" />
                  <div className="absolute -top-2 -end-2 h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center animate-bounce-slow">
                    <span className="text-[10px]">📱</span>
                  </div>
                </div>
                <h3 className="text-lg font-black text-foreground mb-2">
                  {t("search.noDeviceFound") || "Uncharted Territory"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">
                  {t("search.noDeviceFoundDesc") || "No device recognized. Check the spelling or explore the full archive."}
                </p>
                <Link href="/devices" 
                  className="group relative inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-black text-white hover:scale-105 active:scale-95 transition-all shadow-[0_4px_16px_rgba(29,155,240,0.3)]"
                  style={{ backgroundColor: "var(--primary)" }}>
                  <span className="absolute inset-0 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-500 bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-12" />
                  {t("search.browseAllDevices") || "Browse Archive"} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {shownDevices.map(d => <DeviceCard key={d.codename} device={d} />)}
                </div>
                {!isSearching && devPage < devTotalPages && (
                  <div ref={observerTargetDevices} className="flex justify-center py-4 mt-4">
                    {archiveLoading && (
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
        )}

        {/* ROMS */}
        {tab === "roms" && (
          romsLoading ? (
            <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <RomCardSkeleton key={i} />)}
            </div>
          ) : !isSearching || roms.length === 0 ? (
            <div className="animate-fade-in flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="mb-5 flex h-24 w-24 flex-col items-center justify-center rounded-[2rem] border border-dashed border-border bg-card/50 relative group shadow-sm">
                <Package className="h-10 w-10 text-muted-foreground/30 transition-transform duration-500 group-hover:scale-110 group-hover:text-purple-400" />
                <div className="absolute -top-2 -end-2 h-7 w-7 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center animate-bounce-slow">
                  <span className="text-[10px]">📦</span>
                </div>
              </div>
              <h3 className="text-lg font-black text-foreground mb-2">
                {isSearching ? t("search.noReleases") : t("search.searchToFind")}
              </h3>
              {!isSearching && (
                <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                  {t("search.typeRomOrDevice")}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">{t("search.resultCount", { n: roms.length })}</p>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
                  <TrendingUp className="h-3 w-3" /> {t("search.sortedByRelevance")}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
                {roms.map(r => <RomCard key={r.id} rom={r} />)}
              </div>
              {nextCursorRoms && (
                <div ref={observerTargetRoms} className="flex justify-center py-4 mt-2">
                  {loadingMoreRoms && (
                    <div className="flex items-center gap-2 text-muted-foreground font-bold text-sm">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {t("common.loading") || "Loading..."}
                    </div>
                  )}
                </div>
              )}
            </>
          )
        )}

        {/* USERS */}
        {tab === "users" && (
          usersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-[72px] rounded-2xl bg-card animate-pulse border border-border" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="animate-fade-in flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="mb-5 flex h-24 w-24 flex-col items-center justify-center rounded-[2rem] border border-dashed border-border bg-card/50 relative group shadow-sm">
                <Users className="h-10 w-10 text-muted-foreground/30 transition-transform duration-500 group-hover:scale-110 group-hover:text-sky-400" />
                <div className="absolute -top-2 -end-2 h-7 w-7 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center animate-bounce-slow">
                  <span className="text-[10px]">🧑‍💻</span>
                </div>
              </div>
              <h3 className="text-lg font-black text-foreground mb-2">
                {isUserSearch ? t("search.noDevUserFound", { q: cleanQ }) : t("search.typeAtForDev")}
              </h3>
            </div>
          ) : (
            <div className="grid gap-2">
              {users.map(u => (
                <Link key={u.id} href={`/u/${u.id}`}
                  className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-all hover:border-[var(--primary)]/35 hover:shadow-sm">
                  <div className="relative shrink-0">
                    <Image src={safeImg(u.photo, DEFAULT_AVATAR)} alt={u.name} width={44} height={44}
                      className="rounded-full ring-2 ring-border group-hover:ring-[var(--primary)]/25 transition-all" crossOrigin="anonymous" />
                    {u.romsCount > 0 && (
                      <div className="absolute -bottom-0.5 -end-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white text-[8px] font-black">
                        {u.romsCount > 9 ? "9+" : u.romsCount}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{u.name}</p>
                    {u.username && <p className="text-xs text-muted-foreground">@{u.username}</p>}
                    {u.bio && <p className="mt-0.5 text-[11px] text-muted-foreground/55 line-clamp-1">{u.bio}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Package className="h-3 w-3" />{formatCount(u.romsCount)}</span>
                    <span className="flex items-center gap-1"><Download className="h-3 w-3" />{formatCount(u.totalDownloads ?? 0)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-4 lg:px-6">
        <div className="h-14 animate-pulse rounded-2xl bg-muted mb-4" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <DeviceCardSkeleton key={i} />)}
        </div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
