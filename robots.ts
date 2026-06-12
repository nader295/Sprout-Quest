import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://romx.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // ── General crawlers ─────────────────────────────────────
      {
        userAgent: "*",
        allow: ["/", "/explore", "/devices", "/rom/", "/u/", "/about", "/leaderboard", "/collections", "/privacy", "/contact"],
        disallow: [
          "/api/",
          "/admin",
          "/upload",
          "/settings",
          "/notifications",
          "/favorites",
          "/feed",
          "/feedback",
          "/compare",
          "/search",
          "/earnings",
          "/*?*cursor=",  // prevent crawling paginated API params
          "/*?*page=",
          "/*?*q=",       // search queries
        ],
      },
      // ── Googlebot: give full access to indexable content ─────
      {
        userAgent: "Googlebot",
        allow: ["/", "/explore", "/devices", "/rom/", "/u/", "/about", "/privacy", "/contact", "/leaderboard", "/collections"],
        disallow: [
          "/api/", "/admin", "/upload", "/settings", "/notifications", 
          "/favorites", "/feed", "/feedback", "/compare", "/search", "/earnings",
          "/*?*cursor=", "/*?*page=", "/*?*q="
        ],
      },
      // ── Social media crawlers: allow for rich previews ───────
      {
        userAgent: ["Twitterbot", "facebookexternalhit", "LinkedInBot", "WhatsApp", "TelegramBot"],
        allow: "/",
        disallow: ["/api/", "/admin"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
