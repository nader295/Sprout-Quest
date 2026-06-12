"use client";

import React, { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { apiCreateRom, apiUpdateRom } from "@/lib/api/client";
import type { ContentType } from "@/lib/types";
import {
  Layers, Smartphone, FileText, Image as ImageIcon, Link2, Check,
  Loader2, Shield, ArrowLeft, ChevronRight, ChevronLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { toast } from "@/components/shared/toast";

// ── Hooks ───────────────────────────────────────────────────
import { useUploadForm, isValidUrl, sanitizeText } from "@/components/upload/hooks/use-upload-form";
import { useUploadDraft } from "@/components/upload/hooks/use-upload-draft";

// ── Components ──────────────────────────────────────────────
import { StepType, TYPE_KEYS } from "@/components/upload/steps/step-type";
import { StepDevice } from "@/components/upload/steps/step-device";
import { StepDetails } from "@/components/upload/steps/step-details";
import { StepMedia } from "@/components/upload/steps/step-media";
import { StepLinks } from "@/components/upload/steps/step-links";
import { StepReview } from "@/components/upload/steps/step-review";

const STEPS = [
  { id: 1, labelKey: "upload.step.type",    icon: Layers },
  { id: 2, labelKey: "upload.step.info",    icon: Smartphone },
  { id: 3, labelKey: "upload.step.details", icon: FileText },
  { id: 4, labelKey: "upload.step.media",   icon: ImageIcon },
  { id: 5, labelKey: "upload.step.files",   icon: Link2 },
  { id: 6, labelKey: "upload.step.review",  icon: Check },
];

export default function UploadPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <UploadContent />
    </Suspense>
  );
}

function UploadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId    = searchParams.get("edit");
  const typeParam = searchParams.get("type") as ContentType | null;
  const { user, userDoc, isLoggedIn, canUpload, loading: authLoading } = useAuth();
  const { t } = useTranslation();

  const [step, setStep] = useState(typeParam ? 2 : 1);
  const [submitting, setSubmitting] = useState(false);

  // Hook 1: Form State
  const formManager = useUploadForm(typeParam || undefined);
  const { form: state, setForm, errors, setErrors, getKernelVersion } = formManager;

  // Hook 2: Draft Auto-Save
  const { clearDraft } = useUploadDraft(state, setForm, step, setStep, editId);

  useEffect(() => {
    if (editId) {
      const fetchRom = async () => {
        try {
          const res = await fetch(`/api/roms?id=${editId}`);
          if (res.ok) {
            const data = await res.json();
            if (data) {
              setForm(prev => ({
                ...prev,
                ...data,
                mirrors: data.mirrors?.length ? data.mirrors : [""],
                screenshots: data.screenshots || [],
                tags: data.tags || [],
                variants: data.variants || [],
                moduleManagers: data.moduleManagers || ["any"],
              }));
              if (!typeParam) setStep(2);
            }
          }
        } catch { /* ignore */ }
      };
      fetchRom();
    }
  }, [editId, setForm, typeParam]);

  // ── Validation ───────────────────────────────────────
  const validateStep = (s: number): boolean => {
    const errs: Record<string, string> = {};
    const MD5_REGEX = /^[a-f0-9]{32}$/i;

    const isUniv = state.contentType === "gsi" || state.isUniversal || state.kernelType === "anykernel3" || (state.contentType === "module" && state.moduleScope === "universal");
    if (s === 2) {
      if (state.contentType === "kernel" && !state.kernelType) errs.kernelType = "Choose kernel type";
      if (!isUniv) {
        if (!state.brand) errs.brand = t("upload.err.brandRequired");
        if (!state.device.trim()) errs.device = t("upload.err.deviceRequired");
      }
      if (state.contentType !== "module" && !state.android) errs.android = t("upload.err.androidRequired");
      if (state.contentType === "kernel" && !state.kernelMajor) errs.kernelMajor = "Choose Kernel Version";
    }
    if (s === 3) {
      if (!state.name.trim()) errs.name = t("upload.err.nameRequired");
      else if (state.name.length < 3) errs.name = t("upload.err.nameTooShort");
      if (!state.description.trim()) errs.description = t("upload.err.descRequired");
      else if (state.description.trim().length < 100) errs.description = t("upload.err.descTooShort", { n: 100 - state.description.trim().length });
      if (state.contentType === "module" && !state.moduleId.trim()) errs.moduleId = t("upload.err.moduleIdRequired");
      if (state.contentType === "recovery" && !state.recoveryType) errs.recoveryType = t("upload.err.recoveryTypeRequired");
    }
    // Step 4 is Media (optional warnings/errors usually handled on upload)
    if (s === 5) {
      const hasVariants = state.variants.length > 0 && state.variants.some(v => v.name && v.downloadUrl);
      if (!hasVariants) {
        if (!state.downloadUrl.trim()) errs.downloadUrl = t("upload.err.urlRequired");
        else if (!isValidUrl(state.downloadUrl)) errs.downloadUrl = t("upload.err.urlInvalid");
      } else {
        let variantErr = false;
        state.variants.forEach(v => { if (!v.name.trim() || !v.downloadUrl.trim() || !isValidUrl(v.downloadUrl)) variantErr = true; });
        if (variantErr) errs.variants = "Complete all variants";
      }
      state.mirrors.forEach((m, i) => { if (m.trim() && !isValidUrl(m)) errs[`mirror_${i}`] = t("upload.err.urlInvalid"); });
      if (state.checksumMd5 && !MD5_REGEX.test(state.checksumMd5.trim())) errs.checksumMd5 = t("upload.err.md5Invalid");
    }

    setErrors(p => ({ ...p, ...errs }));
    return Object.keys(errs).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setErrors({});
    setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goPrev = () => {
    setErrors({});
    setStep(s => s - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Submit ───────────────────────────────────────────
  const handleSubmit = async () => {
    if (!user || !userDoc || !state.contentType) return;
    if (!validateStep(2) || !validateStep(3) || !validateStep(5)) return;
    
    setSubmitting(true);
    try {
      const cleanMirrors = state.mirrors.filter(m => m.trim() && isValidUrl(m));
      const kernelVersion = getKernelVersion();
      const isUniv = state.contentType === "gsi" || state.isUniversal || state.kernelType === "anykernel3" || (state.contentType === "module" && state.moduleScope === "universal");

      const payload: Record<string, unknown> = {
        contentType: state.contentType,
        name:        sanitizeText(state.name.trim()),
        brand:       isUniv ? "" : state.brand,
        device:      isUniv ? "Universal" : sanitizeText(state.device.trim()),
        android:     state.android,
        version:     sanitizeText(state.version.trim()),
        size:        sanitizeText(state.size.trim()),
        downloadUrl: state.downloadUrl.trim(),
        mirrorUrl:   cleanMirrors[0] || "",
        mirrors:     cleanMirrors,
        description: sanitizeText(state.description.trim()),
        changelog:   sanitizeText(state.changelog.trim()),
        thumbnail:   state.thumbnail,
        screenshots: state.screenshots,
        tags:        state.tags.map(sanitizeText),
        romStatus:   state.romStatus,
        romType:     state.romType,
        installGuide: sanitizeText(state.installGuide.trim()),
        checksumMd5:    state.checksumMd5.trim(),
        checksumSha256: state.checksumSha256.trim(),
        maintainerUid:   user.uid,
        maintainerName:  userDoc.name,
        maintainerPhoto: userDoc.photo || "",
        deviceCodename: isUniv ? "" : state.deviceCodename.trim().toLowerCase().replace(/\s+/g, "_"),
        variants: state.variants,
        kernelType: state.kernelType || undefined,
        anyKernelTargets: state.anyKernelTargets || undefined,
        moduleScope: state.contentType === "module" ? state.moduleScope : undefined,
        moduleManagers: state.contentType === "module" ? state.moduleManagers : undefined,
        moduleManager: state.contentType === "module" ? (state.moduleManagers.includes("any") ? "any" : state.moduleManagers[0]) : undefined,
        trebleType: state.contentType === "gsi" ? state.trebleType : undefined,
        gsiArch:    state.contentType === "gsi" ? state.gsiArch    : undefined,
        gsiType:    state.contentType === "gsi" ? state.gsiType    : undefined,
        socFamily:  state.contentType === "module" && state.moduleScope === "soc" ? state.socFamily : undefined,
        xdaUrl:      state.xdaUrl      || undefined,
        telegramUrl: state.telegramUrl || undefined,
        sourceUrl:   state.sourceUrl   || undefined,
        knownIssues: state.knownIssues || undefined,
        minRam:      state.minRam      || undefined,
        minStorage:  state.minStorage  || undefined,
      };

      if (state.contentType === "kernel")   payload.kernelVersion = kernelVersion;
      if (state.contentType === "recovery") payload.recoveryType  = state.recoveryType;
      if (state.contentType === "module") {
        payload.moduleId   = state.moduleId;
        payload.minMagisk  = state.minMagisk;
      }

      if (editId) {
        await apiUpdateRom(editId, payload);
        toast.success(t("upload.successUpdate3"));
      } else {
        await apiCreateRom(payload);
        toast.success(t("upload.successPublish"));
        try { localStorage.removeItem("romx_upload_draft_v2"); } catch {}
      }
      router.push("/");
    } finally { setSubmitting(false); }
  };

  const adaptedForm = {
    state,
    updateField: formManager.updateField,
    errors: formManager.errors,
    getKernelVersion: formManager.getKernelVersion,
    validateField: (key: any, value: unknown) => true,
    toggleModuleManager: formManager.toggleModuleManager,
    addVariant: formManager.addVariant,
    updateVariant: formManager.updateVariant,
    removeVariant: formManager.removeVariant,
    addMirror: formManager.addMirror,
    updateMirror: formManager.updateMirror,
    removeMirror: formManager.removeMirror,
    handleThumbnail: async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const url = await formManager.uploadImage(file);
        formManager.updateField("thumbnail", url);
      } catch (err: any) { formManager.setErrors(p => ({ ...p, thumbnail: err.message })); }
    },
    handleScreenshots: async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      try {
        const urls = await Promise.all(files.map(formManager.uploadImage));
        formManager.setForm(p => ({ ...p, screenshots: [...p.screenshots, ...urls].slice(0, 10) }));
      } catch (err: any) { formManager.setErrors(p => ({ ...p, screenshots: err.message })); }
    }
  };

  // ── Auth guard ───────────────────────────────────────
  if (authLoading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!isLoggedIn || !canUpload) return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mb-5 text-primary">
        <Shield className="h-8 w-8" />
      </div>
      <p className="text-lg font-bold text-foreground">{t("upload.signInRequired")}</p>
      <button onClick={() => router.push("/login")} className="mt-5 rounded-xl px-6 py-2.5 text-sm font-semibold text-white bg-primary">
        Sign In
      </button>
    </div>
  );

  const selectedType = TYPE_KEYS.find(t => t.value === state.contentType);
  const accentColor  = selectedType?.accent ?? "var(--primary)";
  const progressPercent = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-4 sm:px-4 pb-20">
      
      {/* ── TOP PROGRESS BAR ── */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-muted z-50">
        <div 
          className="h-full transition-all duration-500 ease-out"
          style={{ 
            width: `${progressPercent}%`,
            background: `linear-gradient(90deg, ${accentColor}, ${selectedType?.accentDim || accentColor})`
          }}
        />
      </div>

      {/* ── HEADER ── */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all active:scale-95">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-black text-foreground leading-tight">{editId ? t("upload.editRelease2") : t("upload.newRelease2")}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(`upload.step.${STEPS[step - 1]?.labelKey?.split('.').pop()}`)} • {t("upload.stepTitle", { step, total: STEPS.length })}
          </p>
        </div>
        {/* Step indicator badge */}
        <div 
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0"
          style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
        >
          <span>{step}/{STEPS.length}</span>
        </div>
      </div>

      {/* ── STEPPER ── */}
      <div className="mb-6">
        {/* Mobile: Compact horizontal stepper */}
        <div className="flex items-center gap-1 sm:gap-0">
          {STEPS.map((s, i) => {
            const isDone   = step > s.id;
            const isActive = step === s.id;
            const StepIcon = s.icon;
            return (
              <React.Fragment key={s.id}>
                <button 
                  onClick={() => { if (s.id < step) { setErrors({}); setStep(s.id); window.scrollTo({ top: 0, behavior: "smooth" }); } }} 
                  disabled={s.id > step} 
                  className={cn(
                    "flex flex-col items-center gap-1.5 transition-all duration-300 group",
                    s.id < step && "cursor-pointer hover:scale-105",
                    s.id > step && "opacity-40"
                  )}
                >
                  <div 
                    className={cn(
                      "flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border-2 transition-all duration-300",
                      isDone && "border-emerald-500/60 bg-emerald-500/10",
                      !isDone && !isActive && "bg-muted/30 border-border"
                    )} 
                    style={isActive ? { 
                      borderColor: accentColor, 
                      backgroundColor: `${accentColor}15`,
                      boxShadow: `0 0 16px ${accentColor}30`
                    } : undefined}
                  >
                    {isDone ? (
                      <Check className="h-4 w-4 text-emerald-400" strokeWidth={3} />
                    ) : (
                      <StepIcon 
                        className="h-4 w-4 transition-colors" 
                        style={{ color: isActive ? accentColor : "var(--muted-foreground)" }} 
                      />
                    )}
                  </div>
                  <span 
                    className={cn(
                      "text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-colors hidden sm:block",
                      isDone && "text-emerald-400/80",
                      !isDone && !isActive && "text-muted-foreground/50"
                    )} 
                    style={isActive ? { color: accentColor } : undefined}
                  >
                    {t(s.labelKey)}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div 
                    className={cn(
                      "flex-1 h-0.5 mx-1 sm:mx-1.5 mb-4 sm:mb-5 rounded-full transition-all duration-500",
                      isDone ? "opacity-100" : "bg-border opacity-100"
                    )} 
                    style={isDone ? { backgroundColor: accentColor } : {}}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── Render Active Step Component ── */}
      {step === 1 && <StepType form={adaptedForm as any} onTypeSelected={goNext} />}
      {step === 2 && <StepDevice form={adaptedForm as any} />}
      {step === 3 && <StepDetails form={adaptedForm as any} />}
      {step === 4 && <StepMedia form={adaptedForm as any} uploadState={{ uploading: formManager.uploading, uploadProgress: formManager.uploadProgress }} />}
      {step === 5 && <StepLinks form={adaptedForm as any} onOpenSettings={() => router.push("/settings?tab=apiKeys")} />}
      {step === 6 && <StepReview form={{ state }} uploadState={{ submitting }} isEdit={!!editId} handleSubmit={handleSubmit} />}

      {/* ── NAVIGATION ── */}
      {step >= 1 && step < 6 && (
        <div className={cn(
          "mt-8 flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
          step === 1 ? "justify-end" : "justify-between"
        )}>
          {step > 1 && (
            <button 
              onClick={goPrev} 
              className="group flex items-center justify-center gap-2 rounded-2xl border border-border px-6 py-3.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/80 hover:border-muted-foreground/30 transition-all active:scale-[0.97] w-full sm:w-auto"
            >
              <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> 
              {t("common.back")}
            </button>
          )}
          <button 
            onClick={goNext} 
            className="group relative flex items-center justify-center gap-2.5 rounded-2xl px-8 py-3.5 text-sm font-black text-white hover:scale-[1.02] active:scale-[0.97] transition-all overflow-hidden shadow-lg w-full sm:w-auto disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{ 
              backgroundColor: accentColor, 
              boxShadow: `0 4px 24px ${accentColor}35` 
            }}
          >
            {/* Shine effect */}
            <div 
              className="absolute inset-0 w-1/2 -translate-x-[200%] skew-x-[-20deg] group-hover:translate-x-[250%] transition-transform duration-700 ease-out pointer-events-none"
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)" }}
            />
            <span className="relative z-10">{step === 5 ? t("upload.stepReviewButton") : t("common.next")}</span>
            <ChevronRight className="h-4 w-4 relative z-10 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      )}
      {step === 6 && (
        <div className="mt-4 flex justify-start animate-in fade-in duration-300">
          <button 
            onClick={goPrev} 
            className="group flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
          >
            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> 
            {t("common.back")}
          </button>
        </div>
      )}
    </div>
  );
}
