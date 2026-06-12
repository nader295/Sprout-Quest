/**
 * GET /api/cron/health — Hourly Quick Health Check
 * Migrated to Supabase
 * - يرفع الإيقافات المنتهية
 * - يحدّث onlineCount
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime  = "nodejs";
export const maxDuration = 20;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth   = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, string> = {};
  const sb = getSupabaseAdmin();

  // ① رفع الإيقافات المنتهية تلقائياً
  try {
    const now = new Date().toISOString();
    const { data: suspendedUsers } = await sb.from("users")
      .select("id")
      .eq("is_suspended", true)
      .not("suspended_until", "is", null)
      .lt("suspended_until", now);

    if (suspendedUsers && suspendedUsers.length > 0) {
      const ids = suspendedUsers.map(u => u.id);
      await sb.from("users")
        .update({ is_suspended: false, suspended_until: null })
        .in("id", ids);
      results.unsuspended = String(ids.length);
    } else {
      results.unsuspended = "0";
    }
  } catch (e) { results.unsuspended = `error: ${String(e)}`; }

  // ② تحديث onlineCount
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    
    // Cleanup old presence first
    await sb.from("presence").delete().lt("updated_at", fiveMinAgo);

    const { count } = await sb.from("presence")
      .select("*", { count: "exact", head: true });
      
    const onlineCount = count ?? 0;
    
    // Save to settings table
    await sb.from("settings").upsert({ key: "onlineCount", value: String(onlineCount) }, { onConflict: "key" });
    results.onlineCount = String(onlineCount);
  } catch (e) { results.onlineCount = `error: ${String(e)}`; }

  return NextResponse.json({ ok: true, ts: new Date().toISOString(), results });
}
