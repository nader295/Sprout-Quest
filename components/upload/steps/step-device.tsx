"use client";

import React, { useState, useEffect, useRef } from "react";
import type { UploadFormState } from "../hooks/use-upload-form";
import { useTranslation } from "@/lib/i18n";
import { FormField, inputCls } from "./shared";
import { TYPE_KEYS } from "./step-type";
import { BRANDS, ANDROID_VERSIONS, POPULAR_DEVICES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Smartphone, Check, AlertTriangle, Loader2, Globe, Zap, Cpu, Layers } from "lucide-react";

interface StepDeviceProps {
  form: {
    state: UploadFormState;
    updateField: (key: string, value: unknown) => void;
    errors: Record<string, string>;
    getKernelVersion: () => string;
  };
}

const KERNEL_MAJOR_VERSIONS = [
  "3.4", "3.10", "3.14", "3.18",
  "4.4", "4.9", "4.14", "4.19",
  "5.4", "5.10", "5.15",
  "6.1", "6.6", "6.12",
];

export function StepDevice({ form }: StepDeviceProps) {
  const { state, updateField, errors, getKernelVersion } = form;
  const { t } = useTranslation();
  
  const selectedType = TYPE_KEYS.find(t => t.value === state.contentType);
  const accentColor  = selectedType?.accent ?? "var(--primary)";

  // Autocomplete / Hint state
  const [deviceSuggestions, setDeviceSuggestions] = useState<string[]>([]);
  const deviceAutocompleteDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codenameDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codenameLockedRef = useRef(false);

  const [codenameHint, setCodenameHint] = useState<{
    loading: boolean; warning?: string; isAmbiguous: boolean; resolved: string | null;
  }>({
    loading: false, isAmbiguous: false, resolved: null
  });

  // Device autocomplete
  useEffect(() => {
    const q = state.device.trim();
    if (q.length < 2) { setDeviceSuggestions([]); return; }
    if (deviceAutocompleteDebounce.current) clearTimeout(deviceAutocompleteDebounce.current);
    
    deviceAutocompleteDebounce.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q, limit: "8" });
        if (state.brand) params.set("brand", state.brand);
        const res  = await fetch(`/api/devices?${params}`);
        const data = await res.json() as { items?: { name: string; codename: string }[] };
        const names = (data.items || []).map((d) => d.name).filter(Boolean);
        setDeviceSuggestions(names.length ? names.slice(0, 6) : POPULAR_DEVICES.filter(d => d.toLowerCase().includes(q.toLowerCase())).slice(0, 5));
      } catch {
        setDeviceSuggestions(POPULAR_DEVICES.filter(d => d.toLowerCase().includes(state.device.trim().toLowerCase())).slice(0, 5));
      }
    }, 250);
  }, [state.device, state.brand]);

  // Smart codename Auto-link (Task 3.3)
  useEffect(() => {
    const cn = state.deviceCodename.trim();
    if (!cn || cn.length < 2) {
      setCodenameHint(h => ({ ...h, loading: false, warning: undefined }));
      return;
    }
    if (codenameDebounce.current) clearTimeout(codenameDebounce.current);
    
    codenameDebounce.current = setTimeout(async () => {
      setCodenameHint(h => ({ ...h, loading: true }));
      try {
        const params = new URLSearchParams();
        params.set("codename", cn);
        if (state.brand) params.set("brand", state.brand);
        if (state.device) params.set("q", state.device);
        const res  = await fetch(`/api/devices/suggest?${params}`);
        if (!res.ok) throw new Error("fetch failed");
        
        const data = await res.json();
        setCodenameHint({ 
          loading: false, 
          warning: data.warning, 
          isAmbiguous: data.isAmbiguous || false, 
          resolved: data.resolved
        });
      } catch { 
        setCodenameHint(h => ({ ...h, loading: false })); 
      }
    }, 600);
  }, [state.deviceCodename, state.brand, state.device]);

  // Handle suggestion click
  const handleDeviceSuggestionClick = async (d: string) => {
    updateField("device", d); 
    setDeviceSuggestions([]);
    try {
      const params = new URLSearchParams({ q: d });
      if (state.brand) params.set("brand", state.brand);
      const res  = await fetch(`/api/devices/suggest?${params}`);
      const data = await res.json() as { best?: { codename: string } };
      if (data.best?.codename) { 
        updateField("deviceCodename", data.best.codename); 
        codenameLockedRef.current = true; 
      }
    } catch { /* ignore */ }
  };

  // Rendering logic based on type
  if ((state.contentType as any) === "gsi") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3.5 py-2.5 mb-4">
          <Globe className="h-4 w-4 shrink-0 text-rose-400" />
          <p className="text-xs text-rose-400 font-medium">{t("upload.gsiWorksOnAny")}</p>
        </div>
        <FormField label="Android Version" error={errors.android} required>
          <select value={state.android} onChange={(e) => updateField("android", e.target.value)} className={cn(inputCls, errors.android && "border-destructive")}>
            <option value="">{t("upload.chooseOption")}</option>
            {ANDROID_VERSIONS.map(v => <option key={v} value={v}>Android {v}</option>)}
          </select>
        </FormField>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${accentColor}15` }}>
          <Smartphone className="h-4.5 w-4.5" style={{ color: accentColor }} />
        </div>
        <div>
          <h3 className="text-xl font-black tracking-tight text-foreground">{t("upload.step.info") || "Device Information"}</h3>
          <p className="text-xs text-muted-foreground">{t("upload.step.infoDesc") || "Select the target device and Android version"}</p>
        </div>
      </div>
      
      {state.contentType === "kernel" && (
        <div className="rounded-2xl border border-border bg-card/30 p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="h-4 w-4" style={{ color: accentColor }} />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t("upload.kernelSettings")}</span>
          </div>

          <FormField label="Kernel Type" error={errors.kernelType} required>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-3 transition-all active:scale-[0.98]",
                  state.kernelType === "device" 
                    ? "border-purple-500 bg-purple-500/10 text-purple-500" 
                    : "border-border text-muted-foreground hover:bg-muted/50 hover:border-muted-foreground/30"
                )}
                onClick={() => updateField("kernelType", "device")}
              >
                <Smartphone className="h-5 w-5" />
                <span className="text-sm font-bold">{t("upload.specificDevice")}</span>
                <span className="text-[10px] opacity-60">Device Specific</span>
              </button>
              <button
                type="button"
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-3 transition-all active:scale-[0.98]",
                  state.kernelType === "anykernel3" 
                    ? "border-purple-500 bg-purple-500/10 text-purple-500" 
                    : "border-border text-muted-foreground hover:bg-muted/50 hover:border-muted-foreground/30"
                )}
                onClick={() => updateField("kernelType", "anykernel3")}
              >
                <Globe className="h-5 w-5" />
                <span className="text-sm font-bold">AnyKernel3</span>
                <span className="text-[10px] opacity-60">{t("upload.universalFlashable")}</span>
              </button>
            </div>
          </FormField>

          <FormField label="Kernel Version" error={errors.kernelMajor} required>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={state.kernelMajor}
                  onChange={(e) => updateField("kernelMajor", e.target.value)}
                  className={cn("h-10 rounded-xl border border-border bg-muted/30 px-3 text-sm font-mono text-foreground focus:outline-none transition-colors", errors.kernelMajor && "border-destructive", "w-36 shrink-0")}
                >
                  <option value="">Select...</option>
                  {KERNEL_MAJOR_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                {state.kernelMajor && (
                  <>
                    <span className="text-muted-foreground font-mono text-sm">.</span>
                    <input
                      value={state.kernelMinor}
                      onChange={(e) => updateField("kernelMinor", e.target.value.replace(/[^0-9\-]/g, "").slice(0, 10))}
                      placeholder="123 (optional)"
                      className="h-10 flex-1 rounded-xl border border-border bg-muted/30 px-3 text-sm font-mono text-foreground focus:outline-none transition-colors"
                    />
                  </>
                )}
              </div>
              {state.kernelMajor && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Zap className="h-3 w-3 shrink-0" style={{ color: accentColor }} />
                  <span>Full version string: </span>
                  <code className="font-mono text-foreground">{getKernelVersion()}</code>
                </div>
              )}
            </div>
          </FormField>
          
          {state.kernelType === "anykernel3" && (
            <FormField label="Supported Targets" hint={t("upload.supportedTargetsHint")}>
              <input value={state.anyKernelTargets} onChange={(e) => updateField("anyKernelTargets", e.target.value)}
                className={cn(inputCls)} placeholder="ginkgo, willow, lavender..." />
            </FormField>
          )}
        </div>
      )}

      {state.contentType === "module" && (
        <div className="rounded-2xl border border-border bg-card/30 p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="h-4 w-4" style={{ color: accentColor }} />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t("upload.moduleSettings")}</span>
          </div>

          <FormField label={t("upload.moduleScope")} required hint={t("upload.moduleScopeHint")}>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "universal", label: t("upload.scopeUniversal"), desc: t("upload.scopeUniversalDesc"), icon: Globe },
                { value: "android", label: t("upload.scopeAndroid"), desc: t("upload.scopeAndroidDesc"), icon: Smartphone },
                { value: "device", label: t("upload.scopeDevice"), desc: t("upload.scopeDeviceDesc"), icon: Smartphone },
                { value: "soc", label: t("upload.scopeSoc"), desc: t("upload.scopeSocDesc"), icon: Cpu },
              ].map(opt => {
                const Icon = opt.icon;
                const isSelected = state.moduleScope === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateField("moduleScope", opt.value)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border-2 p-2.5 text-start transition-all active:scale-[0.98]",
                      isSelected 
                        ? "border-emerald-500 bg-emerald-500/10" 
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <div className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                      isSelected ? "bg-emerald-500/20" : "bg-muted"
                    )}>
                      <Icon className={cn("h-4 w-4", isSelected ? "text-emerald-500" : "text-muted-foreground")} />
                    </div>
                    <div className="min-w-0">
                      <p className={cn("text-sm font-bold", isSelected ? "text-emerald-500" : "text-foreground")}>{opt.label}</p>
                      <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </FormField>
        </div>
      )}

      {/* Target Device UI (Rendered if not universal) */}
      {!( (state.contentType as any) === "gsi" || state.contentType === "module" && state.moduleScope === "universal" || state.contentType === "kernel" && state.kernelType === "anykernel3") && (
        <div className="rounded-2xl border p-4 space-y-4 animate-in fade-in duration-300"
          style={{ borderColor: `${accentColor}25`, backgroundColor: `${accentColor}04` }}>
          
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: `${accentColor}20` }}>
              <Smartphone className="h-4 w-4" style={{ color: accentColor }} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{t("upload.deviceInfoTitle")}</p>
              <p className="text-[10px] text-muted-foreground">{t("upload.deviceInfoSub")}</p>
            </div>
            {codenameHint.loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ms-auto" />}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t("upload.brandLabel")} error={errors.brand} required>
              <select value={state.brand} onChange={(e) => updateField("brand", e.target.value)} className={cn(inputCls, errors.brand && "border-destructive")}>
                <option value="">{t("upload.chooseOption")}</option>
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </FormField>
            
            <FormField label={t("upload.deviceLabel")} error={errors.device} required>
              <div className="relative">
                <input value={state.device}
                  onChange={(e) => { updateField("device", e.target.value); codenameLockedRef.current = false; }}
                  placeholder="Galaxy S25 Ultra"
                  className={cn(inputCls, errors.device && "border-destructive")} />
                {deviceSuggestions.length > 0 && (
                  <div className="absolute top-full z-30 mt-1.5 w-full rounded-2xl border border-white/10 bg-background/80 backdrop-blur-xl shadow-2xl shadow-black/20 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
                    <div className="px-3 py-2 border-b border-white/5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Suggestions</span>
                    </div>
                    {deviceSuggestions.map((d, i) => (
                      <button key={d} type="button" onClick={() => handleDeviceSuggestionClick(d)}
                        className="group w-full px-3.5 py-3 text-start text-sm text-foreground/90 hover:text-foreground hover:bg-primary/8 transition-all duration-150 flex items-center gap-3 border-b border-white/[0.03] last:border-0"
                        style={{ animationDelay: `${i * 30}ms` }}>
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/40 group-hover:bg-primary/15 transition-colors">
                          <Smartphone className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <span className="font-medium truncate">{d}</span>
                        <Check className="h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 ms-auto transition-opacity" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </FormField>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Device Codename</label>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: `${accentColor}18`, color: accentColor }}>{t("upload.mostImportantLabel")}</span>
            </div>
            
            <div className="relative">
              <input
                value={state.deviceCodename}
                onChange={(e) => { 
                  const val = e.target.value.toLowerCase().replace(/[^a-z0-9_\-\.]/g, ""); 
                  if (val !== state.deviceCodename) codenameLockedRef.current = val.length > 0; 
                  updateField("deviceCodename", val); 
                }}
                placeholder="shiva / caiman / ginkgo"
                className={cn("h-11 w-full rounded-xl border bg-muted/30 px-4 pe-10 text-sm font-mono text-foreground placeholder:text-muted-foreground/35 focus:outline-none transition-all", codenameHint.warning ? "border-amber-500/50" : state.deviceCodename ? "border-emerald-500/40" : "border-border")}
              />
              {state.deviceCodename && !codenameHint.loading && (
                <div className="absolute end-3 top-1/2 -translate-y-1/2">
                  {codenameHint.warning ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : <Check className="h-4 w-4 text-emerald-500" />}
                </div>
              )}
            </div>
            
            {codenameHint.warning && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500 mt-0.5" />
                <p className="text-[11px] text-amber-500">{codenameHint.warning}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Android Version common select */}
      {(state.contentType === "rom" || state.contentType === "recovery" || (state.contentType === "kernel" && state.kernelType !== "anykernel3")) && (
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t("upload.androidLabel")} error={errors.android} required>
            <select value={state.android} onChange={(e) => updateField("android", e.target.value)} className={cn(inputCls, errors.android && "border-destructive")}>
              <option value="">{t("upload.chooseOption")}</option>
              {ANDROID_VERSIONS.map(v => <option key={v} value={v}>Android {v}</option>)}
            </select>
          </FormField>
        </div>
      )}
    </div>
  );
}
