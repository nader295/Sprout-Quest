import { NextRequest, NextResponse } from "next/server";

/**
 * Global middleware:
 *  1. Blocks common vulnerability-scanner paths early (saves CPU + log noise).
 *  2. Adds baseline security headers to every response.
 *  3. Forces HTTPS in production (HSTS) while keeping localhost usable.
 *
 * CORS and per-route auth remain in their respective API handlers; we do NOT
 * intercept /api requests here to avoid double work.
 */

// Patterns that are pure bot/scanner noise. Matched against the pathname only.
// Keep this list small — over-matching can break legit URLs.
const SCANNER_PATTERNS = [
  /^\/\.env(\.|$)/i,
  /^\/\.git(\/|$)/i,
  /^\/wp-(admin|login|content|includes)(\/|$)/i,
  /^\/xmlrpc\.php$/i,
  /^\/wp-config\.php$/i,
  /^\/phpmyadmin(\/|$)/i,
  /^\/\.ds_store$/i,
  /^\/\.vscode(\/|$)/i,
  /^\/\.idea(\/|$)/i,
  /^\/config\.json$/i,
  /^\/owa(\/|$)/i,
  /^\/cgi-bin(\/|$)/i,
];

function isScannerPath(pathname: string): boolean {
  for (const pattern of SCANNER_PATTERNS) {
    if (pattern.test(pathname)) return true;
  }
  return false;
}

function securityHeaders(isProd: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-DNS-Prefetch-Control": "on",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  };
  if (isProd) {
    // 180 days; include subdomains; preload-ready.
    headers["Strict-Transport-Security"] = "max-age=15552000; includeSubDomains";
  }
  return headers;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) Drop scanner noise with a bare 404 (no body — cheapest response).
  if (isScannerPath(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  // 2) Attach security headers to every response we forward.
  const res = NextResponse.next();
  const isProd = process.env.NODE_ENV === "production";
  for (const [key, value] of Object.entries(securityHeaders(isProd))) {
    res.headers.set(key, value);
  }
  return res;
}

// Skip Next internals and static assets; run on everything else including /api.
// CORS is still handled per-route, but security headers + scanner blocking
// benefit API routes too.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|woff|woff2|ttf|eot)$).*)",
  ],
};
