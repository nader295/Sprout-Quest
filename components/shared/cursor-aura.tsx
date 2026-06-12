"use client";

/**
 * CursorAura — a global, GPU-cheap cursor-following spotlight that adds
 * depth and "alive" feeling to every page. Also renders a tiny reactive
 * halo ring that subtly grows when hovering interactive elements.
 *
 * • Disabled on touch-only devices (no hover support)
 * • Disabled under prefers-reduced-motion
 * • Pointer-events: none (never blocks interaction)
 * • Uses only transform/opacity for compositor-only animation
 */

import { useEffect, useRef, useState } from "react";

export default function CursorAura() {
  const auraRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const trailRef = useRef<HTMLDivElement | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // Only enable on fine-pointer devices without reduced motion
    const mqHover = window.matchMedia("(hover: hover) and (pointer: fine)");
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = mqHover.matches && !mqMotion.matches;
    setEnabled(on);
    if (!on) return;

    const aura = auraRef.current;
    const ring = ringRef.current;
    const trail = trailRef.current;
    if (!aura || !ring || !trail) return;

    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const target = { x: pos.x, y: pos.y };
    const ringPos = { x: pos.x, y: pos.y };
    const trailPos = { x: pos.x, y: pos.y };
    let hoverScale = 1;
    let pressScale = 1;
    let raf = 0;
    let visible = false;

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      if (!visible) {
        visible = true;
        aura.style.opacity = "1";
        ring.style.opacity = "1";
        trail.style.opacity = "1";
      }

      // Magnetic hover detection — scale ring when near an interactive element
      const el = e.target as HTMLElement | null;
      const interactive = el?.closest(
        'a, button, [role="button"], input, select, textarea, [data-magnet], .cursor-aura-target',
      );
      hoverScale = interactive ? 1.8 : 1;
    };

    const onLeave = () => {
      visible = false;
      aura.style.opacity = "0";
      ring.style.opacity = "0";
      trail.style.opacity = "0";
    };

    const onDown = () => {
      pressScale = 0.7;
    };
    const onUp = () => {
      pressScale = 1;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });

    const loop = () => {
      // Big soft aura — follows immediately (feels more present)
      pos.x += (target.x - pos.x) * 0.18;
      pos.y += (target.y - pos.y) * 0.18;
      // Small ring — slightly laggier for a layered feel
      ringPos.x += (target.x - ringPos.x) * 0.28;
      ringPos.y += (target.y - ringPos.y) * 0.28;
      // Trailing dot — slow, dreamy
      trailPos.x += (target.x - trailPos.x) * 0.09;
      trailPos.y += (target.y - trailPos.y) * 0.09;

      aura.style.transform = `translate3d(${pos.x - 240}px, ${pos.y - 240}px, 0)`;
      const ringS = hoverScale * pressScale;
      ring.style.transform = `translate3d(${ringPos.x - 16}px, ${ringPos.y - 16}px, 0) scale(${ringS})`;
      trail.style.transform = `translate3d(${trailPos.x - 4}px, ${trailPos.y - 4}px, 0)`;

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      {/* Big soft aura — the ambient light */}
      <div
        ref={auraRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 h-[480px] w-[480px] rounded-full opacity-0 transition-opacity duration-300 mix-blend-screen"
        style={{
          zIndex: 60,
          background:
            "radial-gradient(circle at center, color-mix(in srgb, var(--primary) 20%, transparent) 0%, color-mix(in srgb, var(--primary) 6%, transparent) 30%, transparent 65%)",
          filter: "blur(8px)",
          willChange: "transform",
        }}
      />
      {/* Sharp ring — reactive to hover */}
      <div
        ref={ringRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 h-8 w-8 rounded-full opacity-0 transition-[opacity,scale] duration-200"
        style={{
          zIndex: 61,
          border: "1.5px solid color-mix(in srgb, var(--primary) 60%, transparent)",
          boxShadow:
            "0 0 14px color-mix(in srgb, var(--primary) 40%, transparent), inset 0 0 8px color-mix(in srgb, var(--primary) 18%, transparent)",
          backdropFilter: "blur(2px)",
          willChange: "transform",
        }}
      />
      {/* Small trail dot */}
      <div
        ref={trailRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 h-2 w-2 rounded-full opacity-0 transition-opacity duration-300"
        style={{
          zIndex: 62,
          background: "var(--primary)",
          boxShadow: "0 0 10px var(--primary), 0 0 20px color-mix(in srgb, var(--primary) 50%, transparent)",
          willChange: "transform",
        }}
      />
    </>
  );
}
