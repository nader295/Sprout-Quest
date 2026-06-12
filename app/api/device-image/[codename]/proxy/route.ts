/**
 * app/api/device-image/[codename]/proxy/route.ts  — EDGE RUNTIME
 *
 * Edge Function تعمل fetch من GSMArena بـ IPs مختلفة
 * Edge Runtime ≠ Serverless → IPs مختلفة → ما بيتبلوكش
 *
 * GET /api/device-image/[codename]/proxy?url=ENCODED_URL
 */

export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl || !imageUrl.startsWith("https://")) {
    return new Response(null, { status: 400 });
  }

  // تحقق إن الـ URL من مصادر موثوقة فقط
  const ALLOWED_DOMAINS = [
    "fdn2.gsmarena.com",
    "fdn.gsmarena.com",
    "img.devicespecifications.com",
    "www.devicespecifications.com",
    "www.kimovil.com",
    "upload.wikimedia.org",
    "en.wikipedia.org",
  ];

  const domain = new URL(imageUrl).hostname;
  if (!ALLOWED_DOMAINS.includes(domain)) {
    return new Response(null, { status: 403 });
  }

  try {
    const res = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "image/webp,image/apng,image/avif,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.gsmarena.com/",
        "Cache-Control": "no-cache",
      },
    });

    if (!res.ok) return new Response(null, { status: 404 });

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return new Response(null, { status: 404 });
    }

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 4000) {
      return new Response(null, { status: 404 }); // placeholder صغيرة
    }

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type":  contentType,
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable", // تحسين: من 30 يوم إلى سنة كاملة
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
