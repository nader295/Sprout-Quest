import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyRequest } from "@/lib/api/auth";
import {
  errorResponse,
  jsonResponse,
  rateLimitedResponse,
  getClientIp,
  rateLimitUserOrIp,
} from "@/lib/api/middleware";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { mapProposalRow } from "@/lib/marketplace/mappers";

const ProposalSchema = z.object({
  message: z.string().min(20).max(4000).trim(),
  price: z.number().nonnegative().max(1_000_000).optional().nullable(),
  currency: z.string().min(3).max(8).default("USD"),
  deliveryDays: z.number().int().min(1).max(365).optional().nullable(),
});

// GET — only the listing owner and the proposal sender can see proposals.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await verifyRequest(req);
  if (!user) return errorResponse("Unauthorized", 401, req);

  const sb = getSupabaseAdmin();
  const { data: listing } = await sb
    .from("marketplace_listings")
    .select("owner_uid")
    .eq("id", id)
    .maybeSingle();
  if (!listing) return errorResponse("Not found", 404, req);

  const isOwner = listing.owner_uid === user.uid;
  const isMod = ["owner", "admin", "moderator"].includes(user.role);

  let q = sb
    .from("marketplace_proposals")
    .select("*")
    .eq("listing_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (!isOwner && !isMod) {
    q = q.eq("sender_uid", user.uid); // others only see their own proposal
  }
  const { data, error } = await q;
  if (error) {
    console.error("[marketplace/proposals GET]", error);
    return errorResponse("Failed to load proposals", 500, req);
  }
  return jsonResponse({ items: (data ?? []).map(mapProposalRow) }, 200, req);
}

// POST — create or update a proposal (one per sender per listing).
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await verifyRequest(req);
  if (!user) return errorResponse("Unauthorized", 401, req);
  if (user.banned || user.suspended) {
    return errorResponse("Your account is not allowed to send proposals.", 403, req);
  }

  const ip = getClientIp(req);
  const ok = await rateLimitUserOrIp(user.uid, ip, {
    perUser: 8, perIp: 30, windowMs: 60 * 60_000, scope: "mp:proposal:post",
  });
  if (!ok) return rateLimitedResponse(req);

  const sb = getSupabaseAdmin();
  const { data: listing } = await sb
    .from("marketplace_listings")
    .select("owner_uid, status")
    .eq("id", id)
    .maybeSingle();
  if (!listing) return errorResponse("Not found", 404, req);
  if (listing.owner_uid === user.uid) {
    return errorResponse("You can't send a proposal on your own listing", 400, req);
  }
  if (listing.status !== "open") {
    return errorResponse("This listing is no longer accepting proposals", 400, req);
  }

  let body: unknown;
  try { body = await req.json(); } catch { return errorResponse("Invalid JSON body", 400, req); }
  const parsed = ProposalSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message || "Invalid payload", 400, req);
  }
  const v = parsed.data;

  // Upsert by (listing_id, sender_uid) — DB has a UNIQUE constraint.
  const { data, error } = await sb
    .from("marketplace_proposals")
    .upsert(
      {
        listing_id: id,
        sender_uid: user.uid,
        sender_name: user.name || user.email?.split("@")[0] || "User",
        sender_avatar: user.picture || "",
        message: v.message,
        price: v.price ?? null,
        currency: v.currency,
        delivery_days: v.deliveryDays ?? null,
        status: "pending",
      },
      { onConflict: "listing_id,sender_uid" },
    )
    .select("*")
    .single();

  if (error || !data) {
    console.error("[marketplace/proposals POST]", error);
    return errorResponse("Failed to send proposal", 500, req);
  }
  return jsonResponse({ item: mapProposalRow(data) }, 201, req);
}

export async function OPTIONS(req: NextRequest) {
  return jsonResponse({}, 200, req);
}
