/**
 * lib/marketplace/types.ts
 *
 * Shared marketplace types for both client and server. Mirrors the real
 * Postgres schema in scripts/910_marketplace_schema.sql.
 *
 * No mock data lives here — everything comes from the API.
 */

export type ListingKind = "request" | "offer";

export type ListingStatus =
  | "open"
  | "in_progress"
  | "closed"
  | "cancelled"
  | "archived";

export type Urgency = "low" | "normal" | "high" | "critical";

/**
 * Coarse marketplace category. Keep this list short and stable — the UI builds
 * filters and presets directly off it.
 */
export type Category =
  | "kernel"
  | "rom"
  | "unlock"
  | "repair"
  | "recovery"
  | "module"
  | "port"
  | "gsi"
  | "mentorship"
  | "other";

export const CATEGORY_LABEL: Record<Category, string> = {
  kernel: "Custom kernel",
  rom: "Custom ROM",
  unlock: "Bootloader / unlock",
  repair: "Hardware repair",
  recovery: "Recovery / TWRP",
  module: "Magisk / module",
  port: "Port / device bring-up",
  gsi: "GSI work",
  mentorship: "Mentorship / consulting",
  other: "Other",
};

export const URGENCY_LABEL: Record<Urgency, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  critical: "Critical",
};

export const STATUS_LABEL: Record<ListingStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  closed: "Closed",
  cancelled: "Cancelled",
  archived: "Archived",
};

export type ContactChannelKey =
  | "telegram"
  | "whatsapp"
  | "matrix"
  | "signal"
  | "discord"
  | "xmpp"
  | "email"
  | "website";

export type ContactChannels = Partial<Record<ContactChannelKey, string>>;

export interface ListingAttachment {
  url: string;
  type: "image" | "file";
  name: string;
  size?: number;
}

export interface ProviderCredential {
  title: string;
  issuer?: string;
  year?: number;
  url?: string;
}

export interface ProviderPortfolioItem {
  title: string;
  summary?: string;
  image?: string;
  url?: string;
}

/** Listing row, denormalised — owner identity travels with the row. */
export interface Listing {
  id: string;
  ownerUid: string;
  ownerName: string;
  ownerAvatar: string;
  ownerRole: string;
  kind: ListingKind;
  title: string;
  body: string;
  category: Category;
  deviceCodenames: string[];
  deviceLabel: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  isNegotiable: boolean;
  urgency: Urgency;
  deadlineAt: string | null;
  deliveryDays: number | null;
  status: ListingStatus;
  tags: string[];
  attachments: ListingAttachment[];
  coverImage: string | null;
  contactChannels: ContactChannels;
  preferredChannel: ContactChannelKey | null;
  isAnonymous: boolean;
  views: number;
  contactClicks: number;
  proposalsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderProfile {
  uid: string;
  displayName: string;
  avatarUrl: string;
  coverImage: string | null;
  headline: string;
  bio: string;
  hourlyRate: number | null;
  hourlyCurrency: string;
  responseTimeH: number | null;
  languages: string[];
  skills: string[];
  categories: Category[];
  deviceCodenames: string[];
  credentials: ProviderCredential[];
  portfolio: ProviderPortfolioItem[];
  contactChannels: ContactChannels;
  preferredChannel: ContactChannelKey | null;
  acceptsEscrow: boolean;
  isOpenForWork: boolean;
  isAnonymous: boolean;
  alias: string | null;
  verifiedAt: string | null;
  ratingAvg: number;
  ratingCount: number;
  jobsCompleted: number;
  createdAt: string;
  updatedAt: string;
}

export interface Proposal {
  id: string;
  listingId: string;
  senderUid: string;
  senderName: string;
  senderAvatar: string;
  message: string;
  price: number | null;
  currency: string;
  deliveryDays: number | null;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceStats {
  openRequests: number;
  openOffers: number;
  providers: number;
  completed: number;
}

export interface FilterState {
  kind: "all" | ListingKind;
  category: "all" | Category;
  query: string;
  sort: "recent" | "budget_high" | "budget_low" | "popular";
}

export const DEFAULT_FILTER: FilterState = {
  kind: "all",
  category: "all",
  query: "",
  sort: "recent",
};

/** Build the deep-link URL for an external contact channel. */
export function contactHref(channel: ContactChannelKey, handle: string): string {
  const v = handle.trim();
  if (!v) return "#";
  switch (channel) {
    case "telegram":
      return v.startsWith("http") ? v : `https://t.me/${v.replace(/^@/, "")}`;
    case "whatsapp": {
      const digits = v.replace(/[^0-9+]/g, "");
      return `https://wa.me/${digits.replace(/^\+/, "")}`;
    }
    case "matrix":
      return `https://matrix.to/#/${v.startsWith("@") ? v : `@${v}`}`;
    case "signal":
      return v.startsWith("http") ? v : `https://signal.me/#p/${v.replace(/[^0-9+]/g, "")}`;
    case "discord":
      return v.startsWith("http") ? v : `https://discord.com/users/${v}`;
    case "xmpp":
      return `xmpp:${v.replace(/^xmpp:/, "")}`;
    case "email":
      return `mailto:${v}`;
    case "website":
      return v.startsWith("http") ? v : `https://${v}`;
  }
}
