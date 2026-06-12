/**
 * app/api/devices/watch/route.ts
 * Watch/Unwatch a device — get notified when a new ROM is released for it
 * Migrated to Supabase — uses `device_watches` table
 */
import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyRequest } from "@/lib/firebase/auth-verify";
import { getClientIp, rateLimit, rateLimitedResponse, jsonResponse, errorResponse } from "@/lib/api/middleware";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 30, 60_000)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user) return errorResponse("Unauthorized", 401, req);

  const { device, action } = await req.json() as { device: string; action: "watch" | "unwatch" };
  if (!device?.trim()) return errorResponse("Missing device", 400, req);
  if (action !== "watch" && action !== "unwatch") return errorResponse("Invalid action", 400, req);

  const sb = getSupabaseAdmin();
  const normalizedDevice = device.toLowerCase().trim();
  const watchId = `${user.uid}_${normalizedDevice}`;

  if (action === "watch") {
    await sb.from("device_watches").upsert({
      id: watchId,
      uid: user.uid,
      device: normalizedDevice,
      created_at: new Date().toISOString(),
    }, { onConflict: "id" });
    return jsonResponse({ success: true, watching: true }, 200, req);
  } else {
    await sb.from("device_watches").delete().eq("id", watchId);
    return jsonResponse({ success: true, watching: false }, 200, req);
  }
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 60, 60_000)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user) return errorResponse("Unauthorized", 401, req);

  const sb = getSupabaseAdmin();
  const { data } = await sb.from("device_watches").select("device").eq("uid", user.uid).limit(50);
  const devices = (data ?? []).map((d: { device: string }) => d.device);
  return jsonResponse({ devices }, 200, req);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: "GET, POST, OPTIONS" } });
}
