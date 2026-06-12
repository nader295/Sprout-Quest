import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  jsonResponse, errorResponse,
  getClientIp, rateLimit, rateLimitedResponse,
} from "@/lib/api/middleware";
import { verifyRequest } from "@/lib/firebase/auth-verify";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // Rate limit: 3 feedback per IP per hour
  const allowed = await rateLimit(`feedback:${ip}`, 3, 60 * 60 * 1000);
  if (!allowed) return rateLimitedResponse(req);

  try {
    const { type, text } = await req.json() as { type?: string; text?: string };

    if (!type || !["bug", "suggestion"].includes(type)) {
      return errorResponse("Invalid type", 400);
    }
    if (!text || text.trim().length < 10) {
      return errorResponse("Text too short", 400);
    }
    if (text.trim().length > 2000) {
      return errorResponse("Text too long", 400);
    }

    const sb = getSupabaseAdmin();

    // Get user if logged in (optional)
    let uid: string | null = null;
    let username: string | null = null;
    try {
      const user = await verifyRequest(req);
      if (user) {
        uid = user.uid;
        const { data: userData } = await sb.from("users").select("username").eq("id", user.uid).maybeSingle();
        username = userData?.username ?? null;

        // Per-user rate limit: 5 per day
        const userAllowed = await rateLimit(`feedback:uid:${uid}`, 5, 24 * 60 * 60 * 1000);
        if (!userAllowed) return rateLimitedResponse(req);
      }
    } catch { /* anonymous */ }

    await sb.from("feedback").insert({
      text: text.trim(),
      type,
      uid,
      username,
      ip: ip.substring(0, 10) + "***", // partial IP for privacy
      ua: req.headers.get("user-agent")?.substring(0, 200) ?? null,
      url: req.headers.get("referer") ?? null,
      reviewed: false,
      created_at: new Date().toISOString(),
    });

    return jsonResponse({ success: true });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Failed", 500);
  }
}
