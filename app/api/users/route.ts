// app/api/users/route.ts — Supabase فقط
import { NextRequest, NextResponse } from "next/server";
import { jsonResponse, errorResponse, getClientIp, rateLimit, rateLimitedResponse, cachedJsonResponse } from "@/lib/api/middleware";
import { profileSchema } from "@/lib/api/schemas";
import { verifyRequest, isAdmin } from "@/lib/firebase/auth-verify";
import { checkUsername } from "@/lib/username-filter";
import { ADMIN_EMAIL } from "@/lib/constants";
import { checkAndAwardAchievements } from "@/lib/server/achievements";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function stripPrivateFields(data: Record<string, unknown>) {
  const PRIVATE = ["email", "suspended_until", "suspension_reason", "available_balance", "total_earned"];
  for (const f of PRIVATE) delete data[f];
}

/**
 * Supabase يرجع أسماء الأعمدة بـ snake_case لكن الـ frontend يتوقع camelCase.
 * هذه الدالة تحول الحقول الضرورية بعد كل select من جدول users.
 */
function mapUserToCamel(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    // Counts
    followersCount:       row.followers_count        ?? 0,
    followingCount:       row.following_count        ?? 0,
    subscribersCount:     row.subscribers_count      ?? 0,
    romsCount:            row.roms_count             ?? 0,
    totalDownloads:       row.total_downloads        ?? 0,
    totalLikesReceived:   row.total_likes_received   ?? 0,
    totalViewsReceived:   row.total_views_received   ?? 0,
    unreadNotifications:  row.unread_notifications   ?? 0,
    ratingsGiven:         row.ratings_given          ?? 0,
    commentsGiven:        row.comments_given         ?? 0,
    // Booleans
    tourSeen:             row.tour_seen              ?? false,
    showOnMap:            row.show_on_map            ?? false,
    adsEnabled:           row.ads_enabled            ?? false,
    isEarlyAdopter:       row.is_early_adopter       ?? false,
    manualVerified:       row.manual_verified        ?? false,
    hideDownloads:        row.hide_downloads         ?? false,
    hideFollowers:        row.hide_followers         ?? false,
    incognitoMode:        row.incognito_mode         ?? false,
    privateProfile:       row.private_profile        ?? false,
    channelMode:          row.channel_mode           ?? false,
    hideOwnerSupportButton: row.hide_owner_support_button ?? false,
    hideOwnerStudioButton:  row.hide_owner_studio_button  ?? false,
    donationEnabled:      row.donation_enabled       ?? false,
    // Linkvertise monetization
    linkvertiseGlobalEnabled: row.linkvertise_global_enabled ?? false,
    linkvertisePublisherId:   row.linkvertise_publisher_id  ?? "",
    linkvertiseEarnings:      row.linkvertise_earnings       ?? 0,
    // Strings
    countryName:          row.country_name           ?? "",
    usernameLower:        row.username_lower         ?? "",
    adPlacement:          row.ad_placement           ?? "profile",
    coverImage:           (row.cover_image || row.cover_photo) ?? "",
    pinnedRomId:          row.pinned_rom_id          ?? "",
    // Arrays / Objects
    profileLinks:         row.profile_links          ?? [],
    channelLinks:         row.channel_links          ?? [],
    donationLinks:        row.donation_links         ?? [],
  };
}

async function awardXP(uid: string, amount: number, reason?: string) {
  if (!uid || amount <= 0) return;
  const { awardXP: x } = await import("@/lib/server/xp");
  await x(uid, amount, reason);
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 60)) return rateLimitedResponse(req);

  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  // ── Check username availability ────────────────────────
  if (action === "checkUsername") {
    const username = searchParams.get("username") ?? "";
    const uid      = searchParams.get("uid")      ?? "";
    if (!username) return jsonResponse({ available: false });
    const lower = username.toLowerCase();

    const { data } = await sb
      .from("users").select("id").eq("username_lower", lower).maybeSingle();
    const available = !data || (uid ? data.id === uid : false);
    return jsonResponse({ available });
  }

  // ── User rank ──────────────────────────────────────────
  if (action === "myRank") {
    const user = await verifyRequest(req).catch(() => null);
    if (!user) return errorResponse("Unauthorized", 401, req);

    const by = searchParams.get("by") || "xp";
    const fieldMap: Record<string, string> = {
      xp: "xp", karma: "xp", totalDownloads: "total_downloads",
      totalLikesReceived: "total_likes_received",
      totalViewsReceived: "total_views_received",
      romsCount: "roms_count", subscribersCount: "subscribers_count",
    };
    const field = fieldMap[by] ?? "xp";
    const { data: u } = await sb.from("users").select(field).eq("id", user.uid).single();
    const val = (u as unknown as Record<string, number>)?.[field] ?? 0;
    const { count } = await sb.from("users").select("*", { count: "exact", head: true })
      .gt(field, val);
    return jsonResponse({ rank: (count ?? 0) + 1, value: val });
  }

  // ── Get user by ID ─────────────────────────────────────
  const id = searchParams.get("id");
  if (id) {
    const { data, error } = await sb.from("users").select("*").eq("id", id).single();
    if (error || !data) return errorResponse("User not found", 404, req);
    const requestUser = await verifyRequest(req).catch(() => null);
    const out = mapUserToCamel({ ...data } as Record<string, unknown>);
    if (!requestUser || requestUser.uid !== id) stripPrivateFields(out);
    return jsonResponse(out);
  }

  // ── Leaderboard ────────────────────────────────────────
  const by = searchParams.get("by") || "xp";
  const max = Math.min(Number(searchParams.get("max")) || 20, 100);
  const fieldMap: Record<string, string> = {
    xp:                 "xp",
    totalDownloads:     "total_downloads",
    totalLikesReceived: "total_likes_received",
    totalViewsReceived: "total_views_received",
    subscribersCount:   "subscribers_count",
    romsCount:          "roms_count",
    // legacy aliases
    downloads: "total_downloads",
    likes:     "total_likes_received",
    followers: "subscribers_count",
  };
  const field = fieldMap[by] ?? "xp";

  const { data: users, error: lbErr } = await sb.from("users")
    .select("id, name, username, photo, role, xp, roms_count, total_downloads, total_likes_received, total_views_received, subscribers_count, achievements, hide_downloads, hide_followers, level")
    .not("role", "eq", "banned")
    .not("role", "eq", "owner")
    .order(field, { ascending: false })
    .limit(max);

  if (lbErr) {
    console.error("[leaderboard] query error:", lbErr.message, "field:", field);
    // Fallback: retry with safe minimal columns
    const { data: fallback } = await sb.from("users")
      .select("id, name, username, photo, role, xp, roms_count, total_downloads, total_likes_received, subscribers_count, achievements")
      .not("role", "eq", "banned")
      .order("xp", { ascending: false })
      .limit(max);
    return cachedJsonResponse({ items: fallback ?? [] }, 30, req);
  }

  return cachedJsonResponse({ items: users ?? [] }, 30, req); // 30s server cache
}

// خريطة بسيطة لأسماء الدول من كود ISO → اسم إنجليزي/عربي
const COUNTRY_NAMES: Record<string, string> = {
  EG:"مصر",SA:"السعودية",AE:"الإمارات",KW:"الكويت",QA:"قطر",BH:"البحرين",
  OM:"عُمان",JO:"الأردن",IQ:"العراق",SY:"سوريا",LB:"لبنان",PS:"فلسطين",
  YE:"اليمن",LY:"ليبيا",TN:"تونس",DZ:"الجزائر",MA:"المغرب",SD:"السودان",
  ID:"Indonesia",IN:"India",PK:"Pakistan",BD:"Bangladesh",MY:"Malaysia",
  PH:"Philippines",NG:"Nigeria",TR:"Turkey",RU:"Russia",DE:"Germany",
  FR:"France",GB:"United Kingdom",US:"United States",BR:"Brazil",
  MX:"Mexico",AR:"Argentina",CN:"China",JP:"Japan",KR:"South Korea",
  TH:"Thailand",VN:"Vietnam",UA:"Ukraine",PL:"Poland",IR:"Iran",
  ET:"Ethiopia",GH:"Ghana",KE:"Kenya",TZ:"Tanzania",ZA:"South Africa",
  CA:"Canada",AU:"Australia",IT:"Italy",ES:"Spain",NL:"Netherlands",
};

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(ip, 20)) return rateLimitedResponse(req);

  const user = await verifyRequest(req);
  if (!user) return errorResponse("Unauthorized", 401, req);

  const sb   = getSupabaseAdmin();
  const body = await req.json().catch(() => ({}));
  
  if (body.action === "seenTour") {
    // tour_seen هو اسم العمود الصحيح في Supabase — snake_case فقط
    const { error } = await sb.from("users").update({ tour_seen: true }).eq("id", user.uid);
    if (error) console.error("seenTour update failed:", error.message);
    return jsonResponse({ ok: true });
  }

  // ── patchLocation: يُحدّث country, country_name, show_on_map ──
  // يُستدعى من use-auth.tsx عند اكتشاف الدولة من timezone
  // ويستخدم أيضاً Vercel IP header كـ fallback
  if (body.action === "patchLocation") {
    // حاول تجيب country من الـ body أو من Vercel IP header
    let countryCode: string = (body.country as string) || "";
    let countryName: string = (body.countryName as string) || "";

    if (!countryCode) {
      // Fallback: استخدم Vercel/Cloudflare IP geolocation
      countryCode = (
        req.headers.get("x-vercel-ip-country") ||
        req.headers.get("cf-ipcountry") ||
        ""
      ).toUpperCase().trim();
      if (countryCode && countryCode !== "XX") {
        countryName = COUNTRY_NAMES[countryCode] || countryCode;
      } else {
        countryCode = "";
      }
    }

    if (!countryCode) return jsonResponse({ ok: true, skipped: true });

    const { error } = await sb.from("users").update({
      country:      countryCode,
      country_name: countryName,
      show_on_map:  true,
      updated_at:   new Date().toISOString(),
    }).eq("id", user.uid);

    if (error) console.error("patchLocation failed:", error.message);
    return jsonResponse({ ok: true, country: countryCode });
  }

  // ── Ensure user exists (new user creation / first login) ──
  if (body.action === "ensure") {
    const { data: existing } = await sb.from("users").select("*").eq("id", user.uid).maybeSingle();
    if (existing) {
      // Back-fill country for existing users who don't have one yet
      if (!existing.country) {
        const ipCountry = (
          req.headers.get("x-vercel-ip-country") ||
          req.headers.get("cf-ipcountry") ||
          ""
        ).toUpperCase().trim();
        if (ipCountry && ipCountry !== "XX") {
          await sb.from("users").update({
            country:      ipCountry,
            country_name: COUNTRY_NAMES[ipCountry] || ipCountry,
            updated_at:   new Date().toISOString(),
          }).eq("id", user.uid);
          existing.country      = ipCountry;
          existing.country_name = COUNTRY_NAMES[ipCountry] || ipCountry;
        }
      }
      return jsonResponse(mapUserToCamel({ ...existing } as Record<string, unknown>));
    }

    // مستخدم جديد — أنشئه
    const now = new Date().toISOString();

    // ✅ FIX: كشف الدولة من IP header لو الـ body ما فيهاش country
    let newCountryCode: string = (body.country as string) || "";
    let newCountryName: string = (body.countryName as string) || "";
    if (!newCountryCode) {
      const ipCountry = (
        req.headers.get("x-vercel-ip-country") ||
        req.headers.get("cf-ipcountry") ||
        ""
      ).toUpperCase().trim();
      if (ipCountry && ipCountry !== "XX") {
        newCountryCode = ipCountry;
        newCountryName = COUNTRY_NAMES[ipCountry] || ipCountry;
      }
    }

    // NOTE: Only include columns that exist in the DB schema.
    // Extra columns (uid, country_name, show_on_map, tour_seen) are written
    // by the migration 008_profile_columns.sql — omit them here until the
    // migration has been applied, then they will be silently accepted.
    const newUser: Record<string, unknown> = {
      id:            user.uid,
      // uid column does NOT exist — id is the PK (Firebase UID)
      name:          body.name   || "User",
      email:         body.email  || user.email || "",
      photo:         body.photo  || "",
      username:      null,  // NULL to avoid UNIQUE constraint violation on ""
      username_lower: null, // NULL to avoid UNIQUE constraint violation on ""
      role:          "user",
      xp:            0,
      level:         1,
      country:       newCountryCode,
      created_at:    now,
      updated_at:    now,
    };

    // Conditionally add columns added by migration 008 — safe to include once
    // the migration is applied; Supabase will ignore unknown keys when using
    // "upsert" but will throw on "insert" → guard with a try/catch retry below.
    const extendedFields: Record<string, unknown> = {
      country_name: newCountryName,
      show_on_map:  body.showOnMap === true,
      tour_seen:    false,
    };

    // Try with extended fields first (migration 008). Fall back to base if column missing.
    let { data: created, error: createErr } = await sb
      .from("users").insert({ ...newUser, ...extendedFields }).select("*").single();

    if (createErr) {
      console.warn("[ensure] extended insert failed, retrying base only:", createErr.message);
      ({ data: created, error: createErr } = await sb
        .from("users").insert(newUser).select("*").single());
    }

    if (createErr) {
      console.error("ensure user create failed:", createErr.message);
      return errorResponse("Failed to create user", 500, req);
    }

    return jsonResponse(mapUserToCamel({ ...created } as Record<string, unknown>));
  }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.message, 400, req);

  const data = parsed.data as Record<string, unknown>;
  const isFirstProfile = body._isFirstProfile === true;

  // Username handling
  if (data.username) {
    const username = (data.username as string).toLowerCase().trim();
    const filterResult = checkUsername(username);
    if (filterResult.status === "blocked") {
      return errorResponse(filterResult.message, 400, req);
    }

    const { data: taken } = await sb
      .from("users").select("id").eq("username_lower", username).neq("id", user.uid).maybeSingle();
    if (taken) return errorResponse("Username already taken", 409, req);

    data.username = username;
    data.username_lower = username;
  }

  // ── Convert camelCase keys to snake_case for Supabase ──────────────────
  const CAMEL_TO_SNAKE: Record<string, string> = {
    hideDownloads:          "hide_downloads",
    hideFollowers:          "hide_followers",
    incognitoMode:          "incognito_mode",
    privateProfile:         "private_profile",
    coverImage:             "cover_image",
    pinnedRomId:            "pinned_rom_id",
    donationLinks:          "donation_links",
    donationEnabled:        "donation_enabled",
    channelMode:            "channel_mode",
    hideOwnerSupportButton: "hide_owner_support_button",
    hideOwnerStudioButton:  "hide_owner_studio_button",
    // Linkvertise
    linkvertiseGlobalEnabled: "linkvertise_global_enabled",
    linkvertisePublisherId:   "linkvertise_publisher_id",
    linkvertiseEarnings:      "linkvertise_earnings",
    countryName:            "country_name",
    showOnMap:              "show_on_map",
    profileLinks:           "profile_links",
    channelLinks:           "channel_links",
    username_lower:         "username_lower",
  };

  const dbData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const snakeKey = CAMEL_TO_SNAKE[key] ?? key;
    dbData[snakeKey] = value;
  }

  dbData.updated_at = new Date().toISOString();

  // Self-healing: if user somehow missing from Supabase (ensure failed), create them now
  const { data: existingUser } = await sb.from("users").select("id").eq("id", user.uid).maybeSingle();
  if (!existingUser) {
    const now2 = new Date().toISOString();
    await sb.from("users").insert({
      id:             user.uid,
      name:           user.name || user.email || "User",
      email:          user.email || "",
      photo:          "",
      username:       null,
      username_lower: null,
      role:           "user",
      xp:             0,
      level:          1,
      created_at:     now2,
      ...dbData,
    });
  } else {
    const { error: updateErr } = await sb.from("users").update(dbData).eq("id", user.uid);
    if (updateErr) {
      console.error("Profile update error:", updateErr.message, updateErr.details);
      return errorResponse("Failed to update profile: " + updateErr.message, 500, req);
    }
  }

  // XP for profile completion removed — developers earn XP through real activity only
  if (isFirstProfile) {
    await checkAndAwardAchievements(user.uid);
  }

  return jsonResponse({ ok: true });
}

export const PUT = POST;
