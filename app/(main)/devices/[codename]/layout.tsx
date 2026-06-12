import type { Metadata } from "next";

interface Props {
  params: Promise<{ codename: string }>;
  children: React.ReactNode;
}

// ── Helper: بناء JSON-LD لـ Schema.org ────────────────────────────────────
function buildJsonLd(device: Record<string, unknown>, baseUrl: string, codename: string): string {
  const deviceName = String(device.name || codename);
  const brandName  = String(device.brand || "Android");

  // BreadcrumbList
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "RomX",    "item": baseUrl },
      { "@type": "ListItem", "position": 2, "name": "Devices", "item": `${baseUrl}/devices` },
      { "@type": "ListItem", "position": 3, "name": deviceName, "item": `${baseUrl}/devices/${codename}` },
    ],
  };

  // Product schema — يظهر في Google Shopping أحياناً
  const product = {
    "@context": "https://schema.org",
    "@type":    "Product",
    "name":        deviceName,
    "description": `Download the best Custom ROMs, Kernels, TWRP Recovery, and Magisk Modules for ${deviceName} by ${brandName}. Free and updated regularly on RomX.`,
    "category":    "Smartphone",
    "brand": { "@type": "Brand", "name": brandName },
    "url":         `${baseUrl}/devices/${codename}`,
    "identifier":  codename,
    ...(device.chipset ? { "additionalProperty": [
      { "@type": "PropertyValue", "name": "Chipset", "value": String(device.chipset) },
      ...(device.ram    ? [{ "@type": "PropertyValue", "name": "RAM",     "value": String(device.ram)    }] : []),
      ...(device.storage? [{ "@type": "PropertyValue", "name": "Storage", "value": String(device.storage)}] : []),
    ]} : {}),
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "USD",
      "lowPrice": "0",
      "highPrice": "0",
      "offerCount": device.romsCount || 1,
    },
  };

  // ItemList — بيحسن ظهور الصفحة في نتائج البحث
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `Custom ROMs for ${deviceName}`,
    "description": `All available Custom ROMs, Kernels, and Mods for ${deviceName}`,
    "url": `${baseUrl}/devices/${codename}`,
  };

  const safe = (obj: object) => JSON.stringify(obj).replace(/<\/script>/gi, "<\\/script>");
  return [safe(breadcrumb), safe(product), safe(itemList)].join("\n");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { codename } = await params;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://romx.app";
    const res = await fetch(`${baseUrl}/api/devices?codename=${codename}&limit=1`, {
      next: { revalidate: 7200 }, // 📈 تحسين: من 1 ساعة إلى ساعتين لتوفير الاستدعاءات
    });

    if (!res.ok) throw new Error("Device not found");

    const data = await res.json();
    const device = data?.device;
    if (!device?.codename) throw new Error("Invalid device data");

    const dName = device.name || codename;
    const dBrand = device.brand ? String(device.brand) : "";
    const dChip  = device.chipset ? String(device.chipset) : "";
    const romsCount = device.romsCount ? Number(device.romsCount) : 0;

    // "Poco X7 Pro Custom ROMs & Kernels — RomX"
    const title = `${dName} Custom ROMs & Kernels — RomX`;

    // Rich description for Google snippets
    const description = [
      `Download ${romsCount > 0 ? romsCount + " custom" : "the best custom"} ROMs, Kernels, TWRP Recovery, and Magisk Modules for ${dName}`,
      dBrand ? `(${dBrand})` : "",
      dChip  ? `with ${dChip}` : "",
      "— all free, actively maintained, and reviewed by the community on RomX.",
    ].filter(Boolean).join(" ");

    const image = `${baseUrl}/og-default.png`; // Fallback image

    return {
      title,
      description,
      keywords: [
        device.name,
        device.codename,
        device.brand,
        device.chipset,
        device.name && `${device.name} custom rom`,
        device.name && `${device.name} kernel`,
        device.name && `${device.name} twrp`,
        device.name && `${device.name} recovery`,
        device.codename && `${device.codename} rom`,
        device.brand && `${device.brand} custom rom`,
        "custom rom download",
        "twrp recovery",
        "magisk module",
        "android customization",
        "romx",
      ].filter(Boolean) as string[],
      openGraph: {
        title,
        description,
        url:      `${baseUrl}/devices/${codename}`,
        type:     "website",
        images:   [{ url: image, width: 1200, height: 630, alt: `${device.name || codename} ROMs` }],
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
        canonical: `${baseUrl}/devices/${codename}`,
      },
    };
  } catch {
    return {
      title: `${codename} ROMs — RomX`,
      description: `Discover Custom ROMs, Kernels, and Recoveries for ${codename}.`,
      openGraph: {
        title:       `RomX — ${codename} ROMs`,
        description: `Custom ROMs and Android Development for ${codename}.`,
        type:        "website",
      },
    };
  }
}

export default async function DeviceLayout({ params, children }: Props) {
  const { codename } = await params;

  let jsonLdString = "";
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://romx.app";
    const res = await fetch(`${baseUrl}/api/devices?codename=${codename}&limit=1`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.device?.codename) {
        jsonLdString = buildJsonLd(data.device, baseUrl, codename);
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
