"use client";

/**
 * Inline marketplace banner for the home feed.
 * Compact, two-CTA, brand-consistent. Designed to slot between
 * stats bar and the ROM list without stealing the show.
 */

import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Briefcase, Sparkles } from "lucide-react";

export function MarketplaceHomeBanner() {
  return (
    <section
      className="relative mx-3 mt-3 overflow-hidden rounded-2xl border"
      style={{
        borderColor: "color-mix(in srgb, var(--primary) 22%, transparent)",
        background:
          "radial-gradient(ellipse 70% 80% at 0% 0%, color-mix(in srgb, var(--primary) 14%, transparent), transparent 65%), " +
          "radial-gradient(ellipse 60% 70% at 100% 100%, color-mix(in srgb, #f59e0b 12%, transparent), transparent 65%), " +
          "rgb(var(--card))",
      }}
      aria-label="RomX Marketplace"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--primary), #f59e0b, transparent)",
        }}
      />
      <div className="relative flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.18em]"
            style={{ color: "var(--primary)" }}>
            <Briefcase className="h-3 w-3" />
            Marketplace
            <span className="ms-0.5 inline-flex items-center rounded-md bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-bold tracking-normal text-emerald-400">
              NEW
            </span>
          </div>
          <h3 className="text-balance text-base font-black tracking-tight text-foreground sm:text-lg">
            Hire talent. Sell skills. The Android service market is live.
          </h3>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
            Custom kernels, ROM ports, bootloader unlocks, hard-brick recoveries — direct between devs.
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Link
            href="/marketplace/new?kind=request"
            className="inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-black transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              color: "var(--primary)",
              borderColor: "color-mix(in srgb, var(--primary) 36%, transparent)",
              background: "color-mix(in srgb, var(--primary) 10%, transparent)",
            }}
          >
            <ArrowDownLeft className="h-4 w-4" />
            Post a request
          </Link>
          <Link
            href="/marketplace"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 px-3.5 py-2 text-[13px] font-black text-foreground transition-all hover:bg-muted"
          >
            Browse offers
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="relative grid grid-cols-3 gap-2 border-t border-border/40 px-4 py-2 text-[11px] sm:px-5">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Sparkles className="h-3 w-3" style={{ color: "#f59e0b" }} />
          <span className="truncate">9 categories</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <ArrowDownLeft className="h-3 w-3" style={{ color: "var(--primary)" }} />
          <span className="truncate">Open requests</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <ArrowUpRight className="h-3 w-3" style={{ color: "#f59e0b" }} />
          <span className="truncate">Verified pros</span>
        </span>
      </div>
    </section>
  );
}
