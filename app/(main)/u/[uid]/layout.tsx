import type { Metadata } from "next";

interface Props {
  params: Promise<{ uid: string }>;
  children: React.ReactNode;
}

// Single fetch shared across metadata, JSON-LD, and layout render
async function fetchUser(uid: string): Promise<Record<string, unknown> | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://romx.app";
    const res = await fetch(`${baseUrl}/api/users?id=${uid}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user?.uid ? user : null;
  } catch {
    return null;
  }
}

function buildProfileJsonLd(user: Record<string, unknown>, baseUrl: string, uid: string): string {
  const displayName = String(user.name || user.username || "Developer");
  const profile = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "url": `${baseUrl}/u/${uid}`,
    "mainEntity": {
      "@type": "Person",
      "name": displayName,
      "alternateName": user.username || undefined,
      "description": (user.bio as string | undefined)?.slice(0, 300) || undefined,
      "image": (user.photo as string | undefined) || undefined,
      "url": `${baseUrl}/u/${uid}`,
      "interactionStatistic": [
        user.followersCount !== undefined
          ? {
              "@type": "InteractionCounter",
              "interactionType": "https://schema.org/FollowAction",
              "userInteractionCount": Number(user.followersCount || 0),
            }
          : null,
        user.romsCount !== undefined
          ? {
              "@type": "InteractionCounter",
              "interactionType": "https://schema.org/CreateAction",
              "userInteractionCount": Number(user.romsCount || 0),
            }
          : null,
      ].filter(Boolean),
    },
  };
  return JSON.stringify(profile).replace(/<\/script>/gi, "<\\/script>");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { uid } = await params;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://romx.app";
    const userRaw = await fetchUser(uid);
    if (!userRaw) throw new Error("User not found");
    const user = userRaw as Record<string, any>;

    const displayName: string = user.name || user.username || "Developer";
    const handle = user.username ? `@${user.username}` : "";
    const title = `${displayName} ${handle} — RomX`;
    const description: string = [
      typeof user.bio === "string" ? user.bio.slice(0, 120) : "",
      user.romsCount && `${user.romsCount} releases`,
      typeof user.totalDownloads === "number"
        ? `${user.totalDownloads.toLocaleString()} downloads`
        : "",
    ]
      .filter(Boolean)
      .join(" · ") || `${displayName}'s developer profile on RomX.`;

    const image: string = typeof user.photo === "string" && user.photo.startsWith("http")
      ? user.photo
      : `${baseUrl}/og-default.png`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `${baseUrl}/u/${uid}`,
        type: "profile",
        images: [{ url: image, width: 400, height: 400, alt: displayName }],
        siteName: "RomX",
      },
      twitter: {
        card: "summary",
        title,
        description,
        images: [image],
        site: "@RomXApp",
      },
      alternates: {
        canonical: `${baseUrl}/u/${uid}`,
      },
    };
  } catch {
    return {
      title: "Developer Profile — RomX",
      description: "Developer profiles on RomX — The Android Development Platform.",
    };
  }
}

export default async function UserLayout({ params, children }: Props) {
  const { uid } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://romx.app";
  const user = await fetchUser(uid);
  const jsonLd = user ? buildProfileJsonLd(user, baseUrl, uid) : "";

  return (
    <>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      )}
      {children}
    </>
  );
}
