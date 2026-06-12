"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { apiListNotifications, apiMarkNotificationsRead, apiMarkNotificationRead } from "@/lib/api/client";
import type { NotificationItem } from "@/lib/types";
import { timeAgo, safeImg, cn } from "@/lib/utils";
import { DEFAULT_AVATAR } from "@/lib/constants";
import { appCache, CacheKeys } from "@/lib/cache";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell, CheckCheck, Check, Loader2, Heart, UserPlus,
  Download, Star, Zap, MessageSquare, ChevronDown, ChevronUp,
  Reply, AtSign, Settings, Sparkles,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import PageHero from "@/components/shared/page-hero";

// ── Smart routing ────────────────────────────────────────────────────────────
function resolveLink(n: NotificationItem): string {
  if (n.link && n.link !== "#" && n.link !== "") return n.link;
  if (n.type === "follow" && n.authorUid) return `/u/${n.authorUid}`;
  if (n.romId && (n.type === "like" || n.type === "comment" || n.type === "download" || n.type === "reply"))
    return `/rom/${n.romId}`;
  const tl = n.title.toLowerCase();
  if ((tl.includes("follow") || tl.includes("متابع")) && n.authorUid) return `/u/${n.authorUid}`;
  return n.link || "#";
}

// ── Notification meta ───────────────────────────────────────────────────────
function getMeta(n: NotificationItem) {
  const type = n.type || (() => {
    const t = n.title.toLowerCase();
    if (t.includes("follow") || t.includes("متابع")) return "follow";
    if (t.includes("like") || t.includes("إعجاب") || t.includes("لايك")) return "like";
    if (t.includes("download") || t.includes("تحميل")) return "download";
    if (t.includes("comment") || t.includes("تعليق")) return "comment";
    if (t.includes("reply") || t.includes("رد")) return "reply";
    if (t.includes("mention") || t.includes("ذكر")) return "mention";
    if (t.includes("xp") || t.includes("level") || t.includes("achievement")) return "xp";
    if (t.includes("rate") || t.includes("تقييم")) return "rating";
    return "system";
  })();

  const map: Record<string, { icon: React.ElementType; color: string; bg: string; glow: string; accent: string }> = {
    follow:   { icon: UserPlus,      color: "text-sky-400",     bg: "bg-sky-500/10",     glow: "rgba(56,189,248,0.3)",   accent: "#38bdf8" },
    like:     { icon: Heart,         color: "text-rose-400",    bg: "bg-rose-500/10",    glow: "rgba(251,113,133,0.3)",  accent: "#fb7185" },
    download: { icon: Download,      color: "text-emerald-400", bg: "bg-emerald-500/10", glow: "rgba(52,211,153,0.3)",   accent: "#34d399" },
    comment:  { icon: MessageSquare, color: "text-violet-400",  bg: "bg-violet-500/10",  glow: "rgba(167,139,250,0.3)",  accent: "#a78bfa" },
    reply:    { icon: Reply,         color: "text-indigo-400",  bg: "bg-indigo-500/10",  glow: "rgba(99,102,241,0.3)",   accent: "#818cf8" },
    mention:  { icon: AtSign,        color: "text-cyan-400",    bg: "bg-cyan-500/10",    glow: "rgba(34,211,238,0.3)",   accent: "#22d3ee" },
    xp:       { icon: Zap,           color: "text-amber-400",   bg: "bg-amber-500/10",   glow: "rgba(251,191,36,0.3)",   accent: "#fbbf24" },
    rating:   { icon: Star,          color: "text-amber-400",   bg: "bg-amber-500/10",   glow: "rgba(251,191,36,0.3)",   accent: "#fbbf24" },
    system:   { icon: Sparkles,      color: "text-[var(--primary)]", bg: "bg-[var(--primary-dim)]", glow: "rgba(29,155,240,0.3)", accent: "#1d9bf0" },
  };
  return { ...(map[type] || map.system), type };
}

// ── Date grouping helper ──────────────────────────────────────────────────────
function getDateGroup(createdAt: string | number, t: (k: string) => string): string {
  const date = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Check if same calendar day
    if (date.toDateString() === now.toDateString()) return t("notif.today");
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return t("notif.yesterday");
  if (diffDays < 7) return t("notif.thisWeek");
  return t("notif.earlier");
}

// ── Expandable body ──────────────────────────────────────────────────────────
const BODY_LIMIT = 100;

function NotifBody({ body, preview, accent }: { body: string; preview?: string; accent: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const full = preview ? `${body}\n${preview}` : body;
  const isLong = full.length > BODY_LIMIT;
  const displayed = isLong && !expanded ? full.slice(0, BODY_LIMIT) + "…" : full;

  return (
    <div>
      {preview ? (
        <>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{body}</p>
          <div
            className="mt-1.5 rounded-xl px-2.5 py-2 text-xs leading-relaxed border-s-2"
            style={{
              background: `${accent}0d`,
              borderColor: `${accent}40`,
              color: "rgba(255,255,255,0.65)",
              fontStyle: "italic",
              maxHeight: expanded ? "none" : "60px",
              overflow: expanded ? "visible" : "hidden",
              transition: "max-height 0.4s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            &ldquo;{preview}&rdquo;
          </div>
        </>
      ) : (
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
          {displayed}
        </p>
      )}

      {(isLong || (preview && preview.length > 80)) && (
        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); setExpanded(p => !p); }}
          className="mt-1.5 flex items-center gap-1 text-[10px] font-bold transition-all hover:scale-105 active:scale-95"
          style={{ color: accent }}
        >
          {expanded ? (
            <><ChevronUp className="h-3 w-3" />{t("common.showLess")}</>
          ) : (
            <><ChevronDown className="h-3 w-3" />{t("common.showMore")}</>
          )}
        </button>
      )}
    </div>
  );
}

// ── Single notification card ──────────────────────────────────────────────────
function NotifCard({
  n, idx, onMarkRead,
}: {
  n: NotificationItem;
  idx: number;
  onMarkRead: (id: string) => void;
}) {
  const { t } = useTranslation();
  const meta = getMeta(n);
  const Icon = meta.icon;
  const href = resolveLink(n);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), idx * 45);
    return () => clearTimeout(timer);
  }, [idx]);

  return (
    <div
      ref={ref}
      className="group relative overflow-hidden"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(12px) scale(0.98)",
        transition: "opacity 0.35s ease, transform 0.35s cubic-bezier(0.34,1.3,0.64,1)",
      }}
      role="listitem"
    >
      <div
        className={cn(
          "relative flex items-start gap-3 rounded-2xl border p-3.5 transition-all duration-200",
          n.read
            ? "border-border bg-card hover:border-border/80 hover:bg-muted/20"
            : "bg-[var(--primary-dim)] hover:bg-[var(--primary-dim)]"
        )}
        style={!n.read ? { borderColor: `${meta.accent}35` } : undefined}
      >
        {/* Hover glow */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
          style={{ background: `radial-gradient(ellipse 70% 60% at 0% 50%, ${meta.glow.replace("0.3","0.06")} 0%, transparent 70%)` }}
        />

        {/* Unread bar */}
        {!n.read && (
          <div
            className="absolute start-0 top-3 bottom-3 w-[3px] rounded-full"
            style={{ background: `linear-gradient(to bottom, ${meta.accent}, ${meta.accent}60)`, boxShadow: `0 0 8px ${meta.glow}` }}
          />
        )}

        {/* Avatar / Icon */}
        <div className="relative shrink-0">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105", meta.bg)}
            style={{ boxShadow: n.read ? "none" : `0 0 16px ${meta.glow}` }}>
            {n.authorPhoto ? (
              <Image
                src={safeImg(n.authorPhoto, DEFAULT_AVATAR)} alt=""
                width={44} height={44}
                className="rounded-2xl object-cover"
                crossOrigin="anonymous"
              />
            ) : (
              <Icon className={cn("h-5 w-5", meta.color)} />
            )}
          </div>
          {!n.read && (
            <span
              className="absolute -top-1 -end-1 h-3 w-3 rounded-full ring-2 ring-card pulse-dot"
              style={{ backgroundColor: meta.accent }}
            />
          )}
        </div>

        {/* Content */}
        <Link
          href={href}
          onClick={() => { if (!n.read) onMarkRead(n.id); }}
          className="relative flex-1 min-w-0 block"
        >
          <div className="flex items-start justify-between gap-2">
            <p className={cn(
              "text-sm font-black leading-tight",
              n.read ? "text-muted-foreground" : "text-foreground"
            )}>
              {n.title}
            </p>
            <span className="text-[10px] text-muted-foreground/40 font-mono shrink-0 mt-0.5">
              {timeAgo(n.createdAt)}
            </span>
          </div>

          <NotifBody body={n.body} preview={n.preview} accent={meta.accent} />

          {/* ROM chip */}
          {n.romName && (
            <div
              className="mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold"
              style={{ background: `${meta.accent}12`, color: meta.accent, border: `1px solid ${meta.accent}25` }}
            >
              <span>📦</span>{n.romName}
            </div>
          )}
        </Link>

        {/* Mark read btn */}
        {!n.read && (
          <button
            onClick={(e) => { e.stopPropagation(); onMarkRead(n.id); }}
            className="relative shrink-0 flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card/80 text-muted-foreground hover:text-emerald-400 hover:border-emerald-400/40 hover:bg-emerald-400/10 transition-all hover:scale-110 active:scale-90 self-center"
            aria-label={t("notif.markRead")}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Date group header ─────────────────────────────────────────────────────────
function DateGroupHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2 sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
      <div className="h-px flex-1 bg-border/40" />
      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
        {label}
      </span>
      <div className="h-px flex-1 bg-border/40" />
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const { user, isLoggedIn } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread" | "follow" | "like" | "comment">("all");
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    const cacheKey = CacheKeys.notifications(user.uid);
    const cached = appCache.get<NotificationItem[]>(cacheKey);
    if (cached) { setNotifs(cached); setLoading(false); return; }
    apiListNotifications()
      .then((items) => { setNotifs(items); appCache.set(cacheKey, items, 30_000); })
      .catch(() => setNotifs([]))
      .finally(() => setLoading(false));
  }, [user?.uid]);

  const markAllRead = async () => {
    setMarkingAll(true);
    await apiMarkNotificationsRead();
    setNotifs(p => p.map(n => ({ ...n, read: true })));
    appCache.invalidate(user?.uid ? CacheKeys.notifications(user.uid) : "");
    setTimeout(() => setMarkingAll(false), 600);
  };

  const markOneRead = useCallback(async (id: string) => {
    setNotifs(p => p.map(n => n.id === id ? { ...n, read: true } : n));
    try { await apiMarkNotificationRead(id); }
    catch { setNotifs(p => p.map(n => n.id === id ? { ...n, read: false } : n)); }
  }, []);

  if (!isLoggedIn) return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-card mb-5">
        <Bell className="h-9 w-9 text-muted-foreground/40" />
        <div className="absolute inset-0 rounded-3xl dragon-breathe" style={{ border: "1px solid rgba(29,155,240,0.2)" }} />
      </div>
      <p className="text-base font-black text-foreground mb-2">{t("auth.signInPrompt")}</p>
      <Link href="/login"
        className="mt-2 inline-flex items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-black text-white transition-all hover:scale-105 active:scale-95"
        style={{ background: "linear-gradient(135deg, var(--primary), #3b82f6)", boxShadow: "0 4px 14px rgba(29,155,240,0.2)" }}>
        {t("auth.signIn")}
      </Link>
    </div>
  );

  const unreadCount = notifs.filter(n => !n.read).length;

  const FILTERS: { id: typeof filter; label: string; icon: React.ElementType }[] = [
    { id: "all",     label: t("content.all"),          icon: Bell         },
    { id: "unread",  label: t("notif.unread"),         icon: Zap          },
    { id: "follow",  label: t("notif.filterFollow"),   icon: UserPlus     },
    { id: "like",    label: t("notif.filterLikes"),    icon: Heart        },
    { id: "comment", label: t("notif.filterComments"), icon: MessageSquare },
  ];

  const displayed = notifs.filter(n => {
    if (filter === "unread") return !n.read;
    if (filter === "all") return true;
    const m = getMeta(n);
    return m.type === filter;
  });

  // Group notifications by date
  const groupedNotifs: { label: string; items: { n: NotificationItem; globalIdx: number }[] }[] = [];
  const seenGroups = new Map<string, number>();

  displayed.forEach((n, idx) => {
    const timeVal = (n.createdAt as any)?.seconds ? (n.createdAt as any).seconds * 1000 : (n.createdAt as any);
    const label = getDateGroup(timeVal, t);
    const existing = seenGroups.get(label);
    if (existing !== undefined) {
      groupedNotifs[existing].items.push({ n, globalIdx: idx });
    } else {
      seenGroups.set(label, groupedNotifs.length);
      groupedNotifs.push({ label, items: [{ n, globalIdx: idx }] });
    }
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-3 sm:px-4 sm:py-4 pb-24">
      {/* Holographic Header */}
      <PageHero
        icon={Bell}
        title={t("notif.title")}
        description={t("notif.totalCount", { n: notifs.length })}
        compact
        badge={unreadCount > 0 ? (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black text-white"
            style={{ background: "linear-gradient(135deg, var(--primary), #6366f1)", boxShadow: "0 0 8px rgba(29,155,240,0.35)" }}>
            {unreadCount} new
          </span>
        ) : undefined}
        className="mb-5"
        actions={
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button onClick={markAllRead} disabled={markingAll}
                className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:border-emerald-400/40 hover:bg-emerald-400/10 transition-all hover:scale-105 active:scale-95 disabled:opacity-60 backdrop-blur-sm bg-card/50">
                <CheckCheck className={cn("h-3.5 w-3.5 transition-all", markingAll && "text-emerald-400 scale-125")} />
                {t("notif.markAllRead")}
              </button>
            )}
            <button
              onClick={() => router.push("/settings")}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all hover:scale-105 active:scale-90 backdrop-blur-sm bg-card/50"
              aria-label={t("nav.settings")}
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        }
      />

      {/* Filter pills */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
        {FILTERS.map(f => {
          const count = f.id === "unread" ? unreadCount
            : f.id === "all" ? notifs.length
            : notifs.filter(n => getMeta(n).type === f.id).length;
          const active = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className="flex shrink-0 items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-bold transition-all duration-200 hover:scale-105 active:scale-95"
              style={active ? {
                background: "linear-gradient(135deg, var(--primary), #6366f1)",
                color: "white",
                boxShadow: "0 4px 14px rgba(29,155,240,0.35)",
              } : {
                background: "rgb(var(--card))",
                border: "1px solid rgb(var(--border))",
                color: "rgb(var(--muted-foreground))",
              }}>
              <f.icon className="h-3 w-3" />
              {f.label}
              {count > 0 && (
                <span className="rounded-full px-1.5 py-0.5 text-[9px] font-black"
                  style={{ background: active ? "rgba(255,255,255,0.25)" : "rgba(29,155,240,0.15)", color: active ? "white" : "var(--primary)" }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2 animate-in fade-in duration-300">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5" style={{ opacity: 1 - i * 0.15 }}>
              <div className="h-11 w-11 rounded-2xl shimmer shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/5 rounded-xl shimmer" />
                <div className="h-3 w-full rounded-lg shimmer" />
                <div className="h-3 w-2/5 rounded-lg shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-card mb-4">
            <Bell className="h-8 w-8 text-muted-foreground/25" />
          </div>
          <p className="text-sm font-black text-foreground mb-1">
            {filter === "unread" ? t("notif.allReadTitle") : t("notif.emptyTitle")}
          </p>
          <p className="text-xs text-muted-foreground">
            {filter === "unread" ? t("notif.allReadSubtitle") : t("notif.willAppearSubtitle")}
          </p>
        </div>
      ) : (
        <div className="space-y-1 animate-in fade-in duration-500" role="list" aria-label={t("notif.title")}>
          {groupedNotifs.map((group) => (
            <div key={group.label}>
              <DateGroupHeader label={group.label} />
              <div className="space-y-2">
                {group.items.map(({ n, globalIdx }) => (
                  <NotifCard key={n.id} n={n} idx={globalIdx} onMarkRead={markOneRead} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
