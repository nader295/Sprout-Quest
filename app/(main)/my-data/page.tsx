"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { auth } from "@/lib/firebase/client";
import Link from "next/link";
import {
  ShieldCheck, Eye, EyeOff, Download, Heart, MessageSquare,
  Star, Users, Zap, Globe, Lock, CheckCircle2, XCircle,
  ChevronRight, Loader2, RefreshCw, Trash2, UserX, Database,
  Fingerprint, MapPin, Search, History, Cpu, Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────
interface MyDataResponse {
  anonymous: boolean;
  stored: Record<string, unknown>;
  activity?: Record<string, unknown>;
  recentDownloadDates?: string[];
  notStored?: string[];
  thirdParties?: Record<string, boolean>;
  counts?: Record<string, number>;
  message?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string | number; color: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card/60 p-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color }} />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-2xl font-black text-foreground">{value}</span>
    </div>
  );
}

function NotStoredItem({ label, icon: Icon }: { label: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
        <Icon className="h-3.5 w-3.5 text-emerald-400" />
      </div>
      <span className="text-sm text-foreground/80">{label}</span>
      <XCircle className="ml-auto h-4 w-4 shrink-0 text-emerald-400" />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MyDataPage() {
  const { user, isLoggedIn } = useAuth();
  const { t } = useTranslation();
  const [data, setData] = useState<MyDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (isLoggedIn && user) {
        const token = await auth.currentUser?.getIdToken();
        if (token) headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch("/api/my-data", { headers });
      if (!res.ok) throw new Error("Failed to fetch");
      setData(await res.json());
    } catch {
      setError("تعذّر تحميل البيانات — حاول مرة أخرى");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [isLoggedIn]);

  const notStoredIcons: Record<string, React.ElementType> = {
    "عنوان IP الكامل":            Globe,
    "تاريخ التصفح":               History,
    "بصمة الجهاز":                Fingerprint,
    "الموقع الجغرافي":            MapPin,
    "سجل البحث":                  Search,
    "البيانات البيومترية":        Cpu,
    "الرسائل الخاصة بين المستخدمين": MessageSquare,
    "بيانات تطبيقات أخرى":        Share2,
  };

  return (
    <div className="min-h-screen px-4 py-10 max-w-2xl mx-auto">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-8">
        <Link href="/" className="hover:text-[var(--primary)] transition-colors">الرئيسية</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">بياناتي على RomX</span>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-[var(--primary)]/25 bg-gradient-to-br from-[var(--primary-dim)]/40 to-card p-7 mb-8 text-center shadow-xl">
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full blur-[60px] opacity-20"
          style={{ background: "radial-gradient(circle, var(--primary), transparent)" }} />
        <div className="relative">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg"
            style={{ background: "linear-gradient(135deg, var(--primary), #6366f1)" }}>
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-2">ماذا يعرف RomX عنك؟</h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            هذه الصفحة تعرض <span className="text-foreground font-semibold">كل</span> البيانات المخزّنة عنك —
            لا يوجد شيء مخفي. الشفافية الكاملة.
          </p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
          <p className="text-sm text-muted-foreground">جاري جلب بياناتك...</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={fetchData}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-muted transition-all">
            <RefreshCw className="h-4 w-4" /> إعادة المحاولة
          </button>
        </div>
      )}

      {/* ── Anonymous user ────────────────────────────────────────────────── */}
      {!loading && !error && data?.anonymous && (
        <div className="space-y-5">
          {/* Big badge */}
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-emerald-500/30 bg-emerald-500/8 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20">
              <EyeOff className="h-8 w-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-black text-emerald-300">RomX لا يعرف من أنت</h2>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              أنت تصفّح بشكل مجهول. لا اسم، لا بريد، لا IP محفوظ، لا كوكيز تتبع.
            </p>
          </div>

          {/* What IS stored anonymously */}
          <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Database className="h-4 w-4 text-[var(--primary)]" />
              ما يُخزَّن مؤقتاً (مجهول الهوية):
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-400/70" />
                <span>عدد التحميلات والإعجابات — <strong className="text-foreground">رقم فقط</strong>، بدون أي هوية</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-400/70" />
                <span>hash مشفّر من الـ IP لمنع عد نفس التحميل مرتين — <strong className="text-foreground">غير قابل للعكس</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-400/70" />
                <span>يُحذف تلقائياً بعد 90 يوم</span>
              </div>
            </div>
          </div>

          {/* CTA to register */}
          <div className="rounded-2xl border border-border bg-card/60 p-5 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              سجّل دخولك لعرض بياناتك الكاملة وحذفها متى أردت
            </p>
            <Link href="/login"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-black text-white shadow-lg transition-all hover:scale-105 active:scale-95"
              style={{ background: "linear-gradient(135deg, var(--primary), #6366f1)" }}>
              تسجيل الدخول
            </Link>
          </div>

          {/* Certificate for anonymous too */}
          <div className="relative overflow-hidden rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/60 via-card to-card p-6 text-center space-y-4"
            style={{ boxShadow: "0 0 40px -10px rgba(16,185,129,0.15)" }}>
            <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
              style={{ backgroundImage: "repeating-linear-gradient(45deg, #10b981 0, #10b981 1px, transparent 0, transparent 50%)", backgroundSize: "14px 14px" }} />
            <div className="relative space-y-3">
              <div className="mx-auto w-14 h-14 rounded-full border-2 border-emerald-500/50 bg-emerald-500/15 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-base font-black text-emerald-300">شهادة الشفافية ✓</h3>
              <div className="grid gap-1.5 text-sm text-start">
                {[
                  "✅ لا Google Analytics — لا Facebook Pixel",
                  "✅ الـ IP لا يُخزَّن — يُشفَّر فوراً للإحصاء فقط",
                  "✅ لا بيع أو مشاركة بيانات مع أي طرف",
                  "✅ البيانات تُعرض مباشرةً من قاعدة البيانات",
                ].map(t => (
                  <div key={t} className="flex items-start gap-2 rounded-xl bg-emerald-500/8 border border-emerald-500/15 px-3 py-2">
                    <span className="text-muted-foreground leading-relaxed">{t}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-center flex-wrap">
                <button onClick={() => navigator.clipboard.writeText(window.location.href)}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                  🔗 انسخ الرابط
                </button>
                <a href={`https://wa.me/?text=${encodeURIComponent("👇 شوف بنفسك ماذا يعرف موقع RomX عنك:\n" + (typeof window !== "undefined" ? window.location.href : "https://rom-x.vercel.app/my-data"))}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/15 transition-colors">
                  💬 شارك في الواتساب
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Logged-in user ────────────────────────────────────────────────── */}
      {!loading && !error && data && !data.anonymous && (
        <div className="space-y-6">

          {/* Identity card */}
          <section className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-black text-foreground uppercase tracking-wide">
              <Eye className="h-4 w-4 text-[var(--primary)]" />
              هويتك المخزّنة
            </h2>
            {[
              { label: "الاسم",          value: data.stored.name as string },
              { label: "البريد الإلكتروني", value: data.stored.email as string },
              { label: "اسم المستخدم",   value: (data.stored.username as string) || "—" },
              { label: "البلد",           value: (data.stored.country as string) || "—" },
              { label: "تاريخ الانضمام", value: data.stored.joinedAt
                ? new Date(data.stored.joinedAt as string).toLocaleDateString("ar-EG")
                : "—" },
              { label: "الدور",           value: data.stored.role as string },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between gap-4 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                <span className="text-xs text-muted-foreground shrink-0">{label}</span>
                <span className="text-sm font-semibold text-foreground text-end break-all">{value}</span>
              </div>
            ))}
          </section>

          {/* Activity stats */}
          {data.activity && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-black text-foreground uppercase tracking-wide">
                <Database className="h-4 w-4 text-[var(--primary)]" />
                نشاطك المخزّن
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard icon={Download}       label="تحميلات قمت بها"     value={data.activity.downloadsPerformed as number} color="#34d399" />
                <StatCard icon={Heart}           label="إعجابات أعطيتها"     value={data.activity.likesGiven as number}         color="#f43f5e" />
                <StatCard icon={MessageSquare}   label="تعليقات كتبتها"      value={data.activity.commentsWritten as number}    color="#a78bfa" />
                <StatCard icon={Star}            label="تقييمات أعطيتها"     value={data.activity.ratingsGiven as number}       color="#fbbf24" />
                <StatCard icon={Zap}             label="XP"                  value={data.activity.xp as number}                 color="#f59e0b" />
                <StatCard icon={Users}           label="متابعين"             value={data.activity.followers as number}          color="#60a5fa" />
              </div>
            </section>
          )}

          {/* What is NOT stored */}
          {data.notStored && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-black text-foreground uppercase tracking-wide">
                <Lock className="h-4 w-4 text-emerald-400" />
                ما لا يُخزَّن أبداً
              </h2>
              <div className="space-y-2">
                {(data.notStored as string[]).map((item) => (
                  <NotStoredItem key={item} label={item} icon={notStoredIcons[item] || Lock} />
                ))}
              </div>
            </section>
          )}

          {/* Third parties */}
          {data.thirdParties && (
            <section className="rounded-2xl border border-border bg-card/60 p-5 space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-black text-foreground uppercase tracking-wide">
                <Share2 className="h-4 w-4 text-[var(--primary)]" />
                مشاركة بياناتك مع أطراف أخرى
              </h2>
              {[
                { label: "بيع بياناتك",             value: !data.thirdParties.sold },
                { label: "مشاركتها للإعلانات",      value: !data.thirdParties.sharedForAds },
                { label: "مشاركتها مع شركاء",       value: !data.thirdParties.sharedWithPartners },
                { label: "استخدامها لبناء ملف تعريفي", value: !data.thirdParties.usedForProfiling },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  {value
                    ? <span className="flex items-center gap-1 text-xs font-bold text-emerald-400"><CheckCircle2 className="h-4 w-4" /> لا يحدث أبداً</span>
                    : <span className="flex items-center gap-1 text-xs font-bold text-red-400"><XCircle className="h-4 w-4" /> يحدث</span>
                  }
                </div>
              ))}
            </section>
          )}

          {/* Delete account CTA */}
          <section className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-black text-red-400">
              <UserX className="h-4 w-4" />
              حقك الكامل في حذف بياناتك
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              يمكنك حذف حسابك وكل بياناتك من الإعدادات في أي وقت — فوري وغير قابل للتراجع.
            </p>
            <Link href="/settings"
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-400 hover:bg-red-500/20 transition-all">
              <Trash2 className="h-4 w-4" />
              الذهاب للإعدادات
            </Link>
          </section>

          {/* ── Certificate Card — للسكرين شوت والمشاركة ───────────────────── */}
          <section
            id="certificate"
            className="relative overflow-hidden rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/60 via-card to-card p-6 text-center space-y-4"
            style={{ boxShadow: "0 0 40px -10px rgba(16,185,129,0.15)" }}
          >
            {/* Watermark pattern */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
              style={{ backgroundImage: "repeating-linear-gradient(45deg, #10b981 0, #10b981 1px, transparent 0, transparent 50%)", backgroundSize: "14px 14px" }} />

            <div className="relative space-y-4">
              {/* Seal */}
              <div className="mx-auto w-16 h-16 rounded-full border-2 border-emerald-500/50 bg-emerald-500/15 flex flex-col items-center justify-center gap-0.5">
                <ShieldCheck className="w-7 h-7 text-emerald-400" />
              </div>

              <div>
                <h3 className="text-lg font-black text-emerald-300">شهادة الشفافية</h3>
                <p className="text-xs text-emerald-400/70 font-bold tracking-widest uppercase mt-0.5">Transparency Certificate</p>
              </div>

              {/* Facts */}
              <div className="grid grid-cols-1 gap-2 text-sm text-start">
                {[
                  { icon: "✅", text: "لا يوجد Google Analytics أو Facebook Pixel" },
                  { icon: "✅", text: "لا يتم بيع أو مشاركة بياناتك مع أي طرف ثالث" },
                  { icon: "✅", text: "عنوان الـ IP لا يُخزَّن — يُشفَّر فوراً ويُستخدم للإحصاء فقط" },
                  { icon: "✅", text: "يمكنك حذف حسابك وكل بياناتك في أي وقت فوراً" },
                  { icon: "✅", text: "هذه الصفحة تسحب البيانات مباشرةً من قاعدة البيانات الحقيقية" },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-start gap-2 rounded-xl bg-emerald-500/8 border border-emerald-500/15 px-3 py-2">
                    <span className="text-base shrink-0">{icon}</span>
                    <span className="text-muted-foreground leading-relaxed">{text}</span>
                  </div>
                ))}
              </div>

              {/* Timestamp */}
              <div className="rounded-xl bg-black/20 border border-emerald-500/15 px-4 py-2.5 text-center">
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">تم التحقق في</p>
                <p className="text-xs font-bold text-emerald-400/80 mt-0.5">
                  {new Date().toLocaleString("ar-EG", {
                    year: "numeric", month: "long", day: "numeric",
                    hour: "2-digit", minute: "2-digit"
                  })}
                </p>
              </div>

              {/* Share buttons */}
              <div className="flex gap-2 justify-center flex-wrap">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                  🔗 انسخ الرابط
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent("👇 شوف بنفسك ماذا يعرف موقع RomX عنك:\n" + (typeof window !== "undefined" ? window.location.href : "https://rom-x.vercel.app/my-data"))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/15 transition-colors"
                >
                  💬 شارك في الواتساب
                </a>
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "https://rom-x.vercel.app/my-data")}&text=${encodeURIComponent("👇 شوف بنفسك ماذا يعرف موقع RomX عنك")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-xl border border-blue-500/25 bg-blue-500/10 px-4 py-2 text-xs font-bold text-blue-400 hover:bg-blue-500/15 transition-colors"
                >
                  ✈️ شارك في تيليجرام
                </a>
              </div>

              <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
                rom-x.vercel.app/my-data — هذه الصفحة متاحة لأي أحد لفحصها
              </p>
            </div>
          </section>

          {/* Refresh */}
          <button onClick={fetchData}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
            <RefreshCw className="h-4 w-4" />
            تحديث البيانات
          </button>
        </div>
      )}
    </div>
  );
}
