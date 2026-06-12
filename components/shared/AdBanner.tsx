"use client";

import { useEffect, useRef, useState } from "react";

type AdSize = "banner" | "rectangle" | "leaderboard" | "responsive";

interface AdBannerProps {
  slot: string;          // AdSense ad-slot ID
  size?: AdSize;
  className?: string;
  label?: boolean;       // Show "Advertisement" label
}

const SIZE_MAP: Record<AdSize, { width: number; height: number; style: string }> = {
  banner:      { width: 728, height: 90,  style: "min-h-[90px]" },
  rectangle:   { width: 300, height: 250, style: "min-h-[250px]" },
  leaderboard: { width: 970, height: 90,  style: "min-h-[90px]" },
  responsive:  { width: 0,   height: 0,   style: "min-h-[100px]" },
};

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

export function AdBanner({ slot, size = "responsive", className = "", label = true }: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const pushedRef = useRef(false);

  useEffect(() => {
    if (pushedRef.current) return;
    pushedRef.current = true;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      // Check if ad filled after 2s
      setTimeout(() => {
        const el = adRef.current;
        if (!el) return;
        const h = el.offsetHeight;
        if (h > 10) {
          setLoaded(true);
        } else {
          // AdSense didn't fill — try Media.net fallback
          setFailed(true);
        }
      }, 2000);
    } catch (err) {
      console.warn("[AdBanner] push error:", err);
      setFailed(true);
    }
  }, []);

  const { style } = SIZE_MAP[size];
  const isResponsive = size === "responsive";

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      {label && (
        <span className="mb-1 text-[9px] font-medium uppercase tracking-widest text-muted-foreground/40 select-none">
          Advertisement
        </span>
      )}

      {/* ── Primary: Google AdSense ── */}
      {!failed && (
        <ins
          ref={adRef}
          className={`adsbygoogle block w-full ${style}`}
          style={{ display: "block" }}
          data-ad-client="ca-pub-3751919116318287"
          data-ad-slot={slot}
          data-ad-format={isResponsive ? "auto" : undefined}
          data-full-width-responsive={isResponsive ? "true" : undefined}
        />
      )}

      {/* ── Fallback: Media.net — يشتغل لو AdSense ما ملاش ── */}
      {failed && (
        <MediaNetFallback size={size} />
      )}
    </div>
  );
}

/** Media.net fallback placeholder — استبدله بـ Media.net script الفعلي بعد التسجيل */
function MediaNetFallback({ size }: { size: AdSize }) {
  const { style } = SIZE_MAP[size];
  return (
    <div
      className={`w-full ${style} flex items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/20`}
      aria-hidden
    >
      <span className="text-[10px] text-muted-foreground/30 select-none">Ad</span>
    </div>
  );
}

/** Banner أفقي بسيط بين الكاردز في الـ Feed */
export function FeedAdBanner() {
  return (
    <div className="col-span-full my-1">
      <AdBanner
        slot="7234567890"   // ← استبدل بالـ slot ID بعد إنشائه في AdSense
        size="responsive"
        className="rounded-2xl overflow-hidden border border-border/30 bg-card/50 px-2 py-1"
      />
    </div>
  );
}

/** Banner في صفحة الـ ROM — بين الأقسام */
export function RomPageAdBanner() {
  return (
    <AdBanner
      slot="8345678901"   // ← استبدل بالـ slot ID
      size="responsive"
      className="my-3 rounded-2xl overflow-hidden border border-border/30 bg-card/50 px-2 py-1"
    />
  );
}
