// app/api/config/route.ts — Supabase فقط
import { NextRequest, NextResponse } from "next/server";
import { errorResponse, getClientIp, rateLimit, rateLimitedResponse } from "@/lib/api/middleware";
import { verifyRequest } from "@/lib/firebase/auth-verify";
import { ADMIN_EMAIL } from "@/lib/constants";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// ═══════════════════════════════════════════════════════════════
// app/api/config/route.ts — Supabase فقط
// ═══════════════════════════════════════════════════════════════
const DEFAULT_PUBLIC_CONFIG = { channelLinkMinXP: 0, donationMinXP: 0 };
export type PublicConfig = typeof DEFAULT_PUBLIC_CONFIG;

async function getPublicConfig(): Promise<PublicConfig> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from("settings").select("value").eq("key", "public_config").single();
    if (!data?.value) return DEFAULT_PUBLIC_CONFIG;
    return { ...DEFAULT_PUBLIC_CONFIG, ...(data.value as Partial<PublicConfig>) };
  } catch { return DEFAULT_PUBLIC_CONFIG; }
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(`pub_cfg_get:${ip}`, 60)) return rateLimitedResponse(req);
  const config = await getPublicConfig();
  // If request carries auth header, skip CDN cache so admin always sees live data
  const isAuthed = !!req.headers.get("authorization");
  return NextResponse.json(config, {
    headers: {
      "Cache-Control": isAuthed
        ? "no-store"
        : "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await verifyRequest(req);
  if (!user || user.email !== ADMIN_EMAIL) return errorResponse("Unauthorized", 403, req);

  const sb   = getSupabaseAdmin();
  const body = await req.json().catch(() => ({}));
  const current = await getPublicConfig();
  const updated = { ...current, ...body };

  await sb.from("settings").upsert({
    key: "public_config", value: updated, updated_at: new Date().toISOString(),
  }, { onConflict: "key" });

  return NextResponse.json({ ok: true, config: updated });
}


