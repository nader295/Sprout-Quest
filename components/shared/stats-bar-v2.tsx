"use client";

/**
 * Stats bar — unified single glass card with 4 flex segments, shimmer animation.
 *
 * Inspired by "Angelic Guardians"-style dashboards: each stat is its own
 * frosted-glass bento cell with a subtle ring gauge, inner-glow accent,
 * animated count-up, and staggered entry. The presence dot (Online) is
 * kept as the live indicator.
 *
 * Responsive:
 *   - All breakpoints: a single unified glass card containing four flex
 *     segments separated by subtle inline-start dividers (flip-safe for
 *     RTL). The whole bar shares one shimmer sweep, one multi-tinted
 *     ambient backdrop, and one bottom spectrum accent, so it reads as
 *     ONE cohesive component rather than four cards.
 *
 * Accessibility:
 *   - Ring gauges are decorative (`aria-hidden`), numeric value remains
 *     the source of truth for screen readers.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { apiGetStats } from "@/lib/api/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { formatCount } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { Wifi, Box, Users, Code } from "lucide-react";

interface Stats { online: number; roms: number; devs: number; users: number; }

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = sessionStorage.getItem("rx_sid");
  if (!sid) { sid = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`; sessionStorage.setItem("rx_sid", sid); }
  return sid;
}

// Animated counter — requestAnimationFrame driven, respects reduced-motion.
function AnimatedNumber({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;

    // Honour reduced-motion: jump to final value immediately.
    const prefersReduced = typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setDisplayed(to);
      prevRef.current = to;
      return;
    }

    const duration = 900; // ms
    const startedAt = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      // easeOutQuart — smooth, slightly bouncy finish
      const eased = 1 - Math.pow(1 - t, 4);
      const current = Math.round(from + (to - from) * eased);
      setDisplayed(current);
      if (t < 1) rafId = requestAnimationFrame(tick);
      else prevRef.current = to;
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value]);

  return <>{formatCount(displayed)}</>;
}

// ── Subtle ring gauge — decorative accent behind each stat icon ─────────────
// Value is normalised logarithmically so tiny counts (e.g. 3 online)
// still draw a visible arc, and large counts (50k users) don't overshoot.
function RingGauge({
  value, maxReference, colour,
}: { value: number; maxReference: number; colour: string }) {
  const ratio = Math.max(0.08, Math.min(1, Math.log10(value + 1) / Math.log10(maxReference + 1)));
  const r = 18;
  const c = 2 * Math.PI * r;
  const dash = c * ratio;

  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 48 48"
      aria-hidden
    >
      {/* Track */}
      <circle
        cx="24" cy="24" r={r}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.08"
        strokeWidth="1.5"
      />
      {/* Progress */}
      <motion.circle
        cx="24" cy="24" r={r}
        fill="none"
        stroke={colour}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform="rotate(-90 24 24)"
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: 0 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        style={{ filter: `drop-shadow(0 0 3px ${colour})` }}
      />
    </svg>
  );
}

export default function StatsBar() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<Stats>({ online: 0, roms: 0, devs: 0, users: 0 });
  const presenceActive = useRef(false);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [statsData, presenceData] = await Promise.all([
          apiGetStats(),
          fetch("/api/presence")
            .then(r => r.ok ? r.json() as Promise<{ count: number }> : { count: 0 })
            .catch(() => ({ count: 0 })),
        ]);
        setStats({
          online: presenceData.count || 0,
          roms:   statsData.totalRoms  || 0,
          devs:   statsData.totalDevs  || 0,
          users:  statsData.totalUsers || 0,
        });
      } catch { /* swallow — keep last known values */ }
    }
    fetchStats();
    const interval = setInterval(fetchStats, 60_000); // تحسين: من 30s إلى 60s (توفير 50%)
    return () => clearInterval(interval);
  }, []);

  const sendHeartbeat = useCallback(() => {
    const sid = getSessionId();
    if (!sid) return;
    fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sid, uid: user?.uid || null }),
    }).catch(() => {});
  }, [user?.uid]);

  useEffect(() => {
    if (authLoading || presenceActive.current) return;
    presenceActive.current = true;
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 120_000); // تحسين: من 60s إلى 120s (توفير 50%)
    const handleVisibility = () => { if (document.visibilityState === "visible") sendHeartbeat(); };
    document.addEventListener("visibilitychange", handleVisibility);
    const handleUnload = () => {
      const sid = getSessionId(); if (!sid) return;
      navigator.sendBeacon(
        "/api/presence",
        new Blob([JSON.stringify({ sid, uid: user?.uid || null, leaving: true })], { type: "application/json" }),
      );
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleUnload);
      presenceActive.current = false;
    };
  }, [authLoading, sendHeartbeat]);

  // Reference ceilings tuned for the typical shape of each metric.
  const items = [
    { id: "online", icon: Wifi,  value: stats.online, ref: 500,   label: t("stats.online"),  colour: "#34d399", glow: "rgba(52,211,153,0.28)",  isOnline: true  },
    { id: "devs",   icon: Code,  value: stats.devs,   ref: 200,   label: t("stats.devs"),    colour: "#a78bfa", glow: "rgba(167,139,250,0.28)" },
    { id: "users",  icon: Users, value: stats.users,  ref: 10000, label: t("stats.users"),   colour: "#38bdf8", glow: "rgba(56,189,248,0.28)"  },
    { id: "roms",   icon: Box,   value: stats.roms,   ref: 500,   label: t("stats.roms"),    colour: "#fbbf24", glow: "rgba(251,191,36,0.28)"  },
  ];

  return (
    <motion.div
      role="list"
      aria-label={t("stats.title") || "Live stats"}
      initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      // Single unified glass card containing four flex segments, separated
      // by soft vertical dividers instead of 4 individual boxes. This
      // reclaims vertical space and reads as a cohesive statistics strip.
      className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl"
      style={{
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 30px -16px rgba(0,0,0,0.65)",
      }}
    >
      {/* Ambient backdrop — layered colour wash that subtly references each
          stat's accent, giving the bar a living, multi-tinted feel. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 120% at 12% 0%, rgba(52,211,153,0.14) 0%, transparent 55%), " +
            "radial-gradient(60% 120% at 38% 100%, rgba(167,139,250,0.12) 0%, transparent 55%), " +
            "radial-gradient(60% 120% at 64% 0%, rgba(56,189,248,0.12) 0%, transparent 55%), " +
            "radial-gradient(60% 120% at 88% 100%, rgba(251,191,36,0.12) 0%, transparent 55%)",
        }}
      />

      {/* Traveling shimmer — infinite sweep across the whole bar to signal
          "live". Respects reduced-motion via the parent's motion context. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
        }}
        initial={{ x: "-120%" }}
        animate={{ x: "380%" }}
        transition={{ duration: 6, ease: "linear", repeat: Infinity, repeatDelay: 3 }}
      />

      {/* Top hairline — gives the card a crisp glass edge */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
        }}
      />

      <div className="relative flex items-stretch">
        {items.map((item, i) => (
          <div
            key={item.id}
            role="listitem"
            className={
              "group relative flex-1 px-2 py-3 sm:px-4 sm:py-4 transition-colors duration-300 " +
              (i > 0
                ? "border-s border-border/40 [border-inline-start-style:solid]"
                : "")
            }
          >
            {/* Per-segment hover glow — fades in a tinted wash behind the
                segment so hovering feels responsive without disturbing
                neighbours. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              style={{
                background: `radial-gradient(85% 120% at 50% 100%, ${item.glow} 0%, transparent 65%)`,
              }}
            />

            {/* Animated entry per-segment so the numbers cascade in */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.15 + i * 0.08 }}
              className="relative flex flex-col items-center text-center"
            >
              {/* Icon + ring gauge */}
              <div
                className="relative flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center"
                style={{ color: item.colour }}
              >
                <RingGauge value={item.value} maxReference={item.ref} colour={item.colour} />
                <item.icon
                  className="relative h-3 w-3 sm:h-4 sm:w-4 transition-transform duration-300 group-hover:scale-110"
                  style={{ filter: `drop-shadow(0 0 6px ${item.glow})` }}
                />
                {/* Live pulse dot — only on the online segment */}
                {item.isOnline && stats.online > 0 && (
                  <span className="absolute -end-0.5 -top-0.5 flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-full w-full rounded-full bg-emerald-400 ring-2 ring-emerald-400/30" />
                  </span>
                )}
              </div>

              {/* Value */}
              <div
                className="mt-1.5 text-base sm:text-[22px] font-black text-foreground tabular-nums leading-none tracking-tight"
                aria-live={item.isOnline ? "polite" : undefined}
              >
                <AnimatedNumber value={item.value} />
              </div>

              {/* Label */}
              <div className="mt-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.14em] sm:tracking-[0.18em] text-muted-foreground truncate w-full">
                {item.label}
              </div>
            </motion.div>
          </div>
        ))}
      </div>

      {/* Bottom spectrum bar — a single multi-colour accent unifying the
          four segments' identities into one gradient signature. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-70"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, #34d399 22%, #a78bfa 48%, #38bdf8 72%, #fbbf24 92%, transparent 100%)",
        }}
      />
    </motion.div>
  );
}
