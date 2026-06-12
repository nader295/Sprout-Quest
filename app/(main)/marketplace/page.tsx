"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Briefcase,
  Loader2,
  Plus,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { ListingCard } from "@/components/marketplace/listing-card";
import { FilterBar } from "@/components/marketplace/filter-bar";
import {
  DEFAULT_FILTER,
  type Category,
  type FilterState,
  type ListingKind,
} from "@/lib/marketplace/types";
import { useListings, useMarketplaceStats } from "@/lib/marketplace/hooks";

export default function MarketplacePage() {
  const sp = useSearchParams();

  const initial: FilterState = useMemo(() => {
    const tab = sp?.get("tab");
    const kind: FilterState["kind"] =
      tab === "request" || tab === "offer" ? (tab as ListingKind) : "all";
    const cat = sp?.get("category");
    const category: FilterState["category"] = cat ? (cat as Category) : "all";
    return { ...DEFAULT_FILTER, kind, category };
  }, [sp]);

  const [filter, setFilter] = useState<FilterState>(initial);

  // sync with URL changes (e.g. command palette navigation)
  useEffect(() => {
    setFilter(initial);
  }, [initial]);

  const { listings, count, isLoading, error } = useListings({
    kind: filter.kind,
    category: filter.category,
    q: filter.query || undefined,
    sort: filter.sort,
    status: "open",
    limit: 60,
  });

  const { stats } = useMarketplaceStats();

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-24 pt-3 sm:px-5 sm:pt-5">
      <Header stats={stats} />

      <div className="mt-4">
        <FilterBar value={filter} onChange={setFilter} total={count} />
      </div>

      <div id="listings" className="mt-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <ErrorState message={error.message} />
        ) : listings.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function Header({
  stats,
}: {
  stats: ReturnType<typeof useMarketplaceStats>["stats"];
}) {
  return (
    <section
      className="relative overflow-hidden rounded-3xl border p-5 sm:p-7"
      style={{
        borderColor: "color-mix(in srgb, var(--primary) 22%, transparent)",
        background:
          "radial-gradient(ellipse 70% 90% at 0% 0%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 65%)," +
          "radial-gradient(ellipse 60% 70% at 100% 100%, color-mix(in srgb, #f59e0b 12%, transparent), transparent 65%)," +
          "rgb(var(--card))",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--primary), #f59e0b, transparent)",
        }}
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]"
            style={{ color: "var(--primary)" }}
          >
            <Briefcase className="h-3 w-3" /> Marketplace
          </span>
          <h1 className="mt-2 text-balance text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Hire talent. Sell skills.
          </h1>
          <p className="mt-1 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
            Custom kernels, ROM ports, bootloader unlocks, hard-brick recoveries
            — direct between developers and the people who need them.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/marketplace/new?kind=request"
            className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-black uppercase tracking-wider transition hover:scale-[1.02] active:scale-[0.98]"
            style={{
              color: "var(--primary)",
              borderColor: "color-mix(in srgb, var(--primary) 40%, transparent)",
              background: "color-mix(in srgb, var(--primary) 10%, transparent)",
            }}
          >
            <ArrowDownLeft className="h-4 w-4" />
            Post a request
          </Link>
          <Link
            href="/marketplace/new?kind=offer"
            className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-black uppercase tracking-wider transition hover:scale-[1.02] active:scale-[0.98]"
            style={{
              color: "#f59e0b",
              borderColor: "rgba(245,158,11,0.40)",
              background: "rgba(245,158,11,0.10)",
            }}
          >
            <ArrowUpRight className="h-4 w-4" />
            Post an offer
          </Link>
        </div>
      </div>

      {stats && (
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="Open requests"
            value={stats.openRequests}
            color="var(--primary)"
            Icon={ArrowDownLeft}
          />
          <Stat
            label="Open offers"
            value={stats.openOffers}
            color="#f59e0b"
            Icon={ArrowUpRight}
          />
          <Stat
            label="Providers"
            value={stats.providers}
            color="#10b981"
            Icon={Sparkles}
          />
          <Stat
            label="Completed"
            value={stats.completed}
            color="#06b6d4"
            Icon={TrendingUp}
          />
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  color,
  Icon,
}: {
  label: string;
  value: number;
  color: string;
  Icon: React.ElementType;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/50 p-2.5"
      style={{ boxShadow: "var(--card-shadow)" }}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-base font-black tabular-nums text-foreground">
          {value.toLocaleString()}
        </div>
        <div className="truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ filter }: { filter: FilterState }) {
  const isRequestView = filter.kind === "request";
  const isOfferView = filter.kind === "offer";
  const ctaKind = isOfferView ? "offer" : "request";
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          background: "color-mix(in srgb, var(--primary) 12%, transparent)",
          color: "var(--primary)",
        }}
      >
        <Briefcase className="h-7 w-7" />
      </div>
      <div>
        <h3 className="text-lg font-black tracking-tight text-foreground">
          {isRequestView
            ? "No open requests yet"
            : isOfferView
            ? "No offers published yet"
            : "Nothing matches that filter"}
        </h3>
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {isOfferView
            ? "Be the first to advertise your services and reach the whole RomX community."
            : "Be the first to post a request — developers are watching this feed."}
        </p>
      </div>
      <Link
        href={`/marketplace/new?kind=${ctaKind}`}
        className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-black uppercase tracking-wider transition hover:scale-[1.02]"
        style={{
          color: "var(--primary)",
          borderColor: "color-mix(in srgb, var(--primary) 40%, transparent)",
          background: "color-mix(in srgb, var(--primary) 10%, transparent)",
        }}
      >
        <Plus className="h-4 w-4" />
        Post {ctaKind === "offer" ? "an offer" : "a request"}
      </Link>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-6 text-sm font-bold text-destructive">
      Couldn&apos;t load the marketplace: {message}
    </div>
  );
}
