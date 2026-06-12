"use client";

import { useEffect, useState } from "react";
import { apiGetFeaturedDevelopers } from "@/lib/api/client";
import { cachedFetch } from "@/lib/cache";
import type { UserDoc } from "@/lib/types";
import { safeImg, formatCount, cn } from "@/lib/utils";
import { getLevel, DEFAULT_AVATAR } from "@/lib/constants";
import Image from "next/image";
import Link from "next/link";
import { Gem, Star, Download, Package, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { logger } from "@/lib/logger";

function DevBadge({ xp }: { xp: number }) {
  const { t } = useTranslation();
  if (xp >= 25000) return (
    <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-black text-amber-400"
      style={{ boxShadow: "0 0 8px rgba(245,158,11,0.3)" }}>
      <Gem className="h-2 w-2" /> {t("featured.legendary")}
    </span>
  );
  if (xp >= 10000) return (
    <span className="inline-flex items-center gap-0.5 rounded-full border border-purple-500/40 bg-purple-500/10 px-1.5 py-0.5 text-[9px] font-black text-purple-400">
      <Star className="h-2 w-2" /> {t("featured.expert")}
    </span>
  );
  if (xp >= 5000) return (
    <span className="inline-flex items-center gap-0.5 rounded-full border border-blue-500/40 bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-black text-blue-400">
      <Star className="h-2 w-2" /> {t("featured.pro")}
    </span>
  );
  return null;
}

export function FeaturedDevelopers({ max = 6 }: { max?: number }) {
  const { t } = useTranslation();
  const [devs, setDevs] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cachedFetch(`featured-devs:${max}`, () => apiGetFeaturedDevelopers(max), 10 * 60 * 1000)
      .then(setDevs)
      .catch((err) => logger.error("home.featuredDevelopers", err, { max }))
      .finally(() => setLoading(false));
  }, [max]);

  if (loading) return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-xl shimmer" />
        <div className="space-y-1"><div className="h-3 w-24 rounded shimmer" /><div className="h-2.5 w-16 rounded shimmer" /></div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 rounded-2xl border border-border p-3">
            <div className="h-12 w-12 rounded-2xl shimmer" />
            <div className="h-3 w-16 rounded shimmer" />
            <div className="h-2.5 w-12 rounded shimmer" />
          </div>
        ))}
      </div>
    </div>
  );

  if (devs.length === 0) return null;

  return (
    <div className="relative rounded-3xl border border-border bg-card overflow-hidden p-4">
      {/* Top glow line */}
      <div className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(29,155,240,0.25), transparent)" }} />

      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl shrink-0"
          style={{ backgroundColor: "var(--primary-dim)", border: "1px solid var(--primary)" }}>
          <Gem className="h-4 w-4" style={{ color: "var(--primary)", filter: "drop-shadow(0 0 3px rgba(29,155,240,0.28))" }} />
        </div>
        <div>
          <h2 className="text-sm font-black text-foreground">{t("featured.title")}</h2>
          <p className="text-[10px] text-muted-foreground">{t("featured.subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {devs.map((dev, idx) => {
          const level = getLevel(dev.xp);
          return (
            <Link key={dev.uid || dev.id} href={`/u/${dev.uid || dev.id}`}
              className="group relative flex flex-col items-center gap-2 rounded-2xl border border-border bg-muted/20 p-3 overflow-hidden transition-all hover:border-[var(--primary)]/40 hover:bg-muted/40 hover:scale-[1.03] hover:shadow-lg active:scale-[0.98] text-center"
              style={{ animationDelay: `${idx * 0.06}s` }}>
              {/* Hover glow */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(29,155,240,0.06) 0%, transparent 70%)" }} />

              {/* Avatar + level badge */}
              <div className="relative">
                <Image src={safeImg(dev.photo, DEFAULT_AVATAR)} alt={dev.name} width={52} height={52}
                  className="relative rounded-2xl border border-border object-cover transition-all group-hover:border-[var(--primary)]/50 group-hover:scale-105 group-hover:shadow-md" />
                <div className="absolute -bottom-1.5 -end-1.5 h-5 w-5 rounded-lg flex items-center justify-center ring-2 ring-card transition-transform group-hover:scale-110"
                  style={{ background: "linear-gradient(135deg, var(--primary), #3b82f6)", boxShadow: "0 0 5px rgba(29,155,240,0.22)" }}>
                  <span className="text-[8px] font-black text-white">{level.level}</span>
                </div>
              </div>

              <div className="relative min-w-0 w-full">
                <p className="text-xs font-black text-foreground truncate group-hover:text-[var(--primary)] transition-colors">{dev.name}</p>
                {dev.username && <p className="text-[10px] text-muted-foreground truncate font-mono">@{dev.username}</p>}
                <div className="mt-1.5 flex justify-center">
                  <DevBadge xp={dev.xp ?? 0} />
                </div>
              </div>

              <div className="relative flex items-center justify-center gap-3 w-full">
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground transition-colors group-hover:text-[var(--primary)]/70">
                  <Package className="h-2.5 w-2.5" /> {formatCount(dev.romsCount ?? 0)}
                </span>
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground transition-colors group-hover:text-emerald-400/70">
                  <Download className="h-2.5 w-2.5" /> {formatCount(dev.totalDownloads ?? 0)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
