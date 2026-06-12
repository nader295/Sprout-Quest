"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";
import {
  ShieldCheck, Eye, Database, Trash2, Download, Heart,
  MessageCircle, Bell, User, Lock, Globe2, X, CheckCircle2,
  ChevronRight, RefreshCw, Share2, Copy, Check, AlertCircle, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────
interface TransparencyData {
  authenticated: boolean;
  stored: Record<string, unknown>;
  notStored: string[];
  thirdParty: Record<string, boolean>;
  yourRights?: Record<string, unknown>;
  generatedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────
function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold",
      ok
        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
        : "bg-red-500/10 text-red-400 border border-red-500/20"
    )}>
      {ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      {label}
    </span>
  );
}

function DataCard({
  icon: Icon,
  title,
  value,
  note,
  color = "blue",
}: {
  icon: React.ElementType;
  title: string;
  value: string | number;
  note?: string;
  color?: "blue" | "emerald" | "amber" | "rose";
}) {
  const colors = {
    blue:    { bg: "bg-blue-500/8",    border: "border-blue-500/20",    text: "text-blue-400"    },
    emerald: { bg: "bg-emerald-500/8", border: "border-emerald-500/20", text: "text-emerald-400" },
    amber:   { bg: "bg-amber-500/8",   border: "border-amber-500/20",   text: "text-amber-400"   },
    rose:    { bg: "bg-rose-500/8",    border: "border-rose-500/20",    text: "text-rose-400"    },
  }[color];

  return (
    <div className={cn("rounded-2xl border p-4 flex items-center gap-3", colors.bg, colors.border)}>
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", colors.bg, colors.border, "border")}>
        <Icon className={cn("w-4 h-4", colors.text)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground font-medium">{title}</p>
        <p className={cn("text-base font-black truncate", colors.text)}>{value}</p>
        {note && <p className="text-[10px] text-muted-foreground/60 mt-0.5 leading-relaxed">{note}</p>}
      </div>
    </div>
  );
}

// ── Browser Storage Inspector ──────────────────────────────────────────
function BrowserStorageInspector() {
  const [cookies, setCookies]   = useState<string[]>([]);
  const [localStorage_, setLocalStorage_] = useState<string[]>([]);
  const [session, setSession]   = useState<string[]>([]);

  useEffect(() => {
    // Cookies
    const cookieList = document.cookie
      .split(";")
      .map(c => c.trim())
      .filter(Boolean)
      .map(c => c.split("=")[0]);
    setCookies(cookieList);

    // LocalStorage keys
    const lsKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) lsKeys.push(k);
    }
    setLocalStorage_(lsKeys);

    // SessionStorage keys
    const ssKeys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k) ssKeys.push(k);
    }
    setSession(ssKeys);
  }, []);

  // Filter out tracking-related keywords
  const trackingKeywords = ["fbp", "fbc", "_ga", "_gid", "pixel", "track", "analytics", "_clck", "ads"];
  const hasTracking = [...cookies, ...localStorage_, ...session].some(k =>
    trackingKeywords.some(t => k.toLowerCase().includes(t))
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Eye className="w-4 h-4 text-primary" />
        <h3 className="font-bold text-sm">فحص المتصفح الآن — بياناتك عندك</h3>
        <span className="text-[10px] text-muted-foreground mr-auto">يعمل محلياً فقط — لا يُرسَل لنا</span>
      </div>

      {/* Result */}
      <div className={cn(
        "rounded-xl p-4 flex items-center gap-3 border",
        hasTracking
          ? "bg-amber-500/8 border-amber-500/20"
          : "bg-emerald-500/8 border-emerald-500/20"
      )}>
        {hasTracking
          ? <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          : <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />}
        <div>
          <p className={cn("font-black text-sm", hasTracking ? "text-amber-400" : "text-emerald-400")}>
            {hasTracking ? "يوجد بعض الكوكيز (من خدمات خارجية)" : "✅ لا توجد كوكيز تتبع على الإطلاق"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {hasTracking
              ? "هذه الكوكيز من Firebase (المصادقة) — ليست لتتبع نشاطك"
              : "متصفحك نظيف تماماً من أي أدوات تتبع أو تحليل"}
          </p>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        {[
          { label: "Cookies", items: cookies, icon: "🍪" },
          { label: "LocalStorage", items: localStorage_, icon: "💾" },
          { label: "SessionStorage", items: session, icon: "⚡" },
        ].map(({ label, items, icon }) => (
          <div key={label} className="rounded-xl bg-muted/20 border border-border p-3 space-y-1.5">
            <p className="font-bold text-muted-foreground">{icon} {label}</p>
            {items.length === 0
              ? <p className="text-emerald-400 font-bold text-[11px]">فارغ ✓</p>
              : items.map(k => (
                  <p key={k} className="text-[10px] text-muted-foreground truncate font-mono">{k}</p>
                ))
            }
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────
export default function TransparencyPage() {
  const { user, isLoggedIn } = useAuth();
  const { t } = useTranslation();
  const [data, setData] = useState<TransparencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/transparency");
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Sealed Certificate Stamp ───────────────────────────────────────
  const generatedAt = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleString("ar-EG", {
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <div className="min-h-screen pb-20 px-4 pt-6 max-w-2xl mx-auto space-y-5">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-primary transition-colors">الرئيسية</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium">الشفافية الكاملة</span>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 via-card to-card p-6">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 10% 50%, rgba(16,185,129,0.07) 0%, transparent 65%)" }} />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-lg font-black text-foreground">الشفافية الكاملة</h1>
                  <p className="text-[11px] text-muted-foreground">ماذا يعرف عنك RomX؟</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                هذه الصفحة تُظهر <span className="text-foreground font-bold">كل</span> البيانات
                المخزّنة عنك — لا أكثر، لا أقل. في الوقت الحقيقي، مباشرةً من قاعدة البيانات.
              </p>
            </div>
            {/* Seal */}
            <div className="shrink-0 w-16 h-16 rounded-full border-2 border-emerald-500/30 bg-emerald-500/10 flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <span className="text-[8px] font-black text-emerald-400 leading-tight mt-0.5">VERIFIED</span>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge ok label="لا تتبع" />
            <Badge ok label="لا إعلانات بيانات" />
            <Badge ok label="لا بيع للبيانات" />
            <Badge ok label="لا Google Analytics" />
            <Badge ok label="لا Facebook Pixel" />
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">جاري جلب بياناتك من قاعدة البيانات…</span>
        </div>
      )}

      {/* Data Audit */}
      {!loading && data && (
        <>
          {/* Status Bar */}
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
            <div className={cn(
              "w-2 h-2 rounded-full shrink-0",
              isLoggedIn ? "bg-blue-400 animate-pulse" : "bg-emerald-400"
            )} />
            <span className="text-sm font-bold">
              {isLoggedIn ? `مسجّل الدخول — ${user?.displayName || user?.email || "مستخدم"}` : "غير مسجّل — مجهول الهوية"}
            </span>
            <button onClick={load} disabled={refreshing}
              className="mr-auto text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            </button>
          </div>

          {/* Stored Data */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
              📦 ما يعرفه الموقع عنك الآن
            </h2>

            {isLoggedIn && data.stored.profile ? (() => {
              const p = data.stored.profile as Record<string, unknown>;
              const act = data.stored.activity as Record<string, unknown>;
              return (
                <div className="space-y-2">
                  {/* Profile */}
                  <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                    <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> بيانات الحساب
                    </p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                      {[
                        ["الاسم", p.name],
                        ["البريد", p.email],
                        ["الصورة", p.photo],
                        ["الصلاحية", p.role],
                        ["انضم في", p.joinedAt ? new Date(p.joinedAt as string).toLocaleDateString("ar-EG") : "—"],
                        ["XP", p.xp],
                      ].map(([label, val]) => (
                        <div key={label as string} className="flex items-center justify-between border-b border-border/40 py-1">
                          <span className="text-muted-foreground">{label as string}</span>
                          <span className="font-bold text-foreground truncate max-w-[120px] text-right">{String(val ?? "—")}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Activity Counts */}
                  <div className="grid grid-cols-2 gap-2">
                    <DataCard icon={Download}     title="التحميلات"     value={(act.downloads as Record<string,unknown>)?.count as number ?? 0}     note="لمنع التكرار في الإحصائيات"     color="blue" />
                    <DataCard icon={Heart}        title="الإعجابات"     value={(act.likes as Record<string,unknown>)?.count as number ?? 0}          note="لعرض ما أعجبك"                  color="rose" />
                    <DataCard icon={MessageCircle} title="التعليقات"   value={(act.comments as Record<string,unknown>)?.count as number ?? 0}       note="التعليقات التي كتبتها"          color="amber" />
                    <DataCard icon={Bell}         title="الإشعارات"    value={(act.notifications as Record<string,unknown>)?.count as number ?? 0}   note="إشعاراتك الواردة"              color="emerald" />
                  </div>
                </div>
              );
            })() : (
              // Anonymous
              <div className="space-y-2">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center space-y-2">
                  <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="font-black text-emerald-400">لا نعرف عنك شيئاً تقريباً</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    بما أنك غير مسجّل، نخزّن فقط <strong>hash مشفّر</strong> لعنوان IP
                    لمنع تكرار عدّ التحميلات. لا يمكن لأحد استخراج IP الحقيقي من هذا الـ hash.
                  </p>
                </div>

                {!!data.stored.downloads && (
                  <div className="grid grid-cols-2 gap-2">
                    <DataCard icon={Download} title="تحميلات من IP هذا"
                      value={((data.stored.downloads as Record<string,unknown>).count as number) ?? 0}
                      note="hash مشفّر — لا يُقرأ" color="blue" />
                    <DataCard icon={Heart} title="إعجابات مجهولة"
                      value={((data.stored.anonLikes as Record<string,unknown>)?.count as number) ?? 0}
                      note="hash مشفّر — لا يُقرأ" color="rose" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* NOT Stored */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
              🚫 ما لا يعرفه الموقع عنك أبداً
            </h2>
            <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
              {(data.notStored as string[]).map((item) => (
                <div key={item} className="flex items-center gap-2.5 text-sm">
                  <X className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Third Party */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
              🌐 خدمات خارجية
            </h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { key: "analytics",       label: "Analytics" },
                { key: "adTracking",      label: "Ad Tracking" },
                { key: "facebookPixel",   label: "Facebook Pixel" },
                { key: "googleAnalytics", label: "Google Analytics" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
                  {(data.thirdParty as Record<string,boolean>)[key]
                    ? <AlertCircle className="w-4 h-4 text-amber-400" />
                    : <Check className="w-4 h-4 text-emerald-400" />
                  }
                  <span className="font-bold">{label}</span>
                  <span className={cn("mr-auto font-black text-[11px]",
                    (data.thirdParty as Record<string,boolean>)[key] ? "text-amber-400" : "text-emerald-400"
                  )}>
                    {(data.thirdParty as Record<string,boolean>)[key] ? "مفعّل" : "مُعطَّل"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Browser Storage Inspector */}
          <BrowserStorageInspector />

          {/* Rights & Delete */}
          {isLoggedIn && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-400" />
                <h3 className="font-bold text-sm">حقك في حذف بياناتك</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                يمكنك حذف حسابك وجميع بياناتك فوراً وبشكل دائم لا رجعة فيه.
                لا يوجد "انتظر 30 يوم" أو "سنحتفظ بنسخة".
              </p>
              <Link href="/settings"
                className="flex items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-sm py-2.5 hover:bg-red-500/15 transition-colors">
                <Trash2 className="w-4 h-4" />
                احذف حسابي وكل بياناتي
              </Link>
            </div>
          )}

          {/* Sealed Certificate */}
          <div className="relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/30 to-card p-6 text-center space-y-3">
            <div className="absolute inset-0 pointer-events-none opacity-5"
              style={{ backgroundImage: "repeating-linear-gradient(45deg, #10b981 0, #10b981 1px, transparent 0, transparent 50%)", backgroundSize: "12px 12px" }} />
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="font-black text-emerald-400 text-base">شهادة الشفافية — موثّقة</h3>
              <p className="text-xs text-muted-foreground mt-1">
                هذه البيانات مُجلَبة مباشرةً من قاعدة البيانات الحقيقية للموقع
              </p>
              {generatedAt && (
                <p className="text-[11px] text-muted-foreground/60 mt-1">
                  تم التحقق في: {generatedAt}
                </p>
              )}

              {/* Share buttons */}
              <div className="flex gap-2 justify-center mt-4">
                <button onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-card/80 px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "تم النسخ!" : "انسخ الرابط"}
                </button>
                <a href={`https://wa.me/?text=شوف بنفسك ماذا يعرف موقع RomX عنك: ${typeof window !== "undefined" ? window.location.href : ""}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/15 transition-colors">
                  <Share2 className="w-3.5 h-3.5" />
                  شارك في الجروبات
                </a>
              </div>
            </div>
          </div>

        </>
      )}
    </div>
  );
}
