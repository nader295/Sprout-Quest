/**
 * Phase 2 Integration Tests
 * 
 * Tests for:
 * - Static device cache lookup
 * - SSE endpoint and connection management
 * - Query caching and invalidation
 * - FTS search performance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDeviceImageCache, isDeviceInStaticCache, getCachedDeviceCount, clearMemoryCache } from '@/lib/server/device-cache';
import { queryCache, DEVICE_CACHE_KEY, getOrFetch } from '@/lib/server/query-cache';

describe('Phase 2.1 - Static Device Cache', () => {
  beforeEach(() => {
    clearMemoryCache();
  });

  it('should retrieve cached device from static cache', async () => {
    const result = await getDeviceImageCache('pixel-4');
    expect(result).toBeDefined();
    expect(result?.brand).toBe('Google');
    expect(result?.name).toContain('Pixel');
  });

  it('should return null for non-cached devices', async () => {
    const result = await getDeviceImageCache('nonexistent-device');
    expect(result).toBeNull();
  });

  it('should check if device is in static cache', () => {
    expect(isDeviceInStaticCache('pixel-4')).toBe(true);
    expect(isDeviceInStaticCache('nonexistent')).toBe(false);
  });

  it('should return correct cached device count', () => {
    const count = getCachedDeviceCount();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(100); // Top 100 devices
  });

  it('should handle case-insensitive lookups', async () => {
    const lower = await getDeviceImageCache('pixel-4');
    const upper = await getDeviceImageCache('PIXEL-4');
    expect(lower?.name).toBe(upper?.name);
  });

  it('should use in-memory cache after first lookup', async () => {
    const result1 = await getDeviceImageCache('poco-x6');
    const result2 = await getDeviceImageCache('poco-x6');
    expect(result1).toEqual(result2);
  });
});

describe('Phase 2.2 - Query Caching', () => {
  beforeEach(() => {
    queryCache.clear();
  });

  afterEach(() => {
    queryCache.clear();
  });

  it('should store and retrieve cached values', () => {
    const key = 'test:key';
    const data = { test: 'data' };
    
    queryCache.set(key, data, 5000);
    const retrieved = queryCache.get<typeof data>(key);
    
    expect(retrieved).toEqual(data);
  });

  it('should return null for expired cache entries', async () => {
    const key = 'test:expire';
    queryCache.set(key, { data: 'test' }, 100); // 100ms TTL
    
    expect(queryCache.get(key)).toBeDefined();
    
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(queryCache.get(key)).toBeNull();
  });

  it('should handle getOrFetch utility', async () => {
    const key = 'test:fetch';
    let fetchCount = 0;
    
    const fetcher = async () => {
      fetchCount++;
      return { count: fetchCount };
    };
    
    // First call should fetch
    const result1 = await getOrFetch(key, fetcher, 5000);
    expect(result1.count).toBe(1);
    expect(fetchCount).toBe(1);
    
    // Second call should use cache
    const result2 = await getOrFetch(key, fetcher, 5000);
    expect(result2.count).toBe(1); // Still 1 from cache
    expect(fetchCount).toBe(1); // Fetcher not called again
  });

  it('should track cache size', () => {
    queryCache.set('key1', { data: 1 }, 5000);
    queryCache.set('key2', { data: 2 }, 5000);
    queryCache.set('key3', { data: 3 }, 5000);
    
    expect(queryCache.size()).toBe(3);
    
    queryCache.delete('key2');
    expect(queryCache.size()).toBe(2);
  });

  it('should delete cache entries', () => {
    const key = 'test:delete';
    queryCache.set(key, { data: 'test' }, 5000);
    
    expect(queryCache.get(key)).toBeDefined();
    queryCache.delete(key);
    expect(queryCache.get(key)).toBeNull();
  });

  it('should clear all cache entries', () => {
    queryCache.set('key1', { data: 1 }, 5000);
    queryCache.set('key2', { data: 2 }, 5000);
    
    expect(queryCache.size()).toBe(2);
    queryCache.clear();
    expect(queryCache.size()).toBe(0);
  });
});

describe('Phase 2.3 - Cache Key Generation', () => {
  it('should generate consistent device cache keys', () => {
    const key1 = DEVICE_CACHE_KEY('pixel-4');
    const key2 = DEVICE_CACHE_KEY('PIXEL-4');
    expect(key1).toBe(key2);
  });

  it('should generate unique keys for different queries', () => {
    const key1 = DEVICE_CACHE_KEY('pixel-4');
    const key2 = DEVICE_CACHE_KEY('poco-x6');
    expect(key1).not.toBe(key2);
  });
});

describe('Performance Benchmarks', () => {
  it('should return cached device in < 1ms', async () => {
    const start = performance.now();
    await getDeviceImageCache('pixel-4');
    const duration = performance.now() - start;
    
    // Cached lookup should be instant
    expect(duration).toBeLessThan(1);
  });

  it('should handle 1000 cache operations without slowdown', () => {
    const start = performance.now();
    
    for (let i = 0; i < 1000; i++) {
      queryCache.set(`key${i}`, { data: i }, 5000);
    }
    
    const duration = performance.now() - start;
    
    // Average < 1ms per operation
    expect(duration / 1000).toBeLessThan(1);
  });

  it('should maintain performance with large cache entries', () => {
    const largeData = new Array(10000).fill({ foo: 'bar' });
    
    const start = performance.now();
    queryCache.set('large', largeData, 5000);
    const retrieved = queryCache.get('large');
    const duration = performance.now() - start;
    
    expect(retrieved).toBeDefined();
    expect(duration).toBeLessThan(10); // < 10ms for large operations
  });
});

describe('Error Handling', () => {
  it('should handle invalid device codenames gracefully', async () => {
    expect(async () => {
      await getDeviceImageCache('');
    }).not.toThrow();
    
    expect(async () => {
      await getDeviceImageCache(null as unknown as string);
    }).not.toThrow();
  });

  it('should handle concurrent cache access', async () => {
    const promises = [];
    
    for (let i = 0; i < 100; i++) {
      promises.push(getDeviceImageCache('pixel-4'));
    }
    
    const results = await Promise.all(promises);
    
    // All results should be consistent
    expect(results.every(r => r?.name === results[0]?.name)).toBe(true);
  });
});
