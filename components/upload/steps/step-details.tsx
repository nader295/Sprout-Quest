"use client";

import React, { useState } from "react";
import type { UploadFormState } from "../hooks/use-upload-form";
import { useTranslation } from "@/lib/i18n";
import { FormField, inputCls } from "./shared";
import { TYPE_KEYS } from "./step-type";
import { cn } from "@/lib/utils";
import { 
  X, Globe, Smartphone, Cpu, Layers, Check, FileText, Sparkles, 
  Eye, Edit3, AlertTriangle, Lightbulb, Hash, BookOpen, Wrench 
} from "lucide-react";
import { ROM_STATUSES } from "@/lib/constants";

interface StepDetailsProps {
  form: {
    state: UploadFormState;
    updateField: (key: string, value: unknown) => void;
    errors: Record<string, string>;
    validateField: (key: keyof UploadFormState, value: unknown) => boolean;
    toggleModuleManager: (id: string) => void;
  };
}

const MODULE_MANAGERS = [] as const; // placeholder, will be defined inside component

// Suggested tags by content type
const SUGGESTED_TAGS: Record<string, string[]> = {
  rom: ["stable", "official", "unofficial", "ported", "aosp", "oneui", "miui", "ota", "gapps", "vanilla"],
  kernel: ["ksu", "susfs", "overclock", "undervolt", "battery", "gaming", "balanced", "lto", "pelt"],
  recovery: ["twrp", "orangefox", "shrp", "pbrp", "decrypted", "vab", "a-only", "fastboot"],
  module: ["audio", "camera", "performance", "battery", "debloat", "privacy", "ui", "fonts", "gestures"],
  gsi: ["vndk", "gapps", "vanilla", "arm64", "arm32", "treble", "phh", "aosp", "lineage"],
};

// Changelog templates
const CHANGELOG_TEMPLATES = (t: any) => [
  { label: t("upload.changelogTemplates.newUpdate") || "New Update", template: "## What's New\n\n### Added\n- \n\n### Fixed\n- \n\n### Changed\n- " },
  { label: t("upload.changelogTemplates.bugFixes") || "Bug Fixes", template: "## Bug Fixes\n\n- Fixed crash when...\n- Resolved issue with...\n- Improved stability of..." },
  { label: t("upload.changelogTemplates.initialRelease") || "Initial Release", template: "## Initial Release\n\n### Features\n- \n- \n\n### Known Issues\n- " },
];

export function StepDetails({ form }: StepDetailsProps) {
  const { state, updateField, errors, validateField, toggleModuleManager } = form;
  const { t } = useTranslation();

  // Accent color derived from content type (mirrors step-media pattern)
  const selectedType = TYPE_KEYS.find(tk => tk.value === state.contentType);
  const accentColor = selectedType?.accent ?? "var(--primary)";

  // Define module managers after t is available
  const MODULE_MANAGERS = [
    { id: "any", label: "Universal", desc: t("upload.worksWithAll") || "Works with all", color: "#10b981", icon: Globe },
    { id: "magisk", label: "Magisk", desc: "Standard modules", color: "#328eb9", icon: Layers },
    { id: "ksu", label: "KernelSU", desc: "Kernel-level", color: "#f59e0b", icon: Cpu },
    { id: "apatch", label: "APatch", desc: "Android Patch", color: "#6366f1", icon: Smartphone },
  ];

  const [tagInput, setTagInput] = useState("");
  const [showDescPreview, setShowDescPreview] = useState(false);
  const [showChangelogPreview, setShowChangelogPreview] = useState(false);

  const addTag = (tag?: string) => {
    const t = (tag || tagInput).trim().toLowerCase();
    if (t && t.length > 1 && !state.tags.includes(t) && state.tags.length < 10) {
      updateField("tags", [...state.tags, t]);
    }
    if (!tag) setTagInput("");
  };

  const suggestedTags = (SUGGESTED_TAGS[state.contentType] || SUGGESTED_TAGS.rom)
    .filter(tag => !state.tags.includes(tag));

  const descCharCount = state.description.trim().length;
  const descProgress = Math.min(100, (descCharCount / 100) * 100);
  const isDescOk = descCharCount >= 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${accentColor}15` }}>
          <FileText className="h-4.5 w-4.5" style={{ color: accentColor }} />
        </div>
        <div>
          <h3 className="text-xl font-black tracking-tight text-foreground">{t("upload.step.details") || "Details & Description"}</h3>
          <p className="text-xs text-muted-foreground">{t("upload.step.detailsDesc") || "Add detailed information about your post"}</p>
        </div>
      </div>

      {/* Project Name Section */}
      <div className="rounded-2xl border border-border bg-card/30 p-4 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4" style={{ color: accentColor }} />
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t("upload.basicInfo")}</span>
        </div>

        <FormField label={t("upload.romNameLabel")} error={errors.name} required>
          <input value={state.name}
            onChange={(e) => { updateField("name", e.target.value); if (errors.name) validateField("name", e.target.value); }}
            placeholder={
              state.contentType === "kernel" ? "Strix Kernel v3.2" : 
              state.contentType === "module" ? "Audio Mod Pro" : 
              state.contentType === "recovery" ? "TWRP 3.7.0" :
              state.contentType === "gsi" ? "LineageOS 21 GSI" :
              "PixelExperience Plus"
            }
            className={cn(inputCls, "text-base font-semibold h-12", errors.name && "border-destructive")} />
        </FormField>

        {/* Module Specific: Module ID */}
        {state.contentType === "module" && (
          <FormField label="Module ID" error={errors.moduleId} required hint={t("upload.moduleIdHint") || "Unique module identifier (e.g., com.developer.module)"}>
            <input value={state.moduleId} onChange={(e) => updateField("moduleId", e.target.value)}
              className={cn(inputCls, "font-mono text-sm", errors.moduleId && "border-destructive")}
              placeholder="com.example.mymodule" />
          </FormField>
        )}

        {/* Version and Status Row */}
        {!["module", "gsi"].includes(state.contentType) && (
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t("upload.versionLabel2")} hint={t("upload.versionHint") || "Example: v4.2.1"}>
              <input value={state.version} onChange={(e) => updateField("version", e.target.value)}
                placeholder="v4.2.1" className={inputCls} />
            </FormField>
            {state.contentType === "rom" && (
              <FormField label={t("upload.statusLabel")}>
                <select value={state.romStatus} onChange={(e) => updateField("romStatus", e.target.value)} className={inputCls}>
                  {ROM_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </FormField>
            )}
          </div>
        )}
      </div>

      {/* Module Managers Section */}
      {state.contentType === "module" && (
        <div className="rounded-2xl border border-border bg-card/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="h-4 w-4" style={{ color: accentColor }} />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">Module Manager</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {MODULE_MANAGERS.map(mgr => {
              const isChecked = state.moduleManagers.includes(mgr.id);
              const Icon = mgr.icon;
              return (
                <button
                  key={mgr.id}
                  type="button"
                  onClick={() => toggleModuleManager(mgr.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 text-start transition-all group",
                    mgr.id === "any" && "col-span-2 border-dashed"
                  )}
                  style={isChecked 
                    ? { borderColor: `${mgr.color}50`, backgroundColor: `${mgr.color}10` } 
                    : { borderColor: "hsl(var(--border))", backgroundColor: "transparent" }}
                >
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all",
                    isChecked ? "scale-105" : "group-hover:scale-105"
                  )}
                    style={{ backgroundColor: isChecked ? mgr.color : `${mgr.color}20` }}>
                    {isChecked ? (
                      <Check className="h-4 w-4 text-white" />
                    ) : (
                      <Icon className="h-4 w-4" style={{ color: mgr.color }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ color: isChecked ? mgr.color : "var(--foreground)" }}>{mgr.label}</p>
                    <p className="text-[10px] text-muted-foreground">{mgr.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Description Section */}
      <div className="rounded-2xl border border-border bg-card/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" style={{ color: accentColor }} />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t("upload.descriptionLabel")}</span>
            <span className="text-destructive text-xs">*</span>
          </div>
          <button
            type="button"
            onClick={() => setShowDescPreview(!showDescPreview)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
          >
            {showDescPreview ? <Edit3 className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showDescPreview ? (t("upload.descEdit") || "Edit") : (t("upload.descPreview") || "Preview")}
          </button>
        </div>

        {showDescPreview ? (
          <div className="min-h-[120px] rounded-xl border border-border bg-muted/20 p-4">
            <div className="prose prose-sm prose-invert max-w-none">
              {state.description ? (
                <div className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
                  {state.description}
                </div>
              ) : (
                <p className="text-muted-foreground/50 italic">{t("upload.descNoDesc")}</p>
              )}
            </div>
          </div>
        ) : (
          <textarea value={state.description}
            onChange={(e) => { updateField("description", e.target.value); validateField("description", e.target.value); }}
            placeholder={t("upload.descPlaceholder2") || "Write a detailed description for your post. You can use Markdown for formatting..."}
            rows={5}
            className={cn(
              "w-full rounded-xl border bg-muted/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none transition-all",
              errors.description ? "border-destructive" : descCharCount >= 100 ? "border-emerald-500/40" : "border-border"
            )} />
        )}

        {/* Progress bar for description */}
        <div className="space-y-1.5">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-300"
              style={{ 
                width: `${descProgress}%`,
                backgroundColor: descCharCount >= 100 ? "#10b981" : descCharCount >= 50 ? "#f59e0b" : accentColor
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {descCharCount < 100 ? (
                <span className={cn("text-xs font-medium", isDescOk ? "text-emerald-400" : "text-amber-400")}>
                  {isDescOk ? t("upload.descExcellent") : t("upload.descRemaining", { n: Math.max(0, 100 - descCharCount) })}
                </span>
              ) : (
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  {t("upload.descGood2") || "Excellent description!"}
                </span>
              )}
            </div>
            <span className={cn("text-[10px] font-mono", descCharCount > 4500 ? "text-amber-400" : "text-muted-foreground")}>
              {descCharCount}/5000
            </span>
          </div>
        </div>

        {errors.description && (
          <p className="flex items-center gap-1.5 text-[11px] text-destructive">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
            {errors.description}
          </p>
        )}
      </div>

      {/* Changelog Section */}
      <div className="rounded-2xl border border-border bg-card/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">Changelog</span>
            <span className="text-[10px] text-muted-foreground">{t("upload.optional") || "(Optional)"}</span>
          </div>
          <div className="flex items-center gap-1">
            {CHANGELOG_TEMPLATES(t).map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => updateField("changelog", tmpl.template)}
                className="px-2 py-1 rounded-lg text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
              >
                {tmpl.label}
              </button>
            ))}
          </div>
        </div>

        <textarea value={state.changelog} onChange={(e) => updateField("changelog", e.target.value)}
          placeholder="## What's New\n\n- Added new feature...\n- Fixed bug..."
          rows={4}
          className="w-full rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none transition-colors font-mono" />
      </div>

      {/* Install Guide Section */}
      <div className="rounded-2xl border border-border bg-card/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t("upload.installGuide2") || "Installation Guide"}</span>
          <span className="text-[10px] text-muted-foreground">{t("upload.optional") || "(Optional)"}</span>
        </div>

        <textarea value={state.installGuide} onChange={(e) => updateField("installGuide", e.target.value)}
          placeholder={t("upload.installPlaceholder") || "1. Boot to recovery\n2. Wipe data/cache\n3. Flash ROM\n4. Flash GApps (optional)\n5. Reboot"}
          rows={3}
          className="w-full rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none transition-colors" />
      </div>

      {/* Tags Section */}
      <div className="rounded-2xl border border-border bg-card/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4" style={{ color: accentColor }} />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t("upload.tagsLabel", { n: state.tags.length })}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">{state.tags.length}/10</span>
        </div>

        {/* Tag Input */}
        <div className="flex gap-2">
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
            placeholder={t("upload.addTagPlaceholder") || "Add a tag..."}
            className={cn(inputCls, "flex-1")} />
          <button onClick={() => addTag()}
            disabled={!tagInput.trim() || state.tags.length >= 10}
            className="h-10 rounded-xl px-4 text-xs font-bold text-white shrink-0 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: accentColor }}>
            {t("upload.addBtn") || "Add"}
          </button>
        </div>

        {/* Suggested Tags */}
        {suggestedTags.length > 0 && state.tags.length < 10 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Lightbulb className="h-3 w-3 text-amber-400" />
              <span className="text-[10px] text-muted-foreground">{t("upload.suggestions") || "Suggestions:"}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestedTags.slice(0, 6).map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-solid transition-all"
                  style={{ ["--hover-border" as any]: accentColor }}
                >
                  <span>+</span> {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current Tags */}
        {state.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
            {state.tags.map(tag => (
              <span key={tag} className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-foreground transition-all group"
                style={{ borderColor: `${accentColor}40`, backgroundColor: `${accentColor}10` }}>
                <Hash className="h-3 w-3 opacity-50" />
                {tag}
                <button onClick={() => updateField("tags", state.tags.filter(tg => tg !== tag))}
                  className="text-muted-foreground/50 hover:text-destructive transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
