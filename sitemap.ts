import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://romx.app";

const staticPages: MetadataRoute.Sitemap = [
  { url: BASE_URL,                     lastModified: new Date(), changeFrequency: "hourly",  priority: 1.0 },
  { url: `${BASE_URL}/explore`,        lastModified: new Date(), changeFrequency: "hourly",  priority: 0.95 },
  { url: `${BASE_URL}/devices`,        lastModified: new Date(), changeFrequency: "daily",   priority: 0.9 },
  { url: `${BASE_URL}/search`,         lastModified: new Date(), changeFrequency: "daily",   priority: 0.85 },
  { url: `${BASE_URL}/leaderboard`,    lastModified: new Date(), changeFrequency: "daily",   priority: 0.7 },
  { url: `${BASE_URL}/compare`,        lastModified: new Date(), changeFrequency: "weekly",  priority: 0.65 },
  { url: `${BASE_URL}/about`,          lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
  { url: `${BASE_URL}/collections`,    lastModified: new Date(), changeFrequency: "weekly",  priority: 0.55 },
  { url: `${BASE_URL}/feed`,           lastModified: new Date(), changeFrequency: "hourly",  priority: 0.5 },
  { url: `${BASE_URL}/rules`,          lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
  { url: `${BASE_URL}/apply`,          lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
  { url: `${BASE_URL}/privacy`,        lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
  { url: `${BASE_URL}/contact`,        lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
  { url: `${BASE_URL}/earnings`,       lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const results: MetadataRoute.Sitemap = [...staticPages];

  try {
    // ── 1. ROMs — أعلى priority لأنها المحتوى الرئيسي ─────────────────
    const MAX_PER_PAGE = 100;
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 20) {
      const res = await fetch(
        `${BASE_URL}/api/roms?max=${MAX_PER_PAGE}&sortBy=newest&page=${page}`,
        { next: { revalidate: 3600 } }
      );
      if (!res.ok) break;

      const data = await res.json();
      const items: Array<{
        id: string;
        updatedAt?: string | null;
        createdAt?: string | null;
        device?: string;
        brand?: string;
      }> = data.items || [];

      if (items.length === 0) { hasMore = false; break; }

      items.forEach((rom) => {
        results.push({
          url: `${BASE_URL}/rom/${rom.id}`,
          lastModified: rom.updatedAt
            ? new Date(rom.updatedAt)
            : rom.createdAt
              ? new Date(rom.createdAt)
              : new Date(),
          changeFrequency: "weekly",
          priority: 0.85,
        });
      });

      hasMore = items.length === MAX_PER_PAGE;
      page++;
    }

    // ── 2. Devices — مهم جداً للـ search intent ───────────────────────
    // "Poco X7 Pro custom rom" → يدخل على صفحة الجهاز
    try {
      const devRes = await fetch(
        `${BASE_URL}/api/devices?limit=500`,
        { next: { revalidate: 86400 } }
      );
      if (devRes.ok) {
        const devData = await devRes.json();
        const devices: Array<{ codename: string; updatedAt?: string }> =
          devData.devices || devData.items || [];

        devices.forEach((device) => {
          if (!device.codename) return;
          results.push({
            url: `${BASE_URL}/devices/${device.codename}`,
            lastModified: device.updatedAt ? new Date(device.updatedAt) : new Date(),
            changeFrequency: "weekly",
            priority: 0.8,
          });
        });
      }
    } catch { /* devices optional */ }

    // ── 3. Developer profiles ─────────────────────────────────────────
    // "Nader RomX developer" → يدخل على البروفايل
    try {
      const usersRes = await fetch(
        `${BASE_URL}/api/users?role=developer&limit=200`,
        { next: { revalidate: 86400 } }
      );
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        const users: Array<{ uid: string; updatedAt?: string }> =
          usersData.users || usersData.items || [];

        users.forEach((user) => {
          if (!user.uid) return;
          results.push({
            url: `${BASE_URL}/u/${user.uid}`,
            lastModified: user.updatedAt ? new Date(user.updatedAt) : new Date(),
            changeFrequency: "weekly",
            priority: 0.65,
          });
        });
      }
    } catch { /* profiles optional */ }

  } catch {
    return staticPages;
  }

  return results;
}
