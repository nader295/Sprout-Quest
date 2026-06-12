/**
 * lib/marketplace/mappers.ts — server-side row → API DTO converters.
 *
 * The DB stores snake_case columns, the API returns camelCase. Centralising
 * the mapping here keeps every route consistent and lets us evolve the
 * schema without leaking column names through the wire format.
 */

import type {
  Category,
  ContactChannels,
  Listing,
  ListingAttachment,
  ListingKind,
  ListingStatus,
  Proposal,
  ProviderCredential,
  ProviderPortfolioItem,
  ProviderProfile,
  Urgency,
  ContactChannelKey,
} from "./types";

type AnyRow = Record<string, unknown>;
const asString = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const asNumberOrNull = (v: unknown): number | null =>
  typeof v === "number" ? v : v == null ? null : Number(v);
const asBool = (v: unknown, d = false): boolean => (typeof v === "boolean" ? v : d);
const asStringArray = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const asJson = <T>(v: unknown, fallback: T): T => {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try { return JSON.parse(v) as T; } catch { return fallback; }
  }
  return v as T;
};

export function mapListingRow(row: AnyRow): Listing {
  return {
    id: asString(row.id),
    ownerUid: asString(row.owner_uid),
    ownerName: asString(row.owner_name),
    ownerAvatar: asString(row.owner_avatar),
    ownerRole: asString(row.owner_role, "user"),
    kind: asString(row.kind, "request") as ListingKind,
    title: asString(row.title),
    body: asString(row.body),
    category: asString(row.category, "other") as Category,
    deviceCodenames: asStringArray(row.device_codenames),
    deviceLabel: row.device_label ? asString(row.device_label) : null,
    budgetMin: asNumberOrNull(row.budget_min),
    budgetMax: asNumberOrNull(row.budget_max),
    currency: asString(row.currency, "USD"),
    isNegotiable: asBool(row.is_negotiable, true),
    urgency: asString(row.urgency, "normal") as Urgency,
    deadlineAt: row.deadline_at ? asString(row.deadline_at) : null,
    deliveryDays: asNumberOrNull(row.delivery_days),
    status: asString(row.status, "open") as ListingStatus,
    tags: asStringArray(row.tags),
    attachments: asJson<ListingAttachment[]>(row.attachments, []),
    coverImage: row.cover_image ? asString(row.cover_image) : null,
    contactChannels: asJson<ContactChannels>(row.contact_channels, {}),
    preferredChannel: (row.preferred_channel
      ? (asString(row.preferred_channel) as ContactChannelKey)
      : null),
    isAnonymous: asBool(row.is_anonymous, false),
    views: Number(row.views ?? 0),
    contactClicks: Number(row.contact_clicks ?? 0),
    proposalsCount: Number(row.proposals_count ?? 0),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

export function mapProviderRow(row: AnyRow): ProviderProfile {
  return {
    uid: asString(row.uid),
    displayName: asString(row.display_name),
    avatarUrl: asString(row.avatar_url),
    coverImage: row.cover_image ? asString(row.cover_image) : null,
    headline: asString(row.headline),
    bio: asString(row.bio),
    hourlyRate: asNumberOrNull(row.hourly_rate),
    hourlyCurrency: asString(row.hourly_currency, "USD"),
    responseTimeH: asNumberOrNull(row.response_time_h),
    languages: asStringArray(row.languages),
    skills: asStringArray(row.skills),
    categories: asStringArray(row.categories) as Category[],
    deviceCodenames: asStringArray(row.device_codenames),
    credentials: asJson<ProviderCredential[]>(row.credentials, []),
    portfolio: asJson<ProviderPortfolioItem[]>(row.portfolio, []),
    contactChannels: asJson<ContactChannels>(row.contact_channels, {}),
    preferredChannel: (row.preferred_channel
      ? (asString(row.preferred_channel) as ContactChannelKey)
      : null),
    acceptsEscrow: asBool(row.accepts_escrow, false),
    isOpenForWork: asBool(row.is_open_for_work, true),
    isAnonymous: asBool(row.is_anonymous, false),
    alias: row.alias ? asString(row.alias) : null,
    verifiedAt: row.verified_at ? asString(row.verified_at) : null,
    ratingAvg: Number(row.rating_avg ?? 0),
    ratingCount: Number(row.rating_count ?? 0),
    jobsCompleted: Number(row.jobs_completed ?? 0),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

export function mapProposalRow(row: AnyRow): Proposal {
  return {
    id: asString(row.id),
    listingId: asString(row.listing_id),
    senderUid: asString(row.sender_uid),
    senderName: asString(row.sender_name),
    senderAvatar: asString(row.sender_avatar),
    message: asString(row.message),
    price: asNumberOrNull(row.price),
    currency: asString(row.currency, "USD"),
    deliveryDays: asNumberOrNull(row.delivery_days),
    status: asString(row.status, "pending") as Proposal["status"],
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

/** Strip identifying fields when a listing was posted anonymously. */
export function applyAnonymityMask(listing: Listing): Listing {
  if (!listing.isAnonymous) return listing;
  return {
    ...listing,
    ownerUid: "",            // do not leak the real uid
    ownerName: "Anonymous",
    ownerAvatar: "",
    ownerRole: "user",
  };
}
