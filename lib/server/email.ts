/**
 * lib/server/email.ts — Resend Email Utility
 * Server-only — لا تستورد في client components
 *
 * متطلبات البيئة:
 *   RESEND_API_KEY — من resend.com
 *   NEXT_PUBLIC_SITE_URL — URL المنصة (e.g., https://rom-x.vercel.app)
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://rom-x.vercel.app";
const FROM_EMAIL = process.env.FROM_EMAIL || "RomX <noreply@rom-x.vercel.app>";

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!RESEND_API_KEY) {
    // لو Resend مش مضبوط — log فقط بدون خطأ
    console.info("[email] Resend not configured. Would send to:", params.to, "Subject:", params.subject);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: params.to, subject: params.subject, html: params.html }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[email] Resend error:", err);
    }
  } catch (e) {
    console.error("[email] sendEmail failed:", e);
  }
}

// ── Welcome Email ───────────────────────────────────────────────────────────
export async function sendWelcomeEmail(params: {
  to: string;
  name: string;
}): Promise<void> {
  const { to, name } = params;
  if (!to || !to.includes("@")) return;

  const displayName = name || "Explorer";

  await sendEmail({
    to,
    subject: `🚀 مرحباً بك في RomX — ${displayName}!`,
    html: `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;background:#080c14;color:#e2e8f0;margin:0;padding:0">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px">
    <div style="text-align:center;margin-bottom:32px">
      <h1 style="font-size:2rem;font-weight:900;color:#1d9bf0;margin:0">RomX</h1>
      <p style="color:#64748b;margin-top:6px;font-size:14px">منصة Custom ROMs الاجتماعية</p>
    </div>

    <div style="background:#0d1420;border:1px solid #1e3050;border-radius:16px;padding:32px">
      <h2 style="color:#e2e8f0;font-size:1.3rem;margin-top:0">مرحباً يا ${displayName}! 👋</h2>
      <p style="color:#94a3b8;line-height:1.7">
        أنت الآن جزء من مجتمع RomX — أفضل مكان لاكتشاف ومشاركة Custom ROMs، Kernels، وModules لأجهزة Android.
      </p>

      <div style="background:#111827;border-radius:12px;padding:20px;margin:20px 0">
        <p style="color:#e2e8f0;font-weight:700;margin-top:0">ابدأ رحلتك:</p>
        <ul style="color:#94a3b8;line-height:2;padding-right:20px">
          <li>🔍 استكشف أحدث ROMs لجهازك</li>
          <li>⭐ قيّم وعلّق على الإصدارات</li>
          <li>👥 تابع مطوريك المفضلين</li>
          <li>🚀 ارفع إصداراتك وابنِ سمعتك</li>
        </ul>
      </div>

      <a href="${SITE_URL}" style="display:inline-block;background:#1d9bf0;color:white;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:15px">
        ابدأ الاستكشاف →
      </a>
    </div>

    <p style="text-align:center;color:#374151;font-size:12px;margin-top:24px">
      هذا البريد أُرسل تلقائياً من <a href="${SITE_URL}" style="color:#1d9bf0">RomX</a>.
      إذا لم تنشئ هذا الحساب، تجاهل هذا البريد.
    </p>
  </div>
</body>
</html>
    `.trim(),
  });
}

// ── Achievement Email ───────────────────────────────────────────────────────
export async function sendAchievementEmail(params: {
  to: string;
  name: string;
  achievementLabel: string;
  xpBonus: number;
}): Promise<void> {
  const { to, name, achievementLabel, xpBonus } = params;
  if (!to || !to.includes("@")) return;

  await sendEmail({
    to,
    subject: `🏆 إنجاز جديد: ${achievementLabel}`,
    html: `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<body style="font-family:sans-serif;background:#080c14;color:#e2e8f0;margin:0;padding:32px 24px">
  <div style="max-width:500px;margin:0 auto;background:#0d1420;border:1px solid #1e3050;border-radius:16px;padding:32px;text-align:center">
    <div style="font-size:48px;margin-bottom:16px">🏆</div>
    <h2 style="color:#f59e0b;margin-top:0">${achievementLabel}</h2>
    <p style="color:#94a3b8">أحسنت يا ${name || "Explorer"}! حصلت على إنجاز جديد.</p>
    ${xpBonus > 0 ? `<div style="background:#111827;border-radius:10px;padding:12px;color:#10b981;font-weight:700;font-size:18px">+${xpBonus} XP</div>` : ''}
    <a href="${SITE_URL}" style="display:inline-block;margin-top:20px;background:#1d9bf0;color:white;text-decoration:none;padding:10px 24px;border-radius:8px;font-weight:700">
      عرض ملفك →
    </a>
  </div>
</body>
</html>
    `.trim(),
  });
}
