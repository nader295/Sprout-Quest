"use client";
import React from "react";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import {
  apiGetRom, apiIncrementViews, apiToggleLike, apiCheckLiked,
  apiRecordDownload, apiGetUser, apiGetRomVersions, apiTrackLinkvertiseClick,
  apiFollow, apiUnfollow, apiCheckFollowing, apiDeleteRom, apiGetDeleteXPPreview,
} from "@/lib/api/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { formatCount, fmtDate, timeAgo, cn, safeImg } from "@/lib/utils";
import { DEFAULT_AVATAR, getLevel } from "@/lib/constants";
import type { RomItem, UserDoc, RomVersion } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Download, ExternalLink, Heart, Eye,
  MessageSquare, Share2, Clock,
  HardDrive, Smartphone, Hash, Cpu, Calendar, Package,
  UserPlus, UserCheck, Flag, Edit2,
  Youtube, Send, Github, Globe, Link2, Coffee,
  Copy, Check, Zap, Shield, ZoomIn, Trash2, AlertTriangle,
  ChevronDown, ChevronUp, Sparkles, BarChart2,
  Puzzle, Layers,
} from "lucide-react";
import { getFullUrl } from "@/lib/cloudinary-utils";
import { logger } from "@/lib/logger";
import { CommentsSection } from "@/components/comments/comments-section";
import { DownloadToast } from "@/components/rom/rom-card";
import { ReportDialog } from "@/components/shared/report-dialog";
// XP deduction info per content type
// XP deduction is now computed dynamically via /api/roms?xpPreview=
import { ShareMenu } from "@/components/shared/share-menu";
import { LightboxGallery } from "@/components/shared/lightbox-gallery";
import { toast } from "@/components/shared/toast";
import { VariantDownloadButton } from "@/components/shared/variant-download-picker";
import { useTranslation } from "@/lib/i18n";
import { auth } from "@/lib/firebase/client";
import { appCache } from "@/lib/cache";
import LinkvertiseDownloadButton from "@/components/shared/LinkvertiseDownloadButton";

// ── Delete ROM Button (Owner / Admin only) ────────────────────────────────
function DeleteRomButton({ romId, romName, onDeleted }: {
  romId: string; romName?: string; onDeleted: () => void
}) {
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [xpPreview, setXpPreview] = useState<{ total: number; breakdown: Record<string, number> } | null>(null);
  const [loadingXP, setLoadingXP] = useState(false);

  const openConfirm = async () => {
    setConfirm(true);
    setLoadingXP(true);
    try {
      const preview = await apiGetDeleteXPPreview(romId);
      setXpPreview(preview);
    } catch {
      setXpPreview(null);
    } finally {
      setLoadingXP(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiDeleteRom(romId);
      import("@/lib/cache").then(({ appCache, CacheKeys }) => {
        appCache.invalidate(`rom:detail:${romId}`);
        appCache.invalidate(CacheKeys.roms("newest","","",""));
        appCache.invalidate(CacheKeys.roms("trending","","",""));
        appCache.invalidate("explore:trending");
        appCache.invalidate("explore:featured");
      }).catch(() => {});
      onDeleted();
    } catch {
      setDeleting(false);
      setConfirm(false);
    }
  };

  if (confirm) {
    const xpTotal = xpPreview?.total ?? 0;
    const bd = xpPreview?.breakdown;
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-destructive/40 bg-destructive/8 p-3 backdrop-blur-sm min-w-[240px]">
        {/* XP warning — الرقم الدقيق */}
        <div className="flex flex-col gap-1 rounded-xl bg-amber-500/10 border border-amber-500/25 px-2.5 py-2">
          <div className="flex items-center gap-1.5" dir="rtl">
            <span className="text-base">⚡</span>
            {loadingXP ? (
              <p className="text-[11px] font-black text-amber-400">{t("rom.xp.calculating") || "Calculating..."}</p>
            ) : (
              <p className="flex items-center gap-1 flex-wrap text-[11px] font-black text-amber-400">
                <span>{t("rom.xp.willDeduct") || "Will deduct"}</span>
                <span className="text-sm">{xpTotal}</span>
                <span dir="ltr">XP</span>
                <span>{t("rom.xp.exactly") || "exactly"}</span>
              </p>
            )}
          </div>
          {bd && !loadingXP && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1" dir="rtl">
              {bd.publish   > 0 && <span className="text-[9px] text-amber-400/60 flex items-center gap-1"><span>{t("rom.xp.publish") || "Publish:"}</span> <span>-{bd.publish}</span> <span dir="ltr">XP</span></span>}
              {bd.likes     > 0 && <span className="text-[9px] text-amber-400/60 flex items-center gap-1"><span>{t("rom.xp.likes") || "Likes:"}</span> <span>-{bd.likes}</span> <span dir="ltr">XP</span></span>}
              {bd.dlXP      > 0 && <span className="text-[9px] text-amber-400/60 flex items-center gap-1"><span>{t("rom.xp.downloads") || "Downloads:"}</span> <span>-{bd.dlXP}</span> <span dir="ltr">XP</span></span>}
              {bd.viewsXP   > 0 && <span className="text-[9px] text-amber-400/60 flex items-center gap-1"><span>{t("rom.xp.views") || "Views:"}</span> <span>-{bd.viewsXP}</span> <span dir="ltr">XP</span></span>}
              {bd.comments  > 0 && <span className="text-[9px] text-amber-400/60 flex items-center gap-1"><span>{t("rom.xp.comments") || "Comments:"}</span> <span>-{bd.comments}</span> <span dir="ltr">XP</span></span>}
              {(bd.m100 || bd.m500 || bd.m1000) > 0 && (
                <span className="text-[9px] text-amber-400/60 flex items-center gap-1"><span>{t("rom.xp.milestones") || "Milestones:"}</span> <span>-{(bd.m100||0)+(bd.m500||0)+(bd.m1000||0)}</span> <span dir="ltr">XP</span></span>
              )}
            </div>
          )}
          <p className="text-[9px] text-amber-400/80 font-bold mt-0.5" dir="rtl">
            {t("rom.xp.warning") || "⚠️ Milestones related to this ROM will be reviewed and withdrawn if no longer eligible"}
          </p>
        </div>
        <p className="text-[11px] text-destructive font-bold text-center">
          {t("rom.deleteConfirm", { name: romName ?? "" })}
        </p>
        <div className="flex gap-2">
          <button onClick={handleDelete} disabled={deleting || loadingXP}
            className="flex-1 rounded-xl bg-destructive py-1.5 text-[11px] font-black text-white hover:opacity-90 active:scale-95 transition-all disabled:opacity-50">
            {deleting ? t("rom.deleting") : t("rom.confirmDelete")}
          </button>
          <button onClick={() => setConfirm(false)}
            className="flex-1 rounded-xl border border-border bg-card/80 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-all">
            {t("common.cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirm(true)}
      className="flex items-center gap-1.5 rounded-2xl border border-destructive/30 bg-destructive/8 px-3 py-1.5 text-[11px] font-bold text-destructive hover:bg-destructive/15 hover:scale-105 active:scale-90 transition-all backdrop-blur-sm">
      <Trash2 className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{t("rom.delete")}</span>
      <span className="sm:hidden">{t("rom.delete")}</span>
    </button>
  );
}

// ── DeviceInfoInline — معلومات مختصرة للجهاز تحت اسم المعالج فقط ────
// ── DeviceImageHero — صورة الجهاز في الـ hero لما مفيش thumbnail ────
function DeviceImageHero({ codename, name, brand }: { codename: string; name: string; brand: string }) {
  const [src, setSrc] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!codename) return;
    const cached = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("ri_" + codename) : null;
    if (cached) { setSrc(cached === "null" ? null : cached); return; }

    const params = new URLSearchParams({ name, brand });
    fetch(`/api/device-image/${encodeURIComponent(codename)}?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(async d => {
        const urls: string[] = d?.gsmaUrls || [];
        for (const url of urls.slice(0, 5)) {
          const ok = await new Promise<boolean>(res => {
            if (typeof window === "undefined") { res(false); return; }
            const img = new window.Image();
            img.onload = () => res(true);
            img.onerror = () => res(false);
            img.src = url;
            setTimeout(() => res(false), 5000);
          });
          if (ok) {
            setSrc(url);
            try { sessionStorage.setItem("ri_" + codename, url); } catch { /* ignore */ }
            return;
          }
        }
        try { sessionStorage.setItem("ri_" + codename, "null"); } catch { /* ignore */ }
      }).catch((err) => logger.error("rom.deviceImage.fetchChain", err, { codename, brand }));
  }, [codename, name, brand]);

  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name}
    className="h-full w-auto max-h-[90%] object-contain drop-shadow-2xl opacity-85"
    style={{ filter: "drop-shadow(-12px 0 24px rgba(0,0,0,0.5))" }}
  />;
}

function DeviceInfoInline({ codename, deviceName, brand }: { codename: string; deviceName: string; brand: string }) {
  const { t } = useTranslation();
  const [info, setInfo] = useState<{ chipset?: string; released?: string } | null>(null);

  useEffect(() => {
    if (!codename) return;
    fetch(`/api/devices?codename=${encodeURIComponent(codename)}&limit=1`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.device && (d.device.chipset || d.device.released)) {
          setInfo({ chipset: d.device.chipset || null, released: d.device.released || null });
        }
      })
      .catch((err) => logger.error("rom.deviceInfoInline.fetch", err, { codename }));
  }, [codename, deviceName]);

  // لا تعرض الـ component لو ما فيش بيانات
  if (!info?.chipset && !info?.released) return null;

  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      {info.chipset && (
        <span className="flex items-center gap-1 text-[10px] text-white/35 bg-white/5 border border-white/8 rounded-full px-2 py-0.5">
          <Cpu className="h-2.5 w-2.5" />{info.chipset}
        </span>
      )}
      {info.released && (
        <span className="flex items-center gap-1 text-[10px] text-white/35 bg-white/5 border border-white/8 rounded-full px-2 py-0.5">
          <Calendar className="h-2.5 w-2.5" />{info.released}
        </span>
      )}
      <Link href={`/devices/${codename}`}
        className="flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary transition-colors rounded-full px-2 py-0.5 bg-primary/5 border border-primary/15">
        <Package className="h-2.5 w-2.5" /> {t("nav.board")}
      </Link>
    </div>
  );
}

export default function RomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, userDoc: authUserDoc, isLoggedIn, isAdmin } = useAuth();
  const { t } = useTranslation();

  const [rom, setRom] = useState<RomItem | null>(null);
  const [dev, setDev] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [following, setFollowing] = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);
  const [tab, setTab] = useState<"description" | "changelog" | "screenshots">("description");
  const [showReport, setShowReport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [versions, setVersions] = useState<RomVersion[]>([]);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [showDownloadToast, setShowDownloadToast] = useState(false);
  const [copiedChecksum, setCopiedChecksum] = useState<string | null>(null);
  const [floatingVisible, setFloatingVisible] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number>(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [guideExpanded, setGuideExpanded] = useState(false);
  // Linkvertise per-post toggle (owner only)
  const [lvEnabled, setLvEnabled] = useState<boolean | null>(null); // null = not loaded yet
  const [lvToggling, setLvToggling] = useState(false);
  // TikTok-style heart bursts -> Gorgeous 360 Explosion
  const [heartBursts, setHeartBursts] = useState<{ id: number; angle: number; distance: number; size: number; color: string; type: string }[]>([]);
  
  // Tab swipe handlers
  const tabTouchStartX = useRef(0);
  const tabTouchStartY = useRef(0);
  const handleTabTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.overflow-x-auto, [data-swipeable], .no-swipe')) {
      tabTouchStartX.current = -1;
      return;
    }
    tabTouchStartX.current = e.touches[0].clientX;
    tabTouchStartY.current = e.touches[0].clientY;
  }, []);
  const handleTabTouchEnd = useCallback((e: React.TouchEvent) => {
    if (tabTouchStartX.current === -1) return;
    const dx = e.changedTouches[0].clientX - tabTouchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - tabTouchStartY.current);
    if (Math.abs(dx) < 60 || dy > Math.abs(dx) * 0.8) return;
    const tabs = ["description", "changelog", "screenshots"] as const;
    setTab(prev => {
      const idx = tabs.indexOf(prev);
      if (dx < 0 && idx < tabs.length - 1) return tabs[idx + 1];
      if (dx > 0 && idx > 0) return tabs[idx - 1];
      return prev;
    });
  }, []);
  const DESC_LIMIT = 400;
  const GUIDE_LIMIT = 350;
  const downloadBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    async function load() {
      setLoading(true);
      // Try cache first (10 min TTL for ROM detail)
      const cacheKey = `rom:detail:${id}`;
      const cached = appCache.get<RomItem>(cacheKey);
      const romData: RomItem | null = cached ?? await apiGetRom(id);
      if (!romData) { setLoading(false); return; }
      if (!cached) appCache.set(cacheKey, romData, 10 * 60 * 1000);
      setRom(romData);
      setLvEnabled(romData.linkvertiseEnabled ?? false);
      // ── Anti-fraud views: 24h cooldown per ROM per browser ──
      const viewKey = `rx_viewed_${id}`;
      try {
        const stored = localStorage.getItem(viewKey);
        const lastView = stored ? parseInt(stored, 10) : 0;
        const cooldown = 24 * 60 * 60 * 1000; // 24 hours
        if (!lastView || Date.now() - lastView > cooldown) {
          localStorage.setItem(viewKey, String(Date.now()));
          apiIncrementViews(id);
        }
      } catch {
        // fallback if localStorage is blocked
        if (!sessionStorage.getItem(viewKey)) {
          sessionStorage.setItem(viewKey, "1");
          apiIncrementViews(id);
        }
      }
      // ⑮ Recently Viewed — save to localStorage (max 10 items)
      try {
        const RECENTLY_KEY = "rx_recently_viewed";
        const existing: { id: string; name: string; device: string; brand: string; thumbnail?: string; ts: number }[] =
          JSON.parse(localStorage.getItem(RECENTLY_KEY) || "[]");
        const filtered = existing.filter((r) => r.id !== id).slice(0, 9);
        filtered.unshift({
          id,
          name:      romData.name || "",
          device:    romData.device || "",
          brand:     romData.brand || "",
          thumbnail: romData.thumbnail || "",
          ts:        Date.now(),
        });
        localStorage.setItem(RECENTLY_KEY, JSON.stringify(filtered));
      } catch { /* ignore */ }

      // ── اللايك: نعرض من localStorage فورًا (لا انتظار) ──
      if (!user?.uid) {
        try {
          if (localStorage.getItem(`romx_liked_${id}`) === "1") setLiked(true);
        } catch { /* ignore */ }
      }

      await Promise.allSettled([
        romData.maintainerUid
          ? apiGetUser(romData.maintainerUid).then(setDev)
              .catch((err) => logger.error("rom.loadMaintainer", err, { romId: id, maintainerUid: romData.maintainerUid }))
          : Promise.resolve(),
        apiGetRomVersions(id).then(setVersions),
        // تأكيد من السيرفر — يصحح لو localStorage اتمسح أو جهاز تاني
        apiCheckLiked(id)
          .then(setLiked)
          .catch(() => { /* keep localStorage value on failure */ }),
      ]);
      setLoading(false);
    }
    load();
  }, [id]);

  useEffect(() => {
    if (!id || !user?.uid || !rom?.maintainerUid) return;
    apiCheckFollowing(rom.maintainerUid).then(setFollowing)
      .catch((err) => logger.error("rom.checkFollowing", err, { romId: id, maintainerUid: rom.maintainerUid }));
  }, [id, user?.uid, rom?.maintainerUid]);

  // Re-check liked status when user auth state changes (fixes the "like not showing" bug)
  useEffect(() => {
    if (!id || !user?.uid) return;
    apiCheckLiked(id).then(setLiked)
      .catch((err) => logger.error("rom.checkLiked.recheck", err, { romId: id }));
  }, [id, user?.uid]);

  // Floating download — shows when main button scrolls out of view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setFloatingVisible(!entry.isIntersecting),
      { threshold: 0 }
    );
    if (downloadBtnRef.current) observer.observe(downloadBtnRef.current);
    return () => observer.disconnect();
  }, [rom]);

  const likeInFlight = useRef(false);
  const handleLike = useCallback(async () => {
    if (!id) return;
    if (likeInFlight.current) return;
    likeInFlight.current = true;

    // Optimistic update فوري — يتغير قبل الـ API
    const wasLiked = liked;
    setLiked(!wasLiked);
    setRom((prev) => prev ? { ...prev, likesCount: prev.likesCount + (wasLiked ? -1 : 1) } : prev);
    setLikeAnim(false);
    requestAnimationFrame(() => {
      setLikeAnim(true);
      setTimeout(() => setLikeAnim(false), 600);
    });

    // Spawn gorgeous 360 explosion only when liking (not unliking)
    if (!wasLiked) {
      const count = 15;
      const colors = ['#f43f5e', '#fb7185', '#fda4af', '#fecdd3', '#e11d48'];
      const burst = Array.from({ length: count }, (_, i) => ({
        id: Date.now() + i,
        angle: (360 / count) * i + (Math.random() * 20 - 10),
        distance: 25 + Math.random() * 50,
        size: 0.5 + Math.random() * 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        type: Math.random() > 0.4 ? 'heart' : 'circle'
      }));
      setHeartBursts(prev => [...prev, ...burst]);
      setTimeout(() => {
        setHeartBursts(prev => {
          const ids = new Set(burst.map(h => h.id));
          return prev.filter(h => !ids.has(h.id));
        });
      }, 1000);
    }

    try {
      const res = await apiToggleLike(id);
      // تأكيد من السيرفر — لو في فرق صحح
      setLiked(res.liked);
      // حفظ حالة اللايك في localStorage للمستخدمين المجهولين
      try {
        if (res.liked) {
          localStorage.setItem(`romx_liked_${id}`, "1");
        } else {
          localStorage.removeItem(`romx_liked_${id}`);
        }
      } catch { /* ignore */ }
      setRom((prev) => {
        if (!prev) return prev;
        const diff = (res.liked ? 1 : 0) - (!wasLiked ? 1 : 0);
        return { ...prev, likesCount: prev.likesCount + diff };
      });
    } catch {
      // Rollback لو فشل
      setLiked(wasLiked);
      setRom((prev) => prev ? { ...prev, likesCount: prev.likesCount + (wasLiked ? 1 : -1) } : prev);
    } finally {
      likeInFlight.current = false;
    }
  }, [user?.uid, id, liked, router]);

  const handleFollow = useCallback(async () => {
    if (!user?.uid || !rom?.maintainerUid) return;
    if (following) { await apiUnfollow(rom.maintainerUid); }
    else { await apiFollow(rom.maintainerUid); }
    setFollowing(!following);
  }, [user?.uid, rom?.maintainerUid, following]);

  const handleCopyDownloadLink = useCallback(() => {
    if (!rom?.downloadUrl) return;
    navigator.clipboard.writeText(rom.downloadUrl).then(() => {
      toast.success("📋 " + t("share.copied"));
    }).catch(() => {
      toast.error(t("common.error"));
    });
  }, [rom?.downloadUrl, isLoggedIn, id]);

  const handleCopyChecksum = useCallback((value: string, type: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedChecksum(type);
      setTimeout(() => setCopiedChecksum(null), 2000);
    }).catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl px-3 py-3 sm:px-4 sm:py-4 animate-pulse">
        <div className="h-5 w-16 rounded-md bg-muted mb-4" />
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="aspect-[21/9] w-full bg-muted" />
          <div className="p-4 sm:p-5 space-y-4">
            <div className="space-y-2">
              <div className="flex gap-2"><div className="h-5 w-14 rounded-full bg-muted" /><div className="h-5 w-20 rounded-full bg-muted" /></div>
              <div className="h-7 w-3/4 rounded-md bg-muted" />
              <div className="h-4 w-1/2 rounded-md bg-muted" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted" />)}
            </div>
            <div className="h-24 rounded-xl bg-muted" />
            <div className="h-12 rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!rom) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-xl font-semibold text-foreground">{t("home.noResults")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("profile.userNotFoundDesc")}</p>
        <button onClick={() => router.push("/")} className="mt-4 text-sm" style={{ color: "var(--primary)" }}>{t("common.goHome")}</button>
      </div>
    );
  }

  const isOwner = user?.uid === rom.maintainerUid;
  const statusLabel = rom.romStatus === "active" ? t("status.active") :
    rom.romStatus === "beta" ? t("status.beta") :
    rom.romStatus === "testing" ? t("status.testing") :
    rom.romStatus === "discontinued" ? t("status.discontinued") :
    rom.romStatus || t("status.active");
  const statusStyle =
    rom.romStatus === "active" ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" :
    rom.romStatus === "beta"   ? "text-amber-400 bg-amber-400/10 border-amber-400/30" :
    rom.romStatus === "testing" ? "text-blue-400 bg-blue-400/10 border-blue-400/30" :
    "text-orange-400 bg-orange-400/10 border-orange-400/30";
  const tabLabels: Record<string, string> = {
    description: t("rom.description"),
    changelog: t("rom.changelog"),
    screenshots: t("rom.screenshots"),
  };
  const hasThumb = rom.thumbnail && rom.thumbnail.startsWith("http");

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6 pb-28">

      {/* Back + Delete row */}
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => router.back()} className="group flex items-center gap-2 rounded-2xl border border-border/50 bg-card/60 px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted hover:border-[var(--primary)]/30 transition-all hover:scale-105 active:scale-95 backdrop-blur-sm">
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          {t("common.back")}
        </button>
        {(isOwner || isAdmin) && (
          <DeleteRomButton
            romId={id}
            romName={rom?.name}
            onDeleted={() => router.replace("/")}
          />
        )}
      </div>

      {/* Hero — Cinematic Cyber Frame */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-2xl rom-hero-cyber">
        {/* Cyber corner ticks */}
        <span className="pointer-events-none absolute top-0 left-0 h-5 w-5 border-t-2 border-l-2 rounded-tl-3xl z-20" style={{ borderColor: "color-mix(in srgb, var(--primary) 70%, transparent)" }} />
        <span className="pointer-events-none absolute top-0 right-0 h-5 w-5 border-t-2 border-r-2 rounded-tr-3xl z-20" style={{ borderColor: "color-mix(in srgb, var(--primary) 70%, transparent)" }} />
        {/* Top scan pulse */}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px z-20 opacity-70"
          style={{ background: "linear-gradient(90deg, transparent 0%, var(--primary) 50%, transparent 100%)", animation: "holo-scan 4.5s ease-in-out infinite" }} />

        {hasThumb ? (
          <div className="relative w-full overflow-hidden" style={{ height: "clamp(220px, 52vw, 380px)" }}>
            <Image src={getFullUrl(rom.thumbnail)} alt={rom.name} fill className="object-cover scale-[1.03] transition-transform duration-[1200ms] ease-out hover:scale-[1.06]" crossOrigin="anonymous" priority />

            {/* Holographic grid overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-screen"
              style={{ backgroundImage: "linear-gradient(var(--primary) 1px, transparent 1px), linear-gradient(90deg, var(--primary) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

            {/* Radial accent glow top-left */}
            <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full pointer-events-none opacity-50"
              style={{ background: "radial-gradient(ellipse, color-mix(in srgb, var(--primary) 30%, transparent) 0%, transparent 70%)", filter: "blur(40px)" }} />

            {/* Vignette */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.35) 100%)" }} />

            {/* Cinematic fade — light foggy dissolve */}
            <div className="absolute inset-x-0 bottom-0 pointer-events-none"
              style={{ height: "60%", background: "linear-gradient(to top, rgb(var(--card) / 0.98) 0%, rgb(var(--card) / 0.75) 25%, rgb(var(--card) / 0.4) 55%, rgb(var(--card) / 0.1) 78%, transparent 100%)" }} />

            {/* Floating title over image */}
            <div className="absolute inset-x-0 bottom-0 z-10 px-4 sm:px-6 pb-6">
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                {rom.featured && (
                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-md"
                    style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", boxShadow: "0 4px 12px rgba(245,158,11,0.4)" }}>
                    ★ {t("rom.featured")}
                  </span>
                )}
                <span className={cn("rounded-full border px-2.5 py-0.5 text-[10px] font-bold backdrop-blur-md", statusStyle)}>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-current me-1 animate-pulse" />
                  {statusLabel}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black leading-[1.05] text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]">
                {rom.name}
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm font-semibold text-white/80 drop-shadow-lg">
                {[rom.device, rom.brand && rom.brand !== "Other" && rom.brand, rom.android && `Android ${rom.android}`, rom.version && `v${rom.version}`].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="absolute top-3 end-3 flex gap-2">
              {(isOwner || isAdmin) && (
                <Link href={`/upload?edit=${rom.id}`} className="flex items-center gap-1.5 rounded-xl bg-black/65 backdrop-blur-md border border-white/15 px-3 py-2 text-[11px] font-bold text-white/85 hover:text-white hover:bg-black/80 hover:scale-105 active:scale-90 transition-all">
                  <Edit2 className="h-3 w-3" /> {t("rom.edit")}
                </Link>
              )}
              {isOwner && lvEnabled !== null && (
                <button
                  onClick={async () => {
                    setLvToggling(true);
                    const next = !lvEnabled;
                    try {
                      const { apiToggleLinkvertise } = await import("@/lib/api/client");
                      await apiToggleLinkvertise(rom.id, next);
                      setLvEnabled(next);
                    } catch { /* ignore */ } finally { setLvToggling(false); }
                  }}
                  disabled={lvToggling}
                  className="flex items-center gap-1.5 rounded-xl backdrop-blur-md border px-3 py-2 text-[11px] font-bold transition-all hover:scale-105 active:scale-90 disabled:opacity-50"
                  style={lvEnabled
                    ? { background: "rgba(59,130,246,0.55)", borderColor: "rgba(59,130,246,0.6)", color: "#fff" }
                    : { background: "rgba(0,0,0,0.55)", borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }
                  }
                  title={lvEnabled ? (t("rom.disableAd") || "Disable Linkvertise Ad") : (t("rom.enableAd") || "Enable Linkvertise Ad")}
                >
                  <Zap className={`h-3 w-3 ${lvToggling ? "animate-spin" : ""}`} />
                  {lvEnabled ? (t("rom.adEnabled") || "Ad Enabled") : (t("rom.noAd") || "No Ad")}
                </button>
              )}
              <button onClick={() => setShowShare(true)} className="flex items-center gap-1.5 rounded-xl bg-black/65 backdrop-blur-md border border-white/15 px-3 py-2 text-[11px] font-bold text-white/85 hover:text-white hover:bg-black/80 hover:scale-105 active:scale-90 transition-all">
                <Share2 className="h-3 w-3" /> {t("rom.share")}
              </button>
              {isLoggedIn && !isOwner && (
                <button onClick={() => setShowReport(true)}
                  className="flex items-center justify-center rounded-xl bg-black/65 backdrop-blur-md border border-white/15 p-2 text-white/70 hover:text-destructive hover:bg-black/80 hover:scale-105 active:scale-90 transition-all"
                  aria-label="Report">
                  <Flag className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ) : (
          // No thumbnail → device image hero
          <div className="relative overflow-hidden" style={{ height: "clamp(140px, 35vw, 220px)" }}>
            {/* Brand gradient background */}
            <div className="absolute inset-0"
              style={{ background: `linear-gradient(135deg, color-mix(in srgb, var(--primary) 12%, transparent) 0%, var(--card) 100%)` }} />
            {/* Mesh pattern */}
            <div className="absolute inset-0 opacity-[0.03]"
              style={{ backgroundImage: "radial-gradient(var(--primary) 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
            {/* Device image */}
            {rom.deviceCodename && (
              <div className="absolute inset-0 flex items-center justify-end pe-8 overflow-hidden">
                <DeviceImageHero codename={rom.deviceCodename} name={rom.device || ""} brand={rom.brand || ""} />
              </div>
            )}
            {/* Bottom fade */}
            <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none"
              style={{ background: "linear-gradient(to top, rgb(var(--card) / 0.95) 0%, transparent 100%)" }} />
            {/* Action buttons */}
            <div className="absolute top-3 end-3 flex gap-2 z-10">
              {(isOwner || isAdmin) && (
                <Link href={`/upload?edit=${rom.id}`} className="flex items-center gap-1.5 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 px-3 py-2 text-[11px] font-bold text-white/80 hover:text-white hover:bg-black/70 hover:scale-105 active:scale-90 transition-all">
                  <Edit2 className="h-3 w-3" /> {t("rom.edit")}
                </Link>
              )}
              {isOwner && lvEnabled !== null && (
                <button
                  onClick={async () => {
                    setLvToggling(true);
                    const next = !lvEnabled;
                    try {
                      const { apiToggleLinkvertise } = await import("@/lib/api/client");
                      await apiToggleLinkvertise(rom.id, next);
                      setLvEnabled(next);
                    } catch { /* ignore */ } finally { setLvToggling(false); }
                  }}
                  disabled={lvToggling}
                  className="flex items-center gap-1.5 rounded-xl backdrop-blur-md border px-3 py-2 text-[11px] font-bold transition-all hover:scale-105 active:scale-90 disabled:opacity-50"
                  style={lvEnabled
                    ? { background: "rgba(59,130,246,0.5)", borderColor: "rgba(59,130,246,0.55)", color: "#fff" }
                    : { background: "rgba(0,0,0,0.45)", borderColor: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.65)" }
                  }
                  title={lvEnabled ? (t("rom.disableAd") || "Disable Linkvertise Ad") : (t("rom.enableAd") || "Enable Linkvertise Ad")}
                >
                  <Zap className={`h-3 w-3 ${lvToggling ? "animate-spin" : ""}`} />
                  {lvEnabled ? (t("rom.adEnabled") || "Ad Enabled") : (t("rom.noAd") || "No Ad")}
                </button>
              )}
              <button onClick={() => setShowShare(true)} className="flex items-center gap-1.5 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 px-3 py-2 text-[11px] font-bold text-white/80 hover:text-white hover:bg-black/70 hover:scale-105 active:scale-90 transition-all">
                <Share2 className="h-3 w-3" /> {t("rom.share")}
              </button>
            </div>
          </div>
        )}

        <div className="p-4 sm:p-5 relative z-10">
          {/* Title block only when no thumbnail (else it's overlaid on the image) */}
          {!hasThumb && (
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                  {rom.featured && <span className="rounded-full bg-amber-500/90 px-2.5 py-0.5 text-[10px] font-bold text-white">★ {t("rom.featured")}</span>}
                  <span className={cn("rounded-full border px-2.5 py-0.5 text-[10px] font-bold", statusStyle)}>{statusLabel}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-foreground leading-tight">{rom.name}</h1>
                <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground font-semibold">
                  {[rom.device, rom.brand && rom.brand !== "Other" && rom.brand, rom.android && `Android ${rom.android}`, rom.version && `v${rom.version}`].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
          )}
          {/* Report button — top-right corner */}
          {isLoggedIn && !isOwner && !hasThumb && (
            <button onClick={() => setShowReport(true)}
              className="absolute top-3 end-3 z-20 rounded-xl p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:scale-110 active:scale-90 transition-all">
              <Flag className="h-3.5 w-3.5" />
            </button>
          )}

          {/* ── Stats Row — Holographic chips ── */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { icon: Download, value: formatCount(rom.downloads),  label: t("profile.downloads"), color: "#34d399", bg: "rgba(52,211,153,0.08)",   border: "rgba(52,211,153,0.18)" },
              { icon: Heart,    value: formatCount(rom.likesCount), label: t("profile.likes"),     color: "#fb7185", bg: "rgba(251,113,133,0.08)",  border: "rgba(251,113,133,0.18)" },
              { icon: Eye,      value: formatCount(rom.total_views),label: t("profile.views"),     color: "#38bdf8", bg: "rgba(56,189,248,0.08)",   border: "rgba(56,189,248,0.18)" },
            ].map(({ icon: Icon, value, label, color, bg, border }) => (
              <div key={label}
                className="group flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 transition-all hover:scale-[1.03] active:scale-[0.97]"
                style={{ background: bg, border: `1px solid ${border}` }}>
                <Icon className="h-3.5 w-3.5 transition-transform group-hover:scale-110" style={{ color }} />
                <span className="text-base font-black tabular-nums leading-none" style={{ color }}>{value}</span>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 leading-none">{label}</span>
              </div>
            ))}
          </div>

          {/* ── Developer Card — Holographic Glass Design ── */}
          <div className="mt-3 relative overflow-hidden rounded-2xl group/dev"
            style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 8%, transparent) 0%, color-mix(in srgb, var(--primary) 2%, transparent) 100%)", border: "1px solid color-mix(in srgb, var(--primary) 18%, transparent)" }}>
            {/* Corner ticks */}
            <span className="pointer-events-none absolute top-0 left-0 h-3 w-3 border-t border-l rounded-tl-2xl" style={{ borderColor: "color-mix(in srgb, var(--primary) 50%, transparent)" }} />
            <span className="pointer-events-none absolute top-0 right-0 h-3 w-3 border-t border-r rounded-tr-2xl" style={{ borderColor: "color-mix(in srgb, var(--primary) 50%, transparent)" }} />
            {/* Animated top scan line */}
            <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--primary) 55%, transparent), transparent)" }} />
            {/* Hover glow */}
            <div className="absolute inset-0 opacity-0 group-hover/dev:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at top right, color-mix(in srgb, var(--primary) 10%, transparent), transparent 60%)" }} />
            <div className="flex items-center gap-3 px-3 py-3">
              {/* Avatar */}
              <Link href={`/u/${rom.maintainerUid}`} className="relative shrink-0 group/av">
                <Image src={safeImg(dev?.photo || rom.maintainerPhoto, DEFAULT_AVATAR)} alt={dev?.name || rom.maintainerName || "Dev"} width={44} height={44}
                  className="rounded-xl object-cover transition-all duration-200 group-hover/av:ring-2 group-hover/av:ring-[var(--primary)]/60"
                  crossOrigin="anonymous" />
                <div className="absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
              </Link>

              <div className="flex-1 min-w-0">
                <Link href={`/u/${rom.maintainerUid}`}
                  className="text-sm font-bold text-foreground hover:text-[var(--primary)] transition-colors line-clamp-1 block">
                  {dev?.name || rom.maintainerName}
                </Link>
                {dev?.username ? (
                  <p className="text-[11px] text-muted-foreground/60 font-medium">@{dev.username}</p>
                ) : (
                  <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-semibold">Developer</p>
                )}
              </div>

              {!isOwner && (
                <button
                  onClick={isLoggedIn ? handleFollow : () => router.push(`/login?redirect=/rom/${id}`)}
                  className={cn(
                    "shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all",
                    "hover:scale-105 active:scale-95",
                    following
                      ? "border border-border/60 text-muted-foreground hover:border-rose-500/40 hover:text-rose-400"
                      : "text-white shadow-md"
                  )}
                  style={!following ? { background: "linear-gradient(135deg, var(--primary), #3b82f6)", boxShadow: "0 4px 12px rgba(29,155,240,0.3)" } : undefined}>
                  {following ? <><UserCheck className="h-3 w-3" /> {t("profile.following")}</> : <><UserPlus className="h-3 w-3" /> {t("profile.follow")}</>}
                </button>
              )}
            </div>


          </div>

          {/* Channel links */}
          {(dev?.channelLinks?.length ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {dev!.channelLinks!.map((cl, i) => {
                const platformStyle: Record<string, { color: string; bg: string; border: string }> = {
                  youtube:  { color: "#f87171", bg: "rgba(248,113,113,0.08)",  border: "rgba(248,113,113,0.2)"  },
                  telegram: { color: "#38bdf8", bg: "rgba(56,189,248,0.08)",   border: "rgba(56,189,248,0.2)"   },
                  github:   { color: "#e2e8f0", bg: "rgba(226,232,240,0.06)",  border: "rgba(226,232,240,0.12)" },
                  xda:      { color: "#fbbf24", bg: "rgba(251,191,36,0.08)",   border: "rgba(251,191,36,0.2)"   },
                  website:  { color: "#34d399", bg: "rgba(52,211,153,0.08)",   border: "rgba(52,211,153,0.2)"   },
                };
                const ps = platformStyle[cl.platform] ?? { color: "#94a3b8", bg: "rgba(148,163,184,0.06)", border: "rgba(148,163,184,0.15)" };
                return (
                  <a key={i} href={cl.url} target="_blank" rel="noopener noreferrer"
                    className="group flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition-all hover:scale-105 active:scale-95"
                    style={{ color: ps.color, background: ps.bg, border: `1px solid ${ps.border}` }}>
                    {cl.platform === "youtube"  && <Youtube className="h-2.5 w-2.5" />}
                    {cl.platform === "telegram" && <Send className="h-2.5 w-2.5" />}
                    {cl.platform === "github"   && <Github className="h-2.5 w-2.5" />}
                    {cl.platform === "twitter"  && <Globe className="h-2.5 w-2.5" />}
                    {cl.platform === "website"  && <Globe className="h-2.5 w-2.5" />}
                    {cl.platform === "xda"      && <ExternalLink className="h-2.5 w-2.5" />}
                    {cl.platform === "custom"   && <Link2 className="h-2.5 w-2.5" />}
                    {cl.label}
                  </a>
                );
              })}
            </div>
          )}

          {/* Device info card */}
          {rom.deviceCodename && (
            <DeviceInfoInline codename={rom.deviceCodename} deviceName={rom.device ?? ""} brand={rom.brand ?? ""} />
          )}

          {/* Metadata pills */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {rom.size && <span className="flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-all hover:border-[var(--primary)]/30 hover:bg-muted hover:scale-105 cursor-default"><HardDrive className="h-3 w-3" /> {rom.size}</span>}
            {rom.createdAt && <span className="flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-all hover:border-[var(--primary)]/30 hover:bg-muted hover:scale-105 cursor-default"><Clock className="h-3 w-3" /> {fmtDate(rom.createdAt)}</span>}
            {rom.brand && <span className="flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-all hover:border-[var(--primary)]/30 hover:bg-muted hover:scale-105 cursor-default"><Smartphone className="h-3 w-3" /> {rom.brand}</span>}
            
            {rom.moduleManagers && rom.moduleManagers.length > 0 && !rom.moduleManagers.includes("any") && (
              <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400 transition-all hover:bg-emerald-500/20 cursor-default"><Puzzle className="h-3 w-3" /> {rom.moduleManagers.join(", ").toUpperCase()}</span>
            )}
            {rom.trebleType && (
              <span className="flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-400 transition-all hover:bg-rose-500/20 cursor-default"><Layers className="h-3 w-3" /> {rom.trebleType.toUpperCase()}</span>
            )}
            
            {rom.tags?.map((tag) => (
              <span key={tag} className="flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-all hover:border-[var(--primary)]/30 hover:bg-muted hover:scale-105 cursor-default"><Hash className="h-3 w-3" /> {tag}</span>
            ))}
          </div>

          {/* Release Links (XDA, Telegram, Source) */}
          {(rom.xdaUrl || rom.telegramUrl || rom.sourceUrl) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {rom.xdaUrl && (
                <a href={rom.xdaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-xl bg-[#fbbf24]/10 border border-[#fbbf24]/20 px-3 py-1.5 text-[11px] font-bold text-[#fbbf24] transition-all hover:bg-[#fbbf24]/20 hover:scale-105">
                  <ExternalLink className="h-3.5 w-3.5" /> XDA Thread
                </a>
              )}
              {rom.telegramUrl && (
                <a href={rom.telegramUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-xl bg-[#38bdf8]/10 border border-[#38bdf8]/20 px-3 py-1.5 text-[11px] font-bold text-[#38bdf8] transition-all hover:bg-[#38bdf8]/20 hover:scale-105">
                  <Send className="h-3.5 w-3.5" /> Telegram Group
                </a>
              )}
              {rom.sourceUrl && (
                <a href={rom.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-xl bg-slate-400/10 border border-slate-400/20 px-3 py-1.5 text-[11px] font-bold text-slate-300 transition-all hover:bg-slate-400/20 hover:scale-105">
                  <Github className="h-3.5 w-3.5" /> Source Code
                </a>
              )}
            </div>
          )}

          {/* Main Download — Holographic Power Station */}
          <div className="mt-4 flex flex-col gap-2 relative">
            {/* Accent glow behind the main download button */}
            <div className="absolute -inset-1 rounded-[28px] pointer-events-none opacity-60 blur-2xl"
              style={{ background: "radial-gradient(ellipse, color-mix(in srgb, var(--primary) 20%, transparent) 0%, transparent 70%)" }} />
            {/* Linkvertise-aware download — handles badge + confirmation modal */}
            <div ref={downloadBtnRef} className="relative">
              <LinkvertiseDownloadButton
                romId={id as string}
                romName={rom.name}
                devName={dev?.name || rom.maintainerName || t("rom.developerFallback") || "Developer"}
                downloadUrl={rom.downloadUrl || ""}
                linkvertiseEnabled={lvEnabled ?? !!rom.linkvertiseEnabled}
                publisherId={dev?.linkvertisePublisherId ? parseInt(dev.linkvertisePublisherId) : undefined}
                onConfirm={() => {
                  if (id) {
                    apiRecordDownload(id);
                    if (rom?.linkvertiseEnabled) apiTrackLinkvertiseClick(id);
                  }
                  setShowDownloadToast(true);
                  setTimeout(() => setShowDownloadToast(false), 2500);
                }}
              >
                {(handleDownloadClick, hasAd) => (
                  <VariantDownloadButton
                    name={rom.name}
                    downloadUrl={rom.downloadUrl}
                    variants={rom.variants}
                    accentColor="#1d9bf0"
                    size="lg"
                    fullWidth
                    adBadge={hasAd}
                    onDownload={(url, _variantName) => {
                      handleDownloadClick();
                    }}
                  />
                )}
              </LinkvertiseDownloadButton>
            </div>

            <div className="flex gap-2">
              {/* Like button with TikTok-style hearts */}
              <div className="relative flex-1">
                {/* Heart bursts layer */}
                <div className="absolute inset-0 pointer-events-none overflow-visible z-50 flex items-center justify-center">
                  <AnimatePresence>
                    {heartBursts.map(p => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 1, x: 0, y: 0, scale: 0 }}
                        animate={{ 
                          opacity: [0, 1, 1, 0], 
                          x: Math.cos(p.angle * (Math.PI / 180)) * p.distance,
                          y: Math.sin(p.angle * (Math.PI / 180)) * p.distance,
                          scale: [0, p.size, p.size * 0.8, 0],
                          rotate: Math.random() * 180 - 90
                        }}
                        transition={{ duration: 0.6 + Math.random() * 0.3, ease: [0.23, 1, 0.32, 1] }}
                        className="absolute flex items-center justify-center drop-shadow-md z-50 pointer-events-none"
                        style={{ color: p.color }}
                      >
                       {p.type === 'heart' ? (
                         <Heart className="h-4 w-4 fill-current stroke-current" />
                       ) : (
                         <div className="h-2 w-2 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
                       )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  {/* Central huge glowing effect on click */}
                  <AnimatePresence>
                    {likeAnim && (
                       <motion.div
                         key="center-glow"
                         initial={{ scale: 0.5, opacity: 0 }}
                         animate={{ scale: [0.5, 2.5, 4], opacity: [0, 0.8, 0] }}
                         exit={{ opacity: 0 }}
                         transition={{ duration: 0.6, ease: "easeOut" }}
                         className="absolute flex items-center justify-center pointer-events-none"
                       >
                         <div className="h-16 w-16 rounded-full bg-rose-500/20 blur-xl mix-blend-screen" />
                       </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleLike}
                  className={cn(
                    // Unified py-2.5 to match Copy/Mirror buttons in the same row — fixes the
                    // visible height mismatch where the Like button was noticeably taller than
                    // its neighbours.
                    "relative w-full flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-black transition-all duration-300 select-none overflow-hidden group hover:-translate-y-0.5",
                    liked
                      ? "border-rose-500/50 bg-rose-500/10 text-rose-500 shadow-[0_6px_18px_-4px_rgba(244,63,94,0.3)]"
                      : "border-border text-muted-foreground hover:border-rose-400/40 hover:bg-rose-500/5 hover:text-rose-400",
                  )}
                  style={{ touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}>
                  
                  {/* Subtle active pulse gradient */}
                  {liked && <div className="absolute inset-0 bg-rose-400/10 opacity-0 group-active:opacity-100 transition-opacity" />}
                  
                  <motion.div
                    animate={liked ? { 
                      scale: [1, 2.2, 0.8, 1.25, 1], 
                      rotate: [0, -15, 15, -5, 0] 
                    } : { scale: 1 }}
                    transition={{ duration: 0.6, type: "spring", stiffness: 400, damping: 12 }}
                  >
                    <Heart 
                      className={cn(
                        "h-5 w-5 transition-all duration-300", 
                        liked ? "fill-rose-500 stroke-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,1)] scale-110" : "drop-shadow-none group-hover:scale-110"
                      )} 
                    />
                  </motion.div>
                  <span className="relative z-10 drop-shadow-sm">{liked ? t("rom.liked") : t("rom.like")}</span>
                  {rom.likesCount > 0 && (
                    <span className={cn("ms-1 flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums transition-colors z-10", 
                      liked ? "bg-rose-500/20 text-rose-500 shadow-inner border border-rose-500/20" : "bg-muted text-muted-foreground/70"
                    )}>
                      {formatCount(rom.likesCount)}
                    </span>
                  )}
                </motion.button>
              </div>
              {/* Copy Download Link */}
              {rom.downloadUrl && (
                <button onClick={handleCopyDownloadLink}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-xs font-black text-muted-foreground hover:text-foreground hover:border-[var(--primary)]/30 hover:bg-muted transition-all hover:scale-[1.02] active:scale-90"
                  title={t("share.copyLink")}>
                  <Copy className="h-3.5 w-3.5" />
                </button>
              )}
              {(rom.mirrors?.length ?? 0) > 0 ? rom.mirrors!.map((m, idx) => {
                if (!m) return null;
                // Disambiguate identical "Mirror" labels when there is more than one.
                const label = (rom.mirrors!.length > 1)
                  ? `${t("rom.mirror")} ${idx + 1}`
                  : t("rom.mirror");
                return (
                  <a key={idx} href={m} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-black text-muted-foreground hover:text-foreground hover:border-[var(--primary)]/30 hover:bg-muted transition-all hover:scale-[1.02] active:scale-90">
                    <ExternalLink className="h-3.5 w-3.5" /> {label}
                  </a>
                );
              }) : rom.mirrorUrl ? (
                <a href={rom.mirrorUrl} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-black text-muted-foreground hover:text-foreground hover:border-[var(--primary)]/30 hover:bg-muted transition-all hover:scale-[1.02] active:scale-90">
                  <ExternalLink className="h-3.5 w-3.5" /> {t("rom.mirror")}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs — Holographic segmented control */}
      <div className="relative mt-3 flex items-center gap-1 rounded-2xl border border-border bg-card p-1 overflow-hidden">
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
          style={{ background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--primary) 40%, transparent), transparent)" }} />
        {(["description", "changelog", "screenshots"] as const).map((tabKey) => {
          const active = tab === tabKey;
          return (
            <button key={tabKey} onClick={() => setTab(tabKey)}
              className={cn(
                "relative flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-all",
                active ? "text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
              style={active ? { background: "linear-gradient(135deg, var(--primary) 0%, #3b82f6 100%)", boxShadow: "0 4px 14px color-mix(in srgb, var(--primary) 28%, transparent)" } : undefined}>
              {active && (
                <span className="pointer-events-none absolute inset-x-3 top-0 h-px"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)" }} />
              )}
              {tabLabels[tabKey]}
            </button>
          );
        })}
      </div>

      {/* Tab content */}

      <div 
        className="mt-2 rounded-2xl border border-border bg-card p-4 sm:p-5"
        onTouchStart={handleTabTouchStart}
        onTouchEnd={handleTabTouchEnd}
      >
        {tab === "description" && (
          <div className="space-y-5">
            {/* Description with show more */}
            <div className="relative">
              <div className={cn(
                "prose prose-invert max-w-none text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap transition-all duration-500",
                !descExpanded && rom.description && rom.description.length > DESC_LIMIT && "line-clamp-[8]"
              )}>
                {rom.description || <span className="italic text-muted-foreground/50">{t("home.noResults")}</span>}
              </div>

              {/* Gradient fade + button */}
              {rom.description && rom.description.length > DESC_LIMIT && (
                <div className={cn(
                  "relative mt-0",
                  !descExpanded && "before:absolute before:inset-x-0 before:-top-10 before:h-10 before:pointer-events-none",
                )}>
                  {!descExpanded && (
                    <div className="absolute inset-x-0 -top-10 h-10 pointer-events-none"
                      style={{ background: "linear-gradient(to top, rgb(var(--card)), transparent)" }} />
                  )}
                  <button
                    onClick={() => setDescExpanded(p => !p)}
                    className="group relative mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl border px-4 py-2.5 text-xs font-black transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
                      background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 8%, transparent), color-mix(in srgb, var(--primary) 4%, transparent))",
                      color: "var(--primary)",
                    }}>
                    {/* Shimmer on hover */}
                    <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"
                      style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)" }} />
                    {descExpanded ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5" />
                        {t("common.less")}
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-y-0.5" />
                        {t("common.showMore")}
                        <span className="rounded-full px-1.5 py-0.5 text-[9px] font-black"
                          style={{ background: "color-mix(in srgb, var(--primary) 15%, transparent)" }}>
                          +
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Install guide - fixed formatting */}
            {rom.installGuide && (
              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "rgba(var(--primary-rgb,29,155,240),0.25)", background: "rgba(var(--primary-rgb,29,155,240),0.04)" }}>
                <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "rgba(var(--primary-rgb,29,155,240),0.15)", background: "rgba(var(--primary-rgb,29,155,240),0.06)" }}>
                  <Zap className="h-4 w-4 shrink-0" style={{ color: "var(--primary)" }} />
                  <h3 className="text-sm font-black text-foreground">{t("rom.installGuide")}</h3>
                </div>
                <div className="px-4 py-3">
                  <div className={cn(
                    "text-sm text-muted-foreground leading-relaxed",
                    !guideExpanded && rom.installGuide.length > GUIDE_LIMIT && "line-clamp-[6]"
                  )}
                  style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "break-word" }}>
                    {rom.installGuide}
                  </div>
                  {rom.installGuide.length > GUIDE_LIMIT && (
                    <div className="relative mt-0">
                      {!guideExpanded && (
                        <div className="absolute inset-x-0 -top-10 h-10 pointer-events-none"
                          style={{ background: "linear-gradient(to top, color-mix(in srgb, var(--primary) 4%, rgb(var(--card))), transparent)" }} />
                      )}
                      <button onClick={() => setGuideExpanded(p => !p)}
                        className="group relative mt-2.5 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl border px-4 py-2.5 text-xs font-black transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                        style={{
                          borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
                          background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 8%, transparent), color-mix(in srgb, var(--primary) 4%, transparent))",
                          color: "var(--primary)",
                        }}>
                        <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"
                          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)" }} />
                        {guideExpanded ? (
                          <>
                            <ChevronUp className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5" />
                            {t("common.less")}
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-y-0.5" />
                            {t("common.showMore")}
                            <span className="rounded-full px-1.5 py-0.5 text-[9px] font-black"
                              style={{ background: "color-mix(in srgb, var(--primary) 15%, transparent)" }}>
                              +
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            {(rom.checksumMd5 || rom.checksumSha256) && (
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-foreground"><Shield className="h-4 w-4 text-emerald-400" />{t("rom.checksum")}</h3>
                {rom.checksumMd5 && (
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                    <div className="flex-1 min-w-0"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">MD5</p><p className="text-xs font-mono break-all text-foreground/70">{rom.checksumMd5}</p></div>
                    <button onClick={() => handleCopyChecksum(rom.checksumMd5!, "md5")} className="shrink-0 rounded-xl p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted hover:scale-110 active:scale-90 transition-all">
                      {copiedChecksum === "md5" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                )}
                {rom.checksumSha256 && (
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                    <button onClick={() => handleCopyChecksum(rom.checksumSha256!, "sha256")} className="shrink-0 rounded-xl p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted hover:scale-110 active:scale-90 transition-all">
                      {copiedChecksum === "sha256" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* System Requirements */}
            {(rom.minRam || rom.minStorage) && (
              <div className="space-y-2 mt-4 pt-4 border-t border-border/40">
                <h3 className="flex items-center gap-2 text-sm font-bold text-foreground"><Cpu className="h-4 w-4 text-sky-400" />{t("rom.sysReq") || "System Requirements"}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {rom.minRam && (
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400"><Cpu className="h-3.5 w-3.5" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black uppercase text-muted-foreground/60 mb-0.5">{t("rom.ram") || "RAM"}</p>
                        <p className="text-xs font-bold text-foreground/80 break-all">{rom.minRam}</p>
                      </div>
                    </div>
                  )}
                  {rom.minStorage && (
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400"><HardDrive className="h-3.5 w-3.5" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black uppercase text-muted-foreground/60 mb-0.5">{t("rom.storage") || "Storage"}</p>
                        <p className="text-xs font-bold text-foreground/80 break-all">{rom.minStorage}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {/* Known Issues — shown in description tab */}
        {tab === "description" && rom.knownIssues && (
          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-500/15">
              <span className="text-sm">⚠️</span>
              <p className="text-xs font-black text-amber-400/90">{t("rom.knownIssuesTitle") || "Known Issues"}</p>
            </div>
            <div className="px-4 py-3 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {rom.knownIssues}
            </div>
          </div>
        )}

                {tab === "changelog" && (
          <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {rom.changelog || <span className="italic text-muted-foreground/50">{t("home.noResults")}</span>}
          </div>
        )}
        {tab === "screenshots" && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(rom.screenshots?.length ?? 0) > 0 ? (
              rom.screenshots.map((ss, i) => (
                <button key={i} onClick={() => { setLightboxImg(ss); setLightboxIdx(i); }}
                  className="group relative aspect-[9/16] overflow-hidden rounded-2xl border border-border bg-muted transition-all hover:border-[var(--primary)]/50 hover:shadow-xl hover:-translate-y-0.5">
                  <Image src={ss} alt={`Screenshot ${i + 1}`} fill className="object-cover transition-transform duration-500 group-hover:scale-[1.06]" crossOrigin="anonymous" />
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex flex-col items-center justify-center gap-1">
                    <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 duration-200" />
                    <span className="text-[10px] font-bold text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">{i + 1} / {rom.screenshots.length}</span>
                  </div>
                  {/* Bottom fade */}
                  <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))
            ) : (
              <p className="col-span-full text-center text-sm text-muted-foreground py-8">{t("home.noResults")}</p>
            )}
          </div>
        )}
      </div>

      {/* Compatible Devices */}
      {(rom.compatibleDevices?.length ?? 0) > 0 && (
        <div className="mt-2 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
            <Smartphone className="h-4 w-4" style={{ color: "var(--primary)" }} />
            {t("rom.compatibility")}
            <span className="ms-auto text-xs font-normal text-muted-foreground">{rom.compatibleDevices!.length}</span>
          </h3>
          <input type="text" value={deviceSearch} onChange={(e) => setDeviceSearch(e.target.value)} placeholder={t("platform.searchBar")}
            className="mb-3 h-9 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--primary)] transition-colors" />
          <div className="flex flex-wrap gap-1.5">
            {rom.compatibleDevices!.filter((d) => !deviceSearch || d.toLowerCase().includes(deviceSearch.toLowerCase())).map((device) => (
              <span key={device} className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors",
                deviceSearch && device.toLowerCase().includes(deviceSearch.toLowerCase())
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-400"
                  : "border-border text-muted-foreground hover:border-[var(--primary)]/30 hover:text-foreground"
              )}>{device}</span>
            ))}
            {deviceSearch && !rom.compatibleDevices!.some((d) => d.toLowerCase().includes(deviceSearch.toLowerCase())) && (
              <p className="text-sm text-destructive">{t("search.noResults")} &quot;{deviceSearch}&quot;</p>
            )}
          </div>
        </div>
      )}

      {/* Version History */}
      {versions.length > 0 && (
        <div className="mt-2 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Clock className="h-4 w-4" style={{ color: "var(--primary)" }} />
              {t("rom.versions")}
              <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {versions.length}
              </span>
            </h3>
          </div>

          {/* Visual Timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute start-[15px] top-4 bottom-4 w-px bg-border" />

            <div className="space-y-1">
              {versions.map((v, i) => {
                const isLatest = i === 0;
                return (
                  <div key={v.id} className={cn(
                    "relative flex gap-3 rounded-xl p-2.5 transition-all",
                    isLatest ? "bg-primary/5 border border-primary/15" : "hover:bg-muted/20"
                  )}>
                    {/* Timeline dot */}
                    <div className="relative z-10 flex-shrink-0 mt-0.5">
                      <div className={cn(
                        "h-[30px] w-[30px] rounded-full flex items-center justify-center text-[10px] font-black border-2",
                        isLatest
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-card text-muted-foreground"
                      )}>
                        {versions.length - i}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={cn("text-sm font-black", isLatest ? "text-primary" : "text-foreground")}>
                          {v.version ? `v${v.version}` : `${t("rom.version")} ${versions.length - i}`}
                        </span>
                        {isLatest && (
                          <span className="rounded-full bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                            ● {t("sort.newest")}
                          </span>
                        )}
                        {v.size && (
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                            {v.size}
                          </span>
                        )}
                        {v.createdAt && (
                          <span className="text-[9px] text-muted-foreground/50 ms-auto">{fmtDate(v.createdAt)}</span>
                        )}
                      </div>
                      {v.changelog && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{v.changelog}</p>
                      )}
                    </div>

                    {/* Download */}
                    {v.downloadUrl && (
                      <a href={v.downloadUrl} target="_blank" rel="noopener noreferrer"
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-xl border transition-all shrink-0 self-center",
                          isLatest
                            ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                            : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted"
                        )}>
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="mt-2"><CommentsSection romId={id} /></div>

      {/* Floating Download Button */}
      <div className={cn(
        "fixed bottom-20 inset-x-4 z-40 transition-all duration-300 lg:inset-x-auto lg:end-6 lg:w-64",
        floatingVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
      )}>
        <LinkvertiseDownloadButton
          romId={id as string}
          romName={rom.name}
          devName={dev?.name || rom.maintainerName || t("rom.developerFallback") || "Developer"}
          downloadUrl={rom.downloadUrl || ""}
          linkvertiseEnabled={lvEnabled ?? !!rom.linkvertiseEnabled}
          publisherId={dev?.linkvertisePublisherId ? parseInt(dev.linkvertisePublisherId) : undefined}
          onConfirm={() => {
            if (id) {
              apiRecordDownload(id);
              if (rom?.linkvertiseEnabled) apiTrackLinkvertiseClick(id);
            }
            setShowDownloadToast(true);
            setTimeout(() => setShowDownloadToast(false), 2500);
          }}
        >
          {(handleDownloadClick, hasAd) => (
            <VariantDownloadButton
              name={rom.name}
              downloadUrl={rom.downloadUrl}
              variants={rom.variants}
              accentColor="#1d9bf0"
              size="lg"
              fullWidth
              adBadge={hasAd}
              onDownload={() => {
                handleDownloadClick();
              }}
            />
          )}
        </LinkvertiseDownloadButton>
      </div>

      {/* Lightbox — full swipe navigation */}

      {lightboxImg && rom && (rom.screenshots?.length ?? 0) > 0 && (
        <LightboxGallery
          screenshots={rom.screenshots!}
          initialIdx={lightboxIdx}
          onClose={() => setLightboxImg(null)}
        />
      )}

      <ReportDialog open={showReport} onClose={() => setShowReport(false)} targetType="rom" targetId={id} />
      <ShareMenu open={showShare} onClose={() => setShowShare(false)} url={`/rom/${id}`} title={rom.name} />
      <DownloadToast visible={showDownloadToast} name={rom.name} />
    </div>
  );
}
