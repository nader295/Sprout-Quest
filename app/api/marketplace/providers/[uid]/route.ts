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
import { mapProviderRow, mapListingRow, applyAnonymityMask } from "@/lib/marketplace/mappers";

const CATEGORIES = [
  "kernel","rom","unlock","repair","recovery","module","port","gsi","mentorship","other",
] as const;
const CONTACT_KEYS = [
  "telegram","whatsapp","matrix","signal","discord","xmpp","email","website",
] as const;

const ContactSchema = z
  .object(Object.fromEntries(CONTACT_KEYS.map((k) => [k, z.string().max(200).optional()])) as Record<
    (typeof CONTACT_KEYS)[number],
    z.ZodOptional<z.ZodString>
  >)
  .strict();

const CredentialSchema = z.object({
  title: z.string().min(2).max(120),
  issuer: z.string().max(120).optional(),
  year: z.number().int().min(1980).max(2100).optional(),
  url: z.string().url().max(400).optional(),
});
const PortfolioSchema = z.object({
  title: z.string().min(2).max(120),
  summary: z.string().max(800).optional(),
  image: z.string().url().max(500).optional(),
  url: z.string().url().max(500).optional(),
});

const UpsertSchema = z.object({
  headline: z.string().max(160).default(""),
  bio: z.string().max(4000).default(""),
  hourlyRate: z.number().nonnegative().max(10_000).nullable().optional(),
  hourlyCurrency: z.string().min(3).max(8).default("USD"),
  responseTimeH: z.number().int().min(1).max(720).nullable().optional(),
  languages: z.array(z.string().min(2).max(40)).max(12).default([]),
  skills: z.array(z.string().min(2).max(40)).max(30).default([]),
  categories: z.array(z.enum(CATEGORIES)).max(10).default([]),
  deviceCodenames: z.array(z.string().min(1).max(40)).max(20).default([]),
  credentials: z.array(CredentialSchema).max(10).default([]),
  portfolio: z.array(PortfolioSchema).max(12).default([]),
  contactChannels: ContactSchema.default({}),
  preferredChannel: z.enum(CONTACT_KEYS).nullable().optional(),
  acceptsEscrow: z.boolean().default(false),
  isOpenForWork: z.boolean().default(true),
  isAnonymous: z.boolean().default(false),
  alias: z.string().max(40).nullable().optional(),
  coverImage: z.string().url().max(500).nullable().optional(),
});

// GET — public provider profile + their open listings.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ uid: string }> },
) {
  const { uid } = await ctx.params;
  if (!uid) return errorResponse("Missing uid", 400, req);

  const sb = getSupabaseAdmin();

  const [{ data: profile }, listingsRes] = await Promise.all([
    sb.from("marketplace_provider_profiles").select("*").eq("uid", uid).maybeSingle(),
    sb
      .from("marketplace_listings")
      .select("*")
      .eq("owner_uid", uid)
      .in("status", ["open", "in_progress"])
      .order("updated_at", { ascending: false })
      .limit(40),
  ]);

  if (!profile) return errorResponse("Provider profile not found", 404, req);

  const listings = (listingsRes.data ?? []).map(mapListingRow).map(applyAnonymityMask);
  return jsonResponse({ profile: mapProviderRow(profile), listings }, 200, req);
}

// PUT — upsert *my* provider profile. uid in path must equal the caller.
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ uid: string }> },
) {
  const { uid } = await ctx.params;
  const user = await verifyRequest(req);
  if (!user) return errorResponse("Unauthorized", 401, req);
  if (user.uid !== uid) return errorResponse("You can only edit your own provider profile", 403, req);
  if (user.banned || user.suspended) {
    return errorResponse("Your account is not allowed to publish a provider profile.", 403, req);
  }

  const ip = getClientIp(req);
  const ok = await rateLimitUserOrIp(user.uid, ip, {
    perUser: 20, perIp: 60, windowMs: 60_000, scope: "mp:provider:put",
  });
  if (!ok) return rateLimitedResponse(req);

  let body: unknown;
  try { body = await req.json(); } catch { return errorResponse("Invalid JSON body", 400, req); }
  const parsed = UpsertSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message || "Invalid payload", 400, req);
  }
  const v = parsed.data;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("marketplace_provider_profiles")
    .upsert(
      {
        uid,
        display_name: user.name || user.email?.split("@")[0] || "Provider",
        avatar_url: user.picture || "",
        headline: v.headline,
        bio: v.bio,
        hourly_rate: v.hourlyRate ?? null,
        hourly_currency: v.hourlyCurrency,
        response_time_h: v.responseTimeH ?? null,
        languages: v.languages,
        skills: v.skills,
        categories: v.categories,
        device_codenames: v.deviceCodenames,
        credentials: v.credentials,
        portfolio: v.portfolio,
        contact_channels: v.contactChannels,
        preferred_channel: v.preferredChannel ?? null,
        accepts_escrow: v.acceptsEscrow,
        is_open_for_work: v.isOpenForWork,
        is_anonymous: v.isAnonymous,
        alias: v.alias ?? null,
        cover_image: v.coverImage ?? null,
      },
      { onConflict: "uid" },
    )
    .select("*")
    .single();

  if (error || !data) {
    console.error("[marketplace/providers PUT]", error);
    return errorResponse("Failed to save provider profile", 500, req);
  }
  return jsonResponse({ profile: mapProviderRow(data) }, 200, req);
}

export async function OPTIONS(req: NextRequest) {
  return jsonResponse({}, 200, req);
}
