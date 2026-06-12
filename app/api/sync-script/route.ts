import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { sbAdmin } from "@/lib/supabase/admin";
import { verifyRequest, isAdmin } from "@/lib/api/auth";

// Vercel max duration — يحتاج Pro plan للـ 300s
// على Hobby: 60s كحد أقصى
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // P0 hardened: was publicly callable. This endpoint does a
  // Firestore -> Supabase data migration and can overwrite any
  // user record, so it must be admin-only.
  const user = await verifyRequest(req);
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    // batch: رقم الدفعة (0, 1, 2, ...)
    // size: حجم كل دفعة (افتراضي 50)
    const batch = parseInt(url.searchParams.get("batch") || "0");
    const size  = parseInt(url.searchParams.get("size")  || "50");

    const details: string[] = [];
    let affected = 0;

    // 1. Force owner (فقط في الـ batch الأول)
    if (batch === 0) {
      const { error: ownerErr } = await sbAdmin.from("users")
        .update({ role: "owner" })
        .eq("email", "nadermagdy991@gmail.com");
      details.push(ownerErr
        ? "Owner set failed: " + ownerErr.message
        : "Owner set OK");
    }

    // 2. اجلب كل users من Firebase (مرة واحدة — خفيف المعالجة)
    const fbUsersSnap = await adminDb.collection("users").get();
    const allDocs = fbUsersSnap.docs;
    const total   = allDocs.length;

    // 3. قسّم على batches
    const start = batch * size;
    const end   = Math.min(start + size, total);
    const slice = allDocs.slice(start, end);

    if (slice.length === 0) {
      return NextResponse.json({
        success: true, done: true,
        message: "All batches complete",
        total, affected: 0, details,
      });
    }

    // 4. حدّث Supabase لكل مستخدم في الـ slice
    for (const doc of slice) {
      const fbData = doc.data();
      const uid    = doc.id;
      const updates: Record<string, unknown> = {};

      if (fbData.xp            !== undefined) updates.xp              = fbData.xp;
      if (fbData.level         !== undefined) updates.level           = fbData.level;
      if (fbData.country       !== undefined) updates.country         = fbData.country;
      if (fbData.countryName   !== undefined) updates.country_name    = fbData.countryName;
      if (fbData.showOnMap     !== undefined) updates.show_on_map     = fbData.showOnMap;
      if (fbData.achievements  !== undefined) updates.achievements    = fbData.achievements;
      if (fbData.subscribersCount  !== undefined) updates.subscribers_count  = fbData.subscribersCount;
      if (fbData.romsCount         !== undefined) updates.roms_count         = fbData.romsCount;
      if (fbData.totalDownloads    !== undefined) updates.total_downloads    = fbData.totalDownloads;
      if (fbData.totalLikesReceived!== undefined) updates.total_likes_received = fbData.totalLikesReceived;
      if (fbData.followersCount    !== undefined) updates.followers_count    = fbData.followersCount;
      if (fbData.followingCount    !== undefined) updates.following_count    = fbData.followingCount;
      if (fbData.totalViewsReceived!== undefined) updates.total_views_received = fbData.totalViewsReceived;

      if (fbData.role && fbData.email !== "nadermagdy991@gmail.com") {
        updates.role = fbData.role;
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await sbAdmin.from("users").update(updates).eq("id", uid);
        if (!error) affected++;
      }
    }

    const done = end >= total;
    return NextResponse.json({
      success: true,
      done,
      batch,
      processed: `${end} / ${total}`,
      affected,
      nextBatch: done ? null : batch + 1,
      details,
    });

  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
