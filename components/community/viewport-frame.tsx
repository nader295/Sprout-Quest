"use client";

import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  label: string;
  mode: string;
}

/**
 * Cinematic viewport frame wrapping the globe/radar/network stage. Adds
 * HUD brackets, scan lines, corner metadata, and a stable height so
 * swapping modes doesn't cause layout jumps.
 */
export function ViewportFrame({ children, label, mode }: Props) {
  return (
    <div className="relative z-10">
      {/* Header strip */}
      <div className="flex items-center justify-between px-4 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#00f5c4] shadow-[0_0_6px_#00f5c4] animate-pulse" />
          <span className="text-[8px] font-mono tracking-[0.22em] text-[#00f5c4] font-black">
            VIEWPORT · {mode}
          </span>
        </div>
        <span className="text-[8px] font-mono tracking-[0.2em] text-white/30 font-black">
          {label}
        </span>
      </div>

      <div
        className="relative w-full overflow-hidden mx-auto"
        style={{
          height: "clamp(340px, 92vw, 460px)",
          maxWidth: 640,
          background: "#000",
          borderTop: "1px solid rgba(0,245,196,0.25)",
          borderBottom: "1px solid rgba(0,245,196,0.25)",
        }}
      >
        {/* Scan line animation */}
        <div
          aria-hidden
          className="absolute inset-x-0 h-px pointer-events-none z-20 opacity-70"
          style={{
            top: 0,
            background:
              "linear-gradient(90deg, transparent, rgba(0,245,196,0.8), transparent)",
            animation: "scanline 4s linear infinite",
          }}
        />

        {/* Stage */}
        <div className="absolute inset-0">{children}</div>

        {/* Corner brackets (outside canvas, HUD style) */}
        {(["tl", "tr", "bl", "br"] as const).map((p) => (
          <div
            key={p}
            className={`absolute w-5 h-5 pointer-events-none z-10 border-[rgba(0,245,196,0.7)]
            ${p === "tl" ? "top-2 left-2 border-t-2 border-l-2" : ""}
            ${p === "tr" ? "top-2 right-2 border-t-2 border-r-2" : ""}
            ${p === "bl" ? "bottom-2 left-2 border-b-2 border-l-2" : ""}
            ${p === "br" ? "bottom-2 right-2 border-b-2 border-r-2" : ""}`}
          />
        ))}

        {/* Side rails */}
        <div
          aria-hidden
          className="absolute top-10 bottom-10 left-1 w-px pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, transparent, rgba(0,245,196,0.25), transparent)",
          }}
        />
        <div
          aria-hidden
          className="absolute top-10 bottom-10 right-1 w-px pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, transparent, rgba(0,245,196,0.25), transparent)",
          }}
        />
      </div>

      <style jsx>{`
        @keyframes scanline {
          0%   { top: 0%;   opacity: 0; }
          10%  {            opacity: 0.6; }
          90%  {            opacity: 0.6; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
