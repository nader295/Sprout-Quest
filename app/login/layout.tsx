import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — RomX",
  description:
    "Sign in to RomX to upload, download, and explore custom ROMs, kernels, and recoveries for your Android device.",
  robots: { index: false, follow: false }, // login pages shouldn't be indexed
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
