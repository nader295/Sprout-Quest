import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, getClientIp, rateLimit, rateLimitedResponse } from "@/lib/api/middleware";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyRequest } from "@/lib/firebase/auth-verify";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 60)) return rateLimitedResponse(req);

  const { searchParams } = new URL(req.url);
  const romId = searchParams.get("romId");
  if (!romId) return errorResponse("Missing romId", 400);

  try {
    const sb = getSupabaseAdmin();
    const { data: items, error } = await sb
      .from("rom_versions")
      .select("*")
      .eq("rom_id", romId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return jsonResponse({ items: items ?? [] });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Failed", 500);
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 20, 60_000)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user) return errorResponse("Unauthorized", 401);

  try {
    const body = await req.json();
    const { romId, version, android, changelog, downloadUrl, size, downloadCount } = body;
    if (!romId || !version) return errorResponse("Missing romId or version", 400);

    const sb = getSupabaseAdmin();
    
    // تحقق إن المستخدم هو صاحب الـ ROM
    const { data: romData } = await sb.from("roms").select("maintainer_uid, download_url, size").eq("id", romId).single();
    if (!romData) return errorResponse("ROM not found", 404);

    if (romData.maintainer_uid !== user.uid && user.role !== "admin" && user.role !== "owner") {
      return errorResponse("Forbidden", 403);
    }

    // أضف الـ version
    const { data: inserted, error: insertError } = await sb.from("rom_versions").insert({
      rom_id: romId,
      version: version || "",
      android: android || "",
      changelog: changelog || "",
      download_url: downloadUrl || romData.download_url || "",
      size: size || romData.size || "",
      download_count: downloadCount || 0,
      created_at: new Date().toISOString()
    }).select("id").single();

    if (insertError) throw insertError;

    // تحديث version_count في ROM - نكتفي بإضافة حقل في Supabase أو تحديث المتغير لو احتجنا
    // سنضيف الحقل في جدول roms
    try {
      await sb.rpc("increment_rom_version_count", { p_rom_id: romId });
    } catch {
      // Ignore if rpc doesn't exist yet, we will add it to the schema
    }

    return jsonResponse({ id: inserted?.id }, 201);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : "Failed", 500);
  }
}

export async function OPTIONS() {
  return jsonResponse({});
}
