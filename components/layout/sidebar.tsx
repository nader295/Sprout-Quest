"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import {
  Home, Trophy, Activity, Globe2,
  Upload, GitCompare, Shield, Terminal,
  Compass, Layers, Heart, Smartphone, Bell,
  Star, Sparkles, ArrowRight, DollarSign, Settings, Command, User,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Navigation data — collapsed to 3 primary sections ───────────────────────
// Rule: every action has ONE primary home (here) + at most ONE contextual shortcut.
// Removed top-level sections: Tools, Social, Help, Admin (Admin moves under Account when role-gated)
// Compare moves into Discover, Favorites / Notifications / Settings move into Account,
// Feedback / Rules / About / legal move to the footer row.

type NavItem = {
  href: string;
  labelKey: string;
  fallback?: string;
  icon: React.ElementType;
  badge?: "NEW" | "BETA" | "PRO";
};

const DISCOVER_ITEMS: NavItem[] = [
  { href: "/",            labelKey: "nav.home",        icon: Home },
  { href: "/explore",     labelKey: "nav.explore",     fallback: "Explore",     icon: Compass },
  { href: "/devices",     labelKey: "devices.title",   fallback: "Devices",     icon: Smartphone },
  { href: "/creators",    labelKey: "nav.creators",    fallback: "Creators",    icon: Star, badge: "NEW" },
  { href: "/leaderboard", labelKey: "nav.leaderboard", icon: Trophy },
  { href: "/compare",     labelKey: "nav.compare",     icon: GitCompare },
  { href: "/community",   labelKey: "nav.community",   icon: Globe2 },
  { href: "/marketplace", labelKey: "nav.marketplace", fallback: "Marketplace", icon: Briefcase, badge: "NEW" },
];

const CREATE_ITEMS: NavItem[] = [
  { href: "/upload",      labelKey: "nav.upload",      icon: Upload },
  { href: "/collections", labelKey: "nav.collections", icon: Layers },
  { href: "/earnings",    labelKey: "nav.studio",      fallback: "RomX Studio", icon: DollarSign, badge: "PRO" },
];

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="mt-4 mb-1 flex items-center gap-2 px-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">
        {label}
      </span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
}

function SidebarItem({ item, pathname, t }: {
  item: NavItem;
  pathname: string;
  t: (key: string) => string;
}) {
  const isActive = item.href === "/"
    ? pathname === "/"
    : pathname === item.href || pathname.startsWith(item.href + "/") || pathname.startsWith(item.href + "?");

  const label = item.fallback ? (t(item.labelKey) !== item.labelKey ? t(item.labelKey) : item.fallback) : t(item.labelKey);

  return (
    <Link
      href={item.href}
      prefetch={true}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-semibold transition-colors duration-150",
        isActive
          ? "bg-[var(--primary-dim)] text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      {isActive && (
        <div
          aria-hidden
          className="absolute start-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full"
          style={{ backgroundColor: "var(--primary)", boxShadow: "0 0 10px var(--primary-glow)" }}
        />
      )}
      <item.icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isActive ? "" : "text-muted-foreground/70 group-hover:text-foreground",
        )}
        style={isActive ? { color: "var(--primary)" } : undefined}
      />
      <span className="flex-1 truncate">{label}</span>
      {item.badge && (
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
          style={{
            color: item.badge === "PRO" ? "#f59e0b" : "var(--primary)",
            background: item.badge === "PRO" ? "rgba(245,158,11,0.12)" : "var(--primary-dim)",
            border: `1px solid ${item.badge === "PRO" ? "rgba(245,158,11,0.30)" : "color-mix(in srgb, var(--primary) 30%, transparent)"}`,
          }}
        >
          {item.badge}
        </span>
      )}
      {isActive && !item.badge && (
        <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" style={{ color: "var(--primary)" }} />
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { canUpload, isAdmin, isLoggedIn, user } = useAuth();
  const { t, dir } = useTranslation();

  if (pathname === "/login") return null;

  const openPalette = () => window.dispatchEvent(new CustomEvent("romx:open-command-palette"));

  // Account items — only visible when logged in (except Settings which is available to all)
  const ACCOUNT_ITEMS: NavItem[] = [
    ...(isLoggedIn && user?.uid
      ? [{ href: `/u/${user.uid}`, labelKey: "nav.profile", fallback: "Profile", icon: User } as NavItem]
      : []),
    ...(isLoggedIn
      ? [
          { href: "/favorites",     labelKey: "nav.favorites",     icon: Heart } as NavItem,
          { href: "/notifications", labelKey: "nav.notifications", icon: Bell } as NavItem,
          { href: "/feed",          labelKey: "nav.activity",      icon: Activity } as NavItem,
        ]
      : []),
    { href: "/settings", labelKey: "nav.settings", fallback: "Settings", icon: Settings },
  ];

  return (
    <aside className="hidden w-60 shrink-0 border-e border-border/70 lg:block" dir={dir}>
      <nav className="sticky top-14 flex flex-col gap-0.5 px-3 pb-4 pt-3 max-h-[calc(100vh-3.5rem)] overflow-y-auto scrollbar-none">

        {/* ── Command palette shortcut — single unified search entry ── */}
        <button
          onClick={openPalette}
          className="mb-2 flex items-center gap-2 rounded-xl border border-border/80 bg-muted/30 px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-[var(--primary)]/60 hover:bg-muted/60 hover:text-foreground transition-colors group"
        >
          <Command className="h-3.5 w-3.5 transition-transform group-hover:scale-110" style={{ color: "var(--primary)" }} />
          <span className="flex-1 text-start">{t("cmd.quickOpen") || "Quick navigate"}</span>
          <div className="flex items-center gap-0.5">
            <span className="kbd-key">⌘</span>
            <span className="kbd-key">K</span>
          </div>
        </button>

        {/* ── 1. Discover ── */}
        <SectionLabel label={t("nav.discover") || "Discover"} />
        {DISCOVER_ITEMS.map(item => (
          <SidebarItem key={item.href} item={item} pathname={pathname} t={t} />
        ))}

        {/* ── 2. Create (for creators only) ── */}
        {isLoggedIn && canUpload && (
          <>
            <SectionLabel label={t("nav.create") || "Create"} />
            {CREATE_ITEMS.map(item => (
              <SidebarItem key={item.href} item={item} pathname={pathname} t={t} />
            ))}
          </>
        )}

        {/* ── 3. Account ── */}
        <SectionLabel label={t("nav.account") || "Account"} />
        {ACCOUNT_ITEMS.map(item => (
          <SidebarItem key={item.href} item={item} pathname={pathname} t={t} />
        ))}

        {/* ── Admin (role-gated, appended to Account) ── */}
        {isAdmin && (
          <>
            <SidebarItem item={{ href: "/admin", labelKey: "nav.admin", icon: Shield }} pathname={pathname} t={t} />
            <SidebarItem item={{ href: "/admin/logs", labelKey: "nav.logs", icon: Terminal }} pathname={pathname} t={t} />
          </>
        )}

        {/* ── Platform card footer ── */}
        <div className="relative mt-5 overflow-hidden rounded-2xl border border-border/60 p-3 holo-surface">
          <div className="relative flex items-center gap-2 mb-1.5">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{
                background: "linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 60%, var(--holo-cyan, #00e5ff)) 100%)",
                boxShadow: "0 2px 8px var(--primary-glow)",
              }}
            >
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-foreground" dir="ltr">
              Rom<span style={{ color: "var(--primary)" }}>X</span>
            </span>
          </div>
          <p className="relative text-xs leading-relaxed text-muted-foreground mb-2">
            {t("platform.tagline") || "The ultimate Android development platform."}
          </p>
          <Link
            href="/about"
            className="relative inline-flex items-center gap-1 text-xs font-semibold transition-colors"
            style={{ color: "var(--primary)" }}
          >
            {t("common.learnMore") || "Learn more"}
            <ArrowRight className="h-3 w-3 rtl:rotate-180" />
          </Link>
        </div>

        {/* ── Secondary links (Feedback/Rules/About → moved here from top-level) ── */}
        {/* Zero Tracking Badge */}
        <Link href="/my-data"
          className="mt-3 mb-2 mx-1 flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2 hover:bg-emerald-500/15 transition-all group"
        >
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500/20">
            <Shield className="h-3 w-3 text-emerald-400" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] font-black text-emerald-400 group-hover:text-emerald-300 transition-colors">Zero Tracking ✓</span>
            <span className="text-[9px] text-muted-foreground/60">اضغط لعرض بياناتك</span>
          </div>
        </Link>

        <div className="flex flex-wrap gap-x-3 gap-y-1 px-1">
          {[
            { href: "/feedback", label: t("nav.feedback") || "Feedback" },
            { href: "/rules",    label: t("nav.rules")    || "Rules" },
            { href: "/about",    label: t("nav.about")    || "About" },
            { href: "/privacy",  label: "Privacy" },
            { href: "/terms",    label: "Terms" },
            { href: "/contact",  label: "Contact" },
            { href: "/my-data",  label: "🔍 بياناتي" },
          ].map(l => (
            <Link key={l.href} href={l.href} className="text-xs text-muted-foreground/70 hover:text-foreground transition-colors">
              {l.label}
            </Link>
          ))}
          <span className="text-xs text-muted-foreground/50">
            {"\u00A9 "}{new Date().getFullYear()} RomX
          </span>
        </div>
      </nav>
    </aside>
  );
}
