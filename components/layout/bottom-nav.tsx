"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Globe2, Trophy, User, Plus, X, ChevronRight,
  GitCompare, Layers, Heart, Smartphone,
  Bell, Star, Compass, Shield, Terminal, Sparkles, Command,
  Upload, DollarSign, Settings, Search, SlidersHorizontal, Briefcase,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { SpringTile } from "@/components/ui/spring-button";

// ── Primary nav items — 5 slots with center FAB ─────────────────────────────
// Left 2 | FAB (Create) | Right 2
type PrimaryItem = {
  href: string;
  labelKey: string;
  icon: React.ElementType;
  id: string;
  requiresAuth?: boolean;
};

const LEFT_ITEMS: PrimaryItem[] = [
  { href: "/",          labelKey: "nav.home",      icon: Home,    id: "home"     },
  { href: "/community", labelKey: "nav.community", icon: Globe2,  id: "community"},
];

const RIGHT_ITEMS: PrimaryItem[] = [
  { href: "/leaderboard", labelKey: "nav.board",  icon: Trophy, id: "board"    },
  { href: "/more",        labelKey: "common.more",icon: Sparkles, id: "more"    }, // synthetic — opens sheet
];

// ── More-sheet items — 3 sections to mirror the desktop sidebar exactly ────
// Rule: same mental model on both platforms; no action appears more than twice
// across the entire UI. Tools/Help/Social are collapsed into Discover + Account.
type MoreSection = {
  labelKey: string;
  fallback: string;
  items: Array<{ href: string; labelKey: string; fallback?: string; icon: React.ElementType; requiresAuth?: boolean; badge?: "NEW" | "BETA" | "PRO" }>;
};

const MORE_SECTIONS: MoreSection[] = [
  {
    labelKey: "nav.discover",
    fallback: "Discover",
    items: [
      { href: "/explore",     labelKey: "nav.explore",     fallback: "Explore",    icon: Compass },
      { href: "/marketplace", labelKey: "nav.marketplace", fallback: "Marketplace", icon: Briefcase, badge: "NEW" },
      { href: "/devices",     labelKey: "devices.title",   fallback: "Devices",    icon: Smartphone },
      { href: "/creators",    labelKey: "nav.creators",    fallback: "Creators",   icon: Star, badge: "NEW" },
      { href: "/compare",     labelKey: "nav.compare",     icon: GitCompare },
      { href: "/community",   labelKey: "nav.community",   icon: Globe2 },
    ],
  },
  {
    labelKey: "nav.create",
    fallback: "Create",
    items: [
      { href: "/upload",      labelKey: "nav.upload",      icon: Upload, requiresAuth: true },
      { href: "/collections", labelKey: "nav.collections", icon: Layers, requiresAuth: true },
      { href: "/earnings",    labelKey: "nav.studio",      fallback: "RomX Studio", icon: DollarSign, badge: "PRO", requiresAuth: true },
    ],
  },
  {
    labelKey: "nav.account",
    fallback: "Account",
    items: [
      { href: "/favorites",     labelKey: "nav.favorites",     icon: Heart,    requiresAuth: true },
      { href: "/notifications", labelKey: "nav.notifications", icon: Bell,     requiresAuth: true },
      { href: "/feed",          labelKey: "nav.activity",      icon: Sparkles, requiresAuth: true },
      { href: "/settings",      labelKey: "nav.settings",      icon: Settings },
    ],
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const { user, isLoggedIn, loading: authLoading, isAdmin, canUpload } = useAuth();
  const { t, dir } = useTranslation();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // Drawer starts at half-screen; user can drag it up to near-full.
  const [isDrawerExpanded, setIsDrawerExpanded] = useState(false);
  const dragControls = useDragControls();

  // Hide when lightbox is open (keeps bar out of the way of fullscreen media)
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setLightboxOpen(document.body.classList.contains("lightbox-open"));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // NOTE: scroll auto-hide intentionally removed — the bar now stays visible at all times
  // (except when a media lightbox is open). The previous "slide down on scroll" behaviour
  // caused visual conflicts with modals, drawers, and the FAB.

  useEffect(() => { setMoreOpen(false); }, [pathname]);
  // Always open the drawer at half-height initially.
  useEffect(() => { if (moreOpen) setIsDrawerExpanded(false); }, [moreOpen]);

  useEffect(() => {
    if (!moreOpen) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setMoreOpen(false); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [moreOpen]);

  useEffect(() => {
    if (moreOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [moreOpen]);

  if (pathname === "/login") return null;

  const profileHref = authLoading ? "#" : isLoggedIn && user?.uid ? `/u/${user.uid}` : "/login";
  const isProfileActive = pathname.startsWith("/u/");

  const openPalette = () => {
    window.dispatchEvent(new CustomEvent("romx:open-command-palette"));
  };

  // Check if any "More" item is active
  const isMoreActive = MORE_SECTIONS.some(s =>
    s.items.some(i => pathname.startsWith(i.href))
  ) || isProfileActive;

  const leftAndRight: Array<PrimaryItem & { onClick?: () => void; isActive?: boolean; isBadge?: number }> = [
    ...LEFT_ITEMS.map(i => ({ ...i, isActive: i.href === "/" ? pathname === "/" : pathname.startsWith(i.href) })),
  ];

  return (
    <>
      {/* ═══ More Menu — draggable half-screen drawer with spring physics ═══
            Architecture: backdrop + sheet are direct children of AnimatePresence.
            IMPORTANT: we cannot wrap them in a fragment (`<>…</>`) because
            AnimatePresence can only track keyed motion components as direct
            children — fragments are invisible to its child-reconciliation and
            the drawer would fail to mount (which is what caused the "More
            button does nothing" bug). Each sibling is guarded by its own
            conditional and has a unique `key` so enter/exit transitions are
            independently tracked. */}
      <AnimatePresence>
        {moreOpen && (
          /* Backdrop — full-viewport click-catcher */
          <motion.div
            key="more-backdrop"
            className="fixed inset-0 z-[59] bg-black/70 backdrop-blur-md lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setMoreOpen(false)}
          />
        )}
        {moreOpen && (
            /* Draggable Sheet — classic bottom sheet anchored to viewport bottom.
               The main bottom nav is hidden while this drawer is open (see nav
               className below) so the sheet can occupy the full bottom area
               without being clipped by the 64px nav bar. We deliberately avoid
               backdrop-filter on the drawer itself and use a fully opaque
               background: combining `.holo-surface`'s transparent gradient
               with backdrop blur was rendering the sheet as a blurry ghost on
               some mobile browsers (the content looked invisible). */
            <motion.div
              key="more-drawer"
              dir={dir}
              role="dialog"
              aria-modal="true"
              aria-label={t("common.more") || "More options"}
              className="fixed inset-x-0 bottom-0 z-[60] lg:hidden rounded-t-[28px] border-t border-border/60 flex flex-col overflow-hidden shadow-[0_-24px_60px_-12px_rgba(0,0,0,0.6)] transition-[height] duration-300 ease-out"
              style={{
                background: "rgb(var(--card))",
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
                touchAction: "none",
                height: isDrawerExpanded ? "90vh" : "72vh",
                maxHeight: "90vh",
              }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.9 }}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.12, bottom: 0.5 }}
              onDragEnd={(_, info) => {
                const { offset, velocity } = info;
                // Fast flick down or dragged past threshold → close
                if (offset.y > 140 || velocity.y > 600) {
                  setMoreOpen(false);
                  return;
                }
                // Flick up or dragged up → expand to full
                if (offset.y < -60 || velocity.y < -400) {
                  setIsDrawerExpanded(true);
                  return;
                }
                // Dragged down while expanded → collapse to half
                if (isDrawerExpanded && offset.y > 60) {
                  setIsDrawerExpanded(false);
                }
              }}
            >
              {/* Drag handle pill — small grabber at the very top (standard bottom-sheet affordance).
                  The instructional "drag up for more" text has been moved BELOW the header so it
                  no longer visually floats above the sheet title. */}
              <div
                className="flex-shrink-0 flex items-center justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing select-none"
                onPointerDown={(e) => dragControls.start(e)}
                style={{ touchAction: "none" }}
                aria-hidden
              >
                <motion.div
                  className="h-1.5 rounded-full bg-muted-foreground/35"
                  animate={{ width: isDrawerExpanded ? 36 : 56 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22 }}
                />
              </div>

              {/* Header */}
              <div className="flex-shrink-0 flex items-center justify-between gap-3 px-5 pt-2 pb-1">
                <div className="min-w-0">
                  <h3 className="text-base font-black text-foreground">{t("common.more") || "More"}</h3>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {t("nav.discoverAll") || "Discover everything RomX has to offer"}
                  </p>
                </div>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-90"
                  aria-label={t("common.close") || "Close"}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Scrollable content — drag doesn't fight native scroll.
                  NOTE: the "drag up for more" hint has been moved to the BOTTOM of this scroll area
                  (see just before the closing comment end scrollable content) so it no
                  longer floats between the header and the first card. */}
            <div
              className="flex-1 overflow-y-auto overscroll-contain"
              style={{ touchAction: "pan-y" }}
            >

            {/* Profile card */}
            <motion.div
              className="px-4 pb-3"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 360, damping: 22, delay: 0.05 }}
            >
              <Link
                href={profileHref}
                prefetch={true}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-3 transition-all active:scale-[0.97]",
                  isProfileActive
                    ? "border-[var(--primary)]/40 bg-[var(--primary-dim)]"
                    : "border-border/60 bg-muted/30 hover:bg-muted/50"
                )}
              >
                {isLoggedIn && user?.photoURL ? (
                  <div className="relative">
                    <img src={user.photoURL} alt="" className="h-11 w-11 rounded-2xl object-cover border border-border/50" referrerPolicy="no-referrer" />
                    <span className="absolute bottom-0 end-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-background" />
                  </div>
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted border border-border">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-foreground truncate">
                    {isLoggedIn && user?.displayName ? user.displayName : t("nav.profile") || "Profile"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {isLoggedIn ? t("profile.myProfile") || "View profile" : t("auth.signInPrompt") || "Sign in to unlock everything"}
                  </p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted/50">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            </motion.div>

            {/* ── Two clearly-differentiated search entry points ──
                   1. "Search ROMs" (magnifier)      → /search          : content search (devices, ROMs, users)
                   2. "Quick navigate" (command key) → command palette : feature / page search (like Google Settings search)
                These live side-by-side so users can tell them apart at a glance. */}
            <motion.div
              className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 360, damping: 22, delay: 0.1 }}
            >
              {/* Content search — full catalogue of ROMs / devices / users */}
              <Link
                href="/search"
                prefetch={true}
                onClick={() => setMoreOpen(false)}
                className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/25 p-3 transition-all hover:border-[var(--primary)]/50 hover:bg-muted/45 active:scale-[0.98]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--primary)]/30 shrink-0"
                  style={{ background: "var(--primary-dim)" }}>
                  <SlidersHorizontal className="h-4 w-4" style={{ color: "var(--primary)" }} />
                </div>
                <div className="flex-1 text-start min-w-0">
                  <p className="text-[13px] font-bold text-foreground truncate">
                    {t("search.advancedTitle") !== "search.advancedTitle"
                      ? t("search.advancedTitle")
                      : (dir === "rtl" ? "بحث متقدم" : "Search ROMs")}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {t("search.advancedDesc") !== "search.advancedDesc"
                      ? t("search.advancedDesc")
                      : (dir === "rtl" ? "أجهزة، رومات، مطورين" : "Devices, ROMs & developers")}
                  </p>
                </div>
              </Link>

              {/* Feature search — the command palette */}
              <motion.button
                onClick={() => { setMoreOpen(false); setTimeout(openPalette, 200); }}
                whileTap={{ scaleX: 0.98, scaleY: 1.02 }}
                transition={{ type: "spring", stiffness: 420, damping: 18 }}
                className="group flex items-center gap-3 rounded-2xl border border-dashed border-border/80 bg-muted/15 p-3 hover:border-[var(--primary)]/60 hover:bg-muted/35 transition-colors text-start"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--primary)]/30 shrink-0"
                  style={{ background: "var(--primary-dim)" }}>
                  <Command className="h-4 w-4" style={{ color: "var(--primary)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-foreground truncate">
                    {t("cmd.quickOpen") || "Quick navigate"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {t("cmd.paletteDesc") || "Search every feature, instantly"}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-0.5 shrink-0">
                  <span className="kbd-key">⌘</span>
                  <span className="kbd-key">K</span>
                </div>
              </motion.button>
            </motion.div>

            {/* Category sections */}
            <div className="px-4 space-y-4">
              {MORE_SECTIONS.map(section => {
                const visibleItems = section.items.filter(i => !i.requiresAuth || isLoggedIn);
                if (visibleItems.length === 0) return null;
                const label = t(section.labelKey) !== section.labelKey ? t(section.labelKey) : section.fallback;

                return (
                  <div key={section.labelKey}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground/80">
                        {label}
                      </span>
                      <div className="flex-1 h-px bg-border/60" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {visibleItems.map((item, idx) => {
                        const isActive = pathname.startsWith(item.href);
                        const Icon = item.icon;
                        const itemLabel = item.fallback && t(item.labelKey) === item.labelKey ? item.fallback : t(item.labelKey);
                        return (
                          <SpringTile key={item.href} index={idx}>
                          <Link
                            href={item.href}
                            prefetch={true}
                            onClick={() => setMoreOpen(false)}
                            className={cn(
                              "group relative flex flex-col items-center gap-1.5 rounded-2xl border p-3 transition-colors",
                              isActive
                                ? "border-[var(--primary)]/40 bg-[var(--primary-dim)]"
                                : "border-border/40 bg-muted/15 hover:bg-muted/35"
                            )}
                          >
                            {item.badge && (
                              <span
                                className="absolute top-1.5 end-1.5 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
                                style={{
                                  color: item.badge === "PRO" ? "#f59e0b" : "var(--primary)",
                                  background: item.badge === "PRO" ? "rgba(245,158,11,0.12)" : "var(--primary-dim)",
                                  border: `1px solid ${item.badge === "PRO" ? "rgba(245,158,11,0.30)" : "color-mix(in srgb, var(--primary) 30%, transparent)"}`,
                                }}
                              >
                                {item.badge}
                              </span>
                            )}
                            <div
                              className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-xl transition-colors border",
                                isActive ? "border-[var(--primary)]/40" : "border-border/40 bg-muted/30",
                              )}
                              style={isActive ? { background: "var(--primary-dim)" } : undefined}
                            >
                              <Icon
                                className="h-5 w-5"
                                style={isActive ? { color: "var(--primary)" } : { color: "rgb(var(--muted-foreground))" }}
                              />
                            </div>
                            <span
                              className={cn(
                                "text-xs font-semibold text-center leading-tight line-clamp-2",
                                isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                              )}
                            >
                              {itemLabel}
                            </span>
                          </Link>
                          </SpringTile>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Admin section */}
              {isAdmin && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground/80">
                      Admin
                    </span>
                    <div className="flex-1 h-px bg-border/60" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { href: "/admin", labelKey: "nav.admin", icon: Shield },
                      { href: "/admin/logs", labelKey: "nav.logs", icon: Terminal },
                    ].map(item => {
                      const isActive = pathname === item.href;
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          prefetch={true}
                          className={cn(
                            "group flex flex-col items-center gap-1.5 rounded-2xl border p-3 transition-colors active:scale-[0.96]",
                            isActive ? "border-destructive/50 bg-destructive/10" : "border-border/40 bg-muted/15 hover:bg-muted/35"
                          )}
                        >
                          <div className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl border",
                            isActive ? "border-destructive/50 bg-destructive/15" : "border-border/40 bg-muted/30",
                          )}>
                            <Icon className="h-5 w-5" style={{ color: isActive ? "var(--destructive)" : "rgb(var(--muted-foreground))" }} />
                          </div>
                          <span className={cn("text-xs font-semibold text-center leading-tight", isActive ? "text-foreground" : "text-muted-foreground")}>
                            {t(item.labelKey)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Zero Tracking badge — يظهر في الموبايل ويوجّه للصفحة */}
            <div className="px-4 pb-2 pt-1">
              <Link
                href="/my-data"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3 hover:bg-emerald-500/15 transition-all active:scale-[0.97] group"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20">
                  <Shield className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-emerald-400 group-hover:text-emerald-300 transition-colors">
                    Zero Tracking ✓
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    اضغط لعرض كل ما نعرفه عنك
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-emerald-400/60 shrink-0" />
              </Link>
            </div>

            {/* Secondary links — Feedback, Rules, About + legal (consolidated, single row) */}
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-4 pt-4 mt-4 pb-1 text-xs text-muted-foreground/70 border-t border-border/30">
              {[
                { href: "/feedback", label: t("nav.feedback") || "Feedback" },
                { href: "/rules",    label: t("nav.rules")    || "Rules" },
                { href: "/about",    label: t("nav.about")    || "About" },
                { href: "/privacy",  label: "Privacy" },
                { href: "/terms",    label: "Terms" },
                { href: "/contact",  label: "Contact" },
              ].map(l => (
                <Link key={l.href} href={l.href} onClick={() => setMoreOpen(false)} className="hover:text-foreground transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>

            {/* ── Drag hint (bottom of sheet) ──
                Sits at the very bottom of the scrollable content, so it never floats
                between the header and the cards. Fades out once the sheet is fully
                expanded because there is nothing more to reveal. */}
            <motion.div
              className="flex items-center justify-center gap-1.5 px-5 pt-3 pb-2 select-none"
              animate={{ opacity: isDrawerExpanded ? 0 : 0.9 }}
              transition={{ duration: 0.2 }}
              aria-hidden
            >
              <span className="h-px w-5 bg-border/50" />
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground/70">
                {(() => {
                  const isAr = dir === "rtl";
                  const key = "drawer.dragUp";
                  const translated = t(key);
                  if (translated && translated !== key) return translated;
                  return isAr ? "اسحب للأعلى للمزيد" : "Drag up for more";
                })()}
              </span>
              <span className="h-px w-5 bg-border/50" />
            </motion.div>

            </div>
            {/* end scrollable content */}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Main Bottom Nav with center FAB — always visible on mobile (no more scroll auto-hide) ═══
           The nav slides out of view when the More drawer is open so the drawer
           can span the full bottom area without being clipped. It also slides
           away for fullscreen lightboxes so media viewing stays unobstructed. */}
      <nav
        className={cn(
          "nav-legendary fixed inset-x-0 bottom-0 z-50 lg:hidden transition-transform duration-300 ease-out",
          (lightboxOpen || moreOpen) ? "translate-y-full" : "translate-y-0"
        )}
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 0px)" }}
        dir={dir}
      >
        <div className="relative">
          {/* Top glow line */}
          <div className="absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent 5%, var(--primary-glow) 50%, transparent 95%)" }} />

          <div className="flex h-[64px] items-center justify-around px-1 pb-1">
            {/* Left items */}
            {LEFT_ITEMS.map(item => {
              const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  prefetch={true}
                  className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-transform duration-150 active:scale-[0.92]"
                >
                  <span className={cn(
                    "absolute top-0 h-[3px] rounded-full transition-all duration-300",
                    isActive ? "w-10 opacity-100" : "w-0 opacity-0"
                  )}
                  style={isActive ? { backgroundColor: "var(--primary)", boxShadow: "0 2px 12px var(--primary-glow)" } : undefined}
                  />
                  <div className={cn(
                    "relative flex h-8 w-12 items-center justify-center rounded-2xl transition-colors duration-200",
                    isActive ? "bg-[var(--primary-dim)]" : "bg-transparent"
                  )}>
                    <Icon className={cn("h-5 w-5 transition-colors duration-200", isActive ? "nav-active-glow" : "text-muted-foreground")}
                      style={isActive ? { color: "var(--primary)" } : undefined} />
                  </div>
                  <span className={cn("text-[9px] leading-none font-bold transition-opacity duration-200", isActive ? "opacity-100" : "opacity-60")}
                    style={isActive ? { color: "var(--primary)" } : undefined}>
                    {t(item.labelKey)}
                  </span>
                </Link>
              );
            })}

            {/* ── Center FAB — Create / Upload / Sign in ── */}
            <div className="relative flex-1 flex items-center justify-center">
              <Link
                href={canUpload ? "/upload" : isLoggedIn ? "/upload" : "/login"}
                className="fab-primary group"
                aria-label={t("nav.upload") || "Upload"}
              >
                <Plus className="h-6 w-6 transition-transform duration-300 group-hover:rotate-90" />
              </Link>
            </div>

            {/* Right items */}
            {RIGHT_ITEMS.map(item => {
              const isMore = item.id === "more";
              const isActive = isMore ? (moreOpen || isMoreActive) : pathname.startsWith(item.href);
              const Icon = item.icon;

              const inner = (
                <>
                  <span className={cn(
                    "absolute top-0 h-[3px] rounded-full transition-all duration-300",
                    isActive ? "w-10 opacity-100" : "w-0 opacity-0"
                  )}
                  style={isActive ? { backgroundColor: "var(--primary)", boxShadow: "0 2px 12px var(--primary-glow)" } : undefined}
                  />
                  <div className={cn(
                    "relative flex h-8 w-12 items-center justify-center rounded-2xl transition-colors duration-200",
                    isActive ? "bg-[var(--primary-dim)]" : "bg-transparent"
                  )}>
                    <Icon className={cn("h-5 w-5 transition-colors duration-200", isActive ? "nav-active-glow" : "text-muted-foreground")}
                      style={isActive ? { color: "var(--primary)" } : undefined} />
                  </div>
                  <span className={cn("text-[9px] leading-none font-bold transition-opacity duration-200", isActive ? "opacity-100" : "opacity-60")}
                    style={isActive ? { color: "var(--primary)" } : undefined}>
                    {t(item.labelKey)}
                  </span>
                </>
              );

              if (isMore) {
                return (
                  <button
                    key={item.id}
                    onClick={() => setMoreOpen(prev => !prev)}
                    className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-transform duration-150 active:scale-[0.92]"
                    aria-expanded={moreOpen}
                    aria-label={t(item.labelKey)}
                  >
                    {inner}
                  </button>
                );
              }

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  prefetch={true}
                  className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-transform duration-150 active:scale-[0.92]"
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
