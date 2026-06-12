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
import type { Listing } from "@/lib/marketplace/types";

const KINDS = ["request", "offer"] as const;
const CATEGORIES = [
  "kernel",
  "rom",
  "unlock",
  "repair",
  "recovery",
  "module",
  "port",
  "gsi",
  "mentorship",
  "other",
] as const;
const URGENCIES = ["low", "normal", "high", "critical"] as const;
const SORTS = ["recent", "budget_high", "budget_low", "popular"] as const;

const CONTACT_KEYS = [
  "telegram",
  "whatsapp",
  "matrix",
  "signal",
  "discord",
  "xmpp",
  "email",
  "website",
] as const;

const ContactSchema = z
  .object(Object.fromEntries(CONTACT_KEYS.map((k) => [k, z.string().max(200).optional()])) as Record<
    (typeof CONTACT_KEYS)[number],
    z.ZodOptional<z.ZodString>
  >)
  .strict();

const AttachmentSchema = z.object({
  url: z.string().url().max(500),
  type: z.enum(["image", "file"]),
  name: z.string().min(1).max(120),
  size: z.number().int().min(0).max(50 * 1024 * 1024).optional(),
});

const CreateListingSchema = z
  .object({
    kind: z.enum(KINDS),
    title: z.string().min(6).max(120).trim(),
    body: z.string().min(20).max(8000).trim(),
    category: z.enum(CATEGORIES),
    deviceCodenames: z.array(z.string().min(1).max(40)).max(8).optional(),
    deviceLabel: z.string().max(120).optional().nullable(),
    budgetMin: z.number().nonnegative().max(1_000_000).optional().nullable(),
    budgetMax: z.number().nonnegative().max(1_000_000).optional().nullable(),
    currency: z.string().min(3).max(8).default("USD"),
    isNegotiable: z.boolean().default(true),
    urgency: z.enum(URGENCIES).default("normal"),
    deadlineAt: z.string().datetime().optional().nullable(),
    deliveryDays: z.number().int().min(1).max(365).optional().nullable(),
    tags: z.array(z.string().min(1).max(30)).max(10).optional(),
    attachments: z.array(AttachmentSchema).max(10).optional(),
    coverImage: z.string().url().max(500).optional().nullable(),
    contactChannels: ContactSchema.optional(),
    preferredChannel: z.enum(CONTACT_KEYS).optional().nullable(),
    isAnonymous: z.boolean().default(false),
  })
  .refine(
    (v) => v.budgetMin == null || v.budgetMax == null || v.budgetMin <= v.budgetMax,
    { path: ["budgetMin"], message: "budgetMin must be less than or equal to budgetMax" },
  );

// ── GET /api/marketplace/listings ─────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const kind = sp.get("kind");
    const category = sp.get("category");
    const ownerUid = sp.get("ownerUid");
    const status = sp.get("status") || "open";
    const query = sp.get("q") || "";
    const sort = (sp.get("sort") as (typeof SORTS)[number]) || "recent";
    const limitRaw = parseInt(sp.get("limit") || "30", 10);
    const limit = Math.min(60, Math.max(1, isNaN(limitRaw) ? 30 : limitRaw));
    const offsetRaw = parseInt(sp.get("offset") || "0", 10);
    const offset = Math.max(0, isNaN(offsetRaw) ? 0 : offsetRaw);

    const sb = getSupabaseAdmin();
    let q = sb.from("marketplace_listings").select("*", { count: "exact" });

    // ownerUid lets a user view their own listings regardless of status
    if (ownerUid) {
      q = q.eq("owner_uid", ownerUid);
    } else if (status !== "all") {
      q = q.eq("status", status);
    }
    if (kind && (KINDS as readonly string[]).includes(kind)) q = q.eq("kind", kind);
    if (category && (CATEGORIES as readonly string[]).includes(category)) q = q.eq("category", category);

    if (query.trim()) {
      // Use ILIKE on title + body. Postgres-side; small dataset, no fts dependency.
      const term = `%${query.trim().replace(/[%_]/g, "")}%`;
      q = q.or(`title.ilike.${term},body.ilike.${term}`);
    }

    switch (sort) {
      case "budget_high": q = q.order("budget_max", { ascending: false, nullsFirst: false }); break;
      case "budget_low":  q = q.order("budget_min", { ascending: true,  nullsFirst: false }); break;
      case "popular":     q = q.order("views", { ascending: false }); break;
      case "recent":
      default:            q = q.order("updated_at", { ascending: false });
    }
    q = q.range(offset, offset + limit - 1);

    const { data, error, count } = await q;
    if (error) {
      console.error("[marketplace/listings GET]", error);
      return errorResponse("Failed to load listings", 500, req);
    }

    const items: Listing[] = (data ?? [])
      .map(mapListingRow)
      .map(applyAnonymityMask);

    return jsonResponse({ items, count: count ?? items.length, limit, offset }, 200, req);
  } catch (err) {
    console.error("[marketplace/listings GET fatal]", err);
    return errorResponse("Internal error", 500, req);
  }
}

// ── POST /api/marketplace/listings ────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await verifyRequest(req);
  if (!user) return errorResponse("Unauthorized", 401, req);
  if (user.banned || user.suspended) {
    return errorResponse("Your account is not allowed to post.", 403, req);
  }

  const ip = getClientIp(req);
  const ok = await rateLimitUserOrIp(user.uid, ip, {
    perUser: 10,
    perIp: 30,
    windowMs: 60 * 60_000, // 1 hour
    scope: "mp:listing:post",
  });
  if (!ok) return rateLimitedResponse(req);

  let body: unknown;
  try { body = await req.json(); } catch { return errorResponse("Invalid JSON body", 400, req); }
  const parsed = CreateListingSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message || "Invalid payload", 400, req);
  }
  const v = parsed.data;

  // Require at least one contact channel — providers and clients have to be reachable.
  const channels = v.contactChannels ?? {};
  const hasAny = Object.values(channels).some((s) => typeof s === "string" && s.trim().length > 0);
  if (!hasAny) {
    return errorResponse("Add at least one contact channel so people can reach you.", 400, req);
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("marketplace_listings")
    .insert({
      owner_uid: user.uid,
      owner_name: user.name || user.email?.split("@")[0] || "User",
      owner_avatar: user.picture || "",
      owner_role: user.role || "user",
      kind: v.kind,
      title: v.title,
      body: v.body,
      category: v.category,
      device_codenames: v.deviceCodenames ?? [],
      device_label: v.deviceLabel ?? null,
      budget_min: v.budgetMin ?? null,
      budget_max: v.budgetMax ?? null,
      currency: v.currency,
      is_negotiable: v.isNegotiable,
      urgency: v.urgency,
      deadline_at: v.deadlineAt ?? null,
      delivery_days: v.deliveryDays ?? null,
      status: "open",
      tags: v.tags ?? [],
      attachments: v.attachments ?? [],
      cover_image: v.coverImage ?? null,
      contact_channels: channels,
      preferred_channel: v.preferredChannel ?? null,
      is_anonymous: v.isAnonymous,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[marketplace/listings POST]", error);
    return errorResponse("Failed to create listing", 500, req);
  }

  return jsonResponse({ item: mapListingRow(data) }, 201, req);
}

export async function OPTIONS(req: NextRequest) {
  return jsonResponse({}, 200, req);
}
