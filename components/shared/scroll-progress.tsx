"use client";

/**
 * ScrollProgress — a top-of-viewport gradient ribbon that grows horizontally
 * as the user scrolls. Includes a trailing glow node at the leading edge
 * and a soft shimmer sweep animation.
 *
 * Lightweight: single rAF-throttled scroll listener, compositor-only transform.
 */

import { useEffect, useRef } from "react";

export default function ScrollProgress() {
  const barRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const bar = barRef.current;
    const dot = dotRef.current;
    if (!bar || !dot) return;

    let ticking = false;
    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const pct = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.transform = `scaleX(${pct})`;
      dot.style.left = `calc(${pct * 100}% - 6px)`;
      dot.style.opacity = pct > 0.01 && pct < 0.995 ? "1" : "0";
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[120] h-[3px] overflow-visible"
    >
      {/* Track (barely visible) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--primary) 8%, transparent) 50%, transparent 100%)",
        }}
      />
      {/* Fill bar — scales from left */}
      <div
        ref={barRef}
        className="absolute inset-y-0 left-0 right-0 origin-left"
        style={{
          transform: "scaleX(0)",
          background:
            "linear-gradient(90deg, var(--primary) 0%, #60a5fa 40%, #00e5ff 75%, var(--primary) 100%)",
          backgroundSize: "200% 100%",
          animation: "gradient-shift 5s ease infinite",
          boxShadow: "0 0 10px color-mix(in srgb, var(--primary) 60%, transparent)",
          willChange: "transform",
        }}
      />
      {/* Leading-edge glow dot */}
      <div
        ref={dotRef}
        className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full opacity-0 transition-opacity duration-200"
        style={{
          background: "var(--primary)",
          boxShadow:
            "0 0 12px var(--primary), 0 0 22px color-mix(in srgb, var(--primary) 60%, transparent)",
        }}
      />
    </div>
  );
}
