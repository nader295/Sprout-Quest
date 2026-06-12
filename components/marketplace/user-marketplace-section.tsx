"use client";

/**
 * Compact marketplace section for the user profile page (/u/[uid]).
 *
 * Renders a summary card showing:
 *   - The user's provider profile (headline, rate, badges) — if they have one.
 *   - Up to 4 of their open listings (mix of requests + offers).
 *   - CTAs: view all on the marketplace, or (for the owner) create one.
 *
 * The section auto-hides when:
 *   - The viewer is NOT the owner AND the user has no provider profile and no listings.
 *
 * For the owner specifically, we always render — when empty, we show a
 * marketing/onboarding CTA so they discover the marketplace.
 */

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Plus,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";

import { useListings, useProvider } from "@/lib/marketplace/hooks";
import { MarketplaceApiError } from "@/lib/marketplace/api-client";
import { CATEGORY_LABEL } from "@/lib/marketplace/types";
import { KindPill, StatusPill } from "@/components/marketplace/status-pill";

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function formatBudget(
  min: number | null,
  max: number | null,
  currency: string,
) {
  if (min != null && max != null && min !== max) {
    return `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
  }
  if (max != null) return formatMoney(max, currency);
  if (min != null) return formatMoney(min, currency);
  return "Open";
}

interface UserMarketplaceSectionProps {
  uid: string;
  isOwner: boolean;
}

export function UserMarketplaceSection({
  uid,
  isOwner,
}: UserMarketplaceSectionProps) {
  // Fetch listings (open + in_progress only, public-friendly).
  const { listings, count, isLoading: listingsLoading } = useListings({
    ownerUid: uid,
    limit: 4,
    status: "open",
  });

  // Fetch provider profile — 404 is expected for non-providers.
  const { provider, error: providerError } = useProvider(uid);

  const hasProvider =
    !!provider &&
    !(providerError instanceof MarketplaceApiError && providerError.status === 404);

  const visibleListings = useMemo(() => listings.slice(0, 4), [listings]);
  const hasListings = visibleListings.length > 0;
  const showSection = isOwner || hasProvider || hasListings;

  if (!showSection || listingsLoading) {
    // Skip rendering entirely when there's nothing to show. We don't render a
    // skeleton because the host profile page already shows its own loader.
    if (!isOwner && !hasProvider && !hasListings) return null;
    if (listingsLoading && !isOwner && !hasProvider) return null;
  }

  const requestCount = visibleListings.filter((l) => l.kind === "request").length;
  const offerCount = visibleListings.filter((l) => l.kind === "offer").length;

  return (
    <section
      className="relative mt-4 overflow-hidden rounded-3xl border bg-card p-4 sm:p-5"
      style={{
        borderColor: "color-mix(in srgb, var(--primary) 22%, transparent)",
        background:
          "radial-gradient(ellipse 80% 60% at 0% 0%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 60%)," +
          "radial-gradient(ellipse 60% 70% at 100% 100%, color-mix(in srgb, #f59e0b 8%, transparent), transparent 60%)," +
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

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl border"
            style={{
              color: "var(--primary)",
              borderColor: "color-mix(in srgb, var(--primary) 35%, transparent)",
              background: "color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          >
            <Briefcase className="h-4 w-4" />
          </span>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">
              Marketplace
            </div>
            <div className="text-sm font-black tracking-tight text-foreground">
              {hasProvider ? "Provider profile" : "Activity"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasProvider && (
            <Link
              href={`/marketplace/provider/${uid}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground transition-colors hover:border-[color:var(--primary)]/40 hover:text-foreground"
            >
              View profile
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
          {isOwner && (
            <Link
              href="/marketplace/new"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-sm transition-all hover:scale-[1.03] active:scale-[0.97]"
              style={{
                background:
                  "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 70%, #000))",
                boxShadow: "0 4px 14px var(--primary-glow)",
              }}
            >
              <Plus className="h-3 w-3" />
              New listing
            </Link>
          )}
        </div>
      </div>

      {/* Provider strip (only when provider exists) */}
      {hasProvider && provider && (
        <div className="mt-3 grid gap-2 rounded-2xl border border-border/70 bg-card/40 p-3 sm:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            {provider.headline ? (
              <p className="line-clamp-2 text-sm font-bold leading-snug text-foreground">
                {provider.headline}
              </p>
            ) : (
              <p className="text-sm font-bold text-muted-foreground">
                Provider on the RomX marketplace
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {provider.isOpenForWork && (
                <Pill color="#10b981" icon={<Sparkles className="h-3 w-3" />}>
                  Open for work
                </Pill>
              )}
              {provider.acceptsEscrow && (
                <Pill color="var(--primary)" icon={<Shield className="h-3 w-3" />}>
                  Escrow
                </Pill>
              )}
              {provider.verifiedAt && (
                <Pill color="var(--primary)" icon={<ShieldCheck className="h-3 w-3" />}>
                  Verified
                </Pill>
              )}
              {provider.ratingCount > 0 && (
                <Pill
                  color="#f59e0b"
                  icon={<Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                >
                  {provider.ratingAvg.toFixed(2)} · {provider.ratingCount}
                </Pill>
              )}
            </div>
            {provider.categories.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {provider.categories.slice(0, 4).map((c) => (
                  <span
                    key={c}
                    className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    {CATEGORY_LABEL[c]}
                  </span>
                ))}
                {provider.categories.length > 4 && (
                  <span className="text-[10px] font-semibold text-muted-foreground/70">
                    +{provider.categories.length - 4}
                  </span>
                )}
              </div>
            )}
          </div>
          {provider.hourlyRate != null && (
            <div className="flex items-end justify-end sm:flex-col sm:items-end sm:justify-center">
              <div className="text-right">
                <div className="text-lg font-black tabular-nums text-foreground">
                  {formatMoney(provider.hourlyRate, provider.hourlyCurrency)}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  per hour
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Listings */}
      {hasListings && (
        <div className="mt-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">
            Active listings
            <span className="rounded-full border border-border bg-muted/40 px-1.5 py-0 text-[9px] tabular-nums">
              {count}
            </span>
            {requestCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0 text-[9px] text-primary">
                <ArrowDownLeft className="h-2.5 w-2.5" /> {requestCount}
              </span>
            )}
            {offerCount > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[9px]"
                style={{
                  color: "#f59e0b",
                  borderColor: "rgba(245,158,11,0.30)",
                  background: "rgba(245,158,11,0.08)",
                }}
              >
                <ArrowUpRight className="h-2.5 w-2.5" /> {offerCount}
              </span>
            )}
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {visibleListings.map((l) => {
              const isRequest = l.kind === "request";
              const accent = isRequest ? "var(--primary)" : "#f59e0b";
              return (
                <li key={l.id}>
                  <Link
                    href={`/marketplace/${l.id}`}
                    className="group flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-3 transition-all hover:-translate-y-0.5"
                    style={{
                      boxShadow: "var(--card-shadow)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <KindPill kind={l.kind} size="xs" />
                      <StatusPill status={l.status} />
                    </div>
                    <p className="line-clamp-2 text-[13px] font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-[color:var(--link-hover)]" style={{ ["--link-hover" as never]: accent }}>
                      {l.title}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-2 text-[10px] font-bold text-muted-foreground">
                      <span className="truncate">
                        {CATEGORY_LABEL[l.category]}
                        {l.deviceLabel ? ` · ${l.deviceLabel}` : ""}
                      </span>
                      {(l.budgetMin != null || l.budgetMax != null) && (
                        <span
                          className="shrink-0 tabular-nums font-black"
                          style={{ color: accent }}
                        >
                          {formatBudget(l.budgetMin, l.budgetMax, l.currency)}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          {count > visibleListings.length && (
            <Link
              href={`/marketplace?ownerUid=${encodeURIComponent(uid)}`}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-black text-primary hover:underline"
            >
              See all {count} listings <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}

      {/* Empty owner CTA */}
      {!hasProvider && !hasListings && isOwner && !listingsLoading && (
        <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-center">
          <p className="text-sm font-bold text-foreground">
            Hire talent or sell your services on the marketplace.
          </p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Post a request when you need a kernel, ROM port, or repair — or list
            your services so clients can find you directly.
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/marketplace/new?kind=request"
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black uppercase tracking-wider transition hover:scale-[1.03]"
              style={{
                color: "var(--primary)",
                borderColor: "color-mix(in srgb, var(--primary) 40%, transparent)",
                background: "color-mix(in srgb, var(--primary) 10%, transparent)",
              }}
            >
              <ArrowDownLeft className="h-3.5 w-3.5" />
              Post a request
            </Link>
            <Link
              href="/marketplace/new?kind=offer"
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black uppercase tracking-wider transition hover:scale-[1.03]"
              style={{
                color: "#f59e0b",
                borderColor: "rgba(245,158,11,0.40)",
                background: "rgba(245,158,11,0.10)",
              }}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Post an offer
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

function Pill({
  color,
  icon,
  children,
}: {
  color: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      {icon}
      {children}
    </span>
  );
}
