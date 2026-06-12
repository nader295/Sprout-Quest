"use client";

import React, { useState } from "react";
import Image from "next/image";
import type { UploadFormState } from "../hooks/use-upload-form";
import { useTranslation } from "@/lib/i18n";
import { TYPE_KEYS } from "./step-type";
import { cn } from "@/lib/utils";
import { isValidUrl } from "./shared";
import { 
  Zap, AlertTriangle, Check, Rocket, Loader2, Eye, Smartphone, 
  Image as ImageIcon, Link2, FileText, Hash, Globe, Shield, 
  CheckCircle2, XCircle, ChevronDown, ExternalLink, Sparkles
} from "lucide-react";

interface StepReviewProps {
  form: {
    state: UploadFormState;
  };
  uploadState: {
    submitting: boolean;
  };
  isEdit: boolean;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
}

export function StepReview({ form, uploadState, isEdit, handleSubmit }: StepReviewProps) {
  const { state } = form;
  const { submitting } = uploadState;
  const { t } = useTranslation();
  
  const selectedType = TYPE_KEYS.find(t => t.value === state.contentType);
  const accentColor  = selectedType?.accent ?? "var(--primary)";
  const accentDim    = selectedType?.accentDim ?? "var(--primary)";
  const TypeIcon     = selectedType?.icon ?? Smartphone;
  
  const needsDevice = !(state.contentType === "gsi" || state.contentType === "module" && state.moduleScope === "universal" || state.contentType === "kernel" && state.kernelType === "anykernel3");

  const [showFullChecklist, setShowFullChecklist] = useState(false);

  // Checklist items
  const checklistItems = [
    { 
      id: "name", 
      label: t("upload.projectName"), 
      ok: state.name.trim().length >= 3, 
      value: state.name || "—",
      required: true 
    },
    { 
      id: "device", 
      label: t("upload.device"), 
      ok: !needsDevice || state.device.trim().length > 0, 
      value: needsDevice ? (state.device || "—") : "Universal",
      required: needsDevice 
    },
    { 
      id: "codename", 
      label: t("upload.codename"), 
      ok: !needsDevice || state.deviceCodename.trim().length > 0, 
      value: needsDevice ? (state.deviceCodename || t("upload.unspecified")) : "—",
      required: false,
      warning: needsDevice && !state.deviceCodename 
    },
    { 
      id: "android", 
      label: t("upload.androidVersion"), 
      ok: state.contentType === "module" || !!state.android, 
      value: state.android ? `Android ${state.android}` : "—",
      required: state.contentType !== "module" 
    },
    { 
      id: "description", 
      label: t("upload.description"), 
      ok: state.description.trim().length >= 100, 
      value: state.description.trim().length >= 100 ? `✓ ${state.description.trim().length} ${t("upload.descChars")}` : `${state.description.trim().length}/100`,
      required: true 
    },
    { 
      id: "download", 
      label: t("upload.downloadLink"), 
      ok: state.variants.length > 0 
        ? state.variants.some(v => v.downloadUrl && isValidUrl(v.downloadUrl)) 
        : (!!state.downloadUrl && isValidUrl(state.downloadUrl)), 
      value: state.variants.length > 0 ? `${state.variants.filter(v => v.downloadUrl).length} ${t("upload.xVariants")}` : (state.downloadUrl ? "✓" : "—"),
      required: true 
    },
    { 
      id: "thumbnail", 
      label: t("upload.thumbnail"), 
      ok: !!state.thumbnail, 
      value: state.thumbnail ? "✓" : t("upload.unspecified"),
      required: false 
    },
    { 
      id: "screenshots", 
      label: t("upload.screenshots"), 
      ok: state.screenshots.length > 0, 
      value: state.screenshots.length > 0 ? `${state.screenshots.length} ${t("upload.imageWord")}` : t("upload.none"),
      required: false 
    },
    { 
      id: "tags", 
      label: t("upload.tags"), 
      ok: state.tags.length > 0, 
      value: state.tags.length > 0 ? `${state.tags.length} ${t("upload.tagWord")}` : t("upload.none"),
      required: false 
    },
  ];

  const requiredItems = checklistItems.filter(i => i.required);
  const optionalItems = checklistItems.filter(i => !i.required);
  const allRequiredOk = requiredItems.every(i => i.ok);
  const completionPercent = Math.round((checklistItems.filter(i => i.ok).length / checklistItems.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${accentColor}15` }}>
          <Eye className="h-4.5 w-4.5" style={{ color: accentColor }} />
        </div>
        <div>
          <h3 className="text-xl font-black tracking-tight text-foreground">{t("upload.step.review")}</h3>
          <p className="text-xs text-muted-foreground">{t("upload.reviewDesc")}</p>
        </div>
      </div>

      {/* Preview Card - Like final post */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: `${accentColor}25` }}>
        <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: accentColor }} />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t("upload.previewPost")}</span>
          </div>
        </div>

        <div className="p-4">
          <div className="flex gap-4">
            {/* Thumbnail */}
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 shrink-0 rounded-xl overflow-hidden border border-border bg-muted/30">
              {state.thumbnail ? (
                <Image src={state.thumbnail} alt="Preview" fill className="object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                </div>
              )}
              {/* Type badge */}
              <div className="absolute bottom-1 start-1 flex h-6 w-6 items-center justify-center rounded-lg shadow"
                style={{ backgroundColor: accentColor }}>
                <TypeIcon className="h-3.5 w-3.5 text-white" />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <h4 className="font-bold text-foreground text-base sm:text-lg truncate">{state.name || t("upload.projectName")}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {needsDevice ? state.device || t("upload.device") : "Universal"}
                  </span>
                  {state.android && (
                    <>
                      <span className="text-muted-foreground/30">•</span>
                      <span className="text-xs text-muted-foreground">Android {state.android}</span>
                    </>
                  )}
                  {state.version && (
                    <>
                      <span className="text-muted-foreground/30">•</span>
                      <span className="text-xs font-mono" style={{ color: accentColor }}>{state.version}</span>
                    </>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
                {state.description || t("upload.postDescPlaceholder")}
              </p>

              {state.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {state.tags.slice(0, 4).map(tag => (
                    <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
                      #{tag}
                    </span>
                  ))}
                  {state.tags.length > 4 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-muted-foreground bg-muted">
                      +{state.tags.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Screenshots preview */}
          {state.screenshots.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("upload.screenshots")}</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {state.screenshots.slice(0, 5).map((ss, i) => (
                  <div key={i} className="relative w-12 h-20 shrink-0 rounded-lg overflow-hidden border border-border">
                    <Image src={ss} alt={`Screenshot ${i + 1}`} fill className="object-cover" />
                  </div>
                ))}
                {state.screenshots.length > 5 && (
                  <div className="flex w-12 h-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
                    <span className="text-xs text-muted-foreground">+{state.screenshots.length - 5}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Checklist */}
      <div className="rounded-2xl border border-border bg-card/30 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" style={{ color: allRequiredOk ? "#10b981" : "#f59e0b" }} />
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t("upload.checklist")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${completionPercent}%`,
                    backgroundColor: completionPercent === 100 ? "#10b981" : completionPercent >= 70 ? "#f59e0b" : accentColor
                  }}
                />
              </div>
              <span className="text-[10px] font-bold" style={{ color: completionPercent === 100 ? "#10b981" : "var(--muted-foreground)" }}>
                {completionPercent}%
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Required items */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              {t("upload.required")}
            </p>
            {requiredItems.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/10 px-3 py-2">
                <div className="flex items-center gap-2">
                  {item.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive/60 shrink-0" />
                  )}
                  <span className="text-xs font-medium text-foreground">{item.label}</span>
                </div>
                <span className={cn("text-xs font-semibold truncate max-w-[120px]", item.ok ? "text-emerald-400" : "text-destructive/80")}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          {/* Optional items (collapsible) */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowFullChecklist(!showFullChecklist)}
              className="w-full flex items-center justify-between gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                {t("upload.optional")} ({optionalItems.filter(i => i.ok).length}/{optionalItems.length})
              </span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showFullChecklist && "rotate-180")} />
            </button>
            
            {showFullChecklist && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                {optionalItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/5 px-3 py-2">
                    <div className="flex items-center gap-2">
                      {item.ok ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400/70 shrink-0" />
                      ) : item.warning ? (
                        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                      )}
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                    </div>
                    <span className={cn("text-[11px] truncate max-w-[120px]", item.ok ? "text-emerald-400/70" : item.warning ? "text-amber-400" : "text-muted-foreground/50")}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Warnings */}
        {needsDevice && !state.deviceCodename && (
          <div className="border-t border-border/50 px-4 py-3 bg-amber-500/5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-400">{t("upload.codenameWarning2")}</p>
                <p className="text-[11px] text-amber-400/70 mt-0.5">{t("upload.codenameWarningHint")}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SEO Tips */}
      <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${accentColor}15` }}>
            <Zap className="h-4 w-4" style={{ color: accentColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground mb-1.5">{t("upload.seoTips")}</p>
            <ul className="space-y-1">
              <li className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <span style={{ color: accentColor }}>•</span>
                {state.thumbnail ? t("upload.seoThumbOk") : t("upload.seoThumbNeeded")}
              </li>
              <li className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <span style={{ color: accentColor }}>•</span>
                {state.tags.length >= 3 ? t("upload.seoTagsOk") : t("upload.seoTagsNeeded").replace('{n}', String(3 - state.tags.length))}
              </li>
              <li className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <span style={{ color: accentColor }}>•</span>
                {state.description.length >= 200 ? t("upload.seoDescOk") : t("upload.seoDescNeeded")}
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <div className="relative group/btn">
          <div className="absolute -inset-1 rounded-2xl opacity-0 group-hover/btn:opacity-50 blur-xl transition-opacity duration-500 pointer-events-none"
            style={{ background: `linear-gradient(135deg, ${accentColor}, #8b5cf6)` }} />
          <button
            onClick={handleSubmit}
            disabled={submitting || !allRequiredOk}
            className="relative flex w-full items-center justify-center gap-3 rounded-2xl px-8 py-4 text-base font-black text-white hover:scale-[1.01] active:scale-[0.99] transition-all overflow-hidden shadow-xl border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{ 
              background: allRequiredOk 
                ? `linear-gradient(135deg, ${accentColor} 0%, ${accentDim} 100%)` 
                : "hsl(var(--muted))",
              color: allRequiredOk ? "white" : "hsl(var(--muted-foreground))"
            }}
          >
            {/* Shine effect */}
            {allRequiredOk && !submitting && (
              <div className="absolute inset-0 w-1/2 -translate-x-[200%] skew-x-[-20deg] group-hover/btn:translate-x-[250%] transition-transform duration-1000 ease-in-out pointer-events-none"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)" }} />
            )}
            
            <span className="relative z-10 flex items-center gap-2.5">
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t("upload.publishing")}
                </>
              ) : !allRequiredOk ? (
                <>
                  <AlertTriangle className="h-5 w-5" />
                  {t("upload.completeRequired")}
                </>
              ) : (
                <>
                  <Rocket className="h-5 w-5" />
                  {isEdit ? t("upload.saveChangesBtn") : t("upload.publishBtn")}
                </>
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
