/**
 * lib/upstash.ts — Upstash Redis Client
 *
 * Rate Limiter يعمل على Vercel Serverless بشكل صحيح.
 * بخلاف الـ in-memory، هنا الحصة مشتركة بين كل instances.
 *
 * متطلبات البيئة:
 *   UPSTASH_REDIS_REST_URL   — من upstash.com
 *   UPSTASH_REDIS_REST_TOKEN — من upstash.com
 */

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

// ── HTTP Client بسيط بدون dependency ─────────────────────
async function upstashFetch(
  command: string[],
  url: string,
  token: string
): Promise<unknown> {
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([command]),
  });
  if (!res.ok) throw new Error(`Upstash error: ${res.status}`);
  const data = (await res.json()) as { result: unknown }[];
  return data[0]?.result;
}

// ── Sliding Window Rate Limiter ───────────────────────────
export async function rateLimit(
  identifier: string,
  maxRequests = 60,
  windowMs = 60_000
): Promise<RateLimitResult> {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  // لو Upstash مش مضبوط — fallback للـ in-memory مؤقتاً
  if (!url || !token) {
    return inMemoryRateLimit(identifier, maxRequests, windowMs);
  }

  const key = `rl:${identifier}`;
  const windowSec = Math.ceil(windowMs / 1000);
  const now = Date.now();

  try {
    // INCR + EXPIRE في pipeline واحد = طلب واحد فقط
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, windowSec, "NX"],
        ["TTL", key],
      ]),
    });

    if (!res.ok) throw new Error("Upstash error");
    const [[, count], , [, ttl]] = (await res.json()) as [
      [string, number],
      unknown,
      [string, number]
    ];

    const remaining = Math.max(0, maxRequests - count);
    const resetMs   = now + (ttl > 0 ? ttl * 1000 : windowMs);

    return { allowed: count <= maxRequests, remaining, resetMs };
  } catch {
    // لو Upstash فشل — fallback بدل توقف الموقع
    return inMemoryRateLimit(identifier, maxRequests, windowMs);
  }
}

// ── In-Memory Fallback (للـ development والطوارئ) ────────
interface RLEntry { count: number; resetTime: number }
const _g = global as typeof global & { _rl?: Map<string, RLEntry> };
function getStore() {
  if (!_g._rl) _g._rl = new Map();
  return _g._rl;
}

function inMemoryRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const map = getStore();
  const now = Date.now();

  // تنظيف المنتهية
  for (const [k, v] of map) if (now > v.resetTime) map.delete(k);

  const entry = map.get(identifier);
  if (!entry || now > entry.resetTime) {
    map.set(identifier, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetMs: now + windowMs };
  }
  entry.count++;
  return {
    allowed: entry.count <= maxRequests,
    remaining: Math.max(0, maxRequests - entry.count),
    resetMs: entry.resetTime,
  };
}

// ── Cache Helper (اختياري) ────────────────────────────────
export async function redisGet(key: string): Promise<string | null> {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    });
    const data = (await res.json()) as { result: string | null };
    return data.result;
  } catch { return null; }
}

export async function redisSet(
  key: string,
  value: string,
  exSeconds?: number
): Promise<void> {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  try {
    const command = exSeconds
      ? ["SET", key, value, "EX", String(exSeconds)]
      : ["SET", key, value];
    await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([command]),
    });
  } catch { /* silent */ }
}

export async function redisSetNX(
  key: string,
  value: string,
  exSeconds: number
): Promise<boolean> {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return true; // No redis = proceed without contention
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([["SET", key, value, "EX", String(exSeconds), "NX"]]),
    });
    const data = (await res.json()) as { result: string | null }[];
    return data[0]?.result === "OK";
  } catch { return true; }
}
