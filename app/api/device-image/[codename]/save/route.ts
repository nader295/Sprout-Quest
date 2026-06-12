/**
 * POST /api/device-image/[codename]/save
 * يخزن الـ URL الناجح في Supabase devices table.
 *
 * P0 hardened:
 *   - Requires authenticated user (was public → anyone could poison device images).
 *   - Codename is normalized + validated against a strict regex.
 *   - URL must be HTTPS and its host must be on the allowlist we actually use
 *     for device photos (GSMArena, Wikipedia/Wikimedia, Supabase storage).
 */
import { NextRequest, NextResponse } from "next/server";
import { sbAdmin } from "@/lib/supabase/admin";
import { verifyRequest } from "@/lib/api/auth";

const CODENAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

const ALLOWED_HOSTS = new Set<string>([
  "fdn2.gsmarena.com",
  "fdn.gsmarena.com",
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "en.wikipedia.org",
]);

function resolveSource(host: string): string {
  if (host.endsWith("gsmarena.com")) return "gsmarena";
  if (host.endsWith("wikimedia.org") || host.endsWith("wikipedia.org")) return "wikipedia";
  return "auto";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ codename: string }> }
) {
  try {
    const user = await verifyRequest(req);
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { codename: raw } = await params;
    const codename = (raw || "").toLowerCase().trim();

    const body = (await req.json().catch(() => ({}))) as { url?: string };
    const url = typeof body.url === "string" ? body.url.trim() : "";

    if (!codename || !CODENAME_RE.test(codename)) {
      return NextResponse.json({ error: "invalid_codename" }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: "invalid_url" }, { status: 400 });
    }

    if (parsed.protocol !== "https:") {
      return NextResponse.json({ error: "https_required" }, { status: 400 });
    }

    const host = parsed.hostname.toLowerCase();
    const isSupabaseStorage = host.endsWith(".supabase.co") && parsed.pathname.includes("/storage/v1/object/");
    if (!ALLOWED_HOSTS.has(host) && !isSupabaseStorage) {
      return NextResponse.json({ error: "host_not_allowed" }, { status: 400 });
    }

    await sbAdmin
      .from("devices")
      .upsert(
        {
          codename,
          image_url: parsed.toString(),
          image_source: isSupabaseStorage ? "supabase" : resolveSource(host),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "codename", ignoreDuplicates: false },
      );

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[device-image/save] failed:", err);
    return new NextResponse(null, { status: 500 });
  }
}
