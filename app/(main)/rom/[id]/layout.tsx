import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

// ── Helper: بناء JSON-LD لـ Schema.org ────────────────────────────────────
function buildJsonLd(rom: Record<string, unknown>, baseUrl: string, id: string): string {
  // BreadcrumbList — helps Google show breadcrumbs in search results
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "RomX", "item": baseUrl },
      { "@type": "ListItem", "position": 2, "name": "Explore", "item": `${baseUrl}/explore` },
      ...(rom.device ? [{ "@type": "ListItem", "position": 3, "name": String(rom.device), "item": `${baseUrl}/devices/${rom.deviceCodename || ""}` }] : []),
      { "@type": "ListItem", "position": rom.device ? 4 : 3, "name": String(rom.name || "ROM"), "item": `${baseUrl}/rom/${id}` },
    ],
  };

  // SoftwareApplication — the main schema
  const app = {
    "@context": "https://schema.org",
    "@type":    "SoftwareApplication",
    "name":          rom.name        || "Custom ROM",
    "description":   (rom.description as string)?.slice(0, 500) || `Custom ROM for ${rom.device || "Android"} by ${rom.maintainerName || "Developer"}`,
    "operatingSystem": `Android ${rom.android || ""}`.trim(),
    "applicationCategory": "UtilitiesApplication",
    "url":           `${baseUrl}/rom/${id}`,
    "downloadUrl":   rom.downloadUrl || undefined,
    "softwareVersion": rom.version   || undefined,
    "fileSize":      rom.size        || undefined,
    "datePublished": rom.createdAt   || undefined,
    "dateModified":  rom.updatedAt   || undefined,
    "isAccessibleForFree": true,
    "author": {
      "@type": "Person",
      "name":  rom.maintainerName   || "Developer",
      "url":   rom.maintainerUid ? `${baseUrl}/u/${rom.maintainerUid}` : undefined,
    },
    "publisher": {
      "@type": "Organization",
      "name":  "RomX",
      "url":   baseUrl,
    },
    "offers": {
      "@type":        "Offer",
      "price":        "0",
      "priceCurrency":"USD",
      "availability": "https://schema.org/InStock",
    },
    ...(rom.thumbnail ? { "image": rom.thumbnail } : {}),
    ...(rom.ratingAvg && rom.ratingCount && Number(rom.ratingCount) >= 3
      ? {
          "aggregateRating": {
            "@type":       "AggregateRating",
            "ratingValue": String(Math.round(Number(rom.ratingAvg) * 10) / 10),
            "ratingCount": String(rom.ratingCount),
            "bestRating":  "5",
            "worstRating": "1",
          },
        }
      : {}),
  };

  const safe = (obj: object) => JSON.stringify(obj).replace(/<\/script>/gi, "<\\/script>");
  return `${safe(breadcrumb)}\n${safe(app)}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://romx.app";
    // Always fetch fresh so the social preview reflects the latest ROM data
    const res = await fetch(`${baseUrl}/api/roms?id=${id}`, {
      cache: "no-store",
    });

    if (!res.ok) throw new Error("ROM not found");

    const rom = await res.json();
    if (!rom?.id) throw new Error("Invalid ROM data");

    // Title optimized for search: "DragonX HyperOS 3.0.9.0 for Poco X7 Pro — RomX"
    const typeLabel = rom.contentType === "kernel" ? "Kernel"
      : rom.contentType === "recovery" ? "Recovery"
      : rom.contentType === "module" ? "Module"
      : rom.contentType === "gsi" ? "GSI"
      : "ROM";
    const title = rom.device
      ? `${rom.name} ${typeLabel} for ${rom.device} — RomX`
      : `${rom.name} — RomX`;

    // Description optimized for search snippets
    const descParts = [
      rom.device  && `Download ${rom.name} ${typeLabel} for ${rom.device}`,
      rom.brand   && `(${rom.brand})`,
      rom.android && `based on Android ${rom.android}`,
      rom.version && `v${rom.version}`,
      rom.romStatus === "active" ? "• Actively maintained" : rom.romStatus === "stable" ? "• Stable" : "",
      rom.description?.slice(0, 100),
    ].filter(Boolean);
    const description = descParts.join(" ").slice(0, 300) ||
      `Download ${rom.name} custom ${typeLabel.toLowerCase()} for Android. Free on RomX.`;

    // Cache-bust the OG image whenever the ROM is updated.
    // Social platforms (Telegram, WhatsApp, Twitter, Facebook) cache the
    // image URL aggressively — appending a version derived from updatedAt
    // forces them to re-fetch a fresh preview on every change.
    const updatedTs = rom.updatedAt
      ? new Date(rom.updatedAt).getTime()
      : rom.createdAt
        ? new Date(rom.createdAt).getTime()
        : Date.now();
    const image = `${baseUrl}/api/og/${id}?v=${updatedTs}`;

    return {
      title,
      description,
      keywords: [
        rom.name,
        rom.device && `${rom.device} custom rom`,
        rom.device && `${rom.device} ${typeLabel.toLowerCase()}`,
        rom.brand  && `${rom.brand} custom rom`,
        rom.deviceCodename,
        rom.deviceCodename && `${rom.deviceCodename} rom`,
        rom.android && `android ${rom.android} rom`,
        "custom rom download",
        "android customization",
        rom.maintainerName,
        "romx",
      ].filter(Boolean) as string[],
      openGraph: {
        title,
        description,
        url:      `${baseUrl}/rom/${id}`,
        type:     "article",
        images:   [{ url: image, width: 1200, height: 630, alt: rom.name }],
        siteName: "RomX",
      },
      twitter: {
        card:        "summary_large_image",
        title,
        description,
        images:      [image],
        site:        "@RomXApp",
      },
      alternates: {
        canonical: `${baseUrl}/rom/${id}`,
      },
    };
  } catch {
    return {
      title: "ROM — RomX",
      description: "Discover Custom ROMs, Kernels, Recoveries and Modules on RomX.",
      openGraph: {
        title:       "RomX — The Android Development Platform",
        description: "Discover, share and collaborate on Custom ROMs.",
        type:        "website",
      },
    };
  }
}

export default async function RomLayout({ params, children }: Props) {
  const { id } = await params;

  // ✅ JSON-LD للـ SEO — Schema.org SoftwareApplication
  let jsonLdString = "";
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://romx.app";
    const res = await fetch(`${baseUrl}/api/roms?id=${id}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const rom = await res.json();
      if (rom?.id) {
        jsonLdString = buildJsonLd(rom, baseUrl, id);
      }
    }
  } catch {}

  return (
    <>
      {jsonLdString && jsonLdString.split("\n").map((ld, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ld }}
        />
      ))}
      {children}
    </>
  );
}
