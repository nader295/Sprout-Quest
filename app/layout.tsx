import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Arabic } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/lib/hooks/use-auth";
import { SettingsProvider } from "@/lib/hooks/use-settings";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const notoArabic = Noto_Sans_Arabic({ subsets: ["arabic"], variable: "--font-arabic", weight: ["400", "500", "600", "700"] });

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://romx.app";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "RomX — The Android Development Platform",
    template: "%s — RomX",
  },
  description:
    "The ultimate platform for Android ROM developers. Discover, share and collaborate on Custom ROMs, Kernels, Recoveries, Magisk Modules and GSI.",
  keywords: [
    "custom rom", "android rom", "kernel", "recovery", "magisk module",
    "gsi", "rom developer", "xda developers", "romx", "android development",
    "twrp", "orangefox", "lineageos", "pixel experience", "android modding",
    "custom firmware", "android customization", "rom download", "android tweak",
    "rooting android", "bootloader unlock", "android community",
  ],
  authors: [{ name: "RomX" }],
  creator: "RomX",
  publisher: "RomX",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    title: "RomX — The Android Development Platform",
    description: "Discover, share and collaborate on Custom ROMs, Kernels, Recoveries, Magisk Modules and GSI.",
    url: BASE_URL,
    siteName: "RomX",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "RomX — The Android Development Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RomX — The Android Development Platform",
    description: "Discover Custom ROMs, Kernels, Recoveries and Modules.",
    images: ["/og-default.png"],
    site: "@RomXApp",
  },
  icons: {
    // Next.js App Router يجيب الأيقونة من app/icon.tsx تلقائياً
    // favicon.ico مش موجود كـ static file — نستخدم الـ PNG المتولّد
    icon: [
      { url: "/icon", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/icon",
    apple: "/icon",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)",  color: "#07070b" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" className="dark" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebSite",
                "@id": "https://romx.app/#website",
                "url": "https://romx.app",
                "name": "RomX",
                "description": "The ultimate platform for Android ROM developers",
                "potentialAction": {
                  "@type": "SearchAction",
                  "target": { "@type": "EntryPoint", "urlTemplate": "https://romx.app/search?q={search_term_string}" },
                  "query-input": "required name=search_term_string"
                }
              },
              {
                "@type": "Organization",
                "@id": "https://romx.app/#organization",
                "name": "RomX",
                "url": "https://romx.app",
                "logo": "https://romx.app/icon-512.png",
                "sameAs": [],
                "description": "The global platform for Custom ROMs, Kernels, Recoveries and Magisk Modules"
              }
            ]
          }).replace(/<\/script>/g, "<\\/script>") }}
        />
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="preconnect" href="https://firestore.googleapis.com" />
        <link rel="preconnect" href="https://identitytoolkit.googleapis.com" />
        <link rel="dns-prefetch" href="https://ui-avatars.com" />
        {/* theme-color is managed by Next.js viewport export + use-settings.tsx dynamically */}

        {/* AdSense script is loaded once below via Next.js <Script afterInteractive> */}

        {/* ── HilltopAds: referrer meta مطلوب لزيادة الإيرادات 20% ── */}
        <meta name="referrer" content="no-referrer-when-downgrade" />

        {/* ── Google IMA SDK preconnect لتسريع تحميل الفيديو ── */}
        <link rel="preconnect" href="https://imasdk.googleapis.com" />
        <link rel="preconnect" href="https://direct-league.com" />
        
        
        {/* ── Anti-flash script: يطبق الـ theme قبل أي render لمنع الـ FOUC ── */}
        <script dangerouslySetInnerHTML={{ __html: `
(function(){
  try {
    var s = localStorage.getItem('romx_settings');
    var p = s ? JSON.parse(s) : {};
    var mode = p.mode || 'dark';
    var root = document.documentElement;
    var effective = mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : mode;
    root.classList.remove('dark','light','amoled');
    if (mode === 'amoled') root.classList.add('dark', 'amoled');
    else root.classList.add(effective);
    
    // Update ALL theme-color meta tags (handles media-query variants)
    var themeColorValue = mode === 'amoled' ? '#000000' : effective === 'light' ? '#ffffff' : '#07070b';
    document.querySelectorAll('meta[name="theme-color"]').forEach(function(el) {
      el.setAttribute('content', themeColorValue);
    });

    // Apply accent color immediately
    var themes = {
      blue:   { h: '#1d9bf0', d: 'rgba(29,155,240,0.12)',  g: 'rgba(29,155,240,0.28)' },
      green:  { h: '#22c55e', d: 'rgba(34,197,94,0.12)',   g: 'rgba(34,197,94,0.28)'  },
      orange: { h: '#f97316', d: 'rgba(249,115,22,0.12)',  g: 'rgba(249,115,22,0.28)' },
      rose:   { h: '#f43f5e', d: 'rgba(244,63,94,0.12)',   g: 'rgba(244,63,94,0.28)'  },
      gold:   { h: '#f59e0b', d: 'rgba(245,158,11,0.12)',  g: 'rgba(245,158,11,0.28)' },
      cyan:   { h: '#06b6d4', d: 'rgba(6,182,212,0.12)',   g: 'rgba(6,182,212,0.28)'  },
    };
    var t = themes[p.accent] || themes.blue;
    root.style.setProperty('--primary', t.h);
    root.style.setProperty('--primary-dim', t.d);
    root.style.setProperty('--primary-glow', t.g);
    // Apply lang/dir
    if (p.lang) {
      root.lang = p.lang;
      root.dir = ['ar','fa','he','ur'].includes(p.lang) ? 'rtl' : 'ltr';
    }
  } catch(e) {
    document.documentElement.classList.add('dark');
  }
})();
        ` }} />
        <Script id="gcm-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          // Google Consent Mode v2 — default: deny all until user decides
          gtag('consent', 'default', {
            ad_storage:          'denied',
            ad_user_data:        'denied',
            ad_personalization:  'denied',
            analytics_storage:   'denied',
            wait_for_update:     500
          });
          // Restore consent immediately if already set (avoid flicker)
          try {
            var c = localStorage.getItem('romx_cookie_consent');
            if (c === 'accepted') {
              gtag('consent', 'update', {
                ad_storage: 'granted', ad_user_data: 'granted',
                ad_personalization: 'granted', analytics_storage: 'granted'
              });
            }
          } catch(e) {}
        `}} />
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3751919116318287"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />

        {/* Linkvertise CDN — loaded once, publisher ID set per-user dynamically */}
        <Script strategy="lazyOnload" src="https://publisher.linkvertise.com/cdn/linkvertise.js" />
      </head>
      <body className={`${inter.variable} ${notoArabic.variable} font-sans`}>
        <SettingsProvider>
          <AuthProvider>{children}</AuthProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
