"use client";

import { useEffect, useRef } from "react";
import type { CountryData } from "./shared";
import { continentOf, flagOf } from "./shared";

// Continent → angle (radians) on the radar disc.
const CONTINENT_ANGLE: Record<string, number> = {
  "N.America": -Math.PI * 0.65,
  "S.America": -Math.PI * 0.40,
  "Europe":    -Math.PI * 0.95,
  "Africa":    -Math.PI * 0.15,
  "M.East":     Math.PI * 0.05,
  "S.Asia":     Math.PI * 0.20,
  "E.Asia":     Math.PI * 0.45,
  "SE.Asia":    Math.PI * 0.30,
  "C.Asia":     Math.PI * 0.60,
  "Oceania":    Math.PI * 0.75,
  "Other":      Math.PI * 0.90,
};

interface Props {
  countries: CountryData[];
}

/**
 * Canvas-based 360° radar display.
 * Countries are plotted as blips around concentric rings — their angular
 * position is derived from the continent, their radius from count ranking,
 * and their brightness/size from relative activity. A rotating sweep line
 * highlights them as it passes.
 */
export default function RadarScan({ countries }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let cx = 0;
    let cy = 0;
    let maxR = 0;
    let frame = 0;

    // Pre-compute blip positions from data.
    const max = countries[0]?.count || 1;
    type Blip = {
      x: number;
      y: number;
      r: number;
      intensity: number;
      ang: number;
      code: string;
      name: string;
      flag: string;
      count: number;
    };
    let blips: Blip[] = [];

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2;
      cy = H / 2;
      maxR = Math.min(W, H) * 0.46;

      // Recompute blips for new dimensions.
      blips = countries.slice(0, 40).map((c, idx) => {
        const cont = continentOf(c.code);
        const baseAng = CONTINENT_ANGLE[cont] ?? 0;
        // Spread countries in same continent on a small arc.
        const sameCont = countries.filter((x) => continentOf(x.code) === cont);
        const localIdx = sameCont.findIndex((x) => x.code === c.code);
        const spread = (localIdx - (sameCont.length - 1) / 2) * 0.08;
        const ang = baseAng + spread;

        // Rank-based radius: top countries closer to center.
        const rank = idx / Math.max(countries.length - 1, 1);
        const r = maxR * (0.25 + rank * 0.7);

        const intensity = Math.min(c.count / max, 1);
        return {
          x: cx + Math.cos(ang) * r,
          y: cy + Math.sin(ang) * r,
          r,
          intensity,
          ang,
          code: c.code,
          name: c.name,
          flag: flagOf(c.code),
          count: c.count,
        };
      });
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function draw() {
      frame++;
      ctx!.clearRect(0, 0, W, H);

      // Dark radial base.
      const bgGrad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, maxR * 1.2);
      bgGrad.addColorStop(0, "rgba(0,20,30,0.7)");
      bgGrad.addColorStop(1, "rgba(0,2,6,1)");
      ctx!.fillStyle = bgGrad;
      ctx!.fillRect(0, 0, W, H);

      // Concentric rings.
      ctx!.strokeStyle = "rgba(0,245,196,0.12)";
      ctx!.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        ctx!.beginPath();
        ctx!.arc(cx, cy, (maxR * i) / 4, 0, Math.PI * 2);
        ctx!.stroke();
      }

      // Crosshair.
      ctx!.strokeStyle = "rgba(0,245,196,0.06)";
      ctx!.beginPath();
      ctx!.moveTo(cx - maxR, cy);
      ctx!.lineTo(cx + maxR, cy);
      ctx!.moveTo(cx, cy - maxR);
      ctx!.lineTo(cx, cy + maxR);
      ctx!.stroke();

      // Sweep line (rotating).
      const sweepAng = (frame * 0.018) % (Math.PI * 2);
      const sweepGrad = ctx!.createConicGradient(sweepAng, cx, cy);
      sweepGrad.addColorStop(0, "rgba(0,245,196,0.45)");
      sweepGrad.addColorStop(0.08, "rgba(0,245,196,0.15)");
      sweepGrad.addColorStop(0.25, "rgba(0,245,196,0)");
      sweepGrad.addColorStop(1, "rgba(0,245,196,0)");
      ctx!.fillStyle = sweepGrad;
      ctx!.beginPath();
      ctx!.arc(cx, cy, maxR, 0, Math.PI * 2);
      ctx!.fill();

      // Center node (YOU).
      const pulse = Math.sin(frame * 0.08) * 0.5 + 0.5;
      const coreR = 5 + pulse * 2;
      const coreGrad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3);
      coreGrad.addColorStop(0, "rgba(0,245,196,0.9)");
      coreGrad.addColorStop(1, "rgba(0,245,196,0)");
      ctx!.fillStyle = coreGrad;
      ctx!.beginPath();
      ctx!.arc(cx, cy, coreR * 3, 0, Math.PI * 2);
      ctx!.fill();

      ctx!.fillStyle = "#00f5c4";
      ctx!.beginPath();
      ctx!.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx!.fill();

      // Blips.
      blips.forEach((b) => {
        // Distance from sweep (0 = just hit, 1 = far).
        const diff = ((b.ang + Math.PI * 2.5 - sweepAng) % (Math.PI * 2)) / (Math.PI * 2);
        const hot = Math.max(0, 1 - diff * 4); // recent sweep → bright
        const size = 2 + b.intensity * 6 + hot * 3;

        // Halo.
        const halo = ctx!.createRadialGradient(b.x, b.y, 0, b.x, b.y, size * 4);
        halo.addColorStop(0, `rgba(0,245,196,${0.25 + hot * 0.4})`);
        halo.addColorStop(1, "rgba(0,245,196,0)");
        ctx!.fillStyle = halo;
        ctx!.beginPath();
        ctx!.arc(b.x, b.y, size * 4, 0, Math.PI * 2);
        ctx!.fill();

        // Core dot.
        ctx!.fillStyle = `rgba(${hot > 0.3 ? "255,255,255" : "0,245,196"},${0.5 + hot * 0.5})`;
        ctx!.beginPath();
        ctx!.arc(b.x, b.y, size, 0, Math.PI * 2);
        ctx!.fill();

        // Connection line to center for brightest recent blips.
        if (hot > 0.3) {
          ctx!.strokeStyle = `rgba(0,245,196,${hot * 0.35})`;
          ctx!.lineWidth = 1;
          ctx!.beginPath();
          ctx!.moveTo(cx, cy);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();
        }
      });

      // Radial scan lines (subtle static rays).
      ctx!.strokeStyle = "rgba(0,200,255,0.04)";
      ctx!.lineWidth = 0.5;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx!.beginPath();
        ctx!.moveTo(cx, cy);
        ctx!.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
        ctx!.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [countries]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Corner brackets */}
      {(["tl", "tr", "bl", "br"] as const).map((p) => (
        <div
          key={p}
          className={`absolute w-4 h-4 pointer-events-none border-[rgba(0,245,196,0.35)]
          ${p === "tl" ? "top-2 start-2 border-t border-s" : ""}
          ${p === "tr" ? "top-2 end-2 border-t border-e" : ""}
          ${p === "bl" ? "bottom-2 start-2 border-b border-s" : ""}
          ${p === "br" ? "bottom-2 end-2 border-b border-e" : ""}`}
        />
      ))}

      {/* Top-left HUD label */}
      <div className="absolute top-3 left-3 pointer-events-none">
        <p className="text-[8px] font-mono tracking-[0.2em] text-[#00f5c4]/80">RADAR · 360°</p>
        <p className="text-[7px] font-mono tracking-[0.15em] text-white/30 mt-0.5">SWEEP MODE</p>
      </div>

      {/* Range indicator bottom-right */}
      <div className="absolute bottom-3 right-3 text-right pointer-events-none">
        <p className="text-[7px] font-mono tracking-[0.18em] text-white/35">RANGE</p>
        <p className="text-[9px] font-mono tracking-wider text-[#00c8ff] font-black">GLOBAL</p>
      </div>

      {/* Center hint */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-5 pointer-events-none">
        <p className="text-[7px] font-mono tracking-[0.25em] text-[#00f5c4]/60 font-black">
          YOU · ORIGIN
        </p>
      </div>
    </div>
  );
}
