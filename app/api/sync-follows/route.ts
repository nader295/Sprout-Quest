import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { sbAdmin } from "@/lib/supabase/admin";
import { verifyRequest, isAdmin } from "@/lib/api/auth";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // P0 hardened: was publicly callable. This endpoint rebuilds the
  // follow graph from Firestore, which is an expensive admin-only job.
  const user = await verifyRequest(req);
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const fbUsersSnap = await adminDb.collection("users").get();
    let totalFollows = 0;

    for (const doc of fbUsersSnap.docs) {
      const targetUid = doc.id;
      const followersSnap = await doc.ref.collection("followers").get();

      const insertData = followersSnap.docs.map(f => ({
        follower_id: f.id,
        following_id: targetUid,
        created_at: new Date().toISOString()
      }));

      if (insertData.length > 0) {
        await sbAdmin.from("follows").upsert(insertData, { onConflict: "follower_id,following_id", ignoreDuplicates: true });
        totalFollows += insertData.length;
      }
    }

    return NextResponse.json({ success: true, totalFollows });
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
