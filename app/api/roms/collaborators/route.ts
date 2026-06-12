// ═══════════════════════════════════════════════════════════════
// app/api/roms/collaborators/route.ts — Supabase فقط
// ═══════════════════════════════════════════════════════════════
import { NextRequest } from "next/server";
import { verifyRequest } from "@/lib/firebase/auth-verify";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getClientIp, rateLimit, rateLimitedResponse, jsonResponse, errorResponse } from "@/lib/api/middleware";

// GET /api/roms/collaborators?romId=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const romId = searchParams.get("romId");
  if (!romId) return errorResponse("romId required", 400, req);

  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from("collaborators")
      .select("*")
      .eq("rom_id", romId)
      .order("added_at", { ascending: false })
      .limit(20);

    if (error) return errorResponse("Failed", 500, req);
    return jsonResponse({ items: data ?? [] });
  } catch {
    return errorResponse("Failed", 500, req);
  }
}

// POST /api/roms/collaborators — invite collaborator
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 10)) return rateLimitedResponse(req);
  const user = await verifyRequest(req).catch(() => null);
  if (!user) return errorResponse("Unauthorized", 401, req);

  const { romId, targetUsername, role = "editor" } = await req.json();
  if (!romId || !targetUsername) return errorResponse("romId and targetUsername required", 400, req);
  if (!["editor", "maintainer"].includes(role)) return errorResponse("Invalid role", 400, req);

  const sb = getSupabaseAdmin();

  // Verify requester owns the ROM
  const { data: romData } = await sb.from("roms").select("maintainer_uid").eq("id", romId).single();
  if (!romData) return errorResponse("ROM not found", 404, req);
  if (romData.maintainer_uid !== user.uid) return errorResponse("Not ROM owner", 403, req);

  // Find target user by username
  const { data: targetData } = await sb.from("users")
    .select("id, name, username, photo")
    .eq("username_lower", targetUsername.toLowerCase())
    .maybeSingle();

  if (!targetData) return errorResponse("User not found", 404, req);

  // Prevent duplicate
  const { data: existing } = await sb.from("collaborators")
    .select("id")
    .eq("rom_id", romId)
    .eq("uid", targetData.id)
    .maybeSingle();
  if (existing) return errorResponse("Already a collaborator", 409, req);

  const collab = {
    rom_id: romId,
    uid: targetData.id,
    name: targetData.name || targetUsername,
    photo: targetData.photo || "",
    username: targetData.username || targetUsername,
    role,
    added_by: user.uid,
    added_at: new Date().toISOString(),
  };

  const { data: inserted } = await sb.from("collaborators").insert(collab).select("id").single();
  return jsonResponse({ id: inserted?.id, ...collab }, 201, req);
}

// DELETE /api/roms/collaborators?romId=xxx&uid=yyy
export async function DELETE(req: NextRequest) {
  const user = await verifyRequest(req).catch(() => null);
  if (!user) return errorResponse("Unauthorized", 401, req);

  const { searchParams } = new URL(req.url);
  const romId = searchParams.get("romId");
  const targetUid = searchParams.get("uid");
  if (!romId || !targetUid) return errorResponse("romId and uid required", 400, req);

  const sb = getSupabaseAdmin();
  const { data: romData } = await sb.from("roms").select("maintainer_uid").eq("id", romId).single();
  const isOwner = romData?.maintainer_uid === user.uid;
  const isSelf = targetUid === user.uid;
  if (!isOwner && !isSelf) return errorResponse("Forbidden", 403, req);

  await sb.from("collaborators").delete().eq("rom_id", romId).eq("uid", targetUid);
  return jsonResponse({ success: true });
}
