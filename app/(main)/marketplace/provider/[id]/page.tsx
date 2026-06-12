"use client";

/**
 * Public marketplace provider profile.
 *
 * Reads from /api/marketplace/providers/[uid] which returns the provider
 * profile + their open listings. No mock data anywhere.
 */

import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Languages as LanguagesIcon,
  Loader2,
  Share2,
  Shield,
  ShieldCheck,
  Smartphone,
  Star,
  UserPlus,
} from "lucide-react";

import { ProviderAvatar } from "@/components/marketplace/provider-avatar";
import { ContactPanel } from "@/components/marketplace/contact-panel";
import { ListingCard } from "@/components/marketplace/listing-card";
import { CATEGORY_LABEL } from "@/lib/marketplace/types";
import { useProvider } from "@/lib/marketplace/hooks";
import { MarketplaceApiError } from "@/lib/marketplace/api-client";
import { toast } from "@/components/shared/toast";

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

export default function ProviderProfilePage() {
  const params = useParams<{ id: string }>();
  const { provider, listings, isLoading, error } = useProvider(params?.id);

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-6xl items-center justify-center px-3 py-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    if (error instanceof MarketplaceApiError && error.status === 404) {
      notFound();
    }
    return (
      <div className="mx-auto w-full max-w-3xl px-3 py-8">
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-6 text-sm font-bold text-destructive">
          Couldn&apos;t load this provider: {error.message}
        </div>
      </div>
    );
  }
  if (!provider) {
    notFound();
  }

  const offers = listings.filter((l) => l.kind === "offer");
  const requests = listings.filter((l) => l.kind === "request");

  const displayName = provider.isAnonymous
    ? provider.alias || "Anonymous operator"
    : provider.displayName;
  const isVerified = !!provider.verifiedAt;
  const joinedYear = provider.createdAt
    ? new Date(provider.createdAt).getFullYear()
    : null;

  const onShare = () => {
    if (typeof window === "undefined") return;
    if (navigator.share) {
      void navigator
        .share({ title: displayName, url: window.location.href })
        .catch(() => {});
    } else {
      void navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-3 pb-24 sm:px-4 sm:py-4 lg:px-6">
      <Link
        href="/marketplace"
        className="group mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
        Back to marketplace
      </Link>

      {/* Header card */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-3xl border bg-card p-5 sm:p-7"
        style={{
          borderColor: "color-mix(in srgb, var(--primary) 22%, transparent)",
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--primary) 8%, transparent) 0%, color-mix(in srgb, var(--primary) 2%, transparent) 50%, rgb(var(--card)) 100%), rgb(var(--card))",
        }}
      >
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--primary), transparent)",
          }}
        />
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-30"
          style={{
            background:
              "radial-gradient(ellipse, var(--primary) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />

        {provider.coverImage && (
          <div className="relative z-10 mb-4 aspect-[16/6] w-full overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={provider.coverImage}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-start">
          <ProviderAvatar
            name={displayName}
            avatarUrl={provider.avatarUrl}
            isAnonymous={provider.isAnonymous}
            isVerified={isVerified}
            size={88}
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-balance text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                {displayName}
              </h1>
              {isVerified && !provider.isAnonymous && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                  style={{
                    color: "var(--primary)",
                    background:
                      "color-mix(in srgb, var(--primary) 12%, transparent)",
                    border:
                      "1px solid color-mix(in srgb, var(--primary) 35%, transparent)",
                  }}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Verified
                </span>
              )}
              {provider.isAnonymous && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                  style={{
                    color: "#06b6d4",
                    background: "rgba(6,182,212,0.10)",
                    border: "1px solid rgba(6,182,212,0.35)",
                  }}
                >
                  <Shield className="h-3 w-3" />
                  Anonymous
                </span>
              )}
              {provider.isOpenForWork && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                  style={{
                    color: "#10b981",
                    background: "rgba(16,185,129,0.10)",
                    border: "1px solid rgba(16,185,129,0.30)",
                  }}
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Open for work
                </span>
              )}
            </div>

            {provider.headline && (
              <p className="mt-1 text-sm font-bold text-foreground/90">
                {provider.headline}
              </p>
            )}

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold text-muted-foreground">
              {!provider.isAnonymous && <span>@{provider.uid.slice(0, 12)}</span>}
              {joinedYear && <span>· Member since {joinedYear}</span>}
              {provider.responseTimeH != null && (
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3 w-3" />~{provider.responseTimeH}h reply
                </span>
              )}
            </div>

            {provider.bio && (
              <p className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {provider.bio}
              </p>
            )}

            {/* Stat chips */}
            <div className="mt-4 flex flex-wrap gap-2">
              <StatChip
                icon={
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                }
                value={provider.ratingAvg ? provider.ratingAvg.toFixed(2) : "—"}
                label={`${provider.ratingCount} reviews`}
              />
              <StatChip
                icon={
                  <ShieldCheck
                    className="h-3 w-3"
                    style={{ color: "#10b981" }}
                  />
                }
                value={provider.jobsCompleted.toString()}
                label="jobs done"
              />
              {provider.hourlyRate != null && (
                <StatChip
                  icon={
                    <Award className="h-3 w-3" style={{ color: "#f59e0b" }} />
                  }
                  value={formatMoney(
                    provider.hourlyRate,
                    provider.hourlyCurrency,
                  )}
                  label="per hour"
                />
              )}
              {provider.acceptsEscrow && (
                <StatChip
                  icon={
                    <Shield
                      className="h-3 w-3"
                      style={{ color: "var(--primary)" }}
                    />
                  }
                  value="Escrow"
                  label="accepted"
                />
              )}
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              {!provider.isAnonymous && (
                <Link
                  href={`/u/${provider.uid}`}
                  className="group inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black text-white shadow-md transition-all hover:scale-[1.02] active:scale-[0.97]"
                  style={{
                    background: "linear-gradient(135deg, var(--primary), #3b82f6)",
                    boxShadow: "0 6px 20px var(--primary-glow)",
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                  View RomX profile
                </Link>
              )}
              <button
                type="button"
                onClick={onShare}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2 text-sm font-black text-foreground transition-colors hover:border-[color:var(--primary)]/40"
              >
                <Share2 className="h-4 w-4" />
                Share profile
              </button>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Body grid */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* Main column */}
        <main className="flex flex-col gap-5">
          {/* Categories + skills */}
          {(provider.categories.length > 0 || provider.skills.length > 0) && (
            <section className="rounded-2xl border border-border bg-card p-5">
              {provider.categories.length > 0 && (
                <>
                  <h2 className="mb-2 text-sm font-black uppercase tracking-wider text-muted-foreground">
                    Specialties
                  </h2>
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {provider.categories.map((c) => (
                      <span
                        key={c}
                        className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-primary"
                      >
                        {CATEGORY_LABEL[c]}
                      </span>
                    ))}
                  </div>
                </>
              )}
              {provider.skills.length > 0 && (
                <>
                  <h2 className="mb-2 text-sm font-black uppercase tracking-wider text-muted-foreground">
                    Core skills
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {provider.skills.map((s) => (
                      <span
                        key={s}
                        className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs font-bold text-foreground"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {/* Devices */}
          {provider.deviceCodenames.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-muted-foreground">
                <Smartphone className="h-4 w-4" />
                Devices supported
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {provider.deviceCodenames.map((d) => (
                  <span
                    key={d}
                    className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs font-bold text-foreground"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Languages */}
          {provider.languages.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-muted-foreground">
                <LanguagesIcon className="h-4 w-4" />
                Languages
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {provider.languages.map((l) => (
                  <span
                    key={l}
                    className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs font-bold text-foreground"
                  >
                    {l}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Credentials */}
          {provider.credentials.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-muted-foreground">
                <GraduationCap className="h-4 w-4" />
                Credentials
              </h2>
              <ul className="flex flex-col gap-2">
                {provider.credentials.map((c, i) => (
                  <li
                    key={i}
                    className="flex flex-col gap-0.5 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-foreground"
                  >
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ color: "#10b981" }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold leading-snug">{c.title}</div>
                        <div className="text-[11px] font-semibold text-muted-foreground">
                          {[c.issuer, c.year].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      {c.url && (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-black text-primary hover:underline"
                        >
                          View
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Portfolio */}
          {provider.portfolio.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-muted-foreground">
                Portfolio
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {provider.portfolio.map((p, i) => (
                  <div
                    key={`${p.title}-${i}`}
                    className="group flex flex-col rounded-xl border border-border bg-muted/30 p-3 transition-colors hover:border-[color:var(--primary)]/40"
                  >
                    {p.image && (
                      <div className="mb-2 aspect-[16/9] overflow-hidden rounded-lg">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.image}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      </div>
                    )}
                    <h3 className="text-sm font-bold leading-snug text-foreground">
                      {p.title}
                    </h3>
                    {p.summary && (
                      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                        {p.summary}
                      </p>
                    )}
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-black"
                        style={{ color: "var(--primary)" }}
                      >
                        Open case study
                        <ArrowUpRight className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Listings */}
          {offers.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-muted-foreground">
                Active offers ({offers.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {offers.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            </section>
          )}

          {requests.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-muted-foreground">
                Open requests ({requests.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {requests.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            </section>
          )}
        </main>

        {/* Sidebar */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-16 lg:self-start">
          {/* Contact */}
          <section
            className="rounded-2xl border bg-card p-4"
            style={{
              borderColor:
                "color-mix(in srgb, var(--primary) 25%, transparent)",
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--primary) 5%, transparent), rgb(var(--card)))",
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                  Get in touch
                </div>
                <div className="text-sm font-black text-foreground">
                  Contact channels
                </div>
              </div>
              <Shield className="h-5 w-5" style={{ color: "var(--primary)" }} />
            </div>
            <ContactPanel
              channels={provider.contactChannels}
              preferred={provider.preferredChannel ?? null}
            />
          </section>

          {/* Trust block */}
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">
              Safety tips
            </div>
            <ul className="flex flex-col gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <li>• Verify credentials before sending devices.</li>
              <li>• Prefer escrow for jobs over $100.</li>
              <li>• Never share carrier unlock tokens in plaintext.</li>
              <li>• Keep a written scope before work begins.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatChip({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs">
      {icon}
      <span className="font-black tabular-nums text-foreground">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
        {label}
      </span>
    </div>
  );
}
