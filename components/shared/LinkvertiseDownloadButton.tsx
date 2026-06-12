"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Download, ExternalLink, Zap, Shield, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

const DEFAULT_PUBLISHER_ID = 4988176;

interface Props {
  romId: string;
  romName: string;
  devName: string;
  downloadUrl: string;
  linkvertiseEnabled: boolean;
  publisherId?: number;
  onConfirm?: () => void;
  children?: (onClick: () => void, hasAd: boolean) => React.ReactNode;
  render?: (onClick: () => void, hasAd: boolean) => React.ReactNode;
}

type ModalState = "idle" | "confirm" | "done";

/**
 * Builds a Linkvertise Full Script API URL by loading their script,
 * initializing it with the publisher ID, and returning a function that
 * opens the Linkvertise page for a given target URL.
 *
 * Strategy: The only reliable way to use Linkvertise's Full Script API is
 * to let their linkvertise.js script scan the DOM for <a> tags matching
 * our whitelist AFTER the modal is open, then `.click()` the element.
 * We use a unique ID so the script can find the right link each time.
 */
let lvScriptLoaded = false;
let lvInitialized = false;

function ensureLvScript(): Promise<void> {
  return new Promise((resolve) => {
    if (lvScriptLoaded) { resolve(); return; }
    const existing = document.getElementById("lv-script");
    if (existing) { lvScriptLoaded = true; resolve(); return; }
    const script = document.createElement("script");
    script.id = "lv-script";
    script.src = "https://publisher.linkvertise.com/cdn/linkvertise.js";
    script.onload = () => { lvScriptLoaded = true; resolve(); };
    script.onerror = () => resolve(); // fail silently
    document.head.appendChild(script);
  });
}

export default function LinkvertiseDownloadButton({
  romId,
  romName,
  devName,
  downloadUrl,
  linkvertiseEnabled,
  publisherId = DEFAULT_PUBLISHER_ID,
  onConfirm,
  children,
  render,
}: Props) {
  const { t } = useTranslation();
  const [modalState, setModalState] = useState<ModalState>("idle");
  const [lvReady, setLvReady] = useState(false);
  const linkId = `lv-dl-${romId}`;

  // When the confirm modal opens, load the LV script and initialize it
  useEffect(() => {
    if (modalState !== "confirm" || !linkvertiseEnabled) return;
    let cancelled = false;

    const init = async () => {
      await ensureLvScript();
      if (cancelled) return;

      // Wait until window.linkvertise is available
      let tries = 0;
      const waitForLv = () => {
        if (cancelled) return;
        const lv = (window as any).linkvertise;
        if (lv && !lvInitialized) {
          try {
            // Only whitelist the exact download hostname
            const { hostname } = new URL(downloadUrl);
            lv(publisherId, { whitelist: [hostname], blacklist: [] });
            lvInitialized = true;
          } catch (_) {}
        }
        if (lv) {
          setLvReady(true);
        } else if (tries++ < 20) {
          setTimeout(waitForLv, 300);
        } else {
          // Fallback: LV script failed to load, proceed without ad
          setLvReady(true);
        }
      };
      waitForLv();
    };

    init();
    return () => { cancelled = true; };
  }, [modalState, linkvertiseEnabled, publisherId, downloadUrl]);

  const closeModal = useCallback(() => {
    setModalState("idle");
    setLvReady(false);
  }, []);

  const handleClick = useCallback(() => {
    if (!linkvertiseEnabled) {
      window.open(downloadUrl, "_blank");
      onConfirm?.();
      return;
    }
    lvInitialized = false; // reset so it re-runs per session
    setModalState("confirm");
  }, [linkvertiseEnabled, downloadUrl, onConfirm]);

  // Called when the user clicks the visible <a> tag (trusted click)
  const handleDownloadClick = useCallback(() => {
    onConfirm?.();
    setModalState("done");
    setTimeout(closeModal, 1800);
  }, [onConfirm, closeModal]);

  return (
    <>
      {children?.(handleClick, linkvertiseEnabled) || render?.(handleClick, linkvertiseEnabled)}

      {modalState !== "idle" && (
        <div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-6 sm:pb-0 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lv-modal-title"
          onKeyDown={(e) => { if (e.key === "Escape") closeModal(); }}
        >
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#0d0d0d] shadow-2xl animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-300">

            {/* Header */}
            <div className="relative flex flex-col items-center justify-center bg-gradient-to-br from-blue-700 via-blue-800 to-[#0a0a0a] p-7 text-center">
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close download dialog"
                className="absolute right-4 top-4 rounded-full bg-white/10 p-1.5 text-white/60 hover:bg-white/20 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>

              <div className={cn(
                "flex h-14 w-14 items-center justify-center rounded-2xl mb-3 transition-all duration-500",
                modalState === "confirm" && "bg-blue-500/20 text-blue-400",
                modalState === "done"    && "bg-emerald-500/20 text-emerald-400",
              )}>
                {modalState === "confirm" && <Download className="h-7 w-7" />}
                {modalState === "done"    && <Zap className="h-7 w-7" />}
              </div>

              <h3 id="lv-modal-title" className="text-lg font-black text-white">
                {modalState === "confirm" && (t("support.downloadWithAd") || "تحميل مع إعلان")}
                {modalState === "done"    && (t("support.downloading") || "جاري التحميل!")}
              </h3>
              <p className="mt-1 text-[11px] text-white/50 truncate max-w-[240px]">{romName}</p>
            </div>

            {/* Body */}
            <div className="px-6 py-6 space-y-5">

              {modalState === "confirm" && (
                <>
                  <div className="rounded-2xl bg-blue-500/8 border border-blue-500/20 p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <Zap className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-foreground">
                          {t("support.devHasAd") || "المطور"} <span className="text-blue-300">{devName}</span> {t("support.hasActivatedAd") || "فعّل إعلاناً على هذا التحميل"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                          {t("support.adDesc") || "سيتم توجيهك لصفحة Linkvertise لثوانٍ قصيرة، ثم يبدأ التحميل تلقائياً. هذا يدعم المطور على الاستمرار في التطوير مجاناً."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl bg-muted/20 border border-border/50 px-3 py-2">
                    <Shield className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <p className="text-[10px] text-muted-foreground">{t("support.originalLinkSaved") || "الرابط الأصلي محفوظ — Linkvertise لا تعدّل الملف"}</p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={closeModal}
                      className="flex-1 rounded-2xl border border-border bg-muted/20 py-3 text-sm font-bold text-muted-foreground hover:bg-muted/40 transition-all active:scale-95"
                    >
                      {t("support.cancel") || "إلغاء"}
                    </button>

                    {/* 
                      This <a> tag is the actual Linkvertise intercept target.
                      It MUST be visible and real in the DOM for LV script to hook it.
                      When linkvertise.js runs, it wraps this link with their redirect.
                    */}
                    {linkvertiseEnabled ? (
                      <a
                        id={linkId}
                        href={downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleDownloadClick}
                        className={cn(
                          "flex-[2] flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all hover:scale-[1.02] active:scale-95",
                          !lvReady && "opacity-70 cursor-wait"
                        )}
                      >
                        {!lvReady ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> {t("support.preparing") || "جاري التحضير..."}</>
                        ) : (
                          <><Download className="h-4 w-4" /> {t("support.downloadNow") || "تحميل الآن"}</>
                        )}
                      </a>
                    ) : (
                      <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleDownloadClick}
                        className="flex-[2] flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all hover:scale-[1.02] active:scale-95"
                      >
                        <Download className="h-4 w-4" /> {t("support.downloadNow") || "تحميل الآن"}
                      </a>
                    )}
                  </div>
                </>
              )}

              {modalState === "done" && (
                <div className="flex flex-col items-center py-4 gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
                    <Loader2 className="h-7 w-7 text-emerald-400 animate-spin" />
                  </div>
                  <p className="text-sm font-bold text-emerald-400">{t("support.linkOpened") || "تم فتح رابط التحميل!"}</p>
                  <p className="text-xs text-muted-foreground text-center">{t("support.checkBrowserSettings") || "إذا لم يفتح التحميل تلقائياً، تحقق من إعدادات المتصفح"}</p>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}
