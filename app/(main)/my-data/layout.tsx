import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ماذا يعرف RomX عنك؟ — شفافية كاملة",
  description:
    "صفحة الشفافية الكاملة — اعرف بالظبط كل البيانات التي يخزّنها RomX عنك. لا تتبع، لا بيع بيانات، لا إعلانات مستهدفة.",
  openGraph: {
    title:       "RomX — Zero Tracking ✓ شفافية كاملة",
    description: "افتح الصفحة واعرف بالظبط ما يعرفه RomX عنك — مباشرةً من قاعدة البيانات. لا أسرار.",
    type:        "website",
    locale:      "ar_EG",
  },
  twitter: {
    card:        "summary",
    title:       "RomX — Zero Tracking ✓",
    description: "اعرف كل ما يعرفه RomX عنك — شفافية 100%",
  },
  robots: { index: true, follow: true },
};

export default function MyDataLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
