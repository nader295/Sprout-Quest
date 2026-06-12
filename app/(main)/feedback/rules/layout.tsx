import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feedback Guidelines — RomX",
  description: "Rules and guidelines for submitting feedback and bug reports on RomX.",
  robots: { index: false, follow: true },
};

export default function FeedbackRulesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
