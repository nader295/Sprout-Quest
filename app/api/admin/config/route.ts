/**
 * app/api/admin/config/route.ts
 *
 * GET   /api/admin/config  → اجيب الـ platform_config كاملاً
 * POST  /api/admin/config  → حدّث section
 * PATCH /api/admin/config  → reset section للـ defaults
 *
 * المصدر: Supabase → settings (id='platform_config')
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyRequest } from "@/lib/firebase/auth-verify";
import { getClientIp, rateLimit, rateLimitedResponse } from "@/lib/api/middleware";

const DEFAULT_CONFIG = {
  xp_rewards: {
    ROM_PUBLISH:          30,
    VERSION_UPDATE:       10,
    LIKE_RECEIVED:        3,
    DOWNLOADS_PER_10:     2,
    NEW_FOLLOWER:         5,
    MILESTONE_100_DL:     20,
    MILESTONE_500_DL:     50,
    CHANNEL_SETUP:        25,
    FALSE_REPORT_PENALTY: -10,
  },
  xp_levels: [
    { level: 1,  xp: 0,     label: "Member" },
    { level: 3,  xp: 150,   label: "Publisher" },
    { level: 7,  xp: 600,   label: "Developer" },
    { level: 10, xp: 1800,  label: "Top Developer" },
    { level: 15, xp: 4000,  label: "Pro Developer" },
    { level: 20, xp: 9000,  label: "Expert Developer" },
    { level: 30, xp: 25000, label: "Legendary Developer" },
  ],
  level_unlocks: {
    SOCIAL_LINKS:      3,
    PINNED_ROM:        3,
    CHANNEL_MODE:      7,
    DONATION_LINKS:    7,
    COVER_IMAGE:       7,
    ANALYTICS:         7,
    PRIORITY_LISTING:  10,
    CUSTOM_STATUS:     10,
    INCOGNITO_BROWSE:  15,
    BETA_FEATURES:     15,
    DISTINCTION_BADGE: 20,
    FEATURED_DEVS:     30,
  },
  moderation: {
    REPORTS_TO_HIDE_CONTENT: 3,
    REPORTS_TO_SUSPEND_24H:  5,
    REPORTS_TO_SUSPEND_7D:   10,
    MIN_ACCOUNT_AGE_DAYS:    7,
    MIN_XP_TO_REPORT:        100,
    FALSE_REPORTS_TO_BAN:    3,
    SUSPENSION_24H_MS:       86400000,
    SUSPENSION_7D_MS:        604800000,
    REPORT_BAN_DURATION_MS:  604800000,
  },
  features: {
    upload_enabled:          true,
    registration_enabled:    true,
    comments_enabled:        true,
    ratings_enabled:         true,
    downloads_enabled:       true,
    search_enabled:          true,
    leaderboard_enabled:     true,
    collections_enabled:     true,
    compare_enabled:         true,
    apply_page_enabled:      true,
    archive_reports_enabled: true,
    ai_tags_enabled:         false,
    voice_search_enabled:    false,
    guest_browse_enabled:    true,
    maintenance_mode:        false,
  },
  site: {
    maintenance_message:   "We'll be back shortly.",
    max_upload_size_mb:    500,
    max_screenshots:       10,
    max_mirrors:           3,
    max_tags:              10,
    new_rom_trend_boost:   100,
    trend_decay_rate:      0.9,
    min_rom_name_length:   2,
    max_rom_name_length:   100,
    max_description_chars: 5000,
    upload_rate_limit:     10,
    comment_rate_limit:    5,
    report_rate_limit:     5,
  },
};

type PlatformConfig = typeof DEFAULT_CONFIG;

// ── helpers ───────────────────────────────────────────────────────────

async function requireOwner(req: NextRequest) {
  const user = await verifyRequest(req);
  if (!user) return null;
  if (user.role !== "owner" && user.role !== "admin") return null;
  return user;
}

async function getConfig(): Promise<PlatformConfig> {
  try {
    const sb = getSupabaseAdmin();
    const { data: snap } = await sb.from("settings").select("data").eq("id", "platform_config").maybeSingle();
    if (!snap || !snap.data) return DEFAULT_CONFIG;
    return deepMerge(DEFAULT_CONFIG as unknown as Record<string, unknown>, snap.data as Record<string, unknown>) as unknown as PlatformConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const bv = base[key], ov = override[key];
    if (ov !== null && ov !== undefined && typeof ov === "object" && !Array.isArray(ov) &&
        typeof bv === "object" && bv !== null && !Array.isArray(bv)) {
      result[key] = deepMerge(bv as Record<string, unknown>, ov as Record<string, unknown>);
    } else if (ov !== null && ov !== undefined) {
      result[key] = ov;
    }
  }
  return result;
}

async function logChange(uid: string, section: string, changes: Record<string, unknown>) {
  const sb = getSupabaseAdmin();
  await sb.from("admin_logs").insert({
    type: "platform_config",
    uid: uid,
    data: { action: `config.update.${section}`, changes },
    created_at: new Date().toISOString(),
  });
}

// ── GET ───────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(`cfg_get:${ip}`, 60)) return rateLimitedResponse(req);
  const user = await requireOwner(req);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const config = await getConfig();
  return NextResponse.json({ config, defaults: DEFAULT_CONFIG });
}

// ── POST — update section ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(`cfg_post:${ip}`, 20)) return rateLimitedResponse(req);
  const user = await requireOwner(req);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body?.section || !body?.updates) return NextResponse.json({ error: "Missing section or updates" }, { status: 400 });

  const { section, updates } = body as { section: string; updates: Record<string, unknown> };
  if (!(section in DEFAULT_CONFIG)) return NextResponse.json({ error: `Unknown section: ${section}` }, { status: 400 });

  const sb = getSupabaseAdmin();
  const currentConfig = await getConfig();
  const newConfig = deepMerge(currentConfig as unknown as Record<string, unknown>, { [section]: updates });

  await sb.from("settings").upsert({ id: "platform_config", data: newConfig, updated_at: new Date().toISOString() });
  await logChange(user.uid, section, updates);
  
  return NextResponse.json({ ok: true, section, updates });
}

// ── PATCH — reset section to defaults ────────────────────────────────
export async function PATCH(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(`cfg_patch:${ip}`, 10)) return rateLimitedResponse(req);
  const user = await requireOwner(req);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const section = body?.section as string | undefined;
  if (!section || !(section in DEFAULT_CONFIG)) return NextResponse.json({ error: "Invalid section" }, { status: 400 });

  const sb = getSupabaseAdmin();
  const currentConfig = await getConfig();
  const newConfig = { ...currentConfig };
  delete (newConfig as any)[section]; // Remove the overrides for this section, making it fallback to DEFAULT_CONFIG

  await sb.from("settings").upsert({ id: "platform_config", data: newConfig, updated_at: new Date().toISOString() });
  await logChange(user.uid, section, { reset_to_defaults: true });
  
  return NextResponse.json({ ok: true, section, reset: true });
}
