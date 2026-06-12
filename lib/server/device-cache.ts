/**
 * Static Device Images Cache
 * 
 * Serves pre-cached device image URLs for top 100 devices.
 * Dramatically reduces API calls for the most popular devices.
 * 
 * Phase 2.1 Optimization: ~350k-400k invocations/month savings
 */

import topDevices from '@/lib/cache/top-devices.json';

export interface CachedDevice {
  name: string;
  brand: string;
  url: string;
}

// In-memory cache with 1-hour TTL
const memoryCache = new Map<string, CachedDevice | null>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const cacheTimestamps = new Map<string, number>();

/**
 * Get device image from static cache first
 * Falls back to API only if not in static cache
 */
export async function getDeviceImageCache(
  codename: string
): Promise<CachedDevice | null> {
  const key = codename.toLowerCase();

  // Check memory cache
  if (memoryCache.has(key)) {
    const cached = memoryCache.get(key) || null;
    const timestamp = cacheTimestamps.get(key) || 0;
    if (Date.now() - timestamp < CACHE_TTL) {
      return cached;
    }
    memoryCache.delete(key);
  }

  // Check static JSON cache
  const staticDevice = (topDevices.devices as Record<string, CachedDevice | undefined>)[key];
  if (staticDevice) {
    memoryCache.set(key, staticDevice);
    cacheTimestamps.set(key, Date.now());
    return staticDevice;
  }

  return null;
}

/**
 * Check if device is in static cache
 */
export function isDeviceInStaticCache(codename: string): boolean {
  const key = codename.toLowerCase();
  return key in topDevices.devices;
}

/**
 * Get count of cached devices
 */
export function getCachedDeviceCount(): number {
  return Object.keys(topDevices.devices).length;
}

/**
 * List all cached device codenames
 */
export function listCachedDevices(): string[] {
  return Object.keys(topDevices.devices);
}

/**
 * Force clear memory cache (for testing)
 */
export function clearMemoryCache(): void {
  memoryCache.clear();
  cacheTimestamps.clear();
}
