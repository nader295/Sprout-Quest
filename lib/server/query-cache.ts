/**
 * In-Memory Query Cache
 * 
 * Caches popular database queries with configurable TTL
 * Automatically invalidates based on time
 * 
 * Phase 2.3 Optimization: ~90-100k invocations/month savings
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class QueryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private timers = new Map<string, NodeJS.Timeout>();

  /**
   * Get cached value if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cache value with TTL in milliseconds
   */
  set<T>(key: string, data: T, ttl: number = 60000): void {
    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    // Auto-delete after TTL
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl);

    this.timers.set(key, timer);
  }

  /**
   * Delete cache entry
   */
  delete(key: string): void {
    this.cache.delete(key);

    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
      this.timers.delete(key);
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }

    this.cache.clear();
    this.timers.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

// Global query cache instance
export const queryCache = new QueryCache();

/**
 * Cache device queries (10-minute TTL)
 */
export const DEVICE_CACHE_KEY = (codename: string) => `device:${codename.toLowerCase()}`;
export const DEVICE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Cache ROM queries (5-minute TTL for search)
 */
export const ROM_SEARCH_CACHE_KEY = (query: string, limit: number, offset: number) =>
  `rom:search:${query}:${limit}:${offset}`;
export const ROM_SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Cache ROM list queries (15-minute TTL for filtered lists)
 */
export const ROM_LIST_CACHE_KEY = (filter: string) => `rom:list:${filter}`;
export const ROM_LIST_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Cache stats (2-minute TTL)
 */
export const STATS_CACHE_KEY = 'stats:global';
export const STATS_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

/**
 * Cache user leaderboard (1-hour TTL)
 */
export const LEADERBOARD_CACHE_KEY = (category: string) => `leaderboard:${category}`;
export const LEADERBOARD_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Cache trending ROMs (30-minute TTL)
 */
export const TRENDING_CACHE_KEY = 'trending:roms';
export const TRENDING_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Clear cache by pattern (useful for invalidation)
 */
export function invalidateCacheByPattern(pattern: RegExp): void {
  const keysToDelete: string[] = [];

  // Manual iteration since Map doesn't support pattern deletion
  for (const key of (queryCache as any).cache.keys()) {
    if (pattern.test(key)) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    queryCache.delete(key);
  }
}

/**
 * Utility: Get or fetch with cache
 * 
 * Example:
 * ```typescript
 * const devices = await getOrFetch(
 *   DEVICE_CACHE_KEY(codename),
 *   () => db.from('devices').select('*').eq('codename', codename),
 *   DEVICE_CACHE_TTL
 * );
 * ```
 */
export async function getOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<T> {
  // Try cache first
  const cached = queryCache.get<T>(key);
  if (cached) return cached;

  // Fetch from source
  const data = await fetcher();

  // Store in cache
  queryCache.set(key, data, ttl);

  return data;
}
