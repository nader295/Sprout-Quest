import { sbAdmin } from "@/lib/supabase/admin";

export interface DeviceRow {
  codename: string;
  name?: string;
  display_name?: string;
  brand?: string;
  chipset?: string;
  released?: string;
  popularity?: number;
  [key: string]: any;
}

export class UnifiedDeviceCache {
  private static instance: UnifiedDeviceCache;
  private cache: DeviceRow[] = [];
  private loadedAt = 0;
  private readonly TTL = 7 * 60 * 1000; // 7 minutes (compromise between 5min and 10min)

  static get(): UnifiedDeviceCache {
    if (!UnifiedDeviceCache.instance) {
      UnifiedDeviceCache.instance = new UnifiedDeviceCache();
    }
    return UnifiedDeviceCache.instance;
  }

  async getDevices(): Promise<DeviceRow[]> {
    const now = Date.now();
    if (this.cache.length > 0 && now - this.loadedAt < this.TTL) {
      return this.cache; // Cache hit
    }
    // Stale-while-revalidate: return stale data immediately, refresh in background
    if (this.cache.length > 0) {
      this.refresh(); // fire-and-forget
      return this.cache;
    }
    return this.refresh(); // Cold start — must await
  }

  private async refresh(): Promise<DeviceRow[]> {
    const { data } = await sbAdmin
      .from('devices')
      .select('*')
      .order('popularity', { ascending: false })
      .limit(5000);
    this.cache = data ?? [];
    this.loadedAt = Date.now();
    return this.cache;
  }

  invalidate(): void { this.loadedAt = 0; }
}
