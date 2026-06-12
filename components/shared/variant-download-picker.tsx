"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Download, X, Check, ChevronRight, FileDown, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/lib/hooks/use-auth";
import { useRouter } from "next/navigation";
import { toast } from "@/components/shared/toast";

export interface DownloadVariant {
  name: string;
  downloadUrl: string;
  size?: string;
  checksumMd5?: string;
}

interface VariantDownloadButtonProps {
  /** اسم المنشور */
  name: string;
  /** رابط التحميل الرئيسي (يُستخدم لو ما فيش variants) */
  downloadUrl?: string;
  /** النسخ المتعددة */
  variants?: DownloadVariant[];
  /** لون الـ accent حسب نوع المحتوى */
  accentColor?: string;
  /** عداد التحميلات (callback) */
  onDownload?: (url: string, variantName?: string) => void;
  /** حجم الزر */
  size?: "sm" | "md" | "lg";
  /** عرض كامل */
  fullWidth?: boolean;
  /** شارة إعلان */
  adBadge?: boolean;
}

export function VariantDownloadButton({
  name, downloadUrl, variants, accentColor = "#3b82f6",
  onDownload, size = "md", fullWidth = false, adBadge,
}: VariantDownloadButtonProps) {
  const { t } = useTranslation();
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const activeVariants = (variants || []).filter(v => v.name && v.downloadUrl);
  const hasVariants = activeVariants.length > 0;

  function triggerSingleDownload() {
    if (downloadUrl) {
      onDownload?.(downloadUrl);
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
    }
  }

  // Single URL direct download
  if (!hasVariants) {
    if (!downloadUrl) return null;
    return (
      <button
        onClick={triggerSingleDownload}
        className={cn(
          "flex items-center justify-center gap-2 rounded-2xl font-black text-white transition-all duration-300 hover:opacity-90 active:scale-[0.96] overflow-hidden relative group",
          size === "sm"  && "px-4 py-2 text-xs",
          size === "md"  && "px-5 py-2.5 text-sm",
          size === "lg"  && "px-7 py-3.5 text-base",
          fullWidth      && "w-full",
        )}
        style={{
          boxShadow: `0 8px 32px -8px ${accentColor}`,
          background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 80%, black))`
        }}
      >
        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
        <Download className={cn("relative z-10 shrink-0", size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4")} />
        <span className="relative z-10">{t("component.download")}</span>
      </button>
    );
  }

  // Multiple variants — button opening the modal
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center justify-center gap-2 rounded-2xl font-black text-white transition-all duration-300 hover:opacity-90 hover:-translate-y-0.5 active:scale-[0.96] overflow-hidden relative group",
          size === "sm"  && "px-4 py-2 text-xs",
          size === "md"  && "px-5 py-2.5 text-sm",
          size === "lg"  && "px-7 py-3.5 text-base",
          fullWidth      && "w-full",
        )}
        style={{
          boxShadow: `0 8px 32px -8px ${accentColor}`,
          background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 80%, black))`
        }}
      >
        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
        <Download className={cn("relative z-10 shrink-0", size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5 animate-bounce" : "h-4 w-4")} />
        <span className="relative z-10">{t("component.downloadOptions")}</span>
        <span
          className="relative z-10 flex items-center justify-center rounded-full text-[10px] font-black shrink-0 ml-1 shadow-inner bg-white/20 backdrop-blur-md"
          style={{ minWidth: "22px", height: "22px", padding: "0 6px" }}
        >
          {activeVariants.length}
        </span>
      </button>

      <VariantPickerModal
        open={open}
        onClose={() => setOpen(false)}
        name={name}
        variants={variants || []}
        accentColor={accentColor}
        onDownload={onDownload}
      />
    </>
  );
}

// ──────────────────────────────────────────────────────────
// Stunning Animated Modal for Variants
// ──────────────────────────────────────────────────────────
export interface VariantPickerModalProps {
  open: boolean;
  onClose: () => void;
  name: string;
  variants: DownloadVariant[];
  accentColor?: string;
  onDownload?: (url: string, variantName?: string) => void;
}

export function VariantPickerModal({
  open, onClose, name, variants, accentColor = "#3b82f6", onDownload,
}: VariantPickerModalProps) {
  const { t } = useTranslation();
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (open) {
      setShow(true);
      document.body.style.overflow = "hidden";
    } else {
      const t = setTimeout(() => setShow(false), 400); // Wait for transition
      document.body.style.overflow = "";
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open && !show) return null;
  if (!mounted) return null;

  function triggerDownload(url: string, variantName?: string) {
    onDownload?.(url, variantName);
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  }

  const activeVariants = variants.filter(v => v.name && v.downloadUrl);

  const modalContent = (
    <div
      className={cn(
        "fixed inset-0 z-[999999] flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-400 ease-out",
        open ? "opacity-100 backdrop-blur-md" : "opacity-0 backdrop-blur-none pointer-events-none"
      )}
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className={cn(
          "relative w-full sm:max-w-md bg-[#0a0a0a] border-t sm:border border-white/10 rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] shadow-2xl flex flex-col max-h-[90vh]",
          open ? "translate-y-0 sm:scale-100 opacity-100" : "translate-y-full sm:translate-y-12 sm:scale-95 opacity-0"
        )}
        style={{
          boxShadow: `0 32px 120px -10px ${accentColor}50, inset 0 1px 0 rgba(255,255,255,0.05)`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Glow Effects */}
        <div className="absolute top-0 left-0 w-full h-40 opacity-20 pointer-events-none blur-[80px]" style={{ background: accentColor }} />
        <div className="absolute bottom-0 right-0 w-40 h-40 opacity-10 pointer-events-none blur-[60px]" style={{ background: accentColor }} />

        {/* Decorative Top Line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] opacity-80" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />
        
        {/* Mobile drag handle indicator */}
        <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-12 h-1.5 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-4 sm:pt-6">
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="text-xl font-black text-white tracking-tight drop-shadow-md">{t("component.downloadVariants")}</h3>
            <p className="text-sm text-white/60 mt-1 truncate font-medium" style={{ color: accentColor }}>{name}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/15 hover:scale-105 active:scale-95 transition-all text-white/70 hover:text-white backdrop-blur-md shadow-sm"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Variants List */}
        <div className="relative px-5 pb-8 space-y-3 overflow-y-auto custom-scrollbar flex-1 mt-2">
          {activeVariants.map((v, i) => (
            <button
              key={i}
              onClick={() => triggerDownload(v.downloadUrl, v.name)}
              className="group w-full flex items-center gap-4 rounded-[1.5rem] border px-4 py-4 text-start transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden bg-white/[0.03] hover:bg-white/[0.06] border-white/5 hover:border-white/10"
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none"
                style={{ background: `linear-gradient(135deg, ${accentColor}, transparent)` }}
              />

              <div
                className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-lg transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 40%, black))`,
                  border: `1px solid rgba(255,255,255,0.25)`
                }}
              >
                <FileDown className="h-6 w-6 text-white drop-shadow-lg group-hover:-translate-y-0.5 transition-transform" />
              </div>

              <div className="relative flex-1 min-w-0">
                <p className="text-[16px] font-black text-white/90 group-hover:text-white transition-colors">{v.name}</p>
                
                {(v.size || v.checksumMd5) && (
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {v.size && <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-black/40 text-white/70 border border-white/5">{v.size}</span>}
                    {v.checksumMd5 && <span className="text-[10px] text-white/40 font-mono truncate max-w-[120px]">MD5: {v.checksumMd5}</span>}
                  </div>
                )}
              </div>

              <div className="relative flex items-center justify-center h-10 w-10 rounded-full bg-white/5 border border-white/10 group-hover:bg-white/15 transition-all shadow-sm">
                <Download className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-y-0.5 group-hover:scale-110" style={{ color: accentColor }} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
