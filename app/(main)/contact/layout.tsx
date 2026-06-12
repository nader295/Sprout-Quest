import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us — RomX",
  description: "Get in touch with the RomX team. We're here to help with questions about the platform, your account, or partnership opportunities.",
  robots: { index: true, follow: true },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
