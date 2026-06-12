/**
 * lib/cache.ts — RomX Cache Utilities
 *
 * ┌────────────────────────────────────────────────────────────────────┐
 * │  MemoryCache   — في ذاكرة المتصفح، بتتمسح لو أغلق التاب         │
 * │                  LRU: أقصى 500 entry لمنع memory leak             │
 * │  PersistCache  — localStorage، SSR-safe تلقائياً                  │
 * │  requestDedup  — لو فيه 10 requests لنفس الـ key، بيتعمل request │
 * │                  واحد بس وكل التاني بينتظر نفس النتيجة            │
 * └────────────────────────────────────────────────────────────────────┘
 */

import { logger } from "@/lib/logger";

// ── Types ──────────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  key: string;
}

// ── SSR Guard ──────────────────────────────────────
function isClient(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

// ── 1. In-Memory Cache (LRU) ───────────────────────
class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private maxEntries = 500;

  set<T>(key: string, data: T, ttlMs = 2 * 60 * 1000): void {
    if (this.store.has(key)) this.store.delete(key);
    if (this.store.size >= this.maxEntries) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) this.store.delete(firstKey);
    }
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs, key });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.data as T;
  }

  invalidate(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear(): void { this.store.clear(); }
  size(): number { return this.store.size; }
}

// ── 2. Persistent Cache (localStorage) ────────────
class PersistentCache {
  private prefix = "romx_cache_";

  set<T>(key: string, data: T, ttlMs = 24 * 60 * 60 * 1000): void {
    if (!isClient()) return;
    try {
      localStorage.setItem(
        this.prefix + key,
        JSON.stringify({ data, expiresAt: Date.now() + ttlMs })
      );
    } catch {}
  }

  get<T>(key: string): T | null {
    if (!isClient()) return null;
    try {
      const raw = localStorage.getItem(this.prefix + key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() > parsed.expiresAt) {
        localStorage.removeItem(this.prefix + key);
        return null;
      }
      return parsed.data as T;
    } catch {
      return null;
    }
  }

  invalidate(key: string): void {
    if (!isClient()) return;
    try { localStorage.removeItem(this.prefix + key); } catch {}
  }

  clear(): void {
    if (!isClient()) return;
    try {
      const toDelete: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(this.prefix)) toDelete.push(k);
      }
      toDelete.forEach((k) => localStorage.removeItem(k));
    } catch {}
  }
}

// ── 3. Request Deduplication ────────────────────────
const inflight = new Map<string, Promise<unknown>>();

export async function dedupedFetch<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  if (inflight.has(key)) return inflight.get(key) as Promise<T>;
  const promise = fetcher().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

// ── 4. Cached Fetch ────────────────────────────────
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 2 * 60 * 1000
): Promise<T> {
  const isServer = typeof window === "undefined";
  // On the server, we want to route this to Upstash Redis for Stampede protection
  if (isServer) {
    return serverCachedFetch(key, fetcher, ttlMs / 1000);
  }

  // On the client, keep original behavior (MemoryCache)
  const cached = appCache.get<T>(key);
  if (cached !== null) return cached;
  const data = await dedupedFetch(key, fetcher);
  appCache.set(key, data, ttlMs);
  return data;
}

// ── 5. Cache Keys ─────────────────────────────────
export const CacheKeys = {
  stats:         "platform:stats",
  roms:          (sort: string, type: string, brand: string, android: string) =>
                   `roms:${sort}:${type}:${brand}:${android}`,
  leaderboard:   (cat: string) => `leaderboard:${cat}`,
  adminStats:    "admin:stats",
  adminHealth:   "admin:health",
  userProfile:   (uid: string) => `user:${uid}`,
  romDetail:     (id: string) => `rom:${id}`,
  romDetailTTL:   10 * 60 * 1000,  // ROM detail = 10 min
  notifications: (uid: string) => `notifications:${uid}`,
  devices:       (device: string) => `devices:${device}`,
} as const;

// ── 6. Stale-While-Revalidate ─────────────────────
/**
 * Returns stale data immediately while fetching fresh data in background.
 * Cuts perceived latency to 0 on repeat visits.
 */
export async function swr<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 2 * 60 * 1000
): Promise<T> {
  const stale = appCache.get<T>(key);
  if (stale !== null) {
    // Return stale immediately, refresh in background.
    // A silent failure here means the user keeps seeing stale data forever until
    // TTL eviction — subtle but real, so forward to Sentry.
    fetcher()
      .then((fresh) => appCache.set(key, fresh, ttlMs))
      .catch((err) => logger.error("cache.swr.backgroundRefresh", err, { key }));
    return stale;
  }
  // No cache: fetch normally
  const data = await dedupedFetch(key, fetcher);
  appCache.set(key, data, ttlMs);
  return data;
}

// ── 7. Server-Side Redis Cache with Mutex Lock ────
/**
 * Server-side caching through Upstash Redis.
 * On cache miss:
 *   1. Try to acquire a Redis mutex lock (SET NX EX)
 *   2. If lock acquired → fetch from DB, store in Redis, release lock
 *   3. If lock NOT acquired → return stale data or wait briefly and retry
 * This prevents "Cache Stampede" where 50K users hit the DB simultaneously.
 */
export async function serverCachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 120
): Promise<T> {
  // Dynamic import keeps this server-only (tree-shaken from client bundles)
  let redisGet: (k: string) => Promise<string | null>;
  let redisSet: (k: string, v: string, ex?: number) => Promise<void>;
  let redisSetNX: (k: string, v: string, ex: number) => Promise<boolean>;
  try {
    const upstash = await import("@/lib/upstash");
    redisGet = upstash.redisGet;
    redisSet = upstash.redisSet;
    redisSetNX = upstash.redisSetNX;
  } catch {
    // If upstash import fails, fall through to direct fetch
    const data = await fetcher();
    appCache.set(key, data, ttlSeconds * 1000);
    return data;
  }

  // 1. Check Redis cache first
  try {
    const cached = await redisGet(`cache:${key}`);
    if (cached) {
      const parsed = JSON.parse(cached) as T;
      appCache.set(key, parsed, ttlSeconds * 1000);
      return parsed;
    }
  } catch { /* Redis miss or parse error — proceed to fetch */ }

  // 2. Check in-memory cache (fallback if Redis is down)
  const memCached = appCache.get<T>(key);
  if (memCached !== null) return memCached;

  // 3. Try to acquire mutex lock securely and atomically via NX pattern
  const lockKey = `lock:${key}`;
  let lockAcquired = false;
  try {
    lockAcquired = await redisSetNX(lockKey, "1", 10);
  } catch { /* proceed without lock */ }

  if (!lockAcquired) {
    // Another instance is fetching — wait briefly and try Redis again
    await new Promise(r => setTimeout(r, 200));
    try {
      const retried = await redisGet(`cache:${key}`);
      if (retried) return JSON.parse(retried) as T;
    } catch { /* fall through to direct fetch */ }
  }

  // 4. Fetch from source
  try {
    const data = await fetcher();
    const serialized = JSON.stringify(data);
    // Redis SET failure = cache bypass for every subsequent request until TTL reset.
    // High-value to surface — a down Redis instance would otherwise look like
    // a generic slowdown with no root cause visible.
    await redisSet(`cache:${key}`, serialized, ttlSeconds)
      .catch((err) => logger.error("cache.serverCachedFetch.redisSet", err, { key, ttlSeconds }));
    appCache.set(key, data, ttlSeconds * 1000);
    // Lock release: noise-suppressed since the lock has a 10s TTL and will
    // self-expire — a Redis blip here doesn't impact correctness.
    if (lockAcquired) await redisSet(lockKey, "", 1).catch(() => {});
    return data;
  } catch (err) {
    if (lockAcquired) await redisSet(lockKey, "", 1).catch(() => {});
    throw err;
  }
}

// ── Exports ───────────────────────────────────────
export const appCache     = new MemoryCache();
export const persistCache = new PersistentCache();

