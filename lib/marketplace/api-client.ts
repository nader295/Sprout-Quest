"use client";

/**
 * lib/marketplace/api-client.ts — typed fetch helpers + Cloudinary uploader
 * for the marketplace UI. Mirrors the server routes 1:1.
 *
 * The Authorization header is attached only when Firebase has a current
 * user. Anonymous browse calls (GET listings, GET stats, GET provider) work
 * without a token, matching how the API routes are written.
 */

import { auth } from "@/lib/firebase/client";
import { compressImage } from "@/lib/cloudinary-utils";
import { CLOUDINARY_CONFIG } from "@/lib/constants";
import type {
  Listing,
  ListingKind,
  Category,
  ProviderProfile,
  Proposal,
  MarketplaceStats,
  ContactChannels,
  ContactChannelKey,
  ListingAttachment,
  ProviderCredential,
  ProviderPortfolioItem,
  Urgency,
  ListingStatus,
} from "./types";

// ── Internals ─────────────────────────────────────────────────────
async function authHeaders(): Promise<Record<string, string>> {
  try {
    const u = auth.currentUser;
    if (!u) return {};
    const token = await u.getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export class MarketplaceApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "MarketplaceApiError";
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await authHeaders()),
    ...((init.headers as Record<string, string>) || {}),
  };
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = String(body.error);
    } catch {}
    throw new MarketplaceApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── Listings ──────────────────────────────────────────────────────
export interface ListListingsQuery {
  kind?: "all" | ListingKind;
  category?: "all" | Category;
  ownerUid?: string;
  status?: ListingStatus | "all";
  q?: string;
  sort?: "recent" | "budget_high" | "budget_low" | "popular";
  limit?: number;
  offset?: number;
}

export function buildListingsUrl(query: ListListingsQuery = {}): string {
  const sp = new URLSearchParams();
  if (query.kind && query.kind !== "all") sp.set("kind", query.kind);
  if (query.category && query.category !== "all") sp.set("category", query.category);
  if (query.ownerUid) sp.set("ownerUid", query.ownerUid);
  if (query.status) sp.set("status", query.status);
  if (query.q) sp.set("q", query.q);
  if (query.sort) sp.set("sort", query.sort);
  if (query.limit) sp.set("limit", String(query.limit));
  if (query.offset) sp.set("offset", String(query.offset));
  const qs = sp.toString();
  return qs ? `/api/marketplace/listings?${qs}` : "/api/marketplace/listings";
}

export async function fetchListings(query: ListListingsQuery = {}): Promise<{
  items: Listing[];
  count: number;
}> {
  return request(buildListingsUrl(query));
}

export async function fetchListing(id: string): Promise<{ item: Listing }> {
  return request(`/api/marketplace/listings/${encodeURIComponent(id)}`);
}

export interface CreateListingPayload {
  kind: ListingKind;
  title: string;
  body: string;
  category: Category;
  deviceCodenames?: string[];
  deviceLabel?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency?: string;
  isNegotiable?: boolean;
  urgency?: Urgency;
  deadlineAt?: string | null;
  deliveryDays?: number | null;
  tags?: string[];
  attachments?: ListingAttachment[];
  coverImage?: string | null;
  contactChannels: ContactChannels;
  preferredChannel?: ContactChannelKey | null;
  isAnonymous?: boolean;
}

export async function createListing(p: CreateListingPayload): Promise<{ item: Listing }> {
  return request("/api/marketplace/listings", {
    method: "POST",
    body: JSON.stringify(p),
  });
}

export interface UpdateListingPayload {
  title?: string;
  body?: string;
  status?: ListingStatus;
  urgency?: Urgency;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency?: string;
  isNegotiable?: boolean;
  deadlineAt?: string | null;
  deliveryDays?: number | null;
  tags?: string[];
  deviceCodenames?: string[];
  deviceLabel?: string | null;
  isAnonymous?: boolean;
}

export async function updateListing(id: string, p: UpdateListingPayload): Promise<{ item: Listing }> {
  return request(`/api/marketplace/listings/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(p),
  });
}

export async function deleteListing(id: string): Promise<{ ok: boolean }> {
  return request(`/api/marketplace/listings/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ── Proposals ─────────────────────────────────────────────────────
export interface CreateProposalPayload {
  message: string;
  price?: number | null;
  currency?: string;
  deliveryDays?: number | null;
}

export async function fetchProposals(listingId: string): Promise<{ items: Proposal[] }> {
  return request(`/api/marketplace/listings/${encodeURIComponent(listingId)}/proposals`);
}

export async function sendProposal(
  listingId: string,
  p: CreateProposalPayload,
): Promise<{ item: Proposal }> {
  return request(`/api/marketplace/listings/${encodeURIComponent(listingId)}/proposals`, {
    method: "POST",
    body: JSON.stringify(p),
  });
}

// ── Provider profile ─────────────────────────────────────────────
export interface UpsertProviderPayload {
  headline?: string;
  bio?: string;
  hourlyRate?: number | null;
  hourlyCurrency?: string;
  responseTimeH?: number | null;
  languages?: string[];
  skills?: string[];
  categories?: Category[];
  deviceCodenames?: string[];
  credentials?: ProviderCredential[];
  portfolio?: ProviderPortfolioItem[];
  contactChannels?: ContactChannels;
  preferredChannel?: ContactChannelKey | null;
  acceptsEscrow?: boolean;
  isOpenForWork?: boolean;
  isAnonymous?: boolean;
  alias?: string | null;
  coverImage?: string | null;
}

export async function fetchProvider(uid: string): Promise<{
  profile: ProviderProfile;
  listings: Listing[];
}> {
  return request(`/api/marketplace/providers/${encodeURIComponent(uid)}`);
}

export async function upsertProvider(uid: string, p: UpsertProviderPayload): Promise<{
  profile: ProviderProfile;
}> {
  return request(`/api/marketplace/providers/${encodeURIComponent(uid)}`, {
    method: "PUT",
    body: JSON.stringify(p),
  });
}

// ── Stats / activity ticker ──────────────────────────────────────
export async function fetchStats(): Promise<{ stats: MarketplaceStats; recent: Listing[] }> {
  return request("/api/marketplace/stats");
}

// ── Cloudinary uploads (same pattern as roms / avatars) ──────────
export interface UploadedImage {
  url: string;       // secure_url from Cloudinary
  width?: number;
  height?: number;
  bytes?: number;
}

/**
 * Uploads an image to Cloudinary using the unsigned preset.
 * The image is compressed client-side first to save bandwidth.
 *
 * Throws if the Cloudinary env vars aren't configured or the upload fails.
 */
export async function uploadMarketplaceImage(
  file: File,
  folder: "listings" | "portfolio" | "covers" = "listings",
): Promise<UploadedImage> {
  if (!CLOUDINARY_CONFIG.cloudName || !CLOUDINARY_CONFIG.uploadPreset) {
    throw new Error("Image upload isn't configured. Please contact support.");
  }
  if (file.size > CLOUDINARY_CONFIG.maxSizeMB * 1024 * 1024) {
    throw new Error(`File size must be under ${CLOUDINARY_CONFIG.maxSizeMB} MB`);
  }

  // Compress before sending to Cloudinary — saves a lot of bandwidth.
  let toSend: File = file;
  try {
    const compressed = await compressImage(file, {
      maxWidth: 1600,
      maxHeight: 1600,
      maxSizeKB: 700,
      quality: 0.82,
    });
    toSend = compressed.file;
  } catch {
    // If compression isn't available (SSR / unsupported), upload raw.
  }

  const fd = new FormData();
  fd.append("file", toSend);
  fd.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
  fd.append("folder", `${CLOUDINARY_CONFIG.folder}/marketplace/${folder}`);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
    { method: "POST", body: fd },
  );
  if (!res.ok) {
    let message = "Image upload failed";
    try {
      const body = await res.json();
      if (body?.error?.message) message = body.error.message;
    } catch {}
    throw new Error(message);
  }
  const data: { secure_url?: string; width?: number; height?: number; bytes?: number } =
    await res.json();
  if (!data.secure_url) throw new Error("Cloudinary returned no URL");
  return { url: data.secure_url, width: data.width, height: data.height, bytes: data.bytes };
}
