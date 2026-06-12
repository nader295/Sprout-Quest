import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, getClientIp, hashIp, rateLimit, rateLimitedResponse } from "@/lib/api/middleware";
import { verifyRequest } from "@/lib/firebase/auth-verify";
import { sbAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/my-data
 *
 * شفافية كاملة — يُرجع بالظبط اللي RomX عارفه عن المستخدم.
 * المستخدم المسجل يشوف بياناته الحقيقية.
 * المجهول يشوف إن الموقع مش عارف عنه شيء.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(`my-data:${hashIp(ip)}`, 10, 60_000)) return rateLimitedResponse(req);

  const user = await verifyRequest(req).catch(() => null);

  // ── مستخدم مجهول ────────────────────────────────────────────────────────────
  if (!user) {
    return jsonResponse({
      anonymous: true,
      stored: {
        identity:       null,
        email:          null,
        name:           null,
        photo:          null,
        ipAddress:      "غير مخزّن — الـ IP يُشفَّر ويُستخدم مؤقتاً فقط لمنع التكرار",
        deviceInfo:     null,
        browserHistory: null,
        location:       null,
        cookies:        "جلسة مؤقتة فقط — لا كوكيز تتبع",
        thirdPartyShare: false,
      },
      counts: {
        downloads: 0,
        likes:     0,
        comments:  0,
      },
      message: "RomX لا يعرف من أنت — لا يوجد تتبع، لا بيانات شخصية.",
    }, 200, req);
  }

  // ── مستخدم مسجل ─────────────────────────────────────────────────────────────
  const { data: userData } = await sbAdmin
    .from("users")
    .select(`
      id, name, email, photo, role, created_at,
      roms_count, total_downloads, total_likes_received, total_views_received,
      comments_given, ratings_given, followers_count, following_count,
      xp, level, bio, username, country
    `)
    .eq("id", user.uid)
    .single();

  if (!userData) return errorResponse("User not found", 404, req);
  const u = userData as Record<string, unknown>;

  // عدد التحميلات اللي قام بيها المستخدم ده نفسه
  const { count: myDownloadsCount } = await sbAdmin
    .from("downloads_dedup")
    .select("id", { count: "exact", head: true })
    .like("id", `user_${user.uid}_%`);

  // عدد الإعجابات اللي وضعها
  const { count: myLikesCount } = await sbAdmin
    .from("likes")
    .select("rom_id", { count: "exact", head: true })
    .eq("user_id", user.uid);

  // آخر 5 تحميلات (بدون اسم الـ ROM — فقط متى)
  const { data: recentDl } = await sbAdmin
    .from("downloads_dedup")
    .select("last_at")
    .like("id", `user_${user.uid}_%`)
    .order("last_at", { ascending: false })
    .limit(5);

  // Mask email — نعرض فقط أول حرفين + domain
  const rawEmail = (u.email as string) || "";
  const [localPart, domain] = rawEmail.split("@");
  const maskedEmail = localPart
    ? `${localPart.slice(0, 2)}${"*".repeat(Math.max(2, localPart.length - 2))}@${domain}`
    : null;

  return jsonResponse({
    anonymous: false,
    stored: {
      // ما يُعرض بوضوح — هذا كل شيء
      uid:            user.uid,
      email:          maskedEmail,
      name:           u.name,
      photo:          u.photo,
      username:       u.username || null,
      country:        u.country || null,
      bio:            u.bio || null,
      role:           u.role,
      joinedAt:       u.created_at,
      // ما لا يُخزَّن أبداً
      ipAddress:      "غير مخزّن أبداً — يُشفَّر مؤقتاً فقط",
      browserHistory: null,
      deviceFingerprint: null,
      location:       null,
      searchHistory:  null,
      thirdPartyShare: false,
      cookiesTracking: false,
    },
    activity: {
      romsPublished:      u.roms_count        ?? 0,
      downloadsReceived:  u.total_downloads   ?? 0,
      likesReceived:      u.total_likes_received ?? 0,
      viewsReceived:      u.total_views_received ?? 0,
      commentsWritten:    u.comments_given    ?? 0,
      ratingsGiven:       u.ratings_given     ?? 0,
      downloadsPerformed: myDownloadsCount    ?? 0,
      likesGiven:         myLikesCount        ?? 0,
      followers:          u.followers_count   ?? 0,
      following:          u.following_count   ?? 0,
      xp:                 u.xp               ?? 0,
      level:              u.level            ?? 1,
    },
    recentDownloadDates: (recentDl || []).map((d: Record<string, unknown>) => d.last_at),
    notStored: [
      "عنوان IP الكامل",
      "تاريخ التصفح",
      "بصمة الجهاز",
      "الموقع الجغرافي",
      "سجل البحث",
      "البيانات البيومترية",
      "الرسائل الخاصة بين المستخدمين",
      "بيانات تطبيقات أخرى",
    ],
    thirdParties: {
      sold: false,
      sharedForAds: false,
      sharedWithPartners: false,
      usedForProfiling: false,
    },
  }, 200, req);
}
