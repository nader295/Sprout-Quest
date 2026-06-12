"use client";

/**
 * RomX Command Palette — Universal Feature Discovery Hub
 *
 * Solves the "buried features" problem by surfacing every feature in one
 * keyboard-first, searchable interface. Triggered globally with ⌘K / Ctrl+K,
 * or via the header search trigger.
 *
 * Design goals:
 *   • Make every feature discoverable in ≤2 keystrokes
 *   • Group by intent (Discover / Create / Social / Tools / Account)
 *   • Show descriptions so new users understand what each feature does
 *   • Recent items for power users
 *   • Fully keyboard navigable with arrow keys + Enter
 *   • RTL-aware, i18n-ready
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search, Command, X, ArrowRight, Clock, Home, Compass, Globe2,
  Activity, Trophy, GitCompare, Layers, Heart, Smartphone, Info,
  Upload, Shield, Terminal, Bell, Settings, User, BookOpen,
  MessageSquarePlus, Zap, Package, Cpu, HardDrive, Puzzle, Star,
  TrendingUp, Hash, Sparkles, FileText, Lock, DollarSign, Users,
  Briefcase, ArrowDownLeft, ArrowUpRight,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────
type CommandItem = {
  id: string;
  title: string;
  desc?: string;
  href: string;
  icon: React.ElementType;
  category: "discover" | "create" | "social" | "tools" | "account" | "admin" | "help";
  badge?: "NEW" | "BETA" | "PRO" | "FREE";
  tags?: string[];
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
  shortcut?: string;
};

// Category meta — colors + labels
const CATEGORY_META: Record<CommandItem["category"], { label: string; color: string; icon: React.ElementType }> = {
  discover: { label: "Discover",   color: "#1d9bf0", icon: Compass },
  create:   { label: "Create",     color: "#22c55e", icon: Sparkles },
  social:   { label: "Social",     color: "#f59e0b", icon: Users },
  tools:    { label: "Tools",      color: "#a78bfa", icon: Hash },
  account:  { label: "Account",    color: "#06b6d4", icon: User },
  admin:    { label: "Admin",      color: "#ef4444", icon: Shield },
  help:     { label: "Help",       color: "#64748b", icon: BookOpen },
};

// ── Master feature registry ────────────────────────────────────────────────
// Every feature in RomX lives here. New features? Add one line — done.
function buildItems(t: (k: string) => string): CommandItem[] {
  return [
    // ── Discover ──
    { id: "home",        title: t("nav.home"),        desc: "Latest ROMs, kernels and modules feed", href: "/",            icon: Home,       category: "discover", tags: ["home","feed","latest"] },
    { id: "explore",     title: "Explore Catalog",    desc: "Browse every release with smart filters", href: "/explore",     icon: Compass,    category: "discover", tags: ["explore","browse","catalog","all"] },
    { id: "search",      title: t("nav.search"),      desc: "Global search across ROMs, devices, users", href: "/search",      icon: Search,     category: "discover", shortcut: "/", tags: ["search","find","query"] },
    { id: "community",   title: t("nav.community"),   desc: "World map of developers and users",       href: "/community",   icon: Globe2,     category: "discover", tags: ["community","map","world","globe"] },
    { id: "feed",        title: t("nav.activity"),    desc: "Activity feed from people you follow",    href: "/feed",        icon: Activity,   category: "discover", requiresAuth: true, tags: ["feed","activity","following"] },
    { id: "leaderboard", title: t("nav.leaderboard"), desc: "Top developers and trending releases",    href: "/leaderboard", icon: Trophy,     category: "discover", tags: ["leaderboard","top","ranking","trending"] },
    { id: "creators",    title: "Featured Creators",  desc: "Meet verified top-tier developers",       href: "/creators",    icon: Star,       category: "discover", badge: "NEW", tags: ["creators","developers","featured","verified"] },
    { id: "devices",     title: "Device Database",    desc: "All supported phones with specs",         href: "/devices",     icon: Smartphone, category: "discover", tags: ["devices","phones","database","specs"] },
    { id: "marketplace",         title: "Marketplace",                desc: "Hire developers, find offers, post requests",    href: "/marketplace", icon: Briefcase, category: "discover", badge: "NEW", tags: ["marketplace","hire","jobs","services","gigs","requests","offers","freelance","commission","work"] },
    { id: "marketplace-requests", title: "Browse Requests",            desc: "Open service requests from clients",             href: "/marketplace?tab=request", icon: ArrowDownLeft, category: "discover", tags: ["marketplace","requests","clients","jobs","work"] },
    { id: "marketplace-offers",   title: "Browse Offers",              desc: "Verified providers selling services",            href: "/marketplace?tab=offer",   icon: ArrowUpRight,  category: "discover", tags: ["marketplace","offers","providers","sellers","services"] },

    // ── Create (developer tools) ──
    { id: "upload-rom",      title: "Publish a Release",       desc: "Upload ROM / Kernel / Module / Recovery / GSI", href: "/upload",    icon: Upload,    category: "create", requiresAuth: true, shortcut: "U", tags: ["upload","publish","create","new"] },
    { id: "post-request",    title: "Post a Service Request",   desc: "Need a custom kernel, port or unlock? Post it.", href: "/marketplace/new?kind=request", icon: ArrowDownLeft, category: "create", badge: "NEW", tags: ["marketplace","request","post","need","hire","commission","brief"] },
    { id: "publish-offer",   title: "Publish a Service Offer",  desc: "Sell your skills as a verified provider.",       href: "/marketplace/new?kind=offer",   icon: ArrowUpRight,  category: "create", badge: "NEW", tags: ["marketplace","offer","publish","sell","service","gig","freelance"] },
    { id: "collections",     title: t("nav.collections"),      desc: "Curate and share your ROM collections",         href: "/collections", icon: Layers,    category: "create", requiresAuth: true, tags: ["collections","curate","lists"] },
    { id: "earnings",        title: "RomX Studio",              desc: "Analytics, earnings and payout dashboard",      href: "/earnings",    icon: DollarSign,category: "create", requiresAuth: true, badge: "PRO", tags: ["earnings","studio","analytics","payout","money"] },
    { id: "apply-dev",       title: "Apply as Developer",       desc: "Become a verified ROM developer",                href: "/apply",       icon: FileText,  category: "create", requiresAuth: true, tags: ["apply","verified","developer","verification"] },

    // ── Tools ──
    { id: "compare",         title: t("nav.compare"),           desc: "Side-by-side ROM comparison",                   href: "/compare",     icon: GitCompare, category: "tools", tags: ["compare","diff","vs"] },

    // ── Social ──
    { id: "favorites",       title: t("nav.favorites"),         desc: "ROMs and devs you saved",                       href: "/favorites",   icon: Heart,      category: "social", requiresAuth: true, tags: ["favorites","saved","bookmarks"] },
    { id: "notifications",   title: t("nav.notifications"),     desc: "Alerts, mentions and updates",                  href: "/notifications", icon: Bell,     category: "social", requiresAuth: true, tags: ["notifications","alerts","bell"] },
    { id: "feedback",        title: "Feature Requests",         desc: "Suggest ideas or report bugs",                  href: "/feedback",    icon: MessageSquarePlus, category: "social", tags: ["feedback","suggest","request","bug"] },

    // ── Account ──
    { id: "profile",         title: t("profile.myProfile"),     desc: "Your profile, stats and achievements",          href: "/",            icon: User,       category: "account", requiresAuth: true, tags: ["profile","account","me"] },
    { id: "settings",        title: t("nav.settings"),          desc: "Theme, language, notifications & privacy",      href: "/settings",    icon: Settings,   category: "account", tags: ["settings","preferences","config","theme","language"] },

    // ── Admin (filtered by role) ──
    { id: "admin",           title: t("nav.admin"),             desc: "Review reports, manage users & content",        href: "/admin",       icon: Shield,     category: "admin", requiresAdmin: true, tags: ["admin","panel","moderate"] },
    { id: "admin-logs",      title: t("nav.logs"),              desc: "System activity and error logs",                href: "/admin/logs",  icon: Terminal,   category: "admin", requiresAdmin: true, tags: ["logs","admin","system","errors"] },
    { id: "sync-map",        title: "Sync Map Data",            desc: "Backfill user geolocation",                      href: "/admin/sync-map", icon: Globe2,  category: "admin", requiresAdmin: true, tags: ["admin","map","sync"] },

    // ── Help ──
    { id: "rules",           title: t("nav.rules"),             desc: "Community guidelines & content policy",         href: "/rules",       icon: BookOpen,   category: "help", tags: ["rules","guidelines","policy"] },
    { id: "about",           title: t("nav.about"),             desc: "About RomX platform",                           href: "/about",       icon: Info,       category: "help", tags: ["about","info"] },
    { id: "contact",         title: "Contact Support",          desc: "Reach our team",                                href: "/contact",     icon: MessageSquarePlus, category: "help", tags: ["contact","support","help"] },
    { id: "privacy",         title: "Privacy Policy",           desc: "How we handle your data",                       href: "/privacy",     icon: Lock,       category: "help", tags: ["privacy","policy","data"] },

    // ── Quick content filters (ROM types) ──
    { id: "filter-rom",      title: "Custom ROMs",              desc: "Browse all custom ROM releases",                href: "/?type=rom",   icon: Smartphone, category: "discover", tags: ["roms","custom","android","firmware"] },
    { id: "filter-kernel",   title: "Kernels",                  desc: "Browse kernel releases",                         href: "/?type=kernel", icon: Cpu,       category: "discover", tags: ["kernel","boot"] },
    { id: "filter-recovery", title: "Recoveries",               desc: "TWRP, OrangeFox and more",                      href: "/?type=recovery", icon: HardDrive, category: "discover", tags: ["recovery","twrp","orangefox"] },
    { id: "filter-module",   title: "Magisk Modules",           desc: "Browse Magisk & KernelSU modules",              href: "/?type=module", icon: Puzzle,    category: "discover", tags: ["module","magisk","kernelsu","root"] },
    { id: "filter-gsi",      title: "GSI Images",               desc: "Generic System Images",                         href: "/?type=gsi",    icon: Globe2,    category: "discover", tags: ["gsi","generic","system","image"] },
  ];
}

// ── Simple fuzzy match scoring ─────────────────────────────────────────────
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();
  if (!q) return 1;
  if (t.includes(q)) return 100 - (t.indexOf(q) * 0.5); // earlier match = higher
  // character-by-character subsequence match
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length ? 30 + qi : 0;
}

function scoreItem(item: CommandItem, query: string): number {
  if (!query.trim()) return 1;
  const titleScore = fuzzyScore(query, item.title) * 3;
  const descScore  = fuzzyScore(query, item.desc || "") * 0.8;
  const tagScore   = Math.max(0, ...(item.tags || []).map(tag => fuzzyScore(query, tag))) * 2;
  return Math.max(titleScore, descScore, tagScore);
}

// ── Recent items helper ────────────────────────────────────────────────────
const RECENT_KEY = "romx_cmd_recent";
function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}
function pushRecent(id: string) {
  try {
    const existing = getRecent().filter(x => x !== id);
    existing.unshift(id);
    localStorage.setItem(RECENT_KEY, JSON.stringify(existing.slice(0, 5)));
  } catch { /* noop */ }
}

// ── Main component ─────────────────────────────────────────────────────────
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { isLoggedIn, isAdmin } = useAuth();
  const { t, dir } = useTranslation();

  // Build items once (re-renders on t change)
  const allItems = useMemo(() => buildItems(t), [t]);

  // Filter by auth/admin
  const availableItems = useMemo(() => allItems.filter(i => {
    if (i.requiresAuth && !isLoggedIn) return false;
    if (i.requiresAdmin && !isAdmin) return false;
    return true;
  }), [allItems, isLoggedIn, isAdmin]);

  // Scored + filtered list
  const filtered = useMemo(() => {
    if (!query.trim()) {
      // No query → show curated: recent first, then by category order
      const recentItems = recentIds
        .map(id => availableItems.find(i => i.id === id))
        .filter(Boolean) as CommandItem[];
      const recentSet = new Set(recentIds);
      const rest = availableItems.filter(i => !recentSet.has(i.id));
      return [...recentItems, ...rest];
    }
    return availableItems
      .map(item => ({ item, score: scoreItem(item, query) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.item);
  }, [availableItems, query, recentIds]);

  // Group by category for display (only when no query)
  const grouped = useMemo(() => {
    if (query.trim()) return null;
    const recentItems = recentIds
      .map(id => availableItems.find(i => i.id === id))
      .filter(Boolean) as CommandItem[];
    const recentSet = new Set(recentIds);
    const groups: { key: string; label: string; color: string; icon: React.ElementType; items: CommandItem[] }[] = [];
    if (recentItems.length > 0) {
      groups.push({ key: "recent", label: "Recent", color: "#94a3b8", icon: Clock, items: recentItems });
    }
    (Object.keys(CATEGORY_META) as CommandItem["category"][]).forEach(catKey => {
      const meta = CATEGORY_META[catKey];
      const items = availableItems.filter(i => i.category === catKey && !recentSet.has(i.id));
      if (items.length === 0) return;
      groups.push({ key: catKey, label: meta.label, color: meta.color, icon: meta.icon, items });
    });
    return groups;
  }, [availableItems, query, recentIds]);

  // ── Global keyboard shortcut: ⌘K / Ctrl+K ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K → toggle
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
        return;
      }
      // "/" → open (when not in input)
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Listen for external triggers (header button dispatches this)
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("romx:open-command-palette", onOpen);
    return () => window.removeEventListener("romx:open-command-palette", onOpen);
  }, []);

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setRecentIds(getRecent());
      setTimeout(() => inputRef.current?.focus(), 50);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Keep active index in bounds as list changes
  useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(Math.max(0, filtered.length - 1));
  }, [filtered.length, activeIdx]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const runItem = useCallback((item: CommandItem) => {
    pushRecent(item.id);
    setOpen(false);
    router.push(item.href);
  }, [router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filtered[activeIdx];
      if (target) runItem(target);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  // Compute absolute index for each grouped item (for keyboard nav)
  const flatIndex = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    if (grouped) {
      grouped.forEach(g => g.items.forEach(it => map.set(it.id, idx++)));
    } else {
      filtered.forEach((it, i) => map.set(it.id, i));
    }
    return map;
  }, [grouped, filtered]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="cmd-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[10vh] sm:pt-[14vh]"
          style={{ background: "rgba(0,0,0,0.66)", backdropFilter: "blur(10px) saturate(140%)" }}
          onClick={() => setOpen(false)}
          dir={dir}
        >
          <motion.div
            key="cmd-sheet"
            initial={{ y: -20, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -12, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="relative w-full max-w-2xl overflow-hidden holo-surface card-shadow-lg"
            style={{
              borderRadius: 20,
              background: "rgb(var(--card) / 0.92)",
              backdropFilter: "blur(24px) saturate(160%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top border glow */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent 5%, var(--primary) 50%, transparent 95%)" }} />
            {/* Corner decorations */}
            <div className="cyber-corners pointer-events-none absolute inset-0 rounded-[20px]" />

            {/* ── Input row ── */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/60">
              <Search className="h-4.5 w-4.5 shrink-0" style={{ color: "var(--primary)" }} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
                onKeyDown={handleKeyDown}
                placeholder="Search features, ROMs, tools… try &quot;upload&quot;, &quot;earnings&quot;, &quot;compare&quot;"
                className="flex-1 bg-transparent text-[15px] font-medium text-foreground outline-none placeholder:text-muted-foreground/50"
              />
              <button
                onClick={() => setOpen(false)}
                className="hidden sm:flex h-6 items-center gap-1 rounded-md border border-border px-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                aria-label="Close"
              >
                ESC
              </button>
              <button
                onClick={() => setOpen(false)}
                className="sm:hidden p-1 text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ── Results ── */}
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2 scrollbar-none">
              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/40">
                    <Search className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No results for &ldquo;{query}&rdquo;</p>
                  <p className="text-xs text-muted-foreground">Try another keyword or press ESC to close.</p>
                </div>
              )}

              {grouped ? (
                grouped.map((group) => (
                  <div key={group.key} className="mb-2">
                    <div className="flex items-center gap-2 px-3 pb-1.5 pt-2">
                      <group.icon className="h-3 w-3" style={{ color: group.color }} />
                      <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: group.color }}>
                        {group.label}
                      </span>
                      <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${group.color}30 0%, transparent 100%)` }} />
                    </div>
                    {group.items.map((item) => {
                      const idx = flatIndex.get(item.id) ?? 0;
                      return (
                        <CommandRow
                          key={item.id}
                          item={item}
                          active={idx === activeIdx}
                          index={idx}
                          onHover={() => setActiveIdx(idx)}
                          onSelect={() => runItem(item)}
                          color={CATEGORY_META[item.category].color}
                        />
                      );
                    })}
                  </div>
                ))
              ) : (
                filtered.map((item, idx) => (
                  <CommandRow
                    key={item.id}
                    item={item}
                    active={idx === activeIdx}
                    index={idx}
                    onHover={() => setActiveIdx(idx)}
                    onSelect={() => runItem(item)}
                    color={CATEGORY_META[item.category].color}
                  />
                ))
              )}
            </div>

            {/* ── Footer hints ── */}
            <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-2.5 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="kbd-key">↑</span><span className="kbd-key">↓</span> Navigate
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="kbd-key">↵</span> Select
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="hidden sm:inline text-muted-foreground/60">Powered by</span>
                <span className="font-black text-foreground">Rom<span style={{ color: "var(--primary)" }}>X</span></span>
                <span className="kbd-key">⌘</span><span className="kbd-key">K</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Single command row ─────────────────────────────────────────────────────
function CommandRow({
  item, active, index, color, onHover, onSelect,
}: {
  item: CommandItem;
  active: boolean;
  index: number;
  color: string;
  onHover: () => void;
  onSelect: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      data-idx={index}
      onMouseEnter={onHover}
      onFocus={onHover}
      onClick={onSelect}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-all duration-150",
        active ? "bg-[var(--primary-dim)]" : "hover:bg-muted/40"
      )}
    >
      {/* Left color accent bar when active */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-2 start-0 w-[3px] rounded-full transition-all",
          active ? "opacity-100" : "opacity-0"
        )}
        style={{ background: color, boxShadow: `0 0 8px ${color}60` }}
      />

      {/* Icon wrap */}
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-all"
        style={{
          background: active ? `${color}25` : `${color}12`,
          border: `1px solid ${color}${active ? "55" : "25"}`,
          boxShadow: active ? `0 0 12px ${color}40` : "none",
        }}
      >
        <Icon className="h-4 w-4" style={{ color, filter: active ? `drop-shadow(0 0 4px ${color}90)` : undefined }} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-[13px] font-bold truncate transition-colors",
            active ? "text-foreground" : "text-foreground/85 group-hover:text-foreground"
          )}>
            {item.title}
          </span>
          {item.badge && (
            <span
              className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                color: item.badge === "PRO" ? "#f59e0b" : item.badge === "NEW" ? "#22c55e" : item.badge === "BETA" ? "#a78bfa" : "#1d9bf0",
                background: item.badge === "PRO" ? "#f59e0b20" : item.badge === "NEW" ? "#22c55e20" : item.badge === "BETA" ? "#a78bfa20" : "#1d9bf020",
                border: `1px solid ${item.badge === "PRO" ? "#f59e0b40" : item.badge === "NEW" ? "#22c55e40" : item.badge === "BETA" ? "#a78bfa40" : "#1d9bf040"}`,
              }}
            >
              {item.badge}
            </span>
          )}
        </div>
        {item.desc && (
          <p className={cn(
            "text-[11px] truncate transition-colors mt-0.5",
            active ? "text-muted-foreground" : "text-muted-foreground/75"
          )}>
            {item.desc}
          </p>
        )}
      </div>

      {/* Shortcut hint */}
      {item.shortcut && (
        <span className="kbd-key hidden sm:inline">{item.shortcut}</span>
      )}

      {/* Arrow on active */}
      <ArrowRight
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-all",
          active ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1"
        )}
        style={{ color }}
      />
    </button>
  );
}

// ── Header trigger button (export for header use) ──────────────────────────
export function CommandPaletteTrigger({ className }: { className?: string }) {
  const { t } = useTranslation();
  const [os, setOs] = useState<"mac" | "other">("other");

  useEffect(() => {
    if (typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform)) {
      setOs("mac");
    }
  }, []);

  const openPalette = () => {
    window.dispatchEvent(new CustomEvent("romx:open-command-palette"));
  };

  return (
    <button
      type="button"
      onClick={openPalette}
      className={cn(
        "group flex h-9 w-full items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-3 text-sm text-muted-foreground transition-all",
        "hover:border-[var(--primary)]/50 hover:bg-muted hover:text-foreground hover:shadow-md",
        "focus-visible:outline-none focus-visible:border-[var(--primary)] focus-visible:shadow-[0_0_0_3px_var(--primary-dim)]",
        className
      )}
      aria-label={t("cmd.quickOpen") || "Quick navigate"}
    >
      {/* Command icon distinguishes this from the content search magnifier. */}
      <Command className="h-4 w-4 transition-transform group-hover:scale-110" style={{ color: "var(--primary)" }} />
      <span className="flex-1 text-start truncate">
        {t("cmd.quickOpen") || "Quick navigate"}
      </span>
      <div className="flex items-center gap-0.5 kbd-breathe">
        <span className="kbd-key">{os === "mac" ? "⌘" : "Ctrl"}</span>
        <span className="kbd-key">K</span>
      </div>
    </button>
  );
}

// ── Compact mobile trigger (icon only) ─────────────────────────────────────
export function CommandPaletteMobileTrigger({ className }: { className?: string }) {
  const openPalette = () => window.dispatchEvent(new CustomEvent("romx:open-command-palette"));
  return (
    <button
      type="button"
      onClick={openPalette}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-90",
        className
      )}
      aria-label="Search"
    >
      <Search className="h-5 w-5" />
    </button>
  );
}
