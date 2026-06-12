"use client";

/**
 * Home Page Hero (Stage 2 redesign)
 *
 * Layered composition:
 *   • Layer 0: base gradient + holographic grid (from layout)
 *   • Layer 1: 3D canvas scene (right-anchored, fades to center on mobile)
 *   • Layer 2: glow blobs + scan lines
 *   • Layer 3: content (badge + title + CTAs + trust strip)
 *
 * RTL-aware, auth-aware, reduced-motion-aware.
 */

import { useEffect, useState, lazy, Suspense } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Compass, Upload, ArrowRight, Shield, Globe, Zap,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Lazy-load the three.js scene so it doesn't block initial paint
const Hero3DScene = lazy(() => import("./hero-3d-scene"));

const fadeUp = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  show:   { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

export default function HeroCyber({ children }: { children?: React.ReactNode }) {
  const { t, dir } = useTranslation();
  const { user, canUpload } = useAuth();
  const [scene3DReady, setScene3DReady] = useState(false);

  // Delay mounting the 3D scene until after first paint so LCP is clean
  useEffect(() => {
    const timer = window.setTimeout(() => setScene3DReady(true), 300);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section dir={dir} className="relative overflow-hidden">
      {/* ── Layer 1: 3D canvas ────────────────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        aria-hidden
      >
        <div className={cn(
          "absolute top-0 h-full w-full sm:w-[60%]",
          dir === "rtl" ? "start-0" : "end-0",
        )}>
          {scene3DReady && (
            <Suspense fallback={null}>
              <Hero3DScene className="h-full w-full" />
            </Suspense>
          )}
          {/* Horizontal fade toward content side */}
          <div
            className="absolute inset-0"
            style={{
              background: dir === "rtl"
                ? "linear-gradient(90deg, transparent 0%, transparent 30%, rgb(var(--background) / 0.85) 100%)"
                : "linear-gradient(90deg, rgb(var(--background) / 0.85) 0%, transparent 70%, transparent 100%)",
            }}
          />
          {/* Bottom fade to seam with stats bar */}
          <div
            className="absolute inset-x-0 bottom-0 h-32"
            style={{ background: "linear-gradient(180deg, transparent 0%, rgb(var(--background) / 0.9) 100%)" }}
          />
        </div>
      </div>

      {/* ── Layer 2: ambient glows ─────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        <div
          className="absolute -top-24 left-1/4 w-[520px] h-56 rounded-full opacity-60"
          style={{
            background: "radial-gradient(ellipse, color-mix(in srgb, var(--primary) 22%, transparent) 0%, transparent 70%)",
            filter: "blur(48px)",
          }}
        />
        <div
          className="absolute -bottom-32 right-1/4 w-[520px] h-56 rounded-full opacity-40"
          style={{
            background: "radial-gradient(ellipse, rgba(0,229,255,0.18) 0%, transparent 70%)",
            filter: "blur(56px)",
          }}
        />
        {/* Top scan line */}
        <div
          className="absolute inset-x-0 top-0 h-px opacity-70"
          style={{ background: "linear-gradient(90deg, transparent 0%, var(--primary) 50%, transparent 100%)" }}
        />

        {/* Subtle grain texture — adds depth & warmth à la editorial Figma mocks */}
        <div className="grain-overlay absolute inset-0" aria-hidden />
      </div>

      {/* ── Layer 3: content ───────────────────────────────────────── */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 pt-8 pb-6 sm:px-6 sm:pt-12 sm:pb-8">
        <div className="max-w-2xl">
          {/* Live badge */}
          <motion.div
            initial="hidden" animate="show" variants={fadeUp}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 mb-4 text-[11px] font-bold backdrop-blur-sm"
            style={{
              borderColor: "color-mix(in srgb, var(--primary) 45%, transparent)",
              background: "color-mix(in srgb, var(--primary) 10%, transparent)",
              color: "var(--primary)",
            }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            {t("hero.badge")}
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial="hidden" animate="show" variants={fadeUp}
            transition={{ delay: 0.08 }}
            className="text-4xl font-black sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight text-foreground mb-2"
          >
            {t("hero.title")}
          </motion.h1>
          <motion.h1
            initial="hidden" animate="show" variants={fadeUp}
            transition={{ delay: 0.16 }}
            className="text-4xl font-black sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight mb-4"
            style={{
              background: "linear-gradient(135deg, var(--primary) 0%, #60a5fa 35%, #00e5ff 65%, var(--primary) 100%)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              animation: "gradient-shift 6s ease infinite",
              filter: "drop-shadow(0 0 30px color-mix(in srgb, var(--primary) 25%, transparent))",
            }}
          >
            {t("hero.subtitle")}
          </motion.h1>

          {/* Tagline */}
          <motion.p
            initial="hidden" animate="show" variants={fadeUp}
            transition={{ delay: 0.24 }}
            className="max-w-lg text-sm sm:text-base text-muted-foreground leading-relaxed mb-6"
          >
            {t("hero.desc")}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial="hidden" animate="show" variants={fadeUp}
            transition={{ delay: 0.32 }}
            className="flex flex-wrap items-center gap-2.5 mb-6"
          >
            <Link
              href="/explore"
              className="cyber-btn group"
            >
              <Compass className="h-4 w-4" />
              <span>{t("hero.explore")}</span>
              <ArrowRight className="h-4 w-4 transition-transform rtl:rotate-180 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
            </Link>
            <Link
              href={canUpload ? "/upload" : (user ? "/upload" : "/login")}
              className="cyber-btn-ghost group"
            >
              <Upload className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5" />
              <span>{t("hero.upload") || "Upload ROM"}</span>
            </Link>
          </motion.div>

          {/* Trust strip */}
          <motion.div
            initial="hidden" animate="show" variants={fadeUp}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground/60"
          >
            <span className="flex items-center gap-1.5"><Shield className="h-3 w-3" /> {t("hero.trustSafe")}</span>
            <span className="h-3 w-px bg-border/50" />
            <span className="flex items-center gap-1.5"><Globe className="h-3 w-3" /> {t("hero.trustFree")}</span>
            <span className="h-3 w-px bg-border/50" />
            <span className="flex items-center gap-1.5"><Zap className="h-3 w-3" /> {t("hero.trustLive")}</span>
          </motion.div>
        </div>
      </div>

      {/* Stats bar children slot */}
      {children && (
        <div className="relative z-10 px-3 sm:px-4 lg:px-6 xl:px-8 pb-2">
          {children}
        </div>
      )}
    </section>
  );
}
