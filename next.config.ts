import type { NextConfig } from "next";
// next-pwa plugin
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheStartUrl: false,
  dynamicStartUrl: false,
  workboxOptions: {
    disableDevLogs: true,
    // Exclude external URLs from being cached by the service worker
    // This prevents duplicate CORS headers on cross-origin requests
    navigateFallbackDenylist: [/^\/api\//],
    runtimeCaching: [
      {
        // Exclude external API/image domains from SW caching
        urlPattern: /^https:\/\/(fdn2\.gsmarena\.com)\/.*/i,
        handler: "NetworkOnly" as const,
      },
    ],
  },
});

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // ✅ FIX: Firebase `signInWithPopup` relies on `window.closed` to detect when
  // the OAuth popup finishes. Without this header, the browser applies a
  // stricter default COOP that blocks that check — the popup closes but
  // Firebase never sees it, so the sign-in promise hangs forever and the
  // user gets stuck on the login page until a manual refresh.
  // `same-origin-allow-popups` keeps COOP isolation for same-origin windows
  // while explicitly allowing popups to cross-origin providers (Google,
  // GitHub, Twitter) to communicate back via `window.closed`.
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com https://adservice.google.com https://www.googletagservices.com https://tpc.googlesyndication.com https://www.google.com https://googleads.g.doubleclick.net https:",
      "style-src 'self' 'unsafe-inline' https:",
      "font-src 'self' https: data:",
      "img-src 'self' data: blob: https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://googleads.g.doubleclick.net https://www.google.com https:",
      "media-src 'self' https: data: blob:",
      "connect-src 'self' https://pagead2.googlesyndication.com https://adservice.google.com https://googleads.g.doubleclick.net https: wss:",
      "frame-src 'self' https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com https:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // ── Build ID فريد لكل deploy — يكسر كاش CDN والمتصفح أوتوماتيك ──────
  generateBuildId: async () => {
    // كل deploy بياخد timestamp فريد → Next.js بيغير مسارات الـ JS/CSS
    // المتصفح بيشوف URLs جديدة ويجيب كل حاجة من أول
    return `romx-${Date.now()}`;
  },

  // ── staleTimes: صفر للـ dynamic pages ─────────────────────────────────
  experimental: {
    staleTimes: {
      dynamic: 0,   // صفحات بـ useEffect/useState — لا caching
      static: 300,  // صفحات static — كاش 5 دقائق بس
    },
  },
  // firebase-admin و @google-cloud/firestore يحتويان على opentelemetry
  // لازم يشتغلوا في runtime مش يتبندلوا في build time
  serverExternalPackages: [
    "firebase-admin",
    "@google-cloud/firestore",
    "@opentelemetry/api",
    "google-auth-library",
    "https-proxy-agent",
    "agent-base",
  ],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // منع bundling مكتبات Node.js في الـ client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        fs: false,
        http2: false,
        tls: false,
        child_process: false,
        dns: false,
      };
    }
    return config;
  },
  images: {
    unoptimized: true, // ← DISABLED: يمنع استهلاك حصة Vercel Image Optimization (يحل خطأ 402)
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "ui-avatars.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "commons.wikimedia.org" },
      { protocol: "https", hostname: "wsrv.nl" },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async redirects() {
    return [
      {
        source: '/explore',
        destination: '/search',
        permanent: true,
      },
      {
        source: '/profile/:path*',
        destination: '/u/:path*',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      // ── Security headers على كل حاجة ──────────────────────────────────
      {
        source: "/(.*)",
        headers: securityHeaders,
      },

      // ── HTML pages: no-cache + revalidate ─────────────────────────────
      // المتصفح بيحتفظ بنسخة لكن بيسأل السيرفر "في جديد؟" قبل ما يستخدمها
      // لو في deploy جديد (ETag اتغيرت) → يجيب الجديد
      // لو مفيش جديد → يستخدم الكاش بدون download = سريع وصح
      {
        source: "/((?!_next/static|_next/image|favicon\.ico|.*\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf)).*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Vercel-CDN-Cache-Control", value: "public, s-maxage=0, must-revalidate" },
          { key: "CDN-Cache-Control", value: "public, s-maxage=0, must-revalidate" },
        ],
      },

      // ── API routes: لا كاش على الـ browser، كاش قصير على CDN ──────────
      {
        source: "/api/((?!devices|stats|device-image).*)",
        headers: [
          { key: "Cache-Control", value: "no-store" },
        ],
      },

      // ── API: devices + stats — كاش CDN قصير ────────────────────────────
      {
        source: "/api/devices",
        headers: [{ key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" }],
      },
      {
        source: "/api/stats",
        headers: [{ key: "Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=600" }],
      },
      {
        source: "/api/device-image/:path*",
        headers: [{ key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=86400" }],
      },

      // ── Static assets: كاش سنة كاملة (filename بيتغير مع كل deploy) ────
      // Next.js بيضيف hash في اسم الملف → أي تغيير = URL جديد = كاش جديد
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/_next/image/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default withPWA(nextConfig);
