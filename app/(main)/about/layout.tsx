import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://romx.app";

export const metadata: Metadata = {
  title: "About — RomX",
  description:
    "RomX is the global platform for Android ROM developers. Learn how we empower custom ROM, kernel, recovery, and module creators to share their work.",
  alternates: { canonical: `${BASE_URL}/about` },
  openGraph: {
    title: "About RomX",
    description:
      "The global platform for Android ROM developers — custom ROMs, kernels, recoveries, and modules.",
    url: `${BASE_URL}/about`,
    type: "website",
    siteName: "RomX",
  },
  robots: { index: true, follow: true },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
