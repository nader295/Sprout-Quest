"use client";

/**
 * TiltCard — wraps children and applies a cursor-reactive 3D tilt with a
 * moving "shine" highlight and a soft glow that tracks the pointer.
 *
 * Designed to be a drop-in upgrade for any card component without changing
 * its markup. Automatically disables on touch devices & reduced-motion.
 *
 * Usage:
 *   <TiltCard>
 *     <div className="rounded-2xl border ..."> ... </div>
 *   </TiltCard>
 */

import { useRef, useCallback, useEffect, type ReactNode, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
  /** Max tilt in degrees. Default: 7 */
  max?: number;
  /** Scale on hover. Default: 1.015 */
  scale?: number;
  /** Accent color for glow/shine. Defaults to primary. */
  color?: string;
  /** Show moving shine highlight. Default: true */
  shine?: boolean;
  /** Show pointer-tracking glow. Default: true */
  glow?: boolean;
};

export default function TiltCard({
  children,
  className,
  max = 7,
  scale = 1.015,
  color,
  shine = true,
  glow = true,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const enabledRef = useRef(true);

  useEffect(() => {
    const mqHover = window.matchMedia("(hover: hover) and (pointer: fine)");
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    enabledRef.current = mqHover.matches && !mqMotion.matches;
  }, []);

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const host = hostRef.current;
      if (!host || !enabledRef.current) return;
      const r = host.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width; // 0..1
      const py = (e.clientY - r.top) / r.height;
      const rx = (0.5 - py) * max;
      const ry = (px - 0.5) * max;
      host.style.setProperty("--tx", `${ry.toFixed(2)}deg`);
      host.style.setProperty("--ty", `${rx.toFixed(2)}deg`);
      host.style.setProperty("--mx", `${(px * 100).toFixed(2)}%`);
      host.style.setProperty("--my", `${(py * 100).toFixed(2)}%`);
      host.style.setProperty("--s", String(scale));
    },
    [max, scale],
  );

  const onLeave = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    host.style.setProperty("--tx", "0deg");
    host.style.setProperty("--ty", "0deg");
    host.style.setProperty("--s", "1");
  }, []);

  return (
    <div
      ref={hostRef}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={cn("tilt-3d relative", className)}
      style={{
        // CSS vars become the source of truth for both transform & overlays
        "--tx": "0deg",
        "--ty": "0deg",
        "--mx": "50%",
        "--my": "50%",
        "--s": "1",
        "--tilt-color": color ?? "var(--primary)",
      } as CSSProperties}
    >
      <div className="tilt-3d-inner">{children}</div>
      {glow && (
        <div
          aria-hidden
          className="tilt-3d-glow pointer-events-none"
        />
      )}
      {shine && (
        <div
          aria-hidden
          className="tilt-3d-shine pointer-events-none"
        />
      )}
    </div>
  );
}
