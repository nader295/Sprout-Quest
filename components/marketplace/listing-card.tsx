"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { CATEGORY_LABEL, type Listing } from "@/lib/marketplace/types";
import { KindPill, StatusPill, UrgencyPill } from "./status-pill";
import { ProviderAvatar } from "./provider-avatar";
import {
  Clock,
  Eye,
  MessageSquare,
  Smartphone,
  Tag,
} from "lucide-react";

function timeAgo(iso: string) {
  const diff = (Date.now() - +new Date(iso)) / 1000;
  if (diff < 60)     return "just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatRange(min: number | null, max: number | null, currency: string) {
  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return `${n} ${currency}`;
    }
  };
  if (min != null && max != null && min !== max) return `${fmt(min)} – ${fmt(max)}`;
  if (max != null) return fmt(max);
  if (min != null) return fmt(min);
  return "Open budget";
}

export function ListingCard({
  listing,
  compact = false,
}: {
  listing: Listing;
  compact?: boolean;
}) {
  const isRequest = listing.kind === "request";
  const accent = isRequest ? "var(--primary)" : "#f59e0b";
  const ownerLabel = listing.isAnonymous ? "Anonymous" : listing.ownerName || "Member";

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`group relative flex flex-col rounded-2xl border bg-card transition-all duration-200 hover:-translate-y-0.5 ${compact ? "p-3" : "p-4"}`}
      style={{
        borderColor: "rgb(var(--border))",
        boxShadow: "var(--card-shadow)",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${accent} 50%, transparent 100%)`,
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          boxShadow: `0 0 0 1px color-mix(in srgb, ${accent} 45%, transparent), 0 16px 40px -12px color-mix(in srgb, ${accent} 35%, transparent)`,
        }}
      />

      {/* Cover image */}
      {!compact && listing.coverImage && (
        <Link
          href={`/marketplace/${listing.id}`}
          className="relative -m-4 mb-3 block aspect-[16/8] overflow-hidden rounded-t-2xl"
        >
          <Image
            src={listing.coverImage}
            alt=""
            fill
            sizes="(min-width: 1024px) 360px, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            unoptimized
          />
        </Link>
      )}

      {/* Top meta */}
      <div className={`mb-3 flex items-center justify-between gap-2 ${compact ? "" : ""}`}>
        <div className="flex items-center gap-1.5">
          <KindPill kind={listing.kind} />
          <UrgencyPill urgency={listing.urgency} />
        </div>
        <StatusPill status={listing.status} />
      </div>

      <Link
        href={`/marketplace/${listing.id}`}
        className="flex flex-col gap-1.5 outline-none"
      >
        <h3
          className="line-clamp-2 text-[15px] font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-[color:var(--link-hover)]"
          style={{ ["--link-hover" as never]: accent }}
        >
          {listing.title}
        </h3>
        {!!listing.body && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {listing.body}
          </p>
        )}
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <Tag className="h-2.5 w-2.5" />
          {CATEGORY_LABEL[listing.category]}
        </span>
        {listing.deviceLabel && (
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            <Smartphone className="h-2.5 w-2.5" />
            {listing.deviceLabel}
          </span>
        )}
        {listing.tags.slice(0, 2).map((t) => (
          <span
            key={t}
            className="rounded-md border border-border/60 bg-transparent px-2 py-0.5 text-[10px] font-semibold text-muted-foreground/80"
          >
            #{t}
          </span>
        ))}
      </div>

      <div className="flex-1" />

      <div className="mt-4 flex items-end justify-between gap-3 border-t border-border/70 pt-3">
        <Link
          href={listing.isAnonymous ? `/marketplace/${listing.id}` : `/u/${listing.ownerUid}`}
          className="group/link flex items-center gap-2 min-w-0"
        >
          <ProviderAvatar
            name={ownerLabel}
            avatarUrl={listing.ownerAvatar}
            isAnonymous={listing.isAnonymous}
            size={32}
            showRing={false}
          />
          <div className="min-w-0">
            <span className="block truncate text-xs font-bold text-foreground group-hover/link:underline underline-offset-2">
              {ownerLabel}
            </span>
            <span className="block text-[10px] text-muted-foreground">
              {listing.proposalsCount} {isRequest ? "proposals" : "inquiries"}
            </span>
          </div>
        </Link>

        <div className="flex flex-col items-end gap-1">
          {(listing.budgetMin != null || listing.budgetMax != null) && (
            <div className="text-right">
              <div
                className="text-sm font-black tabular-nums"
                style={{ color: accent }}
              >
                {formatRange(listing.budgetMin, listing.budgetMax, listing.currency)}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                {isRequest
                  ? "budget"
                  : listing.isNegotiable
                  ? "from · negotiable"
                  : "fixed"}
              </div>
            </div>
          )}
        </div>
      </div>

      {!compact && (
        <div className="mt-3 flex items-center gap-3 text-[10px] font-semibold text-muted-foreground">
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
      )}
    </motion.article>
  );
}
