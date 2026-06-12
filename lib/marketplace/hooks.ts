"use client";

import useSWR, { mutate } from "swr";
import {
  buildListingsUrl,
  fetchListings,
  fetchListing,
  fetchProposals,
  fetchProvider,
  fetchStats,
  type ListListingsQuery,
} from "./api-client";
import type { Listing, MarketplaceStats, Proposal, ProviderProfile } from "./types";

const KEY_STATS = "marketplace:stats";

export function useMarketplaceStats() {
  const { data, error, isLoading, mutate: m } = useSWR<{
    stats: MarketplaceStats;
    recent: Listing[];
  }>(KEY_STATS, fetchStats, { revalidateOnFocus: false, refreshInterval: 60_000 });
  return { stats: data?.stats, recent: data?.recent ?? [], error, isLoading, mutate: m };
}

export function useListings(query: ListListingsQuery) {
  const url = buildListingsUrl(query);
  const { data, error, isLoading, mutate: m } = useSWR<{
    items: Listing[];
    count: number;
  }>(url, () => fetchListings(query), { revalidateOnFocus: false });
  return { listings: data?.items ?? [], count: data?.count ?? 0, error, isLoading, mutate: m };
}

export function useListing(id: string | null | undefined) {
  const key = id ? `marketplace:listing:${id}` : null;
  const { data, error, isLoading, mutate: m } = useSWR<{ item: Listing }>(
    key,
    () => fetchListing(id!),
    { revalidateOnFocus: false },
  );
  return { listing: data?.item, error, isLoading, mutate: m };
}

export function useProposals(listingId: string | null | undefined) {
  const key = listingId ? `marketplace:proposals:${listingId}` : null;
  const { data, error, isLoading, mutate: m } = useSWR<{ items: Proposal[] }>(
    key,
    () => fetchProposals(listingId!),
    { revalidateOnFocus: false },
  );
  return { proposals: data?.items ?? [], error, isLoading, mutate: m };
}

export function useProvider(uid: string | null | undefined) {
  const key = uid ? `marketplace:provider:${uid}` : null;
  const { data, error, isLoading, mutate: m } = useSWR<{
    profile: ProviderProfile;
    listings: Listing[];
  }>(key, () => fetchProvider(uid!), { revalidateOnFocus: false });
  return {
    provider: data?.profile,
    listings: data?.listings ?? [],
    error,
    isLoading,
    mutate: m,
  };
}

/** Clear all marketplace caches — useful after creating/updating a listing. */
export function invalidateMarketplace() {
  return mutate(
    (key) =>
      typeof key === "string" &&
      (key.startsWith("/api/marketplace") || key.startsWith("marketplace:")),
    undefined,
    { revalidate: true },
  );
}
