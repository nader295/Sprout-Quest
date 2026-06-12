"use client";

import React, { useState, useEffect } from "react";
import type { UploadFormState, UploadChannelLink } from "../hooks/use-upload-form";
import { useTranslation } from "@/lib/i18n";
import { FormField, inputCls, AdvancedSection, isValidUrl } from "./shared";
import { TYPE_KEYS } from "./step-type";
import { cn } from "@/lib/utils";
import { 
  Globe, Download, SplitSquareVertical, Plus, Check, Trash2, ChevronDown, Zap, Send, Heart, Coffee, 
  ExternalLink, Link2, DollarSign, X, Info, Sparkles, Shield, AlertCircle, Copy, CheckCheck
} from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { LINK_PLATFORMS, PLATFORM_COLORS, DONATION_PLATFORMS } from "@/components/profile/social-links";
import { PixeldrainUploader } from "@/components/upload/api-keys/pixeldrain-uploader";

interface StepLinksProps {
  form: {
    state: UploadFormState;
    updateField: (key: string, value: unknown) => void;
    errors: Record<string, string>;
    validateField: (key: keyof UploadFormState, value: unknown) => boolean;
    addVariant: (template?: string) => void;
    updateVariant: (idx: number, field: string, value: string) => void;
    removeVariant: (idx: number) => void;
    addMirror: () => void;
    updateMirror: (idx: number, value: string) => void;
    removeMirror: (idx: number) => void;
  };
  onOpenSettings?: () => void;
}

const MAX_MIRRORS = 3;

// Context-Aware Variant Templates by content type
const VARIANT_TEMPLATES: Record<string, { name: string; hint?: string }[]> = {
  rom: [
    { name: "Vanilla", hint: "No Google Apps" },
    { name: "GApps", hint: "With Google Apps" },
    { name: "MicroG", hint: "Privacy-focused" },
    { name: "Lite", hint: "Minimal features" },
    { name: "Full", hint: "All features" },
  ],
  kernel: [
    { name: "KSU", hint: "KernelSU support" },
    { name: "Non-KSU", hint: "Without KSU" },
    { name: "Battery", hint: "Optimized for battery" },
    { name: "Performance", hint: "Max performance" },
    { name: "Balanced", hint: "Balanced profile" },
  ],
  recovery: [
    { name: "VAB", hint: "Virtual A/B" },
    { name: "A-Only", hint: "A-only partition" },
    { name: "Decrypted", hint: "No encryption" },
    { name: "FBEv2", hint: "File-based encryption" },
  ],
  module: [
    { name: "Magisk", hint: "Magisk compatible" },
    { name: "KernelSU", hint: "KSU compatible" },
    { name: "APatch", hint: "APatch compatible" },
    { name: "Universal", hint: "All managers" },
  ],
  gsi: [
    { name: "VNDKLite", hint: "Lite VNDK" },
    { name: "Full", hint: "Full VNDK" },
    { name: "Go", hint: "Android Go" },
    { name: "Vanilla", hint: "No GApps" },
    { name: "GApps", hint: "With Google" },
  ],
};

// Inline Channel Link Editor
function InlineChannelEditor({ 
  channelLinks, 
  onChange,
  accentColor 
}: { 
  channelLinks: UploadChannelLink[];
  onChange: (links: UploadChannelLink[]) => void;
  accentColor: string;
}) {
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);

  const addLink = (platformId: string) => {
    const pl = LINK_PLATFORMS.find(p => p.id === platformId);
    const newLink: UploadChannelLink = {
      id: Math.random().toString(36).slice(2),
      platform: platformId,
      url: "",
      label: pl?.label ?? platformId,
    };
    onChange([...channelLinks, newLink]);
    setShowPicker(false);
  };

  const updateLink = (id: string, field: string, value: string) => {
    onChange(channelLinks.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const removeLink = (id: string) => {
    onChange(channelLinks.filter(l => l.id !== id));
  };

  return (
    <div className="space-y-3">
      {channelLinks.length > 0 && (
        <div className="space-y-2">
          {channelLinks.map((link) => {
            const pl = LINK_PLATFORMS.find(p => p.id === link.platform);
            const Icon = pl?.icon ?? Link2;
            const color = PLATFORM_COLORS[link.platform] ?? "#1d9bf0";
            const hasValidUrl = link.url?.trim() && isValidUrl(link.url.includes("://") ? link.url : `https://${pl?.prefix || ""}${link.url}`);
            
            return (
              <div key={link.id} className="rounded-xl border overflow-hidden transition-all"
                style={{ borderColor: hasValidUrl ? `${color}40` : "hsl(var(--border))", backgroundColor: hasValidUrl ? `${color}05` : "transparent" }}>
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${color}20` }}>
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <input
                      value={link.label}
                      onChange={e => updateLink(link.id, "label", e.target.value)}
                      placeholder={pl?.label ?? t("upload.channelName")}
                      className="w-full bg-transparent text-xs font-bold text-foreground placeholder:text-muted-foreground/40 focus:outline-none mb-0.5"
                    />
                    <div className="flex items-center gap-1">
                      {pl?.prefix && <span className="text-[10px] text-muted-foreground/50 shrink-0">{pl.prefix}</span>}
                      <input
                        value={link.url}
                        onChange={e => updateLink(link.id, "url", e.target.value)}
                        placeholder={pl?.placeholder ?? t("upload.link")}
                        className="flex-1 min-w-0 bg-transparent text-[11px] text-foreground/80 placeholder:text-muted-foreground/30 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {hasValidUrl && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                    <button onClick={() => removeLink(link.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showPicker ? (
        <div className="rounded-xl border border-border bg-card/50 p-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-foreground">{t("upload.choosePlatform")}</p>
            <button onClick={() => setShowPicker(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {LINK_PLATFORMS.filter(p => ["telegram", "youtube", "github", "twitter", "website", "xda"].includes(p.id)).map((pl) => {
              const color = PLATFORM_COLORS[pl.id];
              const alreadyAdded = channelLinks.some(l => l.platform === pl.id);
              return (
                <button key={pl.id} onClick={() => !alreadyAdded && addLink(pl.id)} disabled={alreadyAdded}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-background p-2.5 hover:border-primary/50 hover:bg-muted/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg transition-transform group-hover:scale-110" style={{ background: `${color}20` }}>
                    <pl.icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground">{pl.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <button onClick={() => setShowPicker(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed py-2.5 text-xs font-semibold transition-all hover:bg-muted/30"
          style={{ borderColor: "rgba(29,155,240,0.3)", color: "#1d9bf0" }}>
          <Plus className="h-3.5 w-3.5" /> <span>{t("upload.addChannel")}</span>
        </button>
      )}
    </div>
  );
}

// Inline Donation Editor
function InlineDonationEditor({ 
  donationLinks, 
  onChange,
  accentColor 
}: { 
  donationLinks: { platform: string; url: string; label: string }[];
  onChange: (links: { platform: string; url: string; label: string }[]) => void;
  accentColor: string;
}) {
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);

  const addLink = (platformId: string) => {
    const pl = DONATION_PLATFORMS.find(p => p.id === platformId);
    const newLink = {
      platform: platformId,
      url: "",
      label: pl?.label ?? platformId,
    };
    onChange([...donationLinks, newLink]);
    setShowPicker(false);
  };

  const updateLink = (idx: number, field: string, value: string) => {
    onChange(donationLinks.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const removeLink = (idx: number) => {
    onChange(donationLinks.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      {donationLinks.length > 0 && (
        <div className="space-y-2">
          {donationLinks.map((link, idx) => {
            const pl = DONATION_PLATFORMS.find(p => p.id === link.platform);
            const Icon = pl?.icon ?? Coffee;
            const color = pl?.color ?? "#f472b6";
            const hasValidUrl = link.url?.trim();
            
            return (
              <div key={idx} className="rounded-xl border overflow-hidden transition-all"
                style={{ borderColor: hasValidUrl ? `${color}40` : "hsl(var(--border))", backgroundColor: hasValidUrl ? `${color}08` : "transparent" }}>
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${color}20` }}>
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <input
                      value={link.label}
                      onChange={e => updateLink(idx, "label", e.target.value)}
                      placeholder={pl?.label ?? t("upload.linkName")}
                      className="w-full bg-transparent text-xs font-bold text-foreground placeholder:text-muted-foreground/40 focus:outline-none mb-0.5"
                    />
                    <div className="flex items-center gap-1">
                      {pl?.prefix && <span className="text-[10px] text-muted-foreground/50 shrink-0">{pl.prefix}</span>}
                      <input
                        value={link.url}
                        onChange={e => updateLink(idx, "url", e.target.value)}
                        placeholder={pl?.placeholder ?? t("upload.usernameOrLink")}
                        className="flex-1 min-w-0 bg-transparent text-[11px] text-foreground/80 placeholder:text-muted-foreground/30 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {hasValidUrl && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                    <button onClick={() => removeLink(idx)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showPicker ? (
        <div className="rounded-xl border border-border bg-card/50 p-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-foreground">{t("upload.chooseDonationPlatform")}</p>
            <button onClick={() => setShowPicker(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {DONATION_PLATFORMS.map((pl) => {
              const alreadyAdded = donationLinks.some(l => l.platform === pl.id);
              return (
                <button key={pl.id} onClick={() => !alreadyAdded && addLink(pl.id)} disabled={alreadyAdded}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-background p-2.5 hover:border-primary/50 hover:bg-muted/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg transition-transform group-hover:scale-110" style={{ background: `${pl.color}20` }}>
                    <pl.icon className="h-4 w-4" style={{ color: pl.color }} />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground text-center leading-tight">{pl.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <button onClick={() => setShowPicker(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed py-2.5 text-xs font-semibold transition-all hover:bg-muted/30"
          style={{ borderColor: "rgba(244,114,182,0.3)", color: "#f472b6" }}>
          <Plus className="h-3.5 w-3.5" /> <span>{t("upload.addDonationLink")}</span>
        </button>
      )}
    </div>
  );
}

export function StepLinks({ form, onOpenSettings }: StepLinksProps) {
  const { state, updateField, errors, validateField, addVariant, updateVariant, removeVariant, addMirror, updateMirror, removeMirror } = form;
  const { t } = useTranslation();
  const { userDoc } = useAuth();
  
  const selectedType = TYPE_KEYS.find(t => t.value === state.contentType);
  const accentColor  = selectedType?.accent ?? "var(--primary)";

  const [advOpen, setAdvOpen] = useState(false);
  const [copiedChecksum, setCopiedChecksum] = useState<string | null>(null);

  // Sync channel links and donation links from profile on mount (only if empty)
  useEffect(() => {
    if (userDoc && state.channelLinks.length === 0) {
      const profileChannelLinks: UploadChannelLink[] = (userDoc.profileLinks || [])
        .filter((l: any) => l.isChannel && l.url?.trim())
        .map((l: any) => ({
          id: l.id,
          platform: l.platform,
          url: l.url,
          label: l.label || l.platform,
        }));
      
      if (profileChannelLinks.length > 0) {
        updateField("channelLinks", profileChannelLinks);
      }
    }
    
    if (userDoc && state.donationLinks.length === 0) {
      const profileDonationLinks = (userDoc.donationLinks || [])
        .filter((d: any) => d.url?.trim())
        .map((d: any) => ({
          platform: d.platform,
          url: d.url,
          label: d.label || d.platform,
        }));

      if (profileDonationLinks.length > 0) {
        updateField("donationLinks", profileDonationLinks);
      }
    }
  }, [userDoc]);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedChecksum(type);
    setTimeout(() => setCopiedChecksum(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header with progress hint */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-black tracking-tight text-foreground">{t("upload.step.files") || "Downloads & Links"}</h3>
          <p className="text-xs text-muted-foreground mt-1">{t("upload.step.links.desc")}</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50">
          <Shield className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-[10px] font-semibold text-muted-foreground">{t("upload.httpsOnly")}</span>
        </div>
      </div>

      {/* ── GSI: Treble + Arch + Type ── */}
      {state.contentType === "gsi" && (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: `${accentColor}25`, backgroundColor: `${accentColor}04` }}>
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/30">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: `${accentColor}20` }}>
              <Globe className="h-4 w-4" style={{ color: accentColor }} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">GSI Configuration</h4>
              <p className="text-[10px] text-muted-foreground">{t("upload.gsiGlobalSettings")}</p>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Treble Type</label>
              <div className="grid grid-cols-3 gap-2">
                {[{ id: "a-only", label: "A-only", desc: "Single slot" }, { id: "ab", label: "A/B", desc: "Dual slot" }, { id: "both", label: "Both", desc: "Universal" }].map(opt => (
                  <button key={opt.id} type="button"
                    onClick={() => updateField("trebleType", state.trebleType === opt.id ? "" : opt.id)}
                    className="flex flex-col items-center gap-0.5 rounded-xl border-2 py-2.5 transition-all active:scale-95"
                    style={state.trebleType === opt.id
                      ? { borderColor: `${accentColor}60`, backgroundColor: `${accentColor}15`, color: accentColor }
                      : { borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}>
                    <span className="text-sm font-bold">{opt.label}</span>
                    <span className="text-[9px] opacity-60">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Architecture</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { id: "arm64",       label: "ARM64", desc: "64-bit" },
                  { id: "arm32",       label: "ARM32", desc: "32-bit" },
                  { id: "arm64+arm32", label: "ARM64+32", desc: "Binder64" },
                  { id: "x86",         label: "x86", desc: "Intel 32" },
                  { id: "x86_64",      label: "x86_64", desc: "Intel 64" },
                ].map(opt => (
                  <button key={opt.id} type="button"
                    onClick={() => updateField("gsiArch", state.gsiArch === opt.id ? "" : opt.id)}
                    className="flex flex-col items-center gap-0.5 rounded-xl border-2 py-2 transition-all active:scale-95"
                    style={state.gsiArch === opt.id
                      ? { borderColor: `${accentColor}60`, backgroundColor: `${accentColor}15`, color: accentColor }
                      : { borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}>
                    <span className="text-sm font-bold">{opt.label}</span>
                    <span className="text-[9px] opacity-60">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="GSI Type">
                <select value={state.gsiType} onChange={(e) => updateField("gsiType", e.target.value)} className={inputCls}>
                  <option value="">Unspecified</option>
                  <option value="vndklite">VNDKLite</option>
                  <option value="full">Full</option>
                  <option value="go">Android Go</option>
                </select>
              </FormField>
              <FormField label={t("upload.sizeLabel2")}>
                <input value={state.size} onChange={(e) => updateField("size", e.target.value)} placeholder="3.2 GB" className={inputCls} />
              </FormField>
            </div>
          </div>
        </div>
      )}

      {/* ── PIXELDRAIN INLINE UPLOADER ── */}
      <PixeldrainUploader
        onOpenSettings={onOpenSettings}
        onUploaded={(info) => {
          if (state.variants.length === 0) {
            // Single-link flow → drop the URL straight into the form fields
            updateField("downloadUrl", info.url);
            if (!state.size) updateField("size", info.sizeLabel);
            // Mark as valid so the green checkmark shows
            validateField("downloadUrl", info.url);
          } else {
            // Multi-variant flow → append a new variant with the URL
            addVariant(info.fileName.replace(/\.[^.]+$/, "") || "Pixeldrain");
            const idx = state.variants.length; // index of the new one
            updateVariant(idx, "downloadUrl", info.url);
            updateVariant(idx, "size", info.sizeLabel);
          }
        }}
      />

      {/* ── DOWNLOAD SECTION ── */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: `${accentColor}25` }}>
        {/* Tab Header */}
        <div className="flex items-center gap-0 border-b border-border/50 bg-muted/20">
          <button type="button" onClick={() => { if (state.variants.length > 0) updateField("variants", []); }}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold transition-all relative"
            style={state.variants.length === 0 ? { backgroundColor: `${accentColor}12`, color: accentColor } : { color: "var(--muted-foreground)" }}>
            <Download className="h-4 w-4" /> 
            <span>{t("upload.singleLink")}</span>
            {state.variants.length === 0 && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 rounded-full" style={{ backgroundColor: accentColor }} />}
          </button>
          <div className="w-px h-8 bg-border" />
          <button type="button" onClick={() => { if (state.variants.length === 0) addVariant(); }}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold transition-all relative"
            style={state.variants.length > 0 ? { backgroundColor: `${accentColor}12`, color: accentColor } : { color: "var(--muted-foreground)" }}>
            <SplitSquareVertical className="h-4 w-4" /> 
            <span>{t("upload.multiLink")}</span>
            {state.variants.length > 0 && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 rounded-full" style={{ backgroundColor: accentColor }} />}
          </button>
        </div>

        <div className="p-4 space-y-4">
          {state.variants.length === 0 ? (
            <>
              <FormField label={t("upload.mainDownloadLabel")} error={errors.downloadUrl} required>
                <div className="relative">
                  <input value={state.downloadUrl}
                    onChange={(e) => { updateField("downloadUrl", e.target.value); if (e.target.value.trim()) validateField("downloadUrl", e.target.value); }}
                    onBlur={(e) => validateField("downloadUrl", e.target.value)}
                    placeholder="https://sourceforge.net/projects/..."
                    className={cn(inputCls, "pe-10", errors.downloadUrl && "border-destructive", !errors.downloadUrl && state.downloadUrl && isValidUrl(state.downloadUrl) && "border-emerald-500/40")} />
                  {state.downloadUrl && isValidUrl(state.downloadUrl) && (
                    <Check className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400" />
                  )}
                </div>
              </FormField>
              
              <FormField label={t("upload.sizeLabel2")} hint={t("upload.sizeExample")}>
                <input value={state.size} onChange={(e) => updateField("size", e.target.value)} placeholder="1.5 GB" className={inputCls} />
              </FormField>
            </>
          ) : (
            <div className="space-y-4">
              {/* Quick Templates with hints */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" style={{ color: accentColor }} />
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t("upload.quickTemplates")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(VARIANT_TEMPLATES[state.contentType] || VARIANT_TEMPLATES.rom).map(template => {
                    const alreadyAdded = state.variants.some(v => v.name === template.name);
                    return (
                      <button key={template.name} type="button" onClick={() => { if (!alreadyAdded) addVariant(template.name); }} disabled={alreadyAdded}
                        className="group flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                        style={alreadyAdded ? { borderColor: `${accentColor}50`, backgroundColor: `${accentColor}15`, color: accentColor } : { borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}>
                        {alreadyAdded ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />}
                        <span>{template.name}</span>
                        {template.hint && !alreadyAdded && (
                          <span className="text-[9px] text-muted-foreground/60 hidden sm:inline">· {template.hint}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {errors.variants && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  <p className="text-[11px] text-destructive font-medium">{errors.variants}</p>
                </div>
              )}
              
              <div className="space-y-3">
                {state.variants.map((v, i) => (
                  <VariantCard key={i} variant={v} index={i}
                    onUpdate={(field, value) => updateVariant(i, field, value)}
                    onRemove={() => removeVariant(i)} accentColor={accentColor} />
                ))}
              </div>
              
              <button type="button" onClick={() => addVariant()}
                className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3 text-sm font-bold transition-all hover:bg-muted/20 active:scale-[0.98]"
                style={{ borderColor: `${accentColor}40`, color: accentColor }}>
                <Plus className="h-4 w-4" /> <span>{t("upload.addNewVariant")}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Mirrors Section ── */}
      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/20 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{t("upload.mirrorLinksLabel")}</p>
              <p className="text-[10px] text-muted-foreground">{t("upload.mirrorLinksDesc")}</p>
            </div>
          </div>
          {state.mirrors.length < MAX_MIRRORS && (
            <button type="button" onClick={addMirror}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 active:scale-95"
              style={{ color: accentColor, backgroundColor: `${accentColor}15` }}>
              <Plus className="h-3.5 w-3.5" /> <span>{t("upload.add")}</span>
            </button>
          )}
        </div>
        
        <div className="p-4 space-y-2">
          {state.mirrors.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 text-center py-2">{t("upload.noMirrors")}</p>
          ) : (
            state.mirrors.map((mirror, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-black" style={{ backgroundColor: `${accentColor}12`, color: accentColor }}>
                  {idx + 1}
                </span>
                <input value={mirror} onChange={(e) => updateMirror(idx, e.target.value)}
                  placeholder={`Mirror ${idx + 1} (https://...)`}
                  className={cn(inputCls, "flex-1", errors[`mirror_${idx}`] && "border-destructive", mirror && isValidUrl(mirror) && "border-emerald-500/30")} />
                <button type="button" onClick={() => removeMirror(idx)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5 transition-all shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Linkvertise Monetization Toggle ── */}
      <div
        className="rounded-2xl border overflow-hidden transition-all cursor-pointer group"
        style={{
          borderColor: state.linkvertiseEnabled ? "rgba(59,130,246,0.4)" : "hsl(var(--border))",
          backgroundColor: state.linkvertiseEnabled ? "rgba(59,130,246,0.05)" : "transparent",
        }}
        onClick={() => updateField("linkvertiseEnabled", !state.linkvertiseEnabled)}
      >
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all group-hover:scale-105"
              style={{
                backgroundColor: state.linkvertiseEnabled ? "rgba(59,130,246,0.2)" : "hsl(var(--muted)/0.6)",
                color: state.linkvertiseEnabled ? "#60a5fa" : "hsl(var(--muted-foreground))",
              }}
            >
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{t("upload.enableLinkvertise")}</p>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                {state.linkvertiseEnabled
                  ? t("upload.linkvertiseWarning")
                  : t("upload.directDownloadNoAd")}
              </p>
            </div>
          </div>
          <div
            className="relative flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200"
            style={{ backgroundColor: state.linkvertiseEnabled ? "#3b82f6" : "hsl(var(--muted))" }}
          >
            <div
              className="absolute h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
              style={{ transform: state.linkvertiseEnabled ? "translateX(21px)" : "translateX(2px)" }}
            />
          </div>
        </div>

        {state.linkvertiseEnabled && (
          <div className="border-t border-blue-500/15 px-4 pb-3 pt-3 bg-blue-500/5">
            <p className="text-[11px] text-blue-300/80 leading-relaxed">
              {t("upload.linkvertiseInfo")}
            </p>
          </div>
        )}
      </div>

      {/* ── CHANNEL LINKS - INLINE EDITING ── */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "rgba(29,155,240,0.25)", backgroundColor: "rgba(29,155,240,0.03)" }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(29,155,240,0.15)" }}>
            <Send className="h-4 w-4" style={{ color: "#1d9bf0" }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">{t("upload.channelLinksTitle")}</p>
            <p className="text-[10px] text-muted-foreground">{t("upload.channelLinksDesc")}</p>
          </div>
          {state.channelLinks.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: "rgba(29,155,240,0.15)", color: "#1d9bf0" }}>
              <Check className="h-3 w-3" /> {state.channelLinks.length}
            </div>
          )}
        </div>
        
        <div className="p-4">
          <InlineChannelEditor
            channelLinks={state.channelLinks}
            onChange={(links) => updateField("channelLinks", links)}
            accentColor={accentColor}
          />
        </div>
      </div>

      {/* ── DONATION LINKS - INLINE EDITING ── */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "rgba(244,114,182,0.25)", backgroundColor: "rgba(244,114,182,0.03)" }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(244,114,182,0.15)" }}>
            <Heart className="h-4 w-4" style={{ color: "#f472b6" }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">{t("upload.donationLinksTitle")}</p>
            <p className="text-[10px] text-muted-foreground">{t("upload.donationLinksDesc")}</p>
          </div>
          {state.donationLinks.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: "rgba(244,114,182,0.15)", color: "#f472b6" }}>
              <Check className="h-3 w-3" /> {state.donationLinks.length}
            </div>
          )}
        </div>
        
        <div className="p-4">
          <InlineDonationEditor
            donationLinks={state.donationLinks}
            onChange={(links) => updateField("donationLinks", links)}
            accentColor={accentColor}
          />
        </div>
      </div>

      {/* ── Advanced Section ── */}
      <AdvancedSection open={advOpen} setOpen={setAdvOpen}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Source Code / GitHub" hint={t("upload.sourceCodeHint")}>
            <input value={state.sourceUrl} onChange={(e) => updateField("sourceUrl", e.target.value)} placeholder="https://github.com/..." className={inputCls} />
          </FormField>
          <FormField label="XDA Thread" hint={t("upload.xdaThreadHint")}>
            <input value={state.xdaUrl} onChange={(e) => updateField("xdaUrl", e.target.value)} placeholder="https://xdaforums.com/..." className={inputCls} />
          </FormField>
          <FormField label="Telegram Channel / Group" hint={t("upload.telegramHint")}>
            <input value={state.telegramUrl} onChange={(e) => updateField("telegramUrl", e.target.value)} placeholder="https://t.me/..." className={inputCls} />
          </FormField>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <FormField label="MD5 Checksum" error={errors.checksumMd5} hint={t("upload.md5Hint")}>
            <div className="relative">
              <input value={state.checksumMd5} onChange={(e) => { updateField("checksumMd5", e.target.value); validateField("checksumMd5", e.target.value); }}
                placeholder="1234abcd5678efgh..."
                className={cn(inputCls, "font-mono text-xs pe-9", errors.checksumMd5 && "border-destructive")} />
              {state.checksumMd5 && (
                <button type="button" onClick={() => copyToClipboard(state.checksumMd5, "md5")}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {copiedChecksum === "md5" ? <CheckCheck className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              )}
            </div>
          </FormField>
          <FormField label="SHA256 Checksum" error={errors.checksumSha256} hint={t("upload.sha256Hint")}>
            <div className="relative">
              <input value={state.checksumSha256} onChange={(e) => { updateField("checksumSha256", e.target.value); validateField("checksumSha256", e.target.value); }}
                placeholder="1234abcd5678efgh..."
                className={cn(inputCls, "font-mono text-xs pe-9", errors.checksumSha256 && "border-destructive")} />
              {state.checksumSha256 && (
                <button type="button" onClick={() => copyToClipboard(state.checksumSha256, "sha256")}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {copiedChecksum === "sha256" ? <CheckCheck className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              )}
            </div>
          </FormField>
        </div>
      </AdvancedSection>
    </div>
  );
}

// ── Variant Builder Card ──────────────────────────────
function VariantCard({ variant, index, onUpdate, onRemove, accentColor }: {
  variant: any;
  index: number;
  onUpdate: (field: string, value: string) => void;
  onRemove: () => void;
  accentColor: string;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(index === 0 || (!variant.name && !variant.downloadUrl));
  const isComplete = variant.name && variant.downloadUrl && isValidUrl(variant.downloadUrl);
  
  return (
    <div className="rounded-2xl border overflow-hidden transition-all duration-300 group"
      style={{ 
        borderColor: isComplete ? "rgba(16,185,129,0.3)" : `${accentColor}30`, 
        backgroundColor: isComplete ? "rgba(16,185,129,0.03)" : `${accentColor}04` 
      }}>
      <button type="button" onClick={() => setExpanded(e => !e)}
        className="w-full flex justify-between items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white transition-transform group-hover:scale-105"
            style={{ backgroundColor: isComplete ? "#10b981" : accentColor }}>
            {isComplete ? <Check className="h-4 w-4" /> : index + 1}
          </div>
          <div className="flex-1 min-w-0 text-start leading-none space-y-1">
            <p className="text-sm font-bold text-foreground truncate">
              {variant.name || <span className="text-muted-foreground font-normal">{t("upload.variantName")} {index + 1}</span>}
            </p>
            <div className="flex items-center gap-2">
              {variant.size && <span className="text-[10px] text-muted-foreground">{variant.size}</span>}
              {variant.downloadUrl && !isValidUrl(variant.downloadUrl) && (
                <span className="text-[10px] text-amber-400">{t("upload.invalidLink")}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-2 -me-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t("upload.variantNameLabel")} required>
              <input value={variant.name} onChange={(e) => onUpdate("name", e.target.value)}
                placeholder={t("upload.variantNameExample")}
                className={cn(inputCls, !variant.name && "border-amber-500/30 focus:border-amber-500")} />
            </FormField>
            <FormField label={t("upload.sizeLabel2")}>
              <input value={variant.size || ""} onChange={(e) => onUpdate("size", e.target.value)}
                placeholder="2.1 GB" className={inputCls} />
            </FormField>
          </div>
          <FormField label={t("upload.downloadLink")} required>
            <div className="relative">
              <input value={variant.downloadUrl} onChange={(e) => onUpdate("downloadUrl", e.target.value)}
                placeholder="https://..."
                className={cn(inputCls, "pe-10", !variant.downloadUrl && "border-amber-500/30 focus:border-amber-500", variant.downloadUrl && isValidUrl(variant.downloadUrl) && "border-emerald-500/40")} />
              {variant.downloadUrl && isValidUrl(variant.downloadUrl) && (
                <Check className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400" />
              )}
            </div>
          </FormField>
        </div>
      )}
    </div>
  );
}
