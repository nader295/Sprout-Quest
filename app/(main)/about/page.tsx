"use client";

import { useTranslation } from "@/lib/i18n";
import {
  Zap, Globe, Shield, Users, Layers, Award, Heart,
  Smartphone, Star, TrendingUp, Eye, Download,
  BarChart3, Rocket, CheckCircle2, Sparkles, Flame, X as XIcon,
  Cpu, HardDrive, Puzzle, Trophy, Bell, Search, Palette, GitMerge,
  ChevronRight, ArrowUpRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";

// ── Hook for animated counters ──────────────────────────────────────────────────
function useAnimatedCount(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          let startTimestamp: number;
          const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            // ease cubic out
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(easeProgress * end));
            if (progress < 1) window.requestAnimationFrame(step);
          };
          window.requestAnimationFrame(step);
        }
      },
      { threshold: 0.1 }
    );
    if (elementRef.current) observer.observe(elementRef.current);
    return () => observer.disconnect();
  }, [end, duration, hasAnimated]);

  return { count, elementRef };
}

// ── Static data ────────────────────────────────────────────────────────────────
const PLATFORM_STATS = [
  { icon: Smartphone, key: "about.stat.contentTypes", value: 5, suffix: "",  color: "#38bdf8" },
  { icon: Globe,      key: "about.stat.languages",    value: 20, suffix: "+", color: "#34d399" },
  { icon: Users,      key: "about.stat.roles",        value: 5, suffix: "",  color: "#a78bfa" },
  { icon: Award,      key: "about.stat.xpLevels",     value: 7, suffix: "",  color: "#fbbf24" },
];

const CONTENT_TYPES = [
  { icon: Smartphone, labelKey: "about.content.roms",       descKey: "about.content.romsDesc",       color: "#38bdf8", bg: "rgba(56,189,248,0.1)"   },
  { icon: Cpu,        labelKey: "about.content.kernels",    descKey: "about.content.kernelsDesc",    color: "#a78bfa", bg: "rgba(167,139,250,0.1)"  },
  { icon: HardDrive,  labelKey: "about.content.recoveries", descKey: "about.content.recoveriesDesc", color: "#fbbf24", bg: "rgba(251,191,36,0.1)"   },
  { icon: Puzzle,     labelKey: "about.content.modules",    descKey: "about.content.modulesDesc",    color: "#34d399", bg: "rgba(52,211,153,0.1)"   },
  { icon: Globe,      labelKey: "about.content.gsi",        descKey: "about.content.gsiDesc",        color: "#fb7185", bg: "rgba(251,113,133,0.1)"  },
];

const FEATURES = [
  { icon: Layers,   titleKey: "about.feature.library",     color: "#38bdf8", descKey: "about.feature.libraryDesc"     },
  { icon: Users,    titleKey: "about.feature.social",      color: "#a78bfa", descKey: "about.feature.socialDesc"      },
  { icon: Trophy,   titleKey: "about.feature.gamification",color: "#fbbf24", descKey: "about.feature.gamificationDesc" },
  { icon: Globe,    titleKey: "about.feature.i18n",        color: "#34d399", descKey: "about.feature.i18nDesc"        },
  { icon: Shield,   titleKey: "about.feature.security",    color: "#fb7185", descKey: "about.feature.securityDesc"    },
  { icon: BarChart3,titleKey: "about.feature.analytics",   color: "#22d3ee", descKey: "about.feature.analyticsDesc"   },
  { icon: Bell,     titleKey: "about.feature.notifications",color: "#818cf8", descKey: "about.feature.notificationsDesc"},
  { icon: Search,   titleKey: "about.feature.search",      color: "#f97316", descKey: "about.feature.searchDesc"      },
  { icon: Palette,  titleKey: "about.feature.themes",      color: "#e879f9", descKey: "about.feature.themesDesc"      },
  { icon: GitMerge, titleKey: "about.feature.collab",      color: "#84cc16", descKey: "about.feature.collabDesc"      },
];

const XP_LEVELS = [
  { level: 1,  nameKey: "about.level.member",    xp: "0",      color: "#94a3b8", unlockKeys: ["about.unlock.upload",   "about.unlock.follow"]   },
  { level: 3,  nameKey: "about.level.publisher",  xp: "150",    color: "#10b981", unlockKeys: ["about.unlock.links",    "about.unlock.pin"]      },
  { level: 7,  nameKey: "about.level.developer",  xp: "600",    color: "#1d9bf0", unlockKeys: ["about.unlock.cover",    "about.unlock.channel",  "about.unlock.donate", "about.unlock.analytics"] },
  { level: 10, nameKey: "about.level.topDev",     xp: "1,800",  color: "#8b5cf6", unlockKeys: ["about.unlock.priority", "about.unlock.status"]   },
  { level: 15, nameKey: "about.level.pro",        xp: "4,000",  color: "#f59e0b", unlockKeys: ["about.unlock.early"]                              },
  { level: 20, nameKey: "about.level.expert",     xp: "9,000",  color: "#ec4899", unlockKeys: ["about.unlock.expertBadge"]                        },
  { level: 30, nameKey: "about.level.legendary",  xp: "25,000", color: "#f43f5e", unlockKeys: ["about.unlock.legendaryBadge", "about.unlock.featured"] },
];

const XP_WAYS = [
  { emoji: "🚀", actionKey: "about.xp.publish",  xp: "+30", color: "#34d399" },
  { emoji: "🔄", actionKey: "about.xp.update",   xp: "+10", color: "#38bdf8" },
  { emoji: "❤️", actionKey: "about.xp.like",     xp: "+3",  color: "#fb7185" },
  { emoji: "⬇️", actionKey: "about.xp.downloads",xp: "+2",  color: "#a78bfa" },
  { emoji: "👤", actionKey: "about.xp.follower",  xp: "+5",  color: "#fbbf24" },
  { emoji: "📡", actionKey: "about.xp.channel",  xp: "+25", color: "#22d3ee" },
  { emoji: "🏆", actionKey: "about.xp.milestone",xp: "+20", color: "#f59e0b" },
  { emoji: "💬", actionKey: "about.xp.comment",  xp: "+5",  color: "#c084fc" },
];

const COMPARISON_KEYS = [
  { key: "about.vs.modernDesign",   us: true,  them: false },
  { key: "about.vs.socialFeatures", us: true,  them: false },
  { key: "about.vs.xpSystem",       us: true,  them: false },
  { key: "about.vs.multiLang",      us: true,  them: false },
  { key: "about.vs.reactions",      us: true,  them: false },
  { key: "about.vs.smartSearch",    us: true,  them: true  },
  { key: "about.vs.pushNotif",      us: true,  them: false },
  { key: "about.vs.devAnalytics",   us: true,  them: false },
  { key: "about.vs.themes",         us: true,  them: false },
  { key: "about.vs.freeForever",    us: true,  them: true  },
];

const DEV_FEATURES = [
  { icon: Rocket,     titleKey: "about.dev.upload",    color: "#1d9bf0", descKey: "about.dev.uploadDesc"    },
  { icon: TrendingUp, titleKey: "about.dev.analytics", color: "#34d399", descKey: "about.dev.analyticsDesc" },
  { icon: Users,      titleKey: "about.dev.audience",  color: "#a78bfa", descKey: "about.dev.audienceDesc"  },
  { icon: Heart,      titleKey: "about.dev.donations", color: "#fb7185", descKey: "about.dev.donationsDesc" },
];

// ── Shared UI ──────────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-4">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent opacity-50" />
      <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60">{children}</span>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent opacity-50" />
    </div>
  );
}

function StatCard({ stat }: { stat: typeof PLATFORM_STATS[0] }) {
  const { count, elementRef } = useAnimatedCount(stat.value);
  const { t } = useTranslation();

  return (
    <div ref={elementRef} className="group relative overflow-hidden rounded-3xl border border-border/40 bg-card p-6 transition-all duration-500 hover:border-border hover:shadow-2xl hover:-translate-y-1" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
      <div className="absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-500 group-hover:opacity-10" style={{ backgroundImage: `linear-gradient(to bottom right, ${stat.color}, transparent)` }} />
      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-inner transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3" style={{ background: `${stat.color}15`, border: `1px solid ${stat.color}30` }}>
          <stat.icon className="h-6 w-6" style={{ color: stat.color }} />
        </div>
        <p className="text-4xl font-black tabular-nums tracking-tight text-foreground transition-all duration-300">
          {count}{stat.suffix}
        </p>
        <p className="text-xs font-bold text-muted-foreground/70 text-center uppercase tracking-wider">{t(stat.key)}</p>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AboutPage() {
  const { t, dir } = useTranslation();
  const [activeLevel, setActiveLevel] = useState<number>(1);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 pb-32 space-y-24" dir={dir}>

      {/* ══ HERO SECTION ══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden rounded-[40px] text-center border border-border/40 bg-card/60 shadow-2xl animate-in fade-in zoom-in-95 duration-700" style={{
        padding: "clamp(3rem, 10vw, 6rem) clamp(1rem, 5vw, 4rem)",
      }}>
        <div className="absolute inset-0 z-0">
          <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full blur-[100px] opacity-10 animate-pulse-slow" style={{ background: "radial-gradient(circle, var(--primary), transparent)" }} />
          <div className="absolute -bottom-32 right-1/4 h-80 w-80 rounded-full blur-[80px] opacity-10 animate-pulse-slow" style={{ background: "radial-gradient(circle, #8b5cf6, transparent)", animationDelay: "2s" }} />
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />
        </div>

        <div className="relative z-10 flex flex-col items-center">
          <div className="inline-flex items-center justify-center gap-3 mb-8 px-5 py-2 rounded-full border border-border/50 bg-background/50 backdrop-blur-sm shadow-xl animate-in slide-in-from-top-4 fade-in duration-700 delay-100">
             <Sparkles className="h-4 w-4 text-[var(--primary)] animate-pulse" />
             <span className="text-xs font-black uppercase tracking-widest bg-gradient-to-r from-[var(--primary)] to-indigo-400 bg-clip-text text-transparent">
               RomX v4.0 Ultimate Edition
             </span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-foreground mb-6 leading-[1.1] tracking-tight animate-in slide-in-from-bottom-6 fade-in duration-700 delay-200">
            {t("about.heroTitle")}
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-4 animate-in slide-in-from-bottom-6 fade-in duration-700 delay-300 font-medium">
            {t("about.heroDesc")}
          </p>
          <p className="text-sm sm:text-base text-muted-foreground/60 max-w-xl mx-auto leading-relaxed mb-10 animate-in slide-in-from-bottom-6 fade-in duration-700 delay-400">
            {t("about.heroSubDesc")}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto animate-in zoom-in-95 fade-in duration-700 delay-500">
            <Link href="/explore"
              className="group relative flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl px-8 py-4 text-sm font-black text-white overflow-hidden transition-all hover:scale-105 active:scale-95"
              style={{ background: "linear-gradient(135deg, var(--primary), #6366f1)", boxShadow: "0 8px 32px rgba(29,155,240,0.3)" }}>
              <span className="absolute inset-0 w-full h-full gradient-swipe opacity-20" />
              <Rocket className="h-4.5 w-4.5 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
              {t("about.exploreNow")}
            </Link>
            <Link href="/login"
              className="group flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl border-2 border-border bg-background/50 px-8 py-4 text-sm font-black text-foreground backdrop-blur hover:bg-muted/50 hover:border-[var(--primary)]/50 transition-all hover:scale-105 active:scale-95 shadow-lg">
              <Users className="h-4.5 w-4.5 group-hover:text-[var(--primary)] transition-colors" />
              {t("about.joinCommunity")}
            </Link>
          </div>
        </div>
      </section>

      {/* ══ DYNAMIC STATS ═════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 animate-in fade-in duration-1000 delay-300">
        {PLATFORM_STATS.map((s) => (
          <StatCard key={s.key} stat={s} />
        ))}
      </section>

      {/* ══ PLATFORM INTRODUCTION ═════════════════════════════════════════════ */}
      <section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <SectionLabel>{t("about.whatIsLabel")}</SectionLabel>
          <h2 className="text-3xl sm:text-4xl font-black text-foreground mb-4">{t("about.whatIsTitle")}</h2>
          <p className="text-base text-muted-foreground leading-relaxed">{t("about.whatIsDesc")}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-[32px] border border-border/50 bg-card p-8 shadow-xl hover:border-border transition-colors">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-6 bg-[var(--primary-dim)] border border-[var(--primary)]/20 text-[var(--primary)] shadow-inner">
              <Flame className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-black text-foreground mb-3">{t("about.forVeterans") || "For Android Veterans"}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("about.whatIsDesc2")}</p>
          </div>

          <div className="rounded-[32px] border border-border/50 bg-card p-8 shadow-xl hover:border-border transition-colors relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent z-0" />
            <div className="relative z-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-6 bg-amber-500/10 border border-amber-500/20 text-amber-500 shadow-inner">
                <Shield className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-black text-foreground mb-3">{t("about.forBeginners")}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t("about.beginnerExplain")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══ CONTENT CATALOG ═══════════════════════════════════════════════════ */}
      <section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <SectionLabel>{t("about.contentTypesLabel")}</SectionLabel>
          <h2 className="text-3xl font-black text-foreground mb-4">{t("about.contentTypesTitle")}</h2>
          <p className="text-base text-muted-foreground">{t("about.contentTypesDesc")}</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CONTENT_TYPES.map((ct, idx) => (
            <div key={ct.labelKey} className={cn("group rounded-[28px] border border-border/50 bg-card/50 p-6 transition-all hover:bg-card hover:border-border hover:shadow-xl hover:-translate-y-1", idx === 3 || idx === 4 ? "lg:col-span-1" : "")}>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-inner transition-transform group-hover:scale-110 group-hover:rotate-6" style={{ background: ct.bg, border: `1px solid ${ct.color}30` }}>
                  <ct.icon className="h-6 w-6" style={{ color: ct.color }} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground mb-1.5">{t(ct.labelKey)}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t(ct.descKey)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ XP SYSTEM & GAMIFICATION ═════════════════════════════════════════ */}
      <section className="animate-in fade-in slide-in-from-bottom-8 duration-700 bg-card/30 rounded-[40px] border border-border/40 p-6 sm:p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[var(--primary-dim)] to-transparent rounded-full blur-[80px] opacity-20 pointer-events-none" />
        
        <div className="text-center max-w-3xl mx-auto mb-10 relative z-10">
          <SectionLabel>{t("about.xpLabel")}</SectionLabel>
          <h2 className="text-3xl font-black text-foreground mb-4">{t("about.xpTitle")}</h2>
          <p className="text-base text-muted-foreground">{t("about.xpDesc")}</p>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 relative z-10">
          {/* XP Actions Grid */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-3 h-fit">
            {XP_WAYS.map((w) => (
              <div key={w.actionKey} className="group flex flex-col items-center gap-2 rounded-3xl border border-border/50 bg-card/80 p-4 text-center hover:border-border hover:bg-card transition-all hover:shadow-lg hover:-translate-y-1">
                <span className="text-3xl filter drop-shadow-md group-hover:scale-110 transition-transform">{w.emoji}</span>
                <p className="text-xs text-foreground font-bold mt-1 leading-tight">{t(w.actionKey)}</p>
                <span className="text-sm font-black tabular-nums bg-background/50 px-3 py-1 rounded-full border border-border/50" style={{ color: w.color }}>{w.xp} XP</span>
              </div>
            ))}
          </div>

          {/* XP Levels List */}
          <div className="lg:col-span-7 bg-background/50 rounded-3xl border border-border p-2 space-y-2">
            {XP_LEVELS.map((l) => {
              const isActive = activeLevel === l.level;
              return (
                <div key={l.level} onClick={() => setActiveLevel(isActive ? 1 : l.level)}
                  className={cn("group rounded-2xl border transition-all cursor-pointer overflow-hidden", isActive ? "bg-card border-border shadow-lg" : "bg-transparent border-transparent hover:bg-card/40")}>
                  <div className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black shadow-inner transition-transform" style={{ background: `${l.color}15`, color: l.color, border: `1px solid ${l.color}30` }}>
                      L{l.level}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-base font-black text-foreground">{t(l.nameKey)}</span>
                        <span className="text-[10px] font-black rounded-full px-2 py-0.5 tracking-wide uppercase" style={{ background: `${l.color}15`, color: l.color }}>{l.xp} XP</span>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium truncate">
                        {isActive ? t("about.unlocks") || "Unlocks:" : `${t(l.unlockKeys[0])}${l.unlockKeys.length > 1 ? ` +${l.unlockKeys.length - 1} ${t("common.more") || "more"}` : ""}`}
                      </p>
                    </div>
                    <ChevronRight className={cn("h-5 w-5 transition-transform opacity-40 shrink-0", isActive && "rotate-90 opacity-100", l.color && `text-[${l.color}]`)} />
                  </div>
                  {isActive && (
                    <div className="px-5 pb-5 pt-1 flex flex-wrap gap-2 animate-in slide-in-from-top-2 fade-in duration-200">
                      {l.unlockKeys.map(k => (
                        <span key={k} className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold shadow-sm" style={{ background: `${l.color}10`, color: l.color, border: `1px solid ${l.color}25` }}>
                          <CheckCircle2 className="h-3.5 w-3.5" />{t(k)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ FEATURES GRID ═════════════════════════════════════════════════════ */}
      <section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <SectionLabel>{t("about.featuresLabel")}</SectionLabel>
          <h2 className="text-3xl font-black text-foreground mb-4">{t("about.featuresTitle")}</h2>
          <p className="text-base text-muted-foreground">{t("about.featuresDesc")}</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <div key={f.titleKey} className={cn("group relative overflow-hidden rounded-[28px] border border-border/50 bg-card p-6 transition-all hover:bg-card hover:border-border hover:-translate-y-1 hover:shadow-xl", i > 5 ? "lg:col-span-1" : "")}>
              <div className="absolute top-0 right-0 p-4 opacity-10 transition-transform group-hover:scale-150 group-hover:opacity-20 duration-500" style={{ color: f.color }}>
                 <f.icon className="h-24 w-24 -mr-8 -mt-8" />
              </div>
              <div className="relative z-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-4 shadow-inner bg-background border transition-colors group-hover:border-transparent" style={{ borderColor: `${f.color}30` }}>
                  <f.icon className="h-6 w-6" style={{ color: f.color }} />
                </div>
                <h3 className="text-base font-black text-foreground mb-2">{t(f.titleKey)}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-medium">{t(f.descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ THE ROMX ADVANTAGE (COMPARISON) ═══════════════════════════════════ */}
      <section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <SectionLabel>{t("about.whyLabel")}</SectionLabel>
          <h2 className="text-3xl font-black text-foreground mb-4">{t("about.whyTitle")}</h2>
          <p className="text-base text-muted-foreground">{t("about.whyDesc")}</p>
        </div>

        <div className="rounded-[32px] border border-border bg-card shadow-2xl overflow-hidden relative">
          <div className="absolute right-1/4 top-0 w-1/4 h-full bg-[var(--primary-dim)] opacity-30 pointer-events-none" />
          
          <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <table className="w-full min-w-[600px] text-left border-collapse relative z-10">
              <thead>
                <tr className="bg-muted/50">
                  <th className="p-5 text-xs font-black uppercase tracking-widest text-muted-foreground w-1/2">{t("about.feature")}</th>
                  <th className="p-5 text-center w-1/4 border-x border-border/50 bg-[var(--primary-dim)]/50 backdrop-blur-sm shadow-[0_-4px_16px_rgba(29,155,240,0.1)]">
                    <span className="text-lg font-black bg-gradient-to-r from-[var(--primary)] to-indigo-400 bg-clip-text text-transparent">RomX</span>
                  </th>
                  <th className="p-5 text-center text-xs font-black uppercase tracking-widest text-muted-foreground w-1/4">{t("about.others")}</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_KEYS.map((cp, i) => (
                  <tr key={cp.key} className="border-t border-border/40 hover:bg-muted/20 transition-colors">
                    <td className="p-4 indent-2 text-sm font-bold text-foreground/80">{t(cp.key)}</td>
                    <td className="p-4 text-center border-x border-border/50 bg-[var(--primary-dim)]/20">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 shadow-inner">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-muted/50 border border-border text-muted-foreground/40 shadow-inner">
                        {cp.them ? <CheckCircle2 className="h-4 w-4 opacity-50" /> : <XIcon className="h-4 w-4" />}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-muted/30 border-t border-border text-center text-xs text-muted-foreground/60 font-medium">
            {t("about.comparisonFootnote") || "* Comparison based on leading generic tech forums and typical file hosting sites as of 2026."}
          </div>
        </div>
      </section>

      {/* ══ CTA SECTION ═══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden rounded-[40px] text-center shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 mt-32 border border-[var(--primary)]/20" style={{
        background: "linear-gradient(135deg, rgba(29,155,240,0.15) 0%, rgba(99,102,241,0.1) 50%, rgba(168,85,247,0.05) 100%)",
        padding: "clamp(4rem, 8vw, 6rem) clamp(1rem, 5vw, 4rem)",
      }}>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--primary)]/50 to-transparent" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-80 w-[600px] rounded-full blur-[100px] opacity-30" style={{ background: "radial-gradient(circle, #1d9bf0, #6366f1)" }} />

        <div className="relative z-10 flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl mb-6 shadow-2xl animate-bounce-slow" style={{ background: "linear-gradient(135deg, #1d9bf0, #6366f1)" }}>
            <Rocket className="h-8 w-8 text-white ml-0.5 mt-0.5" />
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground mb-4 leading-tight">{t("about.ctaTitle")}</h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-6 leading-relaxed font-medium">{t("about.ctaDesc")}</p>
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-background/50 border border-border/50 text-xs font-bold text-muted-foreground mb-10 shadow-sm backdrop-blur">
             <Shield className="h-3.5 w-3.5 text-emerald-500" /> {t("about.freeForever")}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
            <Link href="/explore" className="group flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl px-8 py-4 text-sm font-black text-white transition-all hover:scale-105 active:scale-95 shadow-xl" style={{ background: "linear-gradient(135deg, var(--primary), #6366f1)" }}>
              {t("about.browseRoms")}
              <ArrowUpRight className="h-4.5 w-4.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
            <Link href="/login" className="group flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card px-8 py-4 text-sm font-black text-foreground transition-all hover:bg-muted/80 hover:border-primary/40 hover:scale-105 active:scale-95 shadow-lg">
              <Users className="h-4.5 w-4.5" />
              {t("about.joinCommunity")}
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
