import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { rateLimit as upstashRateLimit } from "@/lib/upstash";

// ══════════════════════════════════════════════════════════════
//  Rate Limiter — Upstash Redis (يعمل صح على Vercel Serverless)
//  بخلاف الـ in-memory، هنا الحصة مشتركة بين كل instances.
//  Fallback تلقائي للـ in-memory لو Upstash مش مضبوط.
// ══════════════════════════════════════════════════════════════

export async function rateLimit(
  identifier: string,
  maxRequests = 60,
  windowMs = 60_000
): Promise<boolean> {
  const result = await upstashRateLimit(identifier, maxRequests, windowMs);
  return result.allowed;
}

/**
 * Dual rate limit for authenticated actions.
 * Applies two independent buckets and rejects if *either* is exceeded:
 *   - per-uid  (tight):  stops one user spamming across sessions/IPs/VPNs
 *   - per-ip   (loose):  stops bot farms that spin up fresh accounts from one host
 *
 * Use this on all mutating POST/PUT/DELETE routes that require auth.
 * When `uid` is null (anonymous or pre-auth), falls back to IP-only.
 *
 * Returns `true` when the request is allowed. The buckets use independent
 * Upstash keys so they can be tuned separately.
 */
export async function rateLimitUserOrIp(
  uid: string | null | undefined,
  ip: string,
  opts: { perUser?: number; perIp?: number; windowMs?: number; scope?: string } = {}
): Promise<boolean> {
  const { perUser = 15, perIp = 60, windowMs = 60_000, scope = "rl" } = opts;
  if (uid) {
    const userOk = await upstashRateLimit(`${scope}:u:${uid}`, perUser, windowMs);
    if (!userOk.allowed) return false;
  }
  const ipOk = await upstashRateLimit(`${scope}:ip:${ip}`, perIp, windowMs);
  return ipOk.allowed;
}

/** نسخة sync للتوافق — تستخدم in-memory فقط */
export function rateLimitSync(
  identifier: string,
  maxRequests = 60,
  windowMs = 60_000
): boolean {
  const _g = global as typeof global & { _rl?: Map<string, { count: number; resetTime: number }> };
  if (!_g._rl) _g._rl = new Map();
  const now = Date.now();
  const entry = _g._rl.get(identifier);
  if (!entry || now > entry.resetTime) {
    _g._rl.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

// ── IP Extraction ───────────────────────────────────────────────
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export function hashIp(ip: string, salt = "romx-view"): string {
  return createHash("sha256")
    .update(`${salt}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

// ── CORS ─────────────────────────────────────────────────────────
// In production, only the configured site origin is allowed.
// A missing NEXT_PUBLIC_SITE_URL is a misconfiguration — we deny the
// header entirely rather than echoing the caller's origin (which would
// effectively be wildcard and allow any site to call credentialed APIs).
const ALLOWED_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");

// Optional: comma-separated list of extra allowed origins (e.g. admin preview).
const EXTRA_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

function isAllowed(origin: string | null | undefined): origin is string {
  if (!origin) return false;
  const normalized = origin.replace(/\/$/, "");
  return normalized === ALLOWED_ORIGIN || EXTRA_ORIGINS.includes(normalized);
}

export function corsHeaders(reqOrigin?: string | null): Record<string, string> {
  const baseHeaders = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  // Dev: echo the caller origin (localhost ports change; don't break DX).
  if (process.env.NODE_ENV !== "production") {
    return {
      "Access-Control-Allow-Origin": reqOrigin || "*",
      ...baseHeaders,
    };
  }

  // Prod: strict allowlist. Never fall back to "*" or echo untrusted origins.
  if (isAllowed(reqOrigin)) {
    return {
      "Access-Control-Allow-Origin": reqOrigin,
      Vary: "Origin",
      ...baseHeaders,
    };
  }

  // Same-origin requests don't need CORS headers; omitting them is safe.
  // Cross-origin requests from disallowed origins get no ACAO → browser blocks.
  return { ...baseHeaders, Vary: "Origin" };
}

// ── Response Helpers ─────────────────────────────────────────────
function generateRequestId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function jsonResponse(data: unknown, status = 200, req?: NextRequest) {
  const origin = req?.headers.get("origin");
  const requestId = req?.headers.get("x-request-id") || generateRequestId();
  return NextResponse.json(data, {
    status,
    headers: { ...corsHeaders(origin), "X-Request-ID": requestId },
  });
}

export function cachedJsonResponse(
  data: unknown,
  ttlSeconds: number,
  req?: NextRequest
) {
  const origin = req?.headers.get("origin");
  const headers: Record<string, string> = {
    ...corsHeaders(origin),
    "Cache-Control": `public, s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 2}, stale-if-error=3600`,
  };
  return NextResponse.json(data, { status: 200, headers });
}

export function errorResponse(
  message: string,
  status = 400,
  req?: NextRequest
) {
  const origin = req?.headers.get("origin");
  return NextResponse.json(
    { error: message },
    { status, headers: corsHeaders(origin) }
  );
}

export function rateLimitedResponse(req?: NextRequest) {
  return errorResponse("Too many requests. Please try again later.", 429, req);
}

export function getTokenFromHeader(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}
