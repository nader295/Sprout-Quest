"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronUp, Clock, Lock, Trophy, Zap } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { LevelBadge } from "./level-badge";
import { LEVEL_KEY_MAP, LEVEL_ROADMAP, XP_EARN_WAYS } from "./level-roadmap";
import { XPHistoryTab } from "./xp-history-tab";

// ── XP Level Card — headline component on profile page ──────────────────────
// Owner-only interactions (expand, show roadmap); viewers see the collapsed state.
export function XpLevelCard({
  xp, level, nextLevel, isOwner, uid,
}: {
  xp: number;
  level: { level: number; xp: number; label: string };
  nextLevel: { level: number; xp: number; label: string } | null;
  isOwner: boolean;
  uid: string;
}) {
  const { t } = useTranslation();
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const progressPct = nextLevel
    ? Math.min(100, ((xp - level.xp) / (nextLevel.xp - level.xp)) * 100)
    : 100;
  const xpToNext = nextLevel ? nextLevel.xp - xp : 0;

  // Direct DOM manipulation — forces browser reflow between 0% and target%
  // React state batching makes useState approach unreliable for this
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    // Step 1: set to 0 instantly (no transition)
    el.style.transition = "none";
    el.style.width = "0%";
    // Step 2: force browser to actually paint 0% (reflow)
    void el.offsetWidth;
    // Step 3: apply transition and target width — browser now animates 0→target
    el.style.transition = "width 1.3s cubic-bezier(0.34, 1.05, 0.64, 1)";
    el.style.width = `${progressPct}%`;
  }, [progressPct]);

  // Badge color per level tier
  const getBadgeStyle = (lvl: number) => {
    if (lvl >= 30) return { bg: "rgba(245,158,11,0.15)",  border: "rgba(245,158,11,0.4)",  color: "#f59e0b" };
    if (lvl >= 20) return { bg: "rgba(168,85,247,0.15)",  border: "rgba(168,85,247,0.4)",  color: "#a855f7" };
    if (lvl >= 15) return { bg: "rgba(59,130,246,0.15)",  border: "rgba(59,130,246,0.4)",  color: "#3b82f6" };
    if (lvl >= 7)  return { bg: "rgba(16,185,129,0.15)",  border: "rgba(16,185,129,0.4)",  color: "#10b981" };
    return          { bg: "rgba(29,155,240,0.15)",  border: "rgba(29,155,240,0.4)",  color: "#1d9bf0" };
  };
  const badge = getBadgeStyle(level.level);
  const roadmapEntry = LEVEL_ROADMAP.find(r => r.level === level.level) || LEVEL_ROADMAP[0];

  // What unlocked AT this level
  const currentUnlocks = roadmapEntry.unlockKeys;

  // What will unlock at next level
  const nextRoadmapEntry = nextLevel ? LEVEL_ROADMAP.find(r => r.level === nextLevel.level) : null;
  const nextUnlocks = nextRoadmapEntry?.unlockKeys ?? [];

  return (
    <div className="mt-3 relative rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${badge.border}40`, background: "linear-gradient(135deg, var(--xp-card-bg) 0%, transparent 100%)" }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 80% 60% at 0% 0%, ${badge.color}09 0%, transparent 50%)` }} />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--subtle-white)] to-transparent" />

      {/* ── Header — always visible, clickable to expand ── */}
      <button
        onClick={() => isOwner && setExpanded(!expanded)}
        className={cn("relative w-full text-start p-4 sm:p-5 transition-colors", isOwner && "hover:bg-white/[0.02] cursor-pointer", !isOwner && "cursor-default")}>
        <div className="flex items-center gap-4">
          {/* Badge */}
          <div className="relative shrink-0 flex h-14 w-14 items-center justify-center rounded-xl"
            style={{ background: `linear-gradient(135deg, ${badge.bg}, rgba(255,255,255,0.02))`, border: `1px solid ${badge.border}60`, boxShadow: `0 4px 20px ${badge.color}18` }}>
            <LevelBadge level={level.level} size={36} />
          </div>

          {/* Label + progress bar */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-base font-black text-foreground leading-none">{t(LEVEL_KEY_MAP[level.label] || level.label)}</span>
              <span className="rounded-lg px-2 py-0.5 text-[10px] font-black leading-none"
                style={{ background: `${badge.color}18`, border: `1px solid ${badge.border}40`, color: badge.color }}>
                LV.{level.level}
              </span>
            </div>

            {/* XP bar — wave animation (Android 16 style) */}
            <div className="relative h-2.5 w-full rounded-full overflow-hidden"
              style={{ background: `${badge.color}18`, border: `1px solid ${badge.color}20` }}>
              {/* Wave fill */}
              <div ref={barRef} style={{
                height: "100%",
                borderRadius: "9999px",
                width: "0%",
                position: "relative",
                overflow: "hidden",
                background: `linear-gradient(90deg, ${badge.color}80, ${badge.color}dd, ${badge.color})`,
                boxShadow: `0 0 10px ${badge.color}60, inset 0 1px 0 rgba(255,255,255,0.25)`,
              }}>
                {/* Shimmer wave */}
                <div style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 40%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.35) 60%, transparent 100%)",
                  animation: "xpWave 2s ease-in-out infinite",
                  backgroundSize: "200% 100%",
                }} />
              </div>
              {/* Glow dot at tip */}
              <div style={{
                position: "absolute", top: "50%", transform: "translateY(-50%)",
                insetInlineStart: `${progressPct}%`, marginInlineStart: "-4px",
                width: "8px", height: "8px", borderRadius: "50%",
                background: badge.color,
                boxShadow: `0 0 6px ${badge.color}, 0 0 12px ${badge.color}80`,
                transition: "left 1.3s cubic-bezier(0.34, 1.05, 0.64, 1)",
              }} />
            </div>

            {nextLevel ? (
              <p className="text-[10px] text-muted-foreground/60 mt-1.5 leading-none">
                <span className="font-bold" style={{ color: badge.color }}>{xpToNext.toLocaleString()} XP</span>
                {" "}{t("xp.toReach")} <span className="font-semibold text-foreground/60">{t(LEVEL_KEY_MAP[nextLevel.label] || nextLevel.label)}</span>
              </p>
            ) : (
              <p className="text-[10px] mt-1.5 leading-none font-bold" style={{ color: badge.color }}>{t("xp.reachedTop")}</p>
            )}
          </div>

          {/* XP + expand pill — stacked vertically */}
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            <div className="text-end">
              <p className="text-2xl font-black leading-none tabular-nums" style={{ color: badge.color }}>{xp.toLocaleString()}</p>
              <p className="text-[10px] font-semibold text-muted-foreground/50 mt-0.5 tracking-wider uppercase">XP</p>
            </div>
            {isOwner && (
              <div className="flex items-center gap-1 rounded-full px-2 py-0.5"
                style={{ background: `${badge.color}15`, border: `1px solid ${badge.color}30` }}>
                <span className="text-[9px] font-bold" style={{ color: `${badge.color}bb` }}>
                  {expanded ? t("xp.collapse") : t("xp.details")}
                </span>
                <ChevronUp className={`h-3 w-3 transition-transform duration-300 ${expanded ? "" : "rotate-180"}`}
                  style={{ color: badge.color }} />
              </div>
            )}
          </div>
        </div>
      </button>

      {/* ── Collapsible content ── */}
      <div className="overflow-hidden transition-all duration-500 ease-in-out"
        style={{ maxHeight: expanded ? "1400px" : "0px", opacity: expanded ? 1 : 0 }}>
        <div style={{ borderTop: `1px solid ${badge.color}18` }}>

          {/* Current unlocks */}
          {currentUnlocks.length > 0 && (
            <div className="px-4 pt-4 pb-0 flex flex-wrap gap-1.5">
              {currentUnlocks.map((u: string) => (
                <span key={u}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold"
                  style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.15)", color: "rgba(52,211,153,0.9)" }}>
                  <Check className="h-3 w-3" /> {t(u)}
                </span>
              ))}
            </div>
          )}

          {/* Next unlocks teaser */}
          {nextUnlocks.length > 0 && isOwner && (
            <div className="mx-4 mt-3 flex flex-wrap items-center gap-1.5 rounded-xl px-3 py-2.5"
              style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.12)" }}>
              <Lock className="h-3 w-3 text-amber-400/60 shrink-0" />
              <span className="text-[10px] font-semibold text-amber-400/70 shrink-0">{t("xp.atNextLevel", { level: nextLevel?.label ? t(LEVEL_KEY_MAP[nextLevel.label] || nextLevel.label) : "" })}</span>
              {nextUnlocks.slice(0, 3).map((u: string) => (
                <span key={u} className="rounded-lg px-2 py-0.5 text-[10px] font-medium"
                  style={{ background: "rgba(245,158,11,0.06)", color: "rgba(245,158,11,0.6)" }}>{t(u)}</span>
              ))}
              {nextUnlocks.length > 3 && <span className="text-[9px] text-amber-400/40">+{nextUnlocks.length - 3}</span>}
            </div>
          )}

          {/* How to earn more XP */}
          {isOwner && (
            <div className="mt-3" style={{ borderTop: `1px solid ${badge.color}14` }}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowRoadmap(!showRoadmap); }}
                className="flex w-full items-center justify-between px-4 py-3 text-[10px] font-black transition-all hover:bg-card/50"
                style={{ color: badge.color }}>
                <span className="flex items-center gap-2"><span className="text-sm">⚡</span> {t("xp.howToEarnMore")}</span>
                <ChevronUp className={`h-3.5 w-3.5 transition-transform duration-300 ${showRoadmap ? "" : "rotate-180"}`} />
              </button>

              {showRoadmap && (
                <div className="px-4 pb-5 space-y-5">

              {/* ── XP History — سجل حركات XP ── */}
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Clock className="h-3 w-3" style={{ color: badge.color }} /> {t("xp.history")}
                </p>
                <XPHistoryTab uid={uid} />
              </div>

              {/* ── XP Earn Ways — horizontal scroll cards ── */}
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Zap className="h-3 w-3" style={{ color: badge.color }} /> {t("xp.earnWays")}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {XP_EARN_WAYS.map((w) => (
                    <div key={w.labelKey}
                      className="relative flex items-center gap-2.5 rounded-2xl px-3 py-2.5 overflow-hidden group hover:scale-[1.02] transition-transform cursor-default"
                      style={{ background: "rgb(var(--muted))", border: "1px solid rgb(var(--border))" }}>
                      {/* Color accent left edge */}
                      <div className="absolute start-0 top-2 bottom-2 w-0.5 rounded-full opacity-60"
                        style={{ background: `var(--${w.color.replace("text-","").split("-")[0]}-400, ${badge.color})` }} />
                      <span className="text-xl leading-none shrink-0 group-hover:scale-110 transition-transform">{w.icon}</span>
                      <p className="flex-1 min-w-0 text-[10px] font-semibold text-muted-foreground leading-tight">{t(w.labelKey)}</p>
                      <span className={`text-sm font-black shrink-0 ${w.color}`}>+{w.xp}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Level Roadmap — vertical timeline ── */}
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Trophy className="h-3 w-3 text-amber-400" /> {t("xp.levelRoadmap")}
                </p>
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute start-[19px] top-5 bottom-5 w-px"
                    style={{ background: `linear-gradient(to bottom, ${badge.color}60, rgba(255,255,255,0.04))` }} />

                  <div className="space-y-1">
                    {LEVEL_ROADMAP.map((r) => {
                      const isCurrentLevel = level.level === r.level;
                      const isPast = xp >= r.xp;
                      const isNextLevel = nextLevel?.level === r.level;
                      const tileStyle = getBadgeStyle(r.level);

                      return (
                        <div key={r.level}
                          className={`relative flex items-start gap-3 rounded-2xl px-2.5 py-2.5 transition-all ${
                            isCurrentLevel ? "scale-[1.01]" : !isPast && !isNextLevel ? "opacity-30" : ""
                          }`}
                          style={
                            isCurrentLevel
                              ? { background: `${tileStyle.color}10`, border: `1px solid ${tileStyle.color}35`, boxShadow: `0 0 16px ${tileStyle.color}18` }
                              : isNextLevel
                              ? { background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }
                              : { border: "1px solid transparent" }
                          }>
                          {/* Timeline dot */}
                          <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                            style={{
                              background: isPast || isCurrentLevel ? `${tileStyle.color}18` : "rgba(255,255,255,0.04)",
                              border: `1.5px solid ${isPast || isCurrentLevel ? tileStyle.color + "50" : "rgba(255,255,255,0.08)"}`,
                            }}>
                            {isPast && !isCurrentLevel
                              ? <span className="text-base">{r.icon}</span>
                              : <LevelBadge level={r.level} size={22} />
                            }
                          </div>

                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                              <span className={`text-[11px] font-black leading-none ${isCurrentLevel ? "text-foreground" : "text-muted-foreground"}`}>
                                {t(r.labelKey)}
                              </span>
                              {isCurrentLevel && (
                                <span className="rounded-full px-1.5 py-0.5 text-[7px] font-black leading-none text-black"
                                  style={{ background: tileStyle.color }}>{t("xp.youAreHere")}</span>
                              )}
                              {isNextLevel && (
                                <span className="rounded-full px-1.5 py-0.5 text-[7px] font-black leading-none bg-amber-500/20 text-amber-400">{t("xp.nextTarget")}</span>
                              )}
                            </div>
                            {r.unlockKeys.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {r.unlockKeys.slice(0, 3).map((uk) => (
                                  <span key={uk} className="text-[8px] rounded-full px-1.5 py-0.5 font-medium"
                                    style={{
                                      background: isPast ? `${tileStyle.color}10` : "rgba(255,255,255,0.04)",
                                      border: `1px solid ${isPast ? tileStyle.color+"25" : "rgba(255,255,255,0.06)"}`,
                                      color: isPast ? tileStyle.color : "var(--muted-foreground)"
                                    }}>
                                    {isPast ? "✓ " : ""}{t(uk)}
                                  </span>
                                ))}
                                {r.unlockKeys.length > 3 && (
                                  <span className="text-[8px] text-muted-foreground/40">+{r.unlockKeys.length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>

                          <span className="shrink-0 text-[9px] font-black tabular-nums mt-0.5"
                            style={{ color: isCurrentLevel ? tileStyle.color : "rgba(255,255,255,0.2)" }}>
                            {r.xp.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shimmer-progress {
          0%   { transform: translateX(-100%); }
          60%, 100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
