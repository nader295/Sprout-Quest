"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGetAdSupportStats } from "@/lib/api/client";
import { formatCount } from "@/lib/utils";
import { DollarSign, Loader2, TrendingUp, Tv } from "lucide-react";
import { logger } from "@/lib/logger";

export function OwnerMonetizationStats() {
  const [stats, setStats] = useState<{
    totalPlatformAdSupports: number;
    totalPlatformRevenue: number;
    topEarners: { uid: string; name: string; totalAdSupports: number; earnings: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGetAdSupportStats()
      .then(setStats)
      .catch((err) => logger.error("owner.monetizationStats.load", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!stats) return null;

  return (
    <div className="rounded-2xl border border-[var(--primary)]/30 bg-[var(--primary-dim)] overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at top right, var(--primary-glow), transparent 70%)" }} />
      <div className="relative z-10 p-5 sm:p-6 border-b border-[var(--primary)]/20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center bg-[rgba(var(--primary-rgb),0.15)] ring-1 ring-[var(--primary)]/30">
              <DollarSign className="h-4 w-4 text-[var(--primary)]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Platform Financials</h3>
              <p className="text-[10px] text-muted-foreground">Ad revenue & earnings overview</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl bg-black/20 border border-white/5 p-4 flex flex-col justify-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1.5"><Tv className="h-3 w-3" /> Total Ad Impressions</p>
            <p className="text-3xl font-black text-foreground">{formatCount(stats.totalPlatformAdSupports ?? 0)}</p>
          </div>
          <div className="rounded-xl bg-[rgba(var(--primary-rgb),0.05)] border border-[var(--primary)]/20 p-4 flex flex-col justify-center hover:bg-[rgba(var(--primary-rgb),0.1)] transition-colors">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--primary)] mb-1 flex items-center gap-1.5"><DollarSign className="h-3 w-3" /> Platform Revenue (10%)</p>
            <p className="text-3xl font-black text-[var(--primary)]">${(stats.totalPlatformRevenue ?? 0).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {stats.topEarners?.length > 0 && (
        <div className="relative z-10 p-5 sm:p-6 bg-black/20">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Top Earning Developers</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {stats.topEarners.map((dev, i) => (
              <div key={dev.uid} className="flex items-center justify-between rounded-xl bg-card/40 backdrop-blur-sm p-3 border border-white/5 hover:border-[var(--primary)]/30 hover:bg-card/60 transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-6 w-6 rounded-full bg-black/40 flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0 border border-white/5">
                    #{i + 1}
                  </div>
                  <div className="min-w-0">
                    <Link href={`/u/${dev.uid}`} className="text-xs font-bold hover:text-[var(--primary)] text-foreground block truncate transition-colors">{dev.name}</Link>
                    <p className="text-[10px] text-muted-foreground">{formatCount(dev.totalAdSupports)} ad views</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono text-sm font-black text-[var(--primary)]">${(dev.earnings ?? 0).toFixed(2)}</span>
                  <p className="text-[9px] text-muted-foreground uppercase pt-0.5">Revenue</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
