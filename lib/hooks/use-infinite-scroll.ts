"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * useInfiniteScroll — IntersectionObserver-based infinite scroll.
 *
 * @param onLoadMore  Called when the sentinel enters the viewport.
 * @param options     { threshold, rootMargin, enabled }
 * @returns           { sentinelRef, loading }
 *
 * Usage:
 * ```tsx
 * const { sentinelRef, loading } = useInfiniteScroll({
 *   onLoadMore: () => fetchNextPage(),
 *   enabled: hasMore,
 * });
 * // at the bottom of your list:
 * <div ref={sentinelRef} />
 * {loading && <Spinner />}
 * ```
 */
export function useInfiniteScroll({
  onLoadMore,
  enabled = true,
  threshold = 0.1,
  rootMargin = "200px",
}: {
  onLoadMore: () => void | Promise<void>;
  enabled?: boolean;
  threshold?: number;
  rootMargin?: string;
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  const handleIntersect = useCallback(
    async (entries: IntersectionObserverEntry[]) => {
      const entry = entries[0];
      if (!entry?.isIntersecting || loadingRef.current || !enabled) return;
      loadingRef.current = true;
      setLoading(true);
      try {
        await onLoadMore();
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [onLoadMore, enabled],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !enabled) return;

    const observer = new IntersectionObserver(handleIntersect, {
      threshold,
      rootMargin,
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleIntersect, threshold, rootMargin, enabled]);

  return { sentinelRef, loading };
}
