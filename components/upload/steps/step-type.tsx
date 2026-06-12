"use client";

import React, { useState } from "react";
import type { UploadFormState } from "../hooks/use-upload-form";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Smartphone, Cpu, HardDrive, Puzzle, Globe, Sparkles, Check, ArrowRight, Star, TrendingUp, Zap } from "lucide-react";

export const TYPE_KEYS = [
  {
    value: "rom", labelKey: "upload.type.rom", descKey: "upload.type.rom.desc",
    icon: Smartphone, color: "from-blue-500 to-cyan-400", glow: "blue",
    accent: "#3b82f6", accentDim: "#1d4ed8", badge: "Custom ROM",
    features: ["Full Android OS replacement", "Custom UI & performance", "OTA updates support"],
    stat: "Most Popular",
    statIcon: TrendingUp,
    tipKey: "upload.type.rom.tip",
  },
  {
    value: "kernel", labelKey: "upload.type.kernel", descKey: "upload.type.kernel.desc",
    icon: Cpu, color: "from-purple-500 to-violet-400", glow: "purple",
    accent: "#a855f7", accentDim: "#7c3aed", badge: "Kernel",
    features: ["CPU/GPU overclocking", "AnyKernel3 support", "KSU / SUSFS / Rooted"],
    stat: "Performance",
    statIcon: Zap,
    tipKey: "upload.type.kernel.tip",
  },
  {
    value: "recovery", labelKey: "upload.type.recovery", descKey: "upload.type.recovery.desc",
    icon: HardDrive, color: "from-amber-500 to-orange-400", glow: "amber",
    accent: "#f59e0b", accentDim: "#d97706", badge: "Recovery",
    features: ["Flash & backup system", "ADB sideload support", "Partition management"],
    stat: "System Tool",
    statIcon: HardDrive,
    tip: "TWRP, OrangeFox, SHRP...",
  },
  {
    value: "module", labelKey: "upload.type.module", descKey: "upload.type.module.desc",
    icon: Puzzle, color: "from-emerald-500 to-teal-400", glow: "emerald",
    accent: "#10b981", accentDim: "#059669", badge: "Module",
    features: ["Magisk / KSU / APatch", "Universal or device-specific", "Systemless overlay"],
    stat: "Systemless",
    statIcon: Puzzle,
    tipKey: "upload.type.module.tip",
  },
  {
    value: "gsi", labelKey: "upload.type.gsi", descKey: "upload.type.gsi.desc",
    icon: Globe, color: "from-rose-500 to-pink-400", glow: "rose",
    accent: "#f43f5e", accentDim: "#e11d48", badge: "GSI",
    features: ["Any Treble device", "ARM64 / ARM32 / x86", "Project Treble based"],
    stat: "Universal",
    statIcon: Globe,
    tipKey: "upload.type.gsi.tip",
  },
];

interface StepTypeProps {
  form: {
    state: UploadFormState;
    updateField: (key: keyof UploadFormState, value: unknown) => void;
  };
  onTypeSelected?: () => void;
}

export function StepType({ form, onTypeSelected }: StepTypeProps) {
  const { t } = useTranslation();
  const [hoveredType, setHoveredType] = useState<string | null>(null);
  const [animatingType, setAnimatingType] = useState<string | null>(null);

  const handleTypeSelect = (typeValue: string) => {
    setAnimatingType(typeValue);
    form.updateField("contentType", typeValue);
    
    // Animate then proceed
    setTimeout(() => {
      setAnimatingType(null);
      if (onTypeSelected) {
        onTypeSelected();
      }
    }, 300);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-xl font-black tracking-tight text-foreground">{t("upload.step.type")}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{t("upload.step.type.desc")}</p>
      </div>

      {/* Type Grid */}
      <div className="grid grid-cols-1 gap-3">
        {TYPE_KEYS.map((type, index) => {
          const isSelected = form.state.contentType === type.value;
          const isHovered = hoveredType === type.value;
          const isAnimating = animatingType === type.value;
          const StatIcon = type.statIcon;
          
          return (
            <button
              key={type.value}
              onClick={() => handleTypeSelect(type.value)}
              onMouseEnter={() => setHoveredType(type.value)}
              onMouseLeave={() => setHoveredType(null)}
              className={cn(
                "relative flex items-start gap-4 p-4 border-2 rounded-2xl text-start transition-all duration-300 overflow-hidden group",
                isSelected 
                  ? "scale-[1.01]" 
                  : "hover:scale-[1.005] active:scale-[0.995]",
                isAnimating && "scale-[1.02]"
              )}
              style={{
                borderColor: isSelected ? type.accent : isHovered ? `${type.accent}40` : "hsl(var(--border))",
                backgroundColor: isSelected ? `${type.accent}08` : isHovered ? `${type.accent}03` : "transparent",
                boxShadow: isSelected ? `0 0 0 2px ${type.accent}30, 0 4px 20px ${type.accent}15` : "none",
                animationDelay: `${index * 50}ms`,
              }}
            >
              {/* Animated background glow */}
              {(isSelected || isHovered) && (
                <div
                  className="absolute inset-0 opacity-20 blur-3xl transition-opacity duration-500 pointer-events-none"
                  style={{ background: `radial-gradient(circle at 30% 50%, ${type.accent}, transparent 70%)` }}
                />
              )}
              
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-3 end-3 flex h-6 w-6 items-center justify-center rounded-full animate-in zoom-in duration-200"
                  style={{ backgroundColor: type.accent }}>
                  <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                </div>
              )}

              {/* Icon */}
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg transition-all duration-300",
                  type.color,
                  (isSelected || isHovered) && "scale-110 shadow-xl"
                )}
                style={{
                  boxShadow: isSelected ? `0 8px 24px ${type.accent}40` : isHovered ? `0 4px 16px ${type.accent}30` : undefined
                }}
              >
                <type.icon strokeWidth={2} className="h-6 w-6" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 relative z-10">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-bold text-foreground text-base tracking-tight">{t(type.labelKey)}</h4>
                  <span
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
                    style={{ 
                      backgroundColor: `${type.accent}15`, 
                      color: type.accent 
                    }}
                  >
                    <StatIcon className="h-2.5 w-2.5" />
                    {type.stat}
                  </span>
                </div>
                
                <p className="text-xs text-muted-foreground/80 leading-relaxed mb-2.5">
                  {t(type.descKey)}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{t(type.descKey)}</p>

                {/* Features list */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                  {type.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                      <div className="h-1 w-1 rounded-full shrink-0" style={{ backgroundColor: type.accent }} />
                      {feature}
                    </div>
                  ))}
                </div>

                {/* Dynamic Tip matching the accent color */}
                {isSelected && type.tipKey && (
                  <div 
                    className="mt-3 pt-3 border-t border-dashed flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
                    style={{ borderColor: `${type.accent}30` }}
                  >
                    <Sparkles className="h-3.5 w-3.5" style={{ color: type.accent }} />
                    <p className="text-[11px] font-medium" style={{ color: type.accent }}>
                      {t(type.tipKey)}
                    </p>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick tip */}
      <div className="flex items-start gap-2.5 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <div>
          <span className="text-xs font-bold text-foreground">{t("upload.quickTip")}</span>
          <p className="text-xs text-muted-foreground/80 leading-relaxed mt-1">{t("upload.quickTipDesc")}</p>
        </div>
      </div>
    </div>
  );
}
