"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation, LANGUAGES } from "@/lib/i18n";
import { detectDeviceLanguage } from "@/lib/detect-language";
import { useSettings } from "@/lib/hooks/use-settings";
import { Globe, X, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Step definitions ────────────────────────────────────────────────────────
interface Step {
  id: string;
  emoji: string;
  titleKey: string;
  descKey: string;
  color: string;
  bg: string;
  glow: string;
}

const STEPS: Step[] = [
  {
    id: "welcome",
    emoji: "🚀",
    titleKey: "onboard.welcome.title",
    descKey: "onboard.welcome.desc",
    color: "#60a5fa",
    bg: "radial-gradient(ellipse at 50% 0%, #1e3a5f 0%, #0a0f1a 70%)",
    glow: "#3b82f680",
  },
  {
    id: "discover",
    emoji: "📦",
    titleKey: "onboard.discover.title",
    descKey: "onboard.discover.desc",
    color: "#34d399",
    bg: "radial-gradient(ellipse at 50% 0%, #0d3326 0%, #0a0f1a 70%)",
    glow: "#34d39980",
  },
  {
    id: "xp",
    emoji: "⚡",
    titleKey: "onboard.xp.title",
    descKey: "onboard.xp.desc",
    color: "#fbbf24",
    bg: "radial-gradient(ellipse at 50% 0%, #3d2e06 0%, #0a0f1a 70%)",
    glow: "#fbbf2480",
  },
  {
    id: "community",
    emoji: "🤝",
    titleKey: "onboard.community.title",
    descKey: "onboard.community.desc",
    color: "#a78bfa",
    bg: "radial-gradient(ellipse at 50% 0%, #2d1f5e 0%, #0a0f1a 70%)",
    glow: "#a78bfa80",
  },
  {
    id: "start",
    emoji: "🌟",
    titleKey: "onboard.start.title",
    descKey: "onboard.start.desc",
    color: "#f472b6",
    bg: "radial-gradient(ellipse at 50% 0%, #3d1030 0%, #0a0f1a 70%)",
    glow: "#f472b680",
  },
];

const FALLBACK: Record<string, string> = {
  "onboard.welcome.title":   "مرحباً بك في RomX 👋",
  "onboard.welcome.desc":    "المنصة العالمية للرومات المعدلة، الكيرنلات والمزيد. اكتشف آلاف الإصدارات من أفضل المطورين حول العالم.",
  "onboard.discover.title":  "اكتشف أفضل الإصدارات",
  "onboard.discover.desc":   "ابحث بالجهاز، الشركة، أو إصدار أندرويد. كل روم مع تقييمات ومراجعات المجتمع.",
  "onboard.xp.title":        "اكسب XP وارتقِ",
  "onboard.xp.desc":         "كل مساهمة تكسبك XP: نشر روم (+30)، إعجاب (+3)، متابع جديد (+5). ارتقِ من عضو إلى مطور أسطوري!",
  "onboard.community.title": "انضم للمجتمع",
  "onboard.community.desc":  "تابع مطوريك المفضلين، اترك تعليقات، شارك في النقاشات. معاً نبني أكبر مجتمع أندرويد.",
  "onboard.start.title":     "مستعد للانطلاق! 🎉",
  "onboard.start.desc":      "ملفك جاهز. ابدأ باستكشاف الإصدارات أو ارفع أول روم لك وابدأ رحلتك.",
  "onboard.skip":            "تخطي",
  "onboard.next":            "التالي",
  "onboard.prev":            "رجوع",
  "onboard.finish":          "ابدأ الآن",
  "onboard.of":              "من",
};

function tr(t: (k: string) => string, key: string): string {
  const res = t(key);
  return res === key ? (FALLBACK[key] ?? key) : res;
}

// ── Animated visual per step ─────────────────────────────────────────────────
function StepVisual({ step, color, glow }: { step: Step; color: string; glow: string }) {
  const { t } = useTranslation();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(p => p + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (step.id === "welcome") return (
    <div className="relative h-40 flex items-center justify-center overflow-hidden">
      {/* Orbiting rings */}
      {[56, 80, 108].map((r, i) => (
        <div key={i} className="absolute rounded-full"
          style={{
            width: r, height: r,
            border: `1px solid ${color}${i === 0 ? "40" : i === 1 ? "25" : "15"}`,
            animation: `ob-rotate ${5 + i * 2}s linear infinite ${i % 2 ? "reverse" : ""}`,
          }} />
      ))}
      {/* Center icon */}
      <div className="relative z-10 flex h-[52px] w-[52px] items-center justify-center rounded-2xl"
        style={{ background: `linear-gradient(135deg, ${color}30, ${color}10)`, border: `1.5px solid ${color}40`, boxShadow: `0 0 30px ${glow}` }}>
        <span className="text-3xl" style={{ filter: `drop-shadow(0 0 8px ${glow})` }}>🚀</span>
      </div>
      {/* Orbit icons */}
      {[{ e: "📦", d: 0 }, { e: "⚡", d: 120 }, { e: "🏆", d: 240 }].map(({ e, d }, i) => {
        const rad = ((d + tick * 4) * Math.PI) / 180;
        return (
          <div key={i} className="absolute flex h-7 w-7 items-center justify-center rounded-xl text-sm"
            style={{
              left: `calc(50% + ${40 * Math.cos(rad)}px)`,
              top: `calc(50% + ${40 * Math.sin(rad)}px)`,
              transform: "translate(-50%, -50%)",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(4px)",
            }}>
            {e}
          </div>
        );
      })}
    </div>
  );

  if (step.id === "discover") return (
    <div className="h-40 rounded-2xl overflow-hidden relative" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }} />
      {[
        { name: "Evolution X", device: "Pixel 8", dl: "12.4K", color: "#60a5fa" },
        { name: "LineageOS 21", device: "Galaxy S23", dl: "8.1K", color: "#34d399" },
        { name: "AOSP Extended", device: "OnePlus 12", dl: "5.3K", color: "#a78bfa" },
      ].map((rom, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b"
          style={{
            borderColor: "rgba(255,255,255,0.05)",
            opacity: tick % 3 === i ? 1 : 0.45,
            transform: tick % 3 === i ? "translateX(0)" : "translateX(-4px)",
            transition: "all 0.5s cubic-bezier(0.34,1.2,0.64,1)",
          }}>
          <div className="h-8 w-8 shrink-0 rounded-xl flex items-center justify-center text-sm"
            style={{ background: `${rom.color}15`, border: `1px solid ${rom.color}25` }}>📦</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{rom.name}</p>
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{rom.device}</p>
          </div>
          <span className="text-[10px] font-bold shrink-0" style={{ color: rom.color }}>⬇ {rom.dl}</span>
        </div>
      ))}
    </div>
  );

  if (step.id === "xp") return (
    <div className="h-40 flex flex-col items-center justify-center gap-3">
      {/* Progress bar */}
      <div className="w-full max-w-[260px]">
        <div className="flex justify-between mb-1.5 text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>
          <span>Member</span>
          <span style={{ color }}>Publisher →</span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${Math.min(100, ((tick * 9) % 105))}%`,
              background: `linear-gradient(90deg, ${color}, ${color}cc)`,
              boxShadow: `0 0 12px ${glow}`,
            }} />
        </div>
      </div>
      {/* XP badges */}
      <div className="flex flex-wrap justify-center gap-2">
        {[
          { label: t("onboard.xp.publishRom") || "نشر روم", xp: "+30", c: "#34d399" },
          { label: t("onboard.xp.like") || "إعجاب", xp: "+3", c: "#f472b6" },
          { label: t("onboard.xp.follower") || "متابع", xp: "+5", c: "#60a5fa" },
          { label: t("onboard.xp.update") || "تحديث", xp: "+10", c: "#a78bfa" },
        ].map((x, i) => (
          <span key={i} className="rounded-xl px-2.5 py-1 text-[10px] font-bold"
            style={{
              background: `${x.c}12`,
              color: x.c,
              border: `1px solid ${x.c}25`,
              animation: `ob-popIn 0.3s ease ${i * 0.08}s both`,
            }}>
            {x.label} <span className="font-black">{x.xp}</span>
          </span>
        ))}
      </div>
    </div>
  );

  if (step.id === "community") return (
    <div className="h-40 flex items-center justify-center flex-col gap-3">
      <div className="flex items-center">
        {["🧑‍💻", "👩‍💻", "🧑‍🎨", "👨‍🚀", "🧑‍🔬"].map((e, i) => (
          <div key={i}
            className="flex h-11 w-11 items-center justify-center rounded-full text-xl"
            style={{
              marginLeft: i > 0 ? "-10px" : "0",
              zIndex: 5 - i,
              border: "2px solid rgba(10,15,26,0.9)",
              background: `${["#60a5fa","#34d399","#a78bfa","#f472b6","#fbbf24"][i]}15`,
              animation: `ob-float ${1.8 + i * 0.25}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.15}s`,
              boxShadow: `0 4px 12px ${["#60a5fa","#34d399","#a78bfa","#f472b6","#fbbf24"][i]}30`,
            }}>
            {e}
          </div>
        ))}
        <div className="flex h-10 w-10 items-center justify-center rounded-full text-[10px] font-black"
          style={{ marginLeft: "-10px", zIndex: 0, background: "rgba(255,255,255,0.06)", border: "2px solid rgba(10,15,26,0.9)", color: "rgba(255,255,255,0.5)" }}>
          +2K
        </div>
      </div>
      <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{t("onboard.community.devsWorldwide") || "مطورون من حول العالم"}</p>
    </div>
  );

  // start
  return (
    <div className="h-40 flex items-center justify-center relative overflow-hidden">
      {/* Floating dots */}
      {[...Array(10)].map((_, i) => (
        <div key={i} className="absolute rounded-full"
          style={{
            width: 4 + (i % 3) * 2,
            height: 4 + (i % 3) * 2,
            background: ["#60a5fa","#34d399","#a78bfa","#f472b6","#fbbf24"][i % 5],
            left: `${8 + i * 9}%`,
            top: `${20 + Math.sin(i * 1.2) * 45}%`,
            animation: `ob-float ${1.5 + i * 0.18}s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.12}s`,
            opacity: 0.7,
          }} />
      ))}
      {/* Center star */}
      <div className="relative z-10 flex h-[60px] w-[60px] items-center justify-center rounded-2xl"
        style={{
          background: `linear-gradient(135deg, ${color}25, ${color}08)`,
          border: `1.5px solid ${color}35`,
          boxShadow: `0 0 40px ${glow}`,
          animation: "ob-breathe 2s ease-in-out infinite",
        }}>
        <span className="text-3xl">🌟</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function OnboardingTour() {
  const { user, userDoc, isLoggedIn, loading: authLoading } = useAuth();
  const { t, dir } = useTranslation();
  const { lang, setLang } = useSettings();
  const router = useRouter();

  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [animDir, setAnimDir] = useState<"next" | "prev">("next");
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [closing, setClosing] = useState(false);

  const touchStart = useRef(0);
  const touchEnd = useRef(0);
  const isRTL = dir === "rtl";

  // ── Show logic: Firebase is the only source of truth ──────────
  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn || !user) { setShow(false); return; }
    // Wait for userDoc to fully load
    if (userDoc === null) return;
    // tourSeen === true in DB → never show
    if (userDoc.tourSeen === true) {
      // اكتب في localStorage كـ cache لتجنب الانتظار في المرة الجاية
      try { localStorage.setItem(`romx_tour_seen_${user.uid}`, "1"); } catch {}
      setShow(false);
      return;
    }
    // localStorage fallback — لو الـ API بطيء أو فشل الحفظ
    try {
      if (localStorage.getItem(`romx_tour_seen_${user.uid}`) === "1") {
        setShow(false);
        return;
      }
    } catch {}
    // tourSeen falsy → مستخدم جديد، عرض مرة واحدة
    const timer = setTimeout(() => setShow(true), 600);
    return () => clearTimeout(timer);
  }, [authLoading, isLoggedIn, user, userDoc]);

  // ── Dismiss with animation ──
  const dismiss = useCallback(async () => {
    setClosing(true);
    setTimeout(() => { setShow(false); setClosing(false); }, 350);
    if (!isLoggedIn || !user) return;
    // اكتب في localStorage فوراً حتى لو فشل الـ API
    try { localStorage.setItem(`romx_tour_seen_${user.uid}`, "1"); } catch {}
    try {
      const { auth } = await import("@/lib/firebase/client");
      const token = await auth.currentUser?.getIdToken();
      await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: "seenTour" }),
      });
    } catch (e) {
      console.error("Failed to mark tour as seen", e);
    }
  }, [isLoggedIn, user]);

  const goNext = useCallback(() => {
    if (step >= STEPS.length - 1) { dismiss(); return; }
    setAnimDir("next");
    setStep(p => p + 1);
  }, [step, dismiss]);

  const goPrev = useCallback(() => {
    if (step <= 0) return;
    setAnimDir("prev");
    setStep(p => p - 1);
  }, [step]);

  // Keyboard nav
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { dismiss(); return; }
      if (e.key === "ArrowRight") { isRTL ? goPrev() : goNext(); }
      if (e.key === "ArrowLeft") { isRTL ? goNext() : goPrev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, dismiss, goNext, goPrev, isRTL]);

  // Swipe
  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = touchEnd.current = e.touches[0].clientX; };
  const onTouchMove = (e: React.TouchEvent) => { touchEnd.current = e.touches[0].clientX; };
  const onTouchEnd = () => {
    const diff = touchStart.current - touchEnd.current;
    if (Math.abs(diff) < 50) return;
    diff > 0 ? (isRTL ? goPrev() : goNext()) : (isRTL ? goNext() : goPrev());
  };

  if (!show) return null;

  const cur = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const ForwardIcon = isRTL ? ChevronLeft : ChevronRight;
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{
          zIndex: 10000,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(6px)",
          animation: closing ? "ob-fadeOut 0.35s ease forwards" : "ob-fadeIn 0.3s ease",
        }}
        onClick={dismiss}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 sm:inset-auto sm:start-1/2 sm:top-1/2"
        style={{
          zIndex: 10001,
          animation: closing
            ? "ob-slideDown 0.35s cubic-bezier(0.4,0,1,1) forwards"
            : "ob-slideUp 0.5s cubic-bezier(0.34,1.15,0.64,1)",
          // Desktop centering
          transform: undefined,
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="relative overflow-hidden rounded-t-[32px] sm:rounded-[28px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[390px]"
          style={{ background: cur.bg, boxShadow: `0 -20px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.07)` }}
          dir={dir}
        >
          {/* Animated glow top */}
          <div className="absolute inset-x-0 top-0 h-32 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 50% -20%, ${cur.glow} 0%, transparent 70%)`, transition: "all 0.5s" }} />

          {/* Handle bar (mobile) */}
          <div className="flex justify-center pt-3 pb-0 sm:hidden">
            <div className="h-1 w-10 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
          </div>

          {/* Top row: lang + close */}
          <div className="relative flex items-center justify-between px-5 pt-4 pb-1">
            {/* Language */}
            <div className="relative">
              <button
                onClick={() => setShowLangPicker(p => !p)}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition-all"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <Globe className="h-3 w-3" />
                {(() => {
                  const stored = typeof window !== "undefined" ? (() => { try { return JSON.parse(localStorage.getItem("romx_settings") || "{}").lang; } catch { return null; } })() : null;
                  if (!stored || stored === "auto") {
                    const d = detectDeviceLanguage();
                    return d ? `✨ ${LANGUAGES.find(l => l.code === d)?.nativeName || "Auto"}` : (t("onboard.lang.auto") || "تلقائي");
                  }
                  return LANGUAGES.find(l => l.code === lang)?.nativeName || "English";
                })()}
              </button>
              {showLangPicker && (
                <div className="absolute top-10 start-0 z-50 w-44 rounded-2xl overflow-hidden max-h-60 overflow-y-auto"
                  style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 40px rgba(0,0,0,0.6)", scrollbarWidth: "none" }}>
                  {/* Auto option */}
                  {(() => {
                    const stored = typeof window !== "undefined" ? (() => { try { return JSON.parse(localStorage.getItem("romx_settings") || "{}").lang; } catch { return null; } })() : null;
                    const isAuto = !stored || stored === "auto";
                    const detected = detectDeviceLanguage();
                    return (
                      <>
                        <button onClick={() => { setLang("auto"); setShowLangPicker(false); }}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs transition-colors hover:bg-white/5"
                          style={{ color: isAuto ? cur.color : "rgba(255,255,255,0.5)" }}>
                          <span>{isAuto ? "✓" : " "}</span>
                          <span>✨ {t("onboard.lang.auto") || "تلقائي"} {detected ? `· ${LANGUAGES.find(l => l.code === detected)?.nativeName}` : ""}</span>
                        </button>
                        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "2px 0" }} />
                      </>
                    );
                  })()}
                  {LANGUAGES.map(l => (
                    <button key={l.code} onClick={() => { setLang(l.code); setShowLangPicker(false); }}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs transition-colors hover:bg-white/5"
                      style={{ color: l.code === lang ? cur.color : "rgba(255,255,255,0.5)" }}>
                      <span>{l.code === lang ? "✓" : " "}</span>
                      <span>{l.nativeName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Close */}
            <button
              onClick={dismiss}
              className="flex h-8 w-8 items-center justify-center rounded-xl transition-all"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.4)" }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Content */}
          <div className="relative px-6 pb-7 pt-2">
            {/* Visual */}
            <div
              key={step}
              style={{ animation: `${animDir === "next" ? "ob-enterNext" : "ob-enterPrev"} 0.4s cubic-bezier(0.34,1.2,0.64,1)` }}
            >
              <StepVisual step={cur} color={cur.color} glow={cur.glow} />
            </div>

            {/* Step dots */}
            <div className="flex items-center justify-center gap-1.5 mt-4 mb-5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  onClick={() => { setAnimDir(i > step ? "next" : "prev"); setStep(i); }}
                  className="cursor-pointer rounded-full transition-all duration-400"
                  style={{
                    height: 4,
                    width: i === step ? 20 : 5,
                    background: i === step ? cur.color : "rgba(255,255,255,0.15)",
                    boxShadow: i === step ? `0 0 8px ${cur.glow}` : "none",
                  }}
                />
              ))}
            </div>

            {/* Text */}
            <div
              key={`txt-${step}`}
              style={{ animation: "ob-fadeUp 0.4s cubic-bezier(0.34,1.2,0.64,1)" }}
              className="text-center mb-6"
            >
              <h2 className="text-xl font-black text-white mb-2 leading-snug">
                {tr(t, cur.titleKey)}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                {tr(t, cur.descKey)}
              </p>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2.5">
              {step > 0 && (
                <button
                  onClick={goPrev}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all active:scale-90"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}
                >
                  <BackIcon className="h-4 w-4" />
                </button>
              )}

              <button
                onClick={goNext}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white transition-all active:scale-[0.97]"
                style={{
                  background: isLast
                    ? `linear-gradient(135deg, ${cur.color}, ${cur.color}aa)`
                    : `linear-gradient(135deg, ${cur.color}dd, ${cur.color}88)`,
                  boxShadow: `0 8px 24px ${cur.glow}`,
                }}
              >
                {isLast ? (
                  <>{tr(t, "onboard.finish")} ✓</>
                ) : (
                  <>{tr(t, "onboard.next")} <ForwardIcon className="h-4 w-4" /></>
                )}
              </button>
            </div>

            {/* Skip */}
            {!isLast && (
              <button
                onClick={dismiss}
                className="mt-3 w-full text-center text-[11px] font-medium py-1.5 transition-colors"
                style={{ color: "rgba(255,255,255,0.2)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.2)")}
              >
                {tr(t, "onboard.skip")}
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ob-fadeIn   { from { opacity:0 } to { opacity:1 } }
        @keyframes ob-fadeOut  { from { opacity:1 } to { opacity:0 } }
        @keyframes ob-slideUp  { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes ob-slideDown { from { transform: translateY(0) } to { transform: translateY(110%) } }
        @keyframes ob-enterNext {
          from { opacity:0; transform: translateX(${isRTL ? "-28px" : "28px"}) scale(0.97) }
          to   { opacity:1; transform: translateX(0) scale(1) }
        }
        @keyframes ob-enterPrev {
          from { opacity:0; transform: translateX(${isRTL ? "28px" : "-28px"}) scale(0.97) }
          to   { opacity:1; transform: translateX(0) scale(1) }
        }
        @keyframes ob-fadeUp {
          from { opacity:0; transform: translateY(12px) }
          to   { opacity:1; transform: translateY(0) }
        }
        @keyframes ob-float {
          from { transform: translateY(0) }
          to   { transform: translateY(-8px) }
        }
        @keyframes ob-rotate { to { transform: rotate(360deg) } }
        @keyframes ob-breathe {
          0%,100% { box-shadow: 0 0 20px ${cur.glow}; }
          50%     { box-shadow: 0 0 40px ${cur.glow}; }
        }
        @keyframes ob-popIn {
          from { opacity:0; transform: scale(0.7) }
          to   { opacity:1; transform: scale(1) }
        }
      `}</style>
    </>
  );
}
