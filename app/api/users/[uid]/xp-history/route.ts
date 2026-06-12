import { NextRequest, NextResponse } from "next/server";
import { sbAdmin } from "@/lib/supabase/admin";
import { verifyRequest, isAdmin } from "@/lib/api/auth";

export const runtime = "nodejs";

/**
 * GET /api/users/[uid]/xp-history
 *
 * Returns the user's XP change history. Readable by:
 *   - The user themselves
 *   - Any admin/owner/moderator
 *
 * Added in P0 to replace a direct anon read of `xp_history` from the
 * profile page (blocked now that RLS is enabled on the table).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  const me = await verifyRequest(req);
  if (!me) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { uid } = await params;
  if (!uid) {
    return NextResponse.json({ error: "missing_uid" }, { status: 400 });
  }

  if (uid !== me.uid && !isAdmin(me)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") || "30"), 100);

  const { data, error } = await sbAdmin
    .from("xp_history")
    .select("id, amount, reason, before_xp, after_xp, created_at")
    .eq("uid", uid)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[users/xp-history] failed:", error);
    return NextResponse.json({ error: "list_failed" }, { status: 500 });
  }

  return NextResponse.json({ items: data || [] });
}
