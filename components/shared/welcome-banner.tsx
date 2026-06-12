"use client";

import { useState, useEffect } from "react";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

export function WelcomeBanner() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = localStorage.getItem("rx_welcome_dismissed");
    if (!dismissed) {
      setVisible(true);
      const timer = setTimeout(() => setMounted(true), 100);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem("rx_welcome_dismissed", "1");
  };

  const openSpotlight = () => {
    // Clear onboarded flag to force spotlight to reopen
    localStorage.removeItem("rx_onboarded");
    dismiss();
    // Trigger page reload to show spotlight
    window.dispatchEvent(new CustomEvent("rx:open-spotlight"));
  };

  if (!visible) return null;

  return (
    <div className={cn(
      "mb-4 relative overflow-hidden rounded-2xl border transition-all duration-700",
      mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    )}
    style={{
      borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
      background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 8%, transparent), color-mix(in srgb, var(--primary) 3%, transparent))",
    }}>
      {/* Decorative glow */}
      <div className="absolute -top-12 -end-12 w-40 h-40 rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, var(--primary), transparent 70%)" }} />

      {/* Close */}
      <button
        onClick={dismiss}
        className="absolute top-3 end-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="relative z-10 p-4 sm:p-5 flex items-center gap-4 flex-wrap">
        {/* Icon */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
          style={{ background: "linear-gradient(135deg, var(--primary), #8b5cf6)" }}>
          <Sparkles className="h-6 w-6" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-black text-foreground mb-0.5">
            {t("welcome.title") || "Welcome to RomX! 🚀"}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("welcome.description") || "The ultimate community-driven platform for Custom ROMs, Kernels, and more. Explore what makes us different."}
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={openSpotlight}
          className="shrink-0 group inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all hover:scale-105 active:scale-95"
          style={{ background: "linear-gradient(135deg, var(--primary), #3b82f6)", boxShadow: "0 4px 14px color-mix(in srgb, var(--primary) 25%, transparent)" }}
        >
          {t("welcome.exploreFeatures") || "Explore Features"}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
