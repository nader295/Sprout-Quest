"use client";

import { Globe, Radar, Cpu } from "lucide-react";

export type ViewMode = "globe" | "scan" | "network";

const MODES: {
  id: ViewMode;
  icon: typeof Globe;
  label: string;
  sub: string;
}[] = [
  { id: "globe",   icon: Globe, label: "GLOBE",   sub: "3D Earth"      },
  { id: "scan",    icon: Radar, label: "SCAN",    sub: "Radar view"    },
  { id: "network", icon: Cpu,   label: "NETWORK", sub: "Neural graph"  },
];

export function ModeSwitcher({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  return (
    <div className="relative z-10 px-4">
      <div className="rounded-2xl border border-[#00c8ff]/12 bg-[rgba(0,8,20,0.7)] p-1 grid grid-cols-3 gap-1">
        {MODES.map((m) => {
          const active = mode === m.id;
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              aria-pressed={active}
              aria-label={`Switch to ${m.label} view`}
              className="relative rounded-xl py-2.5 px-2 flex flex-col items-center justify-center gap-1 transition-all duration-200 overflow-hidden"
              style={{
                background: active ? "rgba(0,245,196,0.10)" : "transparent",
                border: `1px solid ${active ? "rgba(0,245,196,0.35)" : "transparent"}`,
                boxShadow: active ? "inset 0 0 16px rgba(0,245,196,0.08)" : "none",
              }}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-3 top-0 h-px"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(0,245,196,0.8), transparent)",
                  }}
                />
              )}
              <Icon
                className="h-3.5 w-3.5"
                style={{ color: active ? "#00f5c4" : "rgba(0,200,255,0.5)" }}
              />
              <span
                className="text-[9px] font-black font-mono tracking-[0.15em]"
                style={{ color: active ? "#00f5c4" : "rgba(0,200,255,0.55)" }}
              >
                {m.label}
              </span>
              <span
                className="text-[7px] font-mono tracking-wide"
                style={{ color: active ? "rgba(0,245,196,0.6)" : "rgba(255,255,255,0.25)" }}
              >
                {m.sub}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
