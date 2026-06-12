"use client";

import { useState, useEffect } from "react";
import { Zap, Upload, Trophy, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";

interface QuickPublishBannerProps {
  userRole?: string;
  xp?: number;
  nextAchievement?: string;
}

export function QuickPublishBanner({
  userRole,
  xp = 0,
  nextAchievement,
}: QuickPublishBannerProps) {
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 200);
    return () => clearTimeout(timer);
  }, []);

  // Only show to verified developers, admins, moderators
  const isDev = userRole && ["verifiedDev", "admin", "moderator", "owner"].includes(userRole);
  if (!isDev || !visible) return null;

  // Progress calculation (simple tier system)
  const level = Math.floor(xp / 500) + 1;
  const xpInLevel = xp % 500;
  const progressPercent = (xpInLevel / 500) * 100;
  const levelTitle = level >= 10 ? "Legend" : level >= 7 ? "Expert" : level >= 4 ? "Pro" : level >= 2 ? "Rising" : "Rookie";

  return (
    <div className={cn(
      "mb-4 relative overflow-hidden rounded-2xl border transition-all duration-700",
      mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    )}
    style={{
      borderColor: "color-mix(in srgb, var(--primary) 25%, transparent)",
      background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 6%, transparent), color-mix(in srgb, #8b5cf6 4%, transparent))",
    }}>
      {/* Close */}
      <button
        onClick={() => setVisible(false)}
        className="absolute top-3 end-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-3 w-3" />
      </button>

      <div className="relative z-10 p-4 flex items-center gap-4 flex-wrap">
        {/* XP Badge */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg">
            <Trophy className="h-6 w-6 text-white" />
          </div>
          <span className="text-[10px] font-bold text-amber-400">{levelTitle}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-sm font-black text-foreground">
              {t("dev.level") || "Level"} {level}
            </span>
            <span className="text-[10px] text-muted-foreground font-semibold">
              {xp} XP
            </span>
          </div>

          {/* XP Progress bar */}
          <div className="h-1.5 w-full max-w-[200px] rounded-full bg-muted/50 mb-1.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${progressPercent}%`,
                background: "linear-gradient(90deg, var(--primary), #8b5cf6)",
              }}
            />
          </div>

          {nextAchievement && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Zap className="h-3 w-3 text-amber-400" />
              {t("dev.nextAchievement") || "Next"}: {nextAchievement}
            </p>
          )}
        </div>

        {/* Publish CTA */}
        <Link
          href="/submit"
          className="shrink-0 group inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black text-white transition-all hover:scale-105 active:scale-95"
          style={{
            background: "linear-gradient(135deg, var(--primary), #3b82f6)",
            boxShadow: "0 4px 14px color-mix(in srgb, var(--primary) 25%, transparent)",
          }}
        >
          <Upload className="h-3.5 w-3.5" />
          {t("dev.publishRom") || "Publish ROM"}
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
