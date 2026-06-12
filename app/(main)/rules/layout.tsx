import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://romx.app";

export const metadata: Metadata = {
  title: "Community Rules — RomX",
  description:
    "Community guidelines for uploading custom ROMs, kernels, and modules on RomX. Read the rules before publishing.",
  alternates: { canonical: `${BASE_URL}/rules` },
  openGraph: {
    title: "RomX Community Rules",
    description: "Publishing guidelines for custom ROMs, kernels, and modules.",
    url: `${BASE_URL}/rules`,
    type: "website",
    siteName: "RomX",
  },
  robots: { index: true, follow: true },
};

export default function RulesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
