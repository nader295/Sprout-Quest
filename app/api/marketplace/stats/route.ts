import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api/middleware";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { mapListingRow, applyAnonymityMask } from "@/lib/marketplace/mappers";

/** GET /api/marketplace/stats — counts for the hero + last activity ticker. */
export async function GET(req: NextRequest) {
  try {
    const sb = getSupabaseAdmin();

    const [openReq, openOff, providers, completed, recent] = await Promise.all([
      sb.from("marketplace_listings").select("id", { count: "exact", head: true })
        .eq("status", "open").eq("kind", "request"),
      sb.from("marketplace_listings").select("id", { count: "exact", head: true })
        .eq("status", "open").eq("kind", "offer"),
      sb.from("marketplace_provider_profiles").select("uid", { count: "exact", head: true })
        .eq("is_open_for_work", true),
      sb.from("marketplace_listings").select("id", { count: "exact", head: true })
        .eq("status", "closed"),
      sb.from("marketplace_listings").select("*")
        .eq("status", "open")
        .order("updated_at", { ascending: false })
        .limit(10),
    ]);

    const stats = {
      openRequests: openReq.count ?? 0,
      openOffers:   openOff.count ?? 0,
      providers:    providers.count ?? 0,
      completed:    completed.count ?? 0,
    };
    const recentItems = (recent.data ?? []).map(mapListingRow).map(applyAnonymityMask);

    return jsonResponse({ stats, recent: recentItems }, 200, req);
  } catch (err) {
    console.error("[marketplace/stats GET]", err);
    return errorResponse("Internal error", 500, req);
  }
}

export async function OPTIONS(req: NextRequest) {
  return jsonResponse({}, 200, req);
}
