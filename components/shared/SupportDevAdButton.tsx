"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Heart, Coins, Lock, Unlock, ArrowDownToLine, ExternalLink, Loader2, Sparkles, X, Trophy } from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { AD_SUPPORT } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

const SMARTLINK_URL = "https://www.profitablecpmratenetwork.com/j5x5je973?key=3c021f1f13e7b3f2af4a137bdcea6f55";

interface Props {
  romId?: string; // Optional if supporting from profile
  devUid: string;
  devName?: string;
  adsEnabled?: boolean;
  className?: string;
  compact?: boolean;
  downloadLink?: string; // If provided, acts as a Download Gate!
  children?: React.ReactNode; // Can be used to wrap custom buttons
  triggerMode?: boolean; // If true, disables default button and relies on external trigger
}

export type SupportDevAdRef = {
  triggerWithUrl: (url: string) => void;
};

type State = "idle" | "waiting_sponsor" | "counting" | "verifying" | "success" | "cooldown" | "limit" | "error";

export default function SupportDevAdButton({
  romId, devUid, devName, adsEnabled = false, className = "", compact = false, downloadLink, children, triggerMode
}: Props) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [state, setState] = useState<State>("idle");
  const [timeLeft, setTimeLeft] = useState(5);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [cooldownMin, setCooldownMin] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [dynamicUrl, setDynamicUrl] = useState<string | null>(null);

  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const cancelRef = useRef(false);

  // Stop timer on unmount
  useEffect(() => {
    return () => {
      cancelRef.current = true;
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  if (!adsEnabled) return null;

  const handleStart = (overrideUrl?: string) => {
    if (!user) {
      setErrorMsg(t("support.signInFirst"));
      setState("error"); setShowModal(true);
      setTimeout(() => { setShowModal(false); setState("idle"); }, 3000);
      return;
    }
    if (overrideUrl) setDynamicUrl(overrideUrl);
    
    cancelRef.current = false;
    setTimeLeft(5);
    setState("waiting_sponsor");
    setShowModal(true);
  };
  
  // Expose methods to window for ugly but robust integration
  useEffect(() => {
    if (triggerMode && typeof window !== "undefined") {
      (window as any).__triggerSupportDevAd = (url: string) => {
        handleStart(url);
      };
    }
    return () => {
      if (triggerMode && typeof window !== "undefined") {
        delete (window as any).__triggerSupportDevAd;
      }
    };
  }, [user, triggerMode]);

  const handleSponsorClick = () => {
    if (state !== "waiting_sponsor") return;
    
    // 1. Open the Adsterra Smartlink in a new tab to generate revenue!
    window.open(SMARTLINK_URL, "_blank");
    
    // 2. Start the unlocking countdown in the original tab
    setState("counting");
    countdownRef.current = setInterval(() => {
      if (cancelRef.current) return;
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          verifyAndReward();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const verifyAndReward = async () => {
    if (cancelRef.current) return;
    setState("verifying");
    
    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error("No token");

      const res = await fetch("/api/roms/ad-support", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ romId, devUid }),
      });
      const data = await res.json();

      if (data.success) {
        setPointsEarned(data.pointsEarned || AD_SUPPORT.POINTS_PER_WATCH);
        setState("success");
        executeDownload();
      } else if (data.cooldown) {
        setCooldownMin(data.remainMin || 15);
        setState("cooldown");
        executeDownload(); // Always let them download even if dev on cooldown
      } else if (data.dailyLimitReached || data.postLimitReached) {
        setState("limit");
        executeDownload(); // Always let them download
      } else {
        setErrorMsg(data.error || t("support.unexpectedError"));
        setState("error");
      }
    } catch {
      setErrorMsg(t("support.serverError"));
      setState("error");
    }

    // Auto close modal after a few seconds unless it's a success wait (handled by executeDownload)
    if (state !== "success" && state !== "cooldown" && state !== "limit") {
      setTimeout(() => {
        if (!cancelRef.current) { setShowModal(false); setState("idle"); }
      }, 4000);
    }
  };

  const executeDownload = () => {
    const finalUrl = dynamicUrl || downloadLink;
    if (finalUrl && !cancelRef.current) {
      setTimeout(() => {
        if (!cancelRef.current) {
          window.open(finalUrl, "_blank"); // Open direct link in new tab or current
          setShowModal(false);
          setState("idle");
          setDynamicUrl(null);
        }
      }, 2500);
    } else {
      setTimeout(() => {
        if (!cancelRef.current) {
          setShowModal(false);
          setState("idle");
        }
      }, 3500);
    }
  };

  // ------------------------------------------------------------------
  // TRIGGER BUTTON RENDERER
  // ------------------------------------------------------------------
  const renderTrigger = () => {
    if (triggerMode) return null; // Controlled externally!

    if (children) {
      return <div onClick={() => handleStart()} className={className}>{children}</div>;
    }
    if (downloadLink) {
      return (
        <button
          onClick={() => handleStart()}
          className={cn(
            "group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-blue-500/25 active:scale-95",
            className
          )}
        >
          <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
          <ArrowDownToLine className="h-6 w-6 animate-bounce" />
          <span className="text-lg">{t("support.downloadRom")}</span>
          
          <div className="absolute right-0 flex h-full items-center justify-center bg-black/20 px-4 backdrop-blur-sm">
            <Unlock className="h-4 w-4 text-white/70" />
          </div>
        </button>
      );
    }

    return (
      <Button
        onClick={() => handleStart()}
        variant="outline"
        className={cn(
          "group relative overflow-hidden border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 hover:border-orange-500/50 transition-all",
          compact ? "h-9 w-9 p-0 rounded-lg justify-center" : "w-full justify-start rounded-xl p-4 sm:p-6",
          className
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/5 to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity animate-shimmer" />
        {compact ? (
          <Sparkles className="h-4 w-4 text-orange-400 group-hover:scale-110 transition-transform" />
        ) : (
          <div className="flex w-full items-center justify-between z-10 relative">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/20 text-orange-400">
                <Heart className="h-5 w-5" />
              </div>
              <div className="flex flex-col items-start gap-1">
                <span className="font-bold text-sm sm:text-base text-orange-100">{t("support.supportDev")} 🤝</span>
                <p className="text-xs text-orange-200/60 hidden sm:block">{t("support.earnPoints", { n: String(AD_SUPPORT.POINTS_PER_WATCH) })}</p>
              </div>
            </div>
            <Coins className="h-5 w-5 text-orange-400/50 group-hover:text-orange-400 transition-colors" />
          </div>
        )}
      </Button>
    );
  };

  return (
    <>
      {renderTrigger()}

      {/* OVERLAY MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative flex w-full max-w-sm flex-col items-center overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a] shadow-2xl shadow-black/80 animate-in zoom-in-95 duration-300">
            
            {/* Header Graphic */}
            <div className="relative flex h-32 w-full flex-col justify-center items-center bg-gradient-to-br from-indigo-600 via-purple-700 to-black p-6 text-center">
              <div className="absolute inset-0 opacity-10 mix-blend-overlay" style={{backgroundImage: "url('/noise.png')"}}></div>
              
              <button 
                onClick={() => { cancelRef.current = true; setShowModal(false); if (countdownRef.current) clearInterval(countdownRef.current); setState("idle"); }}
                className="absolute right-4 top-4 rounded-full bg-black/40 p-1.5 text-white/50 hover:bg-black/60 hover:text-white transition-colors"
                disabled={state === "verifying"}
              >
                <X className="h-4 w-4" />
              </button>

              {downloadLink ? (
                 <ArrowDownToLine className="h-10 w-10 text-white/90 mb-2 drop-shadow-md animate-bounce" />
              ) : (
                <Lock className="h-10 w-10 text-white/90 mb-2 drop-shadow-md" />
              )}
              
              <h3 className="z-10 text-lg sm:text-xl font-bold text-white tracking-tight">
                {(downloadLink || dynamicUrl) ? t("support.preparingDownload") : t("support.supportDev")}
              </h3>
            </div>

            <div className="flex w-full flex-col items-center px-6 py-8 text-center space-y-6">
              
              {/* STAGES */}
              {state === "waiting_sponsor" && (
                <div className="flex flex-col items-center gap-4 w-full">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t("support.platformFree")}
                    <br/>
                    {t("support.toSupport")} <strong>{devName ?? t("support.devDefaultName")}</strong> {(downloadLink || dynamicUrl) && t("support.andUnlockLink")}, {t("support.visitSponsorMoment")}
                  </p>
                  
                  <button 
                    onClick={handleSponsorClick}
                    className="group relative mt-2 flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-4 font-bold text-white shadow-[0_0_40px_-10px_rgba(16,185,129,0.4)] transition-all hover:scale-[1.02] active:scale-95"
                  >
                    <ExternalLink className="h-5 w-5 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
                    <span>{t("support.visitSponsor")}</span>
                  </button>
                  
                  <p className="text-[10px] sm:text-xs text-muted-foreground/50 mt-2 font-medium">
                    {t("support.clickToVisit")}
                  </p>
                </div>
              )}

              {state === "counting" && (
                <div className="flex flex-col items-center w-full">
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-indigo-500/20 bg-indigo-500/10">
                    <span className="text-4xl font-black text-indigo-400 tabular-nums">
                      {timeLeft}
                    </span>
                    <svg className="absolute inset-0 h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="46" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-indigo-500 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" strokeDasharray="289" strokeDashoffset={289 - (289 * ((5 - timeLeft) / 5))} style={{ transition: 'stroke-dashoffset 1s linear' }} />
                    </svg>
                  </div>
                  <p className="mt-5 text-sm sm:text-base font-bold text-white/90 animate-pulse">
                    {t("support.waitingUnlock")} {(downloadLink || dynamicUrl) ? t("support.waitingUnlockLink") : t("support.waitingPoints")}...
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/60">{t("support.closeAdPage")}</p>
                </div>
              )}

              {state === "verifying" && (
                <div className="flex flex-col items-center py-6 text-indigo-400">
                  <Loader2 className="h-10 w-10 animate-spin" />
                  <p className="mt-4 font-bold text-sm">{t("support.verifying")}</p>
                </div>
              )}

              {state === "success" && (
                <div className="flex flex-col items-center w-full animate-in zoom-in slide-in-from-bottom-4 duration-500">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 text-green-400 mb-2 relative">
                    <div className="absolute inset-0 rounded-full border-2 border-green-400 animate-ping opacity-20" />
                    <Heart className="h-8 w-8 fill-green-400 animate-pulse" />
                  </div>
                  <h4 className="text-xl font-black text-green-400 mb-1">{t("support.successTitle")}</h4>
                  <p className="text-sm font-medium text-white/90 text-center">{t("support.contributed")} {devName ?? t("support.devDefaultName")}</p>
                  
                  <div className="mt-4 flex w-full items-center justify-between rounded-xl bg-orange-500/10 border border-orange-500/20 p-4">
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] text-orange-200/70 uppercase tracking-wider font-bold mb-1">{t("support.todayReward")}</span>
                      <span className="text-lg font-black text-orange-400">+{pointsEarned} {t("support.points")}</span>
                    </div>
                    <Trophy className="h-8 w-8 text-orange-400 opacity-80" />
                  </div>

                  {(downloadLink || dynamicUrl) && (
                    <p className="mt-4 text-sm font-bold text-green-400 animate-pulse">{t("support.downloading")}</p>
                  )}
                </div>
              )}

              {(state === "cooldown" || state === "limit" || state === "error") && (
                <div className="flex flex-col items-center text-center">
                  <div className={cn("flex h-16 w-16 items-center justify-center rounded-full mb-4 animate-in zoom-in", 
                    state === "error" ? "bg-red-500/20 text-red-500" : "bg-orange-500/20 text-orange-500"
                  )}>
                    {state === "error" ? <Lock className="h-8 w-8" /> : <Coins className="h-8 w-8" />}
                  </div>
                  
                  {state === "cooldown" && (
                    <>
                      <h4 className="font-bold text-white mb-2">{t("support.cooldownTitle")}</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">{t("support.cooldownDesc", { n: String(cooldownMin) })}</p>
                      {downloadLink && <p className="mt-4 text-sm font-bold text-green-400 animate-pulse">{t("support.redirectingDownload")}</p>}
                    </>
                  )}
                  
                  {state === "limit" && (
                    <>
                      <h4 className="font-bold text-white mb-2">{t("support.maxTitle")}</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">{t("support.maxDesc")}</p>
                      {downloadLink && <p className="mt-4 text-sm font-bold text-green-400 animate-pulse">{t("support.redirectingDownload")}</p>}
                    </>
                  )}

                  {state === "error" && (
                    <>
                      <h4 className="font-bold text-red-400 mb-2">{t("support.sorryTitle")}</h4>
                      <p className="text-sm text-red-400/80">{errorMsg}</p>
                    </>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}
