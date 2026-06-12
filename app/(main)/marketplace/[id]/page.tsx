"use client";

/**
 * Marketplace listing detail page.
 *
 * 100% live data via /api/marketplace/listings/[id] + /proposals.
 * No mock data. The page handles three viewer roles:
 *   1. Owner             — sees all incoming proposals + can edit/close.
 *   2. Authenticated     — can send a proposal (or update their existing one).
 *   3. Anonymous browser — can only read + click contact channels.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, notFound, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  Flag,
  Loader2,
  MessageSquare,
  Pencil,
  Send,
  Share2,
  Shield,
  Smartphone,
  Tag,
  Trash2,
  TrendingUp,
  XCircle,
} from "lucide-react";

import {
  KindPill,
  StatusPill,
  UrgencyPill,
} from "@/components/marketplace/status-pill";
import { ProviderAvatar } from "@/components/marketplace/provider-avatar";
import { ContactPanel } from "@/components/marketplace/contact-panel";
import { ListingCard } from "@/components/marketplace/listing-card";
import { CATEGORY_LABEL } from "@/lib/marketplace/types";
import {
  useListing,
  useListings,
  useProposals,
  invalidateMarketplace,
} from "@/lib/marketplace/hooks";
import {
  deleteListing,
  sendProposal,
  updateListing,
  MarketplaceApiError,
} from "@/lib/marketplace/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { toast } from "@/components/shared/toast";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = (Date.now() - +new Date(iso)) / 1000;
  if (Number.isNaN(diff)) return "";
  if (diff < 60)     return "just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

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
  fallback: string,
) {
  if (min != null && max != null && min !== max) {
    return `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
  }
  if (max != null) return formatMoney(max, currency);
  if (min != null) return formatMoney(min, currency);
  return fallback;
}

// ── Page ──────────────────────────────────────────────────────────
export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoggedIn } = useAuth();

  const { listing, isLoading, error, mutate } = useListing(params?.id);

  // Related listings from the same owner (best-effort).
  const { listings: ownerListings } = useListings({
    ownerUid: listing && !listing.isAnonymous ? listing.ownerUid : undefined,
    status: "open",
    limit: 6,
  });
  const related = useMemo(
    () =>
      ownerListings
        .filter((l) => listing && l.id !== listing.id)
        .slice(0, 3),
    [ownerListings, listing],
  );

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
          Couldn&apos;t load this listing: {error.message}
        </div>
      </div>
    );
  }

  if (!listing) {
    notFound();
  }

  const isRequest = listing.kind === "request";
  const accent = isRequest ? "var(--primary)" : "#f59e0b";
  const isOwner = !!user && !listing.isAnonymous && user.uid === listing.ownerUid;
  const ownerLabel = listing.isAnonymous
    ? "Anonymous operator"
    : listing.ownerName || "Member";
  const providerHref = listing.isAnonymous
    ? "#"
    : `/marketplace/provider/${listing.ownerUid}`;

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-3 pb-24 sm:px-4 sm:py-4 lg:px-6">
      {/* Back */}
      <Link
        href="/marketplace"
        className="group mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
        Back to marketplace
      </Link>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* Main column */}
        <main className="flex flex-col gap-5">
          {/* Hero */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="relative overflow-hidden rounded-3xl border bg-card p-5 sm:p-7"
            style={{
              borderColor: `color-mix(in srgb, ${accent} 25%, transparent)`,
              background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 8%, transparent) 0%, color-mix(in srgb, ${accent} 2%, transparent) 50%, rgb(var(--card)) 100%), rgb(var(--card))`,
            }}
          >
            <span
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{
                background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
              }}
            />
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-30"
              style={{
                background: `radial-gradient(ellipse, ${accent} 0%, transparent 70%)`,
                filter: "blur(60px)",
              }}
            />

            {listing.coverImage && (
              <div className="relative z-10 mb-4 aspect-[16/8] w-full overflow-hidden rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={listing.coverImage}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div className="relative z-10 flex flex-wrap items-center gap-2">
              <KindPill kind={listing.kind} size="md" />
              <StatusPill status={listing.status} />
              <UrgencyPill urgency={listing.urgency} />
            </div>

            <h1 className="relative z-10 mt-4 text-balance text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              {listing.title}
            </h1>

            <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <Tag className="h-3 w-3" />
                {CATEGORY_LABEL[listing.category]}
              </span>
              {listing.deviceLabel && (
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                  <Smartphone className="h-3 w-3" />
                  {listing.deviceLabel}
                </span>
              )}
              {listing.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-border/60 bg-transparent px-2 py-0.5 text-[10px] font-semibold text-muted-foreground/80"
                >
                  #{t}
                </span>
              ))}
            </div>

            <div className="relative z-10 mt-5 flex flex-wrap items-end gap-4">
              {(listing.budgetMin != null || listing.budgetMax != null) && (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    {isRequest
                      ? "Budget range"
                      : listing.isNegotiable
                      ? "Starting at"
                      : "Fixed price"}
                  </div>
                  <div
                    className="text-3xl font-black tabular-nums"
                    style={{ color: accent }}
                  >
                    {formatBudget(
                      listing.budgetMin,
                      listing.budgetMax,
                      listing.currency,
                      "Open",
                    )}
                  </div>
                  {listing.isNegotiable && (
                    <div className="text-[10px] font-bold text-muted-foreground">
                      negotiable
                    </div>
                  )}
                </div>
              )}
              <div className="ml-auto flex items-center gap-4 text-[11px] font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {timeAgo(listing.updatedAt)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {listing.views.toLocaleString()}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {listing.proposalsCount}
                </span>
              </div>
            </div>
          </motion.section>

          {/* Description */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-2 text-sm font-black uppercase tracking-wider text-muted-foreground">
              {isRequest ? "What's needed" : "Service description"}
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
              {listing.body}
            </p>
          </section>

          {/* Owner panel: edit + proposals received */}
          {isOwner && (
            <OwnerToolbar
              listingId={listing.id}
              status={listing.status}
              onChange={() => mutate()}
              onDelete={async () => {
                if (!confirm("Delete this listing? This cannot be undone.")) return;
                try {
                  await deleteListing(listing.id);
                  await invalidateMarketplace();
                  toast.success("Listing deleted");
                  router.push("/marketplace");
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Failed to delete",
                  );
                }
              }}
            />
          )}

          {isOwner ? (
            <OwnerProposalsList listingId={listing.id} />
          ) : isLoggedIn ? (
            <SendProposalCard
              listingId={listing.id}
              defaultCurrency={listing.currency}
              accent={accent}
              isOpen={listing.status === "open"}
            />
          ) : (
            <SignInPrompt accent={accent} />
          )}

          {/* Related from this provider */}
          {related.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-muted-foreground">
                More from {ownerLabel}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            </section>
          )}

          {/* Trust strip */}
          <section className="grid gap-3 sm:grid-cols-3">
            <TrustStat
              icon={<Shield className="h-4 w-4" style={{ color: "#10b981" }} />}
              label="Direct contact"
              value="Off-platform"
            />
            <TrustStat
              icon={
                <TrendingUp
                  className="h-4 w-4"
                  style={{ color: "var(--primary)" }}
                />
              }
              label="Views"
              value={listing.views.toLocaleString()}
            />
            <TrustStat
              icon={
                <MessageSquare
                  className="h-4 w-4"
                  style={{ color: "#06b6d4" }}
                />
              }
              label={isRequest ? "Proposals" : "Inquiries"}
              value={listing.proposalsCount.toString()}
            />
          </section>
        </main>

        {/* Sidebar */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-16 lg:self-start">
          {/* Owner card */}
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">
              {isRequest ? "Posted by" : "Offered by"}
            </div>
            <Link href={providerHref} className="flex items-center gap-3">
              <ProviderAvatar
                name={ownerLabel}
                avatarUrl={listing.ownerAvatar}
                isAnonymous={listing.isAnonymous}
                size={56}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-foreground">
                  {ownerLabel}
                </div>
                {!listing.isAnonymous && (
                  <div className="truncate text-[11px] text-muted-foreground">
                    {listing.ownerRole &&
                    listing.ownerRole !== "user"
                      ? listing.ownerRole
                      : "Member"}
                  </div>
                )}
                <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                  View profile
                  <ArrowRight className="h-3 w-3" />
                </div>
              </div>
            </Link>
          </section>

          {/* Contact channels */}
          <section
            className="rounded-2xl border bg-card p-4"
            style={{
              borderColor: `color-mix(in srgb, ${accent} 25%, transparent)`,
              background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 6%, transparent), rgb(var(--card)))`,
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                  Contact directly
                </div>
                <div className="text-sm font-black text-foreground">
                  {isRequest ? "Propose a solution" : "Start a conversation"}
                </div>
              </div>
              <Shield className="h-5 w-5" style={{ color: accent }} aria-hidden />
            </div>
            <ContactPanel
              channels={listing.contactChannels}
              preferred={listing.preferredChannel ?? null}
            />
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
              RomX never brokers payments. Always agree on terms in writing and
              prefer escrow for jobs above $100.
            </p>
          </section>

          {/* Quick actions */}
          <section className="grid grid-cols-3 gap-2">
            <ActionBtn
              icon={<Share2 className="h-4 w-4" />}
              label="Share"
              onClick={() => {
                if (typeof window === "undefined") return;
                if (navigator.share) {
                  void navigator.share({
                    title: listing.title,
                    url: window.location.href,
                  }).catch(() => {});
                } else {
                  void navigator.clipboard.writeText(window.location.href);
                  toast.success("Link copied");
                }
              }}
            />
            <ActionBtn icon={<Flag className="h-4 w-4" />} label="Report" />
            {isOwner && (
              <ActionBtn
                icon={<Pencil className="h-4 w-4" />}
                label="Edit"
                onClick={() => {
                  toast.info("Inline edit coming soon");
                }}
              />
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

// ── Owner sub-components ──────────────────────────────────────────
function OwnerToolbar({
  listingId,
  status,
  onChange,
  onDelete,
}: {
  listingId: string;
  status: string;
  onChange: () => void;
  onDelete: () => void;
}) {
  const [busy, setBusy] = useState<"close" | "reopen" | "in_progress" | null>(
    null,
  );

  const setStatus = async (
    next: "open" | "in_progress" | "closed",
    key: "close" | "reopen" | "in_progress",
  ) => {
    setBusy(key);
    try {
      await updateListing(listingId, { status: next });
      await invalidateMarketplace();
      onChange();
      toast.success("Listing updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-3">
      <span className="mr-1 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-primary">
        <Shield className="h-3.5 w-3.5" />
        You own this listing
      </span>
      {status === "open" && (
        <button
          type="button"
          onClick={() => setStatus("in_progress", "in_progress")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-amber-500 transition hover:bg-amber-400/20 disabled:opacity-60"
        >
          {busy === "in_progress" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Loader2 className="h-3 w-3" />
          )}
          Mark in progress
        </button>
      )}
      {status === "open" || status === "in_progress" ? (
        <button
          type="button"
          onClick={() => setStatus("closed", "close")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-muted-foreground transition hover:text-foreground disabled:opacity-60"
        >
          {busy === "close" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          Close
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setStatus("open", "reopen")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-500 transition hover:bg-emerald-400/20 disabled:opacity-60"
        >
          {busy === "reopen" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3 w-3" />
          )}
          Reopen
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-destructive/35 bg-destructive/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-destructive transition hover:bg-destructive/20"
      >
        <Trash2 className="h-3 w-3" />
        Delete
      </button>
    </section>
  );
}

function OwnerProposalsList({ listingId }: { listingId: string }) {
  const { proposals, isLoading, error } = useProposals(listingId);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
          Proposals received
        </h2>
        <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-black tabular-nums text-muted-foreground">
          {proposals.length}
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-bold text-destructive">
          {error.message}
        </div>
      ) : proposals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-[12px] font-semibold text-muted-foreground">
          No proposals yet — share your listing to get more eyes on it.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {proposals.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-muted/20 p-3"
            >
              <div className="flex items-center gap-2">
                <ProviderAvatar
                  name={p.senderName}
                  avatarUrl={p.senderAvatar}
                  size={36}
                  showRing={false}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/u/${p.senderUid}`}
                    className="truncate text-sm font-bold text-foreground hover:underline"
                  >
                    {p.senderName}
                  </Link>
                  <div className="text-[10px] text-muted-foreground">
                    {timeAgo(p.createdAt)}
                  </div>
                </div>
                {p.price != null && (
                  <div className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-black tabular-nums text-primary">
                    {formatMoney(p.price, p.currency)}
                  </div>
                )}
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {p.message}
              </p>
              {p.deliveryDays != null && (
                <div className="text-[11px] font-bold text-muted-foreground">
                  Delivery: ~{p.deliveryDays} day{p.deliveryDays === 1 ? "" : "s"}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Visitor sub-components ────────────────────────────────────────
function SendProposalCard({
  listingId,
  defaultCurrency,
  accent,
  isOpen,
}: {
  listingId: string;
  defaultCurrency: string;
  accent: string;
  isOpen: boolean;
}) {
  const [message, setMessage] = useState("");
  const [price, setPrice] = useState<string>("");
  const [days, setDays] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const canSubmit = message.trim().length >= 20 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await sendProposal(listingId, {
        message: message.trim(),
        price: price ? Number(price) : null,
        currency: defaultCurrency,
        deliveryDays: days ? Number(days) : null,
      });
      await invalidateMarketplace();
      setSent(true);
      toast.success("Proposal sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <section className="rounded-2xl border border-border bg-muted/20 p-5 text-center text-[12px] font-bold text-muted-foreground">
        This listing is no longer accepting proposals.
      </section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border bg-card p-5"
      style={{
        borderColor: `color-mix(in srgb, ${accent} 25%, transparent)`,
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div
            className="text-[10px] font-black uppercase tracking-[0.22em]"
            style={{ color: accent }}
          >
            Send a proposal
          </div>
          <h2 className="mt-1 text-sm font-black tracking-tight text-foreground">
            Pitch directly to the poster
          </h2>
        </div>
        <Send className="h-5 w-5" style={{ color: accent }} aria-hidden />
      </div>

      <AnimatePresence mode="wait">
        {sent ? (
          <motion.div
            key="sent"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm font-bold text-emerald-600 dark:text-emerald-400"
          >
            <CheckCircle2 className="h-4 w-4" />
            Your proposal was sent. Sending again will replace your previous one.
            <button
              type="button"
              onClick={() => setSent(false)}
              className="ml-auto rounded-md border border-emerald-400/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider transition hover:bg-emerald-400/20"
            >
              Edit
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3"
          >
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 4000))}
              rows={4}
              placeholder="Share your relevant experience, deliverables, and turnaround. Min 20 characters."
              className="w-full resize-y rounded-xl border border-border bg-muted/40 p-3 text-sm leading-relaxed text-foreground outline-none transition-colors focus:border-[color:var(--primary)]/60"
              required
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex h-11 overflow-hidden rounded-xl border border-border bg-muted/40 focus-within:border-[color:var(--primary)]/60">
                <input
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Your price"
                  className="h-full flex-1 bg-transparent px-3 text-sm font-bold text-foreground outline-none"
                />
                <span className="flex items-center border-l border-border px-3 text-xs font-black text-muted-foreground">
                  {defaultCurrency}
                </span>
              </div>
              <div className="flex h-11 overflow-hidden rounded-xl border border-border bg-muted/40 focus-within:border-[color:var(--primary)]/60">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  placeholder="Delivery"
                  className="h-full flex-1 bg-transparent px-3 text-sm font-bold text-foreground outline-none"
                />
                <span className="flex items-center border-l border-border px-3 text-xs font-black text-muted-foreground">
                  days
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                {message.length}/4000 — your contact details are not shared until
                the poster opens your proposal.
              </p>
              <button
                type="submit"
                disabled={!canSubmit}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black text-white shadow-md transition-all",
                  canSubmit
                    ? "hover:scale-[1.02] active:scale-[0.97]"
                    : "cursor-not-allowed opacity-60",
                )}
                style={{
                  background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 70%, #000))`,
                  boxShadow: `0 6px 20px color-mix(in srgb, ${accent} 35%, transparent)`,
                }}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send proposal
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function SignInPrompt({ accent }: { accent: string }) {
  return (
    <section
      className="rounded-2xl border bg-card p-5 text-center"
      style={{
        borderColor: `color-mix(in srgb, ${accent} 25%, transparent)`,
        background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 6%, transparent), rgb(var(--card)))`,
      }}
    >
      <p className="text-sm font-bold text-foreground">
        Sign in to send a proposal or use the contact channels on the side.
      </p>
      <Link
        href="/login"
        className="mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black text-white shadow-md transition-all hover:scale-[1.02] active:scale-[0.97]"
        style={{
          background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 70%, #000))`,
          boxShadow: `0 6px 20px color-mix(in srgb, ${accent} 35%, transparent)`,
        }}
      >
        <Send className="h-4 w-4" />
        Sign in to propose
      </Link>
    </section>
  );
}

function TrustStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-muted/40">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="truncate text-sm font-black text-foreground">
          {value}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-card px-2 py-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground transition-colors hover:border-[color:var(--primary)]/40 hover:text-foreground"
    >
      {icon}
      {label}
    </button>
  );
}
