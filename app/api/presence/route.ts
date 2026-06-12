// app/api/presence/route.ts — P0 hardened
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=20, stale-while-revalidate=40",
};

// Limits to stop abuse of the anonymous heartbeat endpoint.
const MAX_BODY_BYTES = 1024;          // 1 KB is way more than we ever need
const SID_RE = /^[A-Za-z0-9_-]{8,128}$/;
const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;

// GET — عدد الجلسات النشطة خلال آخر 5 دقايق
export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();

    const { count } = await sb
      .from("presence")
      .select("*", { count: "exact", head: true })
      .gte("last_seen", fiveMinutesAgo);

    return NextResponse.json({ count: count ?? 0 }, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

// POST — heartbeat تسجيل أو تحديث الجلسة، أو حذفها عند المغادرة
export async function POST(req: NextRequest) {
  try {
    // Reject oversized payloads early. Heartbeats should be tiny.
    const len = Number(req.headers.get("content-length") || "0");
    if (len > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413 });
    }

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "payload_too_large" }, { status: 413 });
    }

    let body: Record<string, unknown> = {};
    if (raw.trim()) {
      try {
        body = JSON.parse(raw);
      } catch {
        return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
      }
    }

    const sidRaw = (body.sid ?? body.sessionId) as unknown;
    const sid = typeof sidRaw === "string" ? sidRaw.trim() : "";
    if (!sid || !SID_RE.test(sid)) {
      return NextResponse.json({ ok: false, error: "invalid_sid" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();

    // المستخدم أغلق الصفحة
    if (body.leaving) {
      await sb.from("presence").delete().eq("session_id", sid);
      return NextResponse.json({ ok: true });
    }

    const uidRaw = body.uid;
    let uid: string | null = null;
    if (typeof uidRaw === "string" && uidRaw) {
      if (!UID_RE.test(uidRaw)) {
        return NextResponse.json({ ok: false, error: "invalid_uid" }, { status: 400 });
      }
      uid = uidRaw;
    }

    const now = new Date().toISOString();

    // upsert بـ session_id (العمود الـ UNIQUE الصحيح بعد الـ migration)
    const { error } = await sb.from("presence").upsert(
      { session_id: sid, uid, last_seen: now },
      { onConflict: "session_id" }
    );

    if (error) {
      // Fallback لو الـ upsert فشل (مثلاً لو الجدول لسه قديم)
      console.error("[presence] upsert error:", error.message);

      const { data: existing } = await sb
        .from("presence")
        .select("uid")
        .eq("session_id", sid)
        .maybeSingle();

      if (existing !== null) {
        await sb
          .from("presence")
          .update({ uid, last_seen: now })
          .eq("session_id", sid);
      } else if (uid) {
        await sb
          .from("presence")
          .upsert({ uid, session_id: sid, last_seen: now }, { onConflict: "uid" });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[presence] POST error:", e);
    return NextResponse.json({ ok: false });
  }
}
