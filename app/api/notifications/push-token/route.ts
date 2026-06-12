import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/firebase/auth-verify";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getClientIp, rateLimit, rateLimitedResponse } from "@/lib/api/middleware";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 10)) return rateLimitedResponse(req);
  const user = await verifyRequest(req).catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { token, platform = "web" } = await req.json();
    if (!token || typeof token !== "string") return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    const sb = getSupabaseAdmin();
    await sb.from("push_tokens").upsert({
      id: `${user.uid}_${platform}`,
      uid: user.uid,
      token,
      platform,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await verifyRequest(req).catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const sb = getSupabaseAdmin();
    await sb.from("push_tokens").delete().eq("id", `${user.uid}_web`);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
