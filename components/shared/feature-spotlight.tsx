"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles, Trophy, Shield, Code2, Layers, Globe,
  ChevronLeft, ChevronRight, X, Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: Layers,
    title: "ROM Collections",
    description: "Curate and organize ROMs into personal collections, share them with the community, and discover hand-picked bundles from top developers.",
    gradient: "from-blue-500 to-cyan-400",
  },
  {
    icon: Trophy,
    title: "XP & Achievements",
    description: "Earn experience points for every contribution. Level up from Rookie to Legend. Unlock rare badges that showcase your expertise.",
    gradient: "from-amber-500 to-orange-400",
  },
  {
    icon: Shield,
    title: "Verified Developers",
    description: "Trusted developers get a verification badge. Their ROMs are highlighted for safety, ensuring you flash with confidence.",
    gradient: "from-emerald-500 to-green-400",
  },
  {
    icon: Code2,
    title: "Version Management",
    description: "Track every ROM version, changelog, and update. Get notified instantly when your favorite ROM gets a new release.",
    gradient: "from-purple-500 to-violet-400",
  },
  {
    icon: Sparkles,
    title: "Analytics Dashboard",
    description: "Developers get real-time analytics: downloads, views, ratings, and geographic distribution. Data-driven development.",
    gradient: "from-pink-500 to-rose-400",
  },
  {
    icon: Globe,
    title: "Multi-Language Support",
    description: "RomX speaks your language. Full internationalization with Arabic, English, and more — RTL-first design included.",
    gradient: "from-indigo-500 to-blue-400",
  },
];

export function FeatureSpotlight() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Handle initial onboarding
    const seen = localStorage.getItem("rx_onboarded");
    if (!seen) {
      // Small delay so the page renders first
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Handle manual trigger from WelcomeBanner or other components
    const handleOpen = () => {
      setCurrentIndex(0);
      setIsOpen(true);
    };

    window.addEventListener("rx:open-spotlight", handleOpen);
    return () => window.removeEventListener("rx:open-spotlight", handleOpen);
  }, []);

  const dismiss = useCallback(() => {
    setIsOpen(false);
    localStorage.setItem("rx_onboarded", "1");
  }, []);

  const next = useCallback(() => {
    if (currentIndex < FEATURES.length - 1) {
      setCurrentIndex((i) => i + 1);
      setHasAnimated(true);
    } else {
      dismiss();
    }
  }, [currentIndex, dismiss]);

  const prev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setHasAnimated(true);
    }
  }, [currentIndex]);

  if (!isOpen) return null;

  const feature = FEATURES[currentIndex];
  const Icon = feature.icon;
  const isLast = currentIndex === FEATURES.length - 1;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={dismiss}
      />

      {/* Modal */}
      <div className={cn(
        "relative w-full max-w-lg rounded-3xl border border-border bg-card shadow-2xl overflow-hidden",
        "animate-in zoom-in-95 fade-in duration-300"
      )}>
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-4 end-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-muted/80 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Feature card */}
        <div className="p-8 pt-12 text-center">
          {/* Icon */}
          <div className={cn(
            "mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br shadow-lg",
            feature.gradient,
            hasAnimated ? "animate-in zoom-in-50 duration-300" : ""
          )}>
            <Icon className="h-10 w-10 text-white" />
          </div>

          {/* Title */}
          <h2 className={cn(
            "text-2xl font-black text-foreground mb-3",
            hasAnimated ? "animate-in slide-in-from-bottom-2 duration-300" : ""
          )}>
            {feature.title}
          </h2>

          {/* Description */}
          <p className={cn(
            "text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto",
            hasAnimated ? "animate-in slide-in-from-bottom-3 fade-in duration-500" : ""
          )}>
            {feature.description}
          </p>
        </div>

        {/* Progress dots + navigation */}
        <div className="px-8 pb-8">
          {/* Dots */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {FEATURES.map((_, i) => (
              <button
                key={i}
                onClick={() => { setCurrentIndex(i); setHasAnimated(true); }}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  i === currentIndex
                    ? "w-8 bg-gradient-to-r " + FEATURES[i].gradient
                    : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={prev}
              disabled={currentIndex === 0}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-2xl border border-border text-muted-foreground transition-all",
                currentIndex === 0
                  ? "opacity-30 cursor-not-allowed"
                  : "hover:bg-muted hover:text-foreground hover:scale-105 active:scale-95"
              )}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              onClick={next}
              className={cn(
                "flex-1 h-11 rounded-2xl text-sm font-black text-white transition-all hover:scale-[1.02] active:scale-95",
                "bg-gradient-to-r shadow-lg",
                isLast ? "from-emerald-500 to-green-400" : feature.gradient
              )}
            >
              {isLast ? (
                <span className="flex items-center justify-center gap-2">
                  <Rocket className="h-4 w-4" />
                  Get Started
                </span>
              ) : (
                "Next"
              )}
            </button>

            <button
              onClick={dismiss}
              className="flex h-11 items-center justify-center rounded-2xl border border-border px-4 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all hover:scale-105 active:scale-95"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
