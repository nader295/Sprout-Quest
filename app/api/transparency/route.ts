import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, getClientIp, hashIp, rateLimit, rateLimitedResponse } from "@/lib/api/middleware";
import { verifyRequest } from "@/lib/firebase/auth-verify";
import { sbAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await rateLimit(`transparency:${hashIp(ip)}`, 10, 60_000)) return rateLimitedResponse(req);

  const user = await verifyRequest(req).catch(() => null);

  // ── What we store about ANY user (anonymous) ────────────────────────
  // We never store the raw IP — only a one-way hash used for dedup.
  // Show them the hashed version so they can see it's unreadable.
  const hashedIp = hashIp(ip);

  if (!user) {
    // Check if this anonymous IP has any download or like records
    const [dlRes, likeRes] = await Promise.all([
      sbAdmin.from("downloads_dedup")
        .select("rom_id, last_at", { count: "exact" })
        .ilike("id", `ip_${hashedIp}_%`)
        .limit(50),
      sbAdmin.from("anon_likes_dedup")
        .select("rom_id, created_at", { count: "exact" })
        .ilike("id", `anon_${hashedIp}_%`)
        .limit(50),
    ]);

    return jsonResponse({
      authenticated: false,
      stored: {
        // We show the hash — not the IP. Proves we never store the raw IP.
        ipHash: hashedIp.slice(0, 8) + "••••••••••••••••••••••••" + hashedIp.slice(-4),
        downloads: {
          count: dlRes.count ?? 0,
          note: "عدد التحميلات فقط — بدون اسمك أو هويتك",
        },
        anonLikes: {
          count: likeRes.count ?? 0,
          note: "عدد الإعجابات فقط — مربوطة بـ hash لا يمكن عكسه",
        },
      },
      notStored: [
        "اسمك الحقيقي",
        "بريدك الإلكتروني",
        "موقعك الجغرافي",
        "جهازك أو متصفحك",
        "سجل تصفحك",
        "أي معلومة شخصية",
      ],
      thirdParty: {
        analytics: false,
        adTracking: false,
        facebookPixel: false,
        googleAnalytics: false,
      },
    }, 200, req);
  }

  // ── What we store about a LOGGED-IN user ───────────────────────────
  const [userRes, dlRes, likeRes, notifRes, commentRes] = await Promise.all([
    sbAdmin.from("users")
      .select("id, name, email, photo, role, created_at, roms_count, xp, level")
      .eq("id", user.uid)
      .single(),
    sbAdmin.from("downloads_dedup")
      .select("rom_id, last_at", { count: "exact" })
      .ilike("id", `user_${user.uid}_%`)
      .limit(100),
    sbAdmin.from("likes")
      .select("rom_id", { count: "exact" })
      .eq("user_id", user.uid)
      .limit(100),
    sbAdmin.from("notifications")
      .select("id", { count: "exact" })
      .eq("recipient_uid", user.uid),
    sbAdmin.from("comments")
      .select("id", { count: "exact" })
      .eq("user_id", user.uid),
  ]);

  const u = userRes.data as Record<string, unknown> | null;

  return jsonResponse({
    authenticated: true,
    stored: {
      profile: {
        id:         u?.id         ?? "—",
        name:       u?.name       ?? "—",
        email:      u?.email      ?? "—",
        photo:      u?.photo      ? "رابط صورة الحساب" : "لا توجد",
        role:       u?.role       ?? "user",
        joinedAt:   u?.created_at ?? "—",
        xp:         u?.xp         ?? 0,
        level:      u?.level      ?? 1,
        romsCount:  u?.roms_count ?? 0,
      },
      activity: {
        downloads:   { count: dlRes.count    ?? 0, note: "لتحديد ما حمّلته مسبقاً — لمنع التكرار في الإحصائيات" },
        likes:       { count: likeRes.count  ?? 0, note: "لعرض اللايكات التي وضعتها" },
        comments:    { count: commentRes.count ?? 0, note: "التعليقات التي كتبتها" },
        notifications:{ count: notifRes.count ?? 0, note: "إشعاراتك" },
      },
    },
    notStored: [
      "كلمة مرورك (مشفّرة بالكامل في Firebase)",
      "بيانات بطاقتك البنكية",
      "موقعك الجغرافي",
      "سجل تصفحك خارج الموقع",
      "بيانات جهازك",
    ],
    thirdParty: {
      analytics: false,
      adTracking: false,
      facebookPixel: false,
      googleAnalytics: false,
      dataSold: false,
      dataShared: false,
    },
    yourRights: {
      deleteAccount: true,
      exportData: false,
      note: "يمكنك حذف حسابك وكل بياناتك فوراً من صفحة الإعدادات",
    },
    generatedAt: new Date().toISOString(),
  }, 200, req);
}
