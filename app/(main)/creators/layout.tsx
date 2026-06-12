import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://romx.app";

export const metadata: Metadata = {
  title: "For Creators — RomX",
  description:
    "Monetize your custom ROMs, kernels, and Android modifications. Learn how RomX rewards developers with ad revenue sharing and sponsorships.",
  alternates: { canonical: `${BASE_URL}/creators` },
  openGraph: {
    title: "For Creators — RomX",
    description:
      "Monetize your custom ROMs with ad revenue sharing. Join the RomX creator program.",
    url: `${BASE_URL}/creators`,
    type: "website",
    siteName: "RomX",
  },
  robots: { index: true, follow: true },
};

export default function CreatorsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
