"use client";

/**
 * PageHero — reusable holographic banner for discovery pages.
 * Usage: <PageHero icon={Compass} title="Explore" description="..." accent="#1d9bf0" />
 */

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export interface PageHeroStat {
  label: string;
  value: string | number;
  icon?: LucideIcon;
}

export interface PageHeroProps {
  icon?: LucideIcon;
  eyebrow?: string;       // small caps text above title (e.g. "Discover")
  title: string;
  description?: string;
  accent?: string;        // hex color, defaults to var(--primary)
  stats?: PageHeroStat[];
  actions?: ReactNode;    // buttons on the right
  badge?: ReactNode;      // small badge (e.g. "NEW")
  className?: string;
  compact?: boolean;      // smaller variant
}

export default function PageHero({
  icon: Icon,
  eyebrow,
  title,
  description,
  accent,
  stats,
  actions,
  badge,
  className,
  compact = false,
}: PageHeroProps) {
  const accentColor = accent || "var(--primary)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(
        "relative overflow-hidden rounded-3xl border bg-card shadow-xl",
        compact ? "p-4 sm:p-5" : "p-5 sm:p-7",
        className,
      )}
      style={{
        borderColor: `color-mix(in srgb, ${accentColor} 22%, transparent)`,
        background: `
          linear-gradient(135deg,
            color-mix(in srgb, ${accentColor} 7%, transparent) 0%,
            color-mix(in srgb, ${accentColor} 2%, transparent) 50%,
            rgb(var(--card)) 100%),
          rgb(var(--card))
        `,
      }}
    >
      {/* Cyber corner ticks */}
      <span className="pointer-events-none absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 rounded-tl-3xl"
        style={{ borderColor: `color-mix(in srgb, ${accentColor} 55%, transparent)` }} />
      <span className="pointer-events-none absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 rounded-tr-3xl"
        style={{ borderColor: `color-mix(in srgb, ${accentColor} 55%, transparent)` }} />
      <span className="pointer-events-none absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 rounded-bl-3xl"
        style={{ borderColor: `color-mix(in srgb, ${accentColor} 35%, transparent)` }} />
      <span className="pointer-events-none absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 rounded-br-3xl"
        style={{ borderColor: `color-mix(in srgb, ${accentColor} 35%, transparent)` }} />

      {/* Animated scan line */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${accentColor} 50%, transparent 100%)`,
          animation: "holo-scan 5s ease-in-out infinite",
        }} />

      {/* Holographic grid background */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(${accentColor} 1px, transparent 1px), linear-gradient(90deg, ${accentColor} 1px, transparent 1px)`,
          backgroundSize: "36px 36px",
          maskImage: "radial-gradient(ellipse at center, black 0%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 0%, transparent 70%)",
        }} />

      {/* Radial glow top-right */}
      <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 rounded-full opacity-30"
        style={{
          background: `radial-gradient(ellipse, ${accentColor} 0%, transparent 70%)`,
          filter: "blur(50px)",
        }} />

      {/* Content */}
      <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
          {Icon && (
            <div
              className="ring-conic levitate-slow shrink-0 flex items-center justify-center rounded-2xl border backdrop-blur-sm relative"
              style={{
                width: compact ? 44 : 56,
                height: compact ? 44 : 56,
                background: `color-mix(in srgb, ${accentColor} 14%, transparent)`,
                borderColor: `color-mix(in srgb, ${accentColor} 40%, transparent)`,
                boxShadow: `0 8px 24px -8px ${accentColor}55, inset 0 1px 0 color-mix(in srgb, ${accentColor} 30%, transparent)`,
                // @ts-expect-error CSS var for ring-conic color
                "--primary": accentColor,
              }}
            >
              <Icon
                className={compact ? "h-5 w-5" : "h-6 w-6"}
                style={{ color: accentColor, filter: `drop-shadow(0 0 8px ${accentColor}99)` }}
              />
              {/* Inner scan pulse */}
              <span className="pointer-events-none absolute inset-x-2 top-0.5 h-px opacity-60"
                style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />
              {/* Orbiting dot */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  animation: "holo-border-rotate 4.5s linear infinite",
                }}
              >
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full -translate-y-[3px]"
                  style={{
                    background: accentColor,
                    boxShadow: `0 0 8px ${accentColor}, 0 0 16px ${accentColor}`,
                  }}
                />
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            {(eyebrow || badge) && (
              <div className="mb-1 flex items-center gap-2 flex-wrap">
                {eyebrow && (
                  <span className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: accentColor }}>
                    {eyebrow}
                  </span>
                )}
                {badge}
              </div>
            )}
            <h1 className={cn(
              "font-black tracking-tight text-foreground leading-[1.05]",
              compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl md:text-4xl",
            )}>
              {title}
            </h1>
            {description && (
              <p className={cn(
                "mt-2 text-muted-foreground leading-relaxed max-w-2xl",
                compact ? "text-xs sm:text-sm" : "text-sm sm:text-base",
              )}>
                {description}
              </p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-2 flex-wrap">{actions}</div>
        )}
      </div>

      {/* Stats chips row */}
      {stats && stats.length > 0 && (
        <div className="relative z-10 mt-4 flex items-center gap-2 flex-wrap">
          {stats.map((stat, idx) => {
            const StatIcon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 + idx * 0.05 }}
                className="magnet-hover shine-sweep flex items-center gap-2 rounded-full border px-3 py-1.5 backdrop-blur-sm"
                style={{
                  borderColor: `color-mix(in srgb, ${accentColor} 25%, transparent)`,
                  background: `color-mix(in srgb, ${accentColor} 6%, transparent)`,
                }}
              >
                {StatIcon && <StatIcon className="h-3 w-3" style={{ color: accentColor }} />}
                <span className="text-sm font-black tabular-nums text-foreground">{stat.value}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  {stat.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
