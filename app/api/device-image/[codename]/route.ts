/**
 * GET /api/device-image/[codename]?name=...&brand=...
 *
 * ══════════════════════════════════════════════════════
 * RomX Intelligent Device Image System — Server Layer
 * ══════════════════════════════════════════════════════
 *
 * المبدأ: السيرفر لا يجلب أي صورة ولا يخزن شيئاً.
 * مهمته الوحيدة: يبني أذكى قائمة URLs ممكنة ويرجعها للمتصفح.
 * المتصفح هو من يجرب ويحمّل — لأنه browser request لا يُبلَك.
 *
 * مصادر الـ URLs:
 *   ① GSMArena CDN  — fdn2.gsmarena.com/vv/bigpic/{slug}.jpg
 *   ② GSMArena Mirror — fdn.gsmarena.com
 *   ③ Wikipedia API endpoint (للمتصفح يطلبه مباشرة)
 *   ④ Wikimedia Commons
 *   ⑤ DuckDuckGo Instant Answer
 *   ⑥ Android device datasets (GitHub)
 *
 * كل الـ slugs تُبنى بخوارزمية — لا hardcode لأي جهاز.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, rateLimitedResponse, getClientIp } from "@/lib/api/middleware";
import { redisGet, redisSet } from "@/lib/upstash";
import { logger } from "@/lib/logger";
import { getDeviceImageCache } from "@/lib/server/device-cache";

// Upstash Redis cache TTL — يوم كامل
const REDIS_TTL = 60 * 60 * 24; // 24 hours in seconds
const REDIS_PREFIX = "imgmeta:v3:"; // v3 = fixed slug + Samsung special cases

// ── Slug Builders ─────────────────────────────────────────────────────

function basicSlug(s: string): string {
  return s.toLowerCase()
    .replace(/[()[\]]/g, " ").trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// GSMArena-specific: + → plus, REDMAGIC → red magic
function gsmaSlug(s: string): string {
  return s.toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/[()[\]]/g, " ")
    .replace(/\bredmagic\b/gi, "red magic")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Brand → GSMArena CDN prefix (فقط الحالات المختلفة)
const GSMA_BRAND: Record<string, string> = {
  poco: "xiaomi", redmi: "xiaomi", iqoo: "vivo",
  "red magic": "zte-nubia", redmagic: "zte-nubia", nubia: "zte-nubia",
};

// ── Smart GSMArena URL Builder ────────────────────────────────────────
// يولّد كل التركيبات الممكنة — يشتغل على أي جهاز تلقائياً
function buildGsmaUrls(brand: string, name: string, codename: string): string[] {
  const G1 = "https://fdn2.gsmarena.com/vv/bigpic";
  const G2 = "https://fdn.gsmarena.com/vv/bigpic";

  const bl       = brand.toLowerCase().trim();
  const nl       = name.toLowerCase().trim();
  const nameSlug = gsmaSlug(name);
  const cnSlug   = basicSlug(codename);

  // 1. Identify GSMArena brand prefix
  const twoW = nl.split(" ").slice(0, 2).join(" ");
  const oneW = nl.split(" ")[0];
  const brandSlug = GSMA_BRAND[bl] ?? GSMA_BRAND[twoW] ?? GSMA_BRAND[oneW] ?? basicSlug(brand);

  // 2. Clean name mapping (remove duplicate brand)
  const bp = brandSlug.split("-")[0];
  let nameNoBrand = nameSlug;
  if (nameSlug.startsWith(bp + "-")) nameNoBrand = nameSlug.slice(bp.length + 1);
  if (nameSlug.startsWith(brandSlug + "-")) nameNoBrand = nameSlug.slice(brandSlug.length + 1);

  // 3. Construct specific accurate slugs
  const fullSlug = `${brandSlug}-${nameNoBrand}`;
  const urls = new Set<string>();

  // Primary attempt
  urls.add(`${G1}/${fullSlug}.jpg`);
  
  // Try 5G/4G fallbacks explicitly
  if (!fullSlug.endsWith("-5g")) urls.add(`${G1}/${fullSlug}-5g.jpg`);
  if (!fullSlug.endsWith("-4g")) urls.add(`${G1}/${fullSlug}-4g.jpg`);

  // Secondary GSMArena Mirror
  urls.add(`${G2}/${fullSlug}.jpg`);

  // Sometimes GSMArena drops the brand entirely if it's very popular or redundant for sub-brands
  if (brandSlug === "xiaomi") {
    urls.add(`${G1}/${nameNoBrand}.jpg`); // e.g. poco-x6
  }

  // Red Magic special case
  if (nl.includes("red magic") || nl.includes("redmagic")) {
    const rm = gsmaSlug(nl.replace(/\bredmagic\b/, "red-magic").replace(/\bzte\b/, "").replace(/\bnubia\b/, ""));
    const rmFull = rm.startsWith("red-magic") ? `zte-nubia-${rm}` : rm;
    urls.add(`${G1}/${rmFull}.jpg`);
  }

  // Samsung Galaxy shorthand used by GSMArena
  if (nl.includes("galaxy") && bl === "samsung") {
    const gal = gsmaSlug(name.replace(/^samsung\s+/i, ""));
    urls.add(`${G1}/samsung-${gal}.jpg`);
  }

  return [...urls]
    .filter(u => !u.includes("undefined"))
    // generic/universal/unknown مش موجودة على GSMArena — بتعمل 404 فقط
    .filter(u => !/\/(generic|universal|unknown|android[-_]one)/.test(u.toLowerCase()))
    .slice(0, 6); // Limit to 6 maximum attempts
}

// ── Wikipedia API Endpoints ───────────────────────────────────────────
// نرجعهم للمتصفح يطلبهم مباشرة
function buildWikiEndpoints(name: string): string[] {
  const titles = [
    name,
    `${name} (smartphone)`,
    `${name} (mobile phone)`,
    name.replace(/\s+/g, "_"),
  ].map(t => encodeURIComponent(t)).join("|");

  return [
    `https://en.wikipedia.org/w/api.php?action=query&titles=${titles}&prop=pageimages&format=json&pithumbsize=600&piprop=thumbnail|original&redirects=1&origin=*`,
    `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name + " smartphone")}&srnamespace=6&srlimit=3&format=json&origin=*`,
  ];
}

// DuckDuckGo removed — CORS blocked from browser

// ── Brand guesser من الكودنيم ─────────────────────────────────────────
function guessBrandFromCodename(cn: string): { brand: string; name: string } {
  const HINTS: Array<{ match: string | RegExp; brand: string; prefix: string }> = [
    { match: /^(SM-|beyond|b[0-9]q|a[0-9]+)/,  brand: "Samsung",  prefix: "Samsung Galaxy" },
    { match: "pixel",    brand: "Google",   prefix: "Google Pixel"  },
    { match: "poco",     brand: "Xiaomi",   prefix: "Poco"          },
    { match: "redmi",    brand: "Xiaomi",   prefix: "Redmi"         },
    { match: "redmagic", brand: "ZTE",      prefix: "REDMAGIC"      },
    { match: "nubia",    brand: "ZTE",      prefix: "Nubia"         },
    { match: "nord",     brand: "OnePlus",  prefix: "OnePlus Nord"  },
    { match: "oneplus",  brand: "OnePlus",  prefix: "OnePlus"       },
    { match: "nothing",  brand: "Nothing",  prefix: "Nothing Phone" },
    { match: "rog",      brand: "ASUS",     prefix: "ASUS ROG Phone"},
    { match: "zenfone",  brand: "ASUS",     prefix: "ASUS Zenfone"  },
    { match: "find",     brand: "OPPO",     prefix: "OPPO Find"     },
    { match: "reno",     brand: "OPPO",     prefix: "OPPO Reno"     },
    { match: "xperia",   brand: "Sony",     prefix: "Sony Xperia"   },
    { match: "edge",     brand: "Motorola", prefix: "Motorola Edge" },
    { match: "moto",     brand: "Motorola", prefix: "Motorola"      },
  ];

  const cl = cn.toLowerCase();
  for (const h of HINTS) {
    const matched = typeof h.match === "string"
      ? cl.includes(h.match)
      : h.match.test(cl);
    if (matched) {
      const num = cl.replace(/[^0-9]/g, "").slice(0, 4);
      return { brand: h.brand, name: `${h.prefix} ${num}`.trim() };
    }
  }
  return {
    brand: "",
    name: cn.replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
  };
}

// ── Score: رتّب الـ URLs حسب الأولوية ────────────────────────────────
// GSMArena أولاً لأنه أدق، ثم Wikipedia
function scoreUrl(url: string): number {
  if (url.includes("fdn2.gsmarena")) return 100;
  if (url.includes("fdn.gsmarena"))  return 90;
  if (url.includes("upload.wikimedia")) return 70;
  if (url.includes("commons.wikimedia")) return 60;
  return 50;
}

// ── Memory cache بسيط (10 دقائق) ─────────────────────────────────────
const _cache = new Map<string, { data: object; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000;

// ── GET ───────────────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ codename: string }> },
) {
  const ip = getClientIp(req);
  if (!(await rateLimit(ip, 300))) return rateLimitedResponse(req);

  const { codename } = await params;
  if (!codename) return new NextResponse(null, { status: 400 });

  const cn = codename.toLowerCase().trim();

  // ① Check static device cache first (Phase 2.1)
  const staticCached = await getDeviceImageCache(cn);
  if (staticCached) {
    return NextResponse.json({
      codename: cn,
      name: staticCached.name,
      brand: staticCached.brand,
      gsmaUrls: [staticCached.url],
      wikiEndpoints: [],
      source: "static-cache"
    }, {
      headers: { "Cache-Control": "public, s-maxage=31536000, immutable" }, // 1 year cache
    });
  }

  // ② Memory cache (0ms)
  const hit = _cache.get(cn);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return NextResponse.json(hit.data, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
    });
  }

  // ② Upstash Redis cache (persistent across deployments)
  try {
    const cached = await redisGet(REDIS_PREFIX + cn);
    if (cached) {
      const parsed = JSON.parse(cached) as object;
      _cache.set(cn, { data: parsed, ts: Date.now() });
      return NextResponse.json(parsed, {
        headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
      });
    }
  } catch { /* Redis unavailable — continue */ }

  // جيب name/brand من query params
  const sp = new URL(req.url).searchParams;
  let name  = sp.get("name")?.trim()  || "";
  let brand = sp.get("brand")?.trim() || "";

  // Fallback: اخمن من الكودنيم
  if (!name) {
    const g = guessBrandFromCodename(cn);
    name  = g.name;
    brand = brand || g.brand;
  }

  // بنِ كل الـ URLs
  const gsmaUrls = buildGsmaUrls(brand, name, cn)
    .sort((a, b) => scoreUrl(b) - scoreUrl(a));

  const wikiEndpoints = buildWikiEndpoints(name);


  const response = {
    codename: cn,
    name,
    brand,
    // URLs للـ img.src مباشرة (GSMArena)
    gsmaUrls,
    // API endpoints للمتصفح يطلبها ويستخرج الـ URL منها
    wikiEndpoints,

  };

  _cache.set(cn, { data: response, ts: Date.now() });

  // Save to Upstash Redis (fire & forget). Surface failures so a down Redis
  // instance shows up in Sentry instead of silently serving uncached responses.
  redisSet(REDIS_PREFIX + cn, JSON.stringify(response), REDIS_TTL)
    .catch((err) => logger.error("deviceImage.redisSet", err, { codename: cn }));

  return NextResponse.json(response, {
    headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
  });
}
