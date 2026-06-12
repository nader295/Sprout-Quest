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
import { mapListingRow, applyAnonymityMask } from "@/lib/marketplace/mappers";

const STATUSES = ["open", "in_progress", "closed", "cancelled", "archived"] as const;
const URGENCIES = ["low", "normal", "high", "critical"] as const;

const PatchSchema = z.object({
  title: z.string().min(6).max(120).trim().optional(),
  body: z.string().min(20).max(8000).trim().optional(),
  status: z.enum(STATUSES).optional(),
  urgency: z.enum(URGENCIES).optional(),
  budgetMin: z.number().nonnegative().max(1_000_000).nullable().optional(),
  budgetMax: z.number().nonnegative().max(1_000_000).nullable().optional(),
  currency: z.string().min(3).max(8).optional(),
  isNegotiable: z.boolean().optional(),
  deadlineAt: z.string().datetime().nullable().optional(),
  deliveryDays: z.number().int().min(1).max(365).nullable().optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
  deviceCodenames: z.array(z.string().min(1).max(40)).max(8).optional(),
  deviceLabel: z.string().max(120).nullable().optional(),
  isAnonymous: z.boolean().optional(),
});

// ── GET /api/marketplace/listings/[id] ────────────────────────────
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id) return errorResponse("Missing id", 400, req);

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("marketplace_listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[marketplace/listings/:id GET]", error);
    return errorResponse("Failed to load listing", 500, req);
  }
  if (!data) return errorResponse("Not found", 404, req);

  // Best-effort view bump (don't block the response on it)
  void sb.rpc("mp_increment_views", { _listing_id: id });

  return jsonResponse({ item: applyAnonymityMask(mapListingRow(data)) }, 200, req);
}

// ── PATCH /api/marketplace/listings/[id] ──────────────────────────
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await verifyRequest(req);
  if (!user) return errorResponse("Unauthorized", 401, req);

  const ip = getClientIp(req);
  const ok = await rateLimitUserOrIp(user.uid, ip, {
    perUser: 30, perIp: 60, windowMs: 60_000, scope: "mp:listing:patch",
  });
  if (!ok) return rateLimitedResponse(req);

  const sb = getSupabaseAdmin();
  const { data: existing } = await sb
    .from("marketplace_listings")
    .select("owner_uid, status")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return errorResponse("Not found", 404, req);

  const isOwner = existing.owner_uid === user.uid;
  const isMod = ["owner", "admin", "moderator"].includes(user.role);
  if (!isOwner && !isMod) return errorResponse("Forbidden", 403, req);

  let body: unknown;
  try { body = await req.json(); } catch { return errorResponse("Invalid JSON body", 400, req); }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message || "Invalid payload", 400, req);
  }
  const v = parsed.data;

  const update: Record<string, unknown> = {};
  if (v.title !== undefined)           update.title = v.title;
  if (v.body !== undefined)            update.body = v.body;
  if (v.status !== undefined)          update.status = v.status;
  if (v.urgency !== undefined)         update.urgency = v.urgency;
  if (v.budgetMin !== undefined)       update.budget_min = v.budgetMin;
  if (v.budgetMax !== undefined)       update.budget_max = v.budgetMax;
  if (v.currency !== undefined)        update.currency = v.currency;
  if (v.isNegotiable !== undefined)    update.is_negotiable = v.isNegotiable;
  if (v.deadlineAt !== undefined)      update.deadline_at = v.deadlineAt;
  if (v.deliveryDays !== undefined)    update.delivery_days = v.deliveryDays;
  if (v.tags !== undefined)            update.tags = v.tags;
  if (v.deviceCodenames !== undefined) update.device_codenames = v.deviceCodenames;
  if (v.deviceLabel !== undefined)     update.device_label = v.deviceLabel;
  if (v.isAnonymous !== undefined)     update.is_anonymous = v.isAnonymous;

  if (Object.keys(update).length === 0) {
    return errorResponse("No fields to update", 400, req);
  }

  const { data, error } = await sb
    .from("marketplace_listings")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    console.error("[marketplace/listings/:id PATCH]", error);
    return errorResponse("Failed to update", 500, req);
  }
  return jsonResponse({ item: mapListingRow(data) }, 200, req);
}

// ── DELETE /api/marketplace/listings/[id] ────────────────────────
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const user = await verifyRequest(req);
  if (!user) return errorResponse("Unauthorized", 401, req);

  const sb = getSupabaseAdmin();
  const { data: existing } = await sb
    .from("marketplace_listings")
    .select("owner_uid")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return errorResponse("Not found", 404, req);

  const isOwner = existing.owner_uid === user.uid;
  const isMod = ["owner", "admin", "moderator"].includes(user.role);
  if (!isOwner && !isMod) return errorResponse("Forbidden", 403, req);

  const { error } = await sb.from("marketplace_listings").delete().eq("id", id);
  if (error) {
    console.error("[marketplace/listings/:id DELETE]", error);
    return errorResponse("Failed to delete", 500, req);
  }
  return jsonResponse({ ok: true }, 200, req);
}

export async function OPTIONS(req: NextRequest) {
  return jsonResponse({}, 200, req);
}
