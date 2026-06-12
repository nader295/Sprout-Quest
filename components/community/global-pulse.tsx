"use client";

import { Activity, Globe2, Cpu, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  total: number;
  regions: number;
  devs: number;
  loading: boolean;
}

/**
 * Animated counter that eases from 0 to the target value on mount / when
 * the value changes. Keeps the motion short (600ms) so repeated data
 * refreshes don't feel noisy.
 */
function Counter({ value, loading }: { value: number; loading: boolean }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (loading) return;
    const start = performance.now();
    const duration = 600;
    const from = display;
    const to = value;

    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      // easeOutQuart
      const eased = 1 - Math.pow(1 - p, 4);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `display` intentionally omitted — we want the start value at effect time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, loading]);

  if (loading) return <span className="text-white/30">---</span>;
  return <>{display.toLocaleString()}</>;
}

export function GlobalPulse({ total, regions, devs, loading }: Props) {
  // Dev saturation = how many of the nodes are also publishers.
  const devRatio = total > 0 ? Math.min(devs / total, 1) : 0;
  const pct = Math.round(devRatio * 100);

  const stats = [
    { icon: Activity, label: "NODES",   value: total,   color: "#00c8ff" },
    { icon: Globe2,   label: "REGIONS", value: regions, color: "#00f5c4" },
    { icon: Cpu,      label: "DEVS",    value: devs,    color: "#a78bfa" },
  ];

  return (
    <div className="relative z-10 px-4 space-y-2">
      {/* Main stats strip */}
      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="relative rounded-2xl px-3 py-3 overflow-hidden"
              style={{
                background: "rgba(0,12,28,0.72)",
                border: "1px solid rgba(0,200,255,0.08)",
              }}
            >
              {/* Accent top-line */}
              <span
                aria-hidden
                className="absolute inset-x-4 top-0 h-px"
                style={{
                  background: `linear-gradient(90deg, transparent, ${s.color}, transparent)`,
                  opacity: 0.5,
                }}
              />
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className="h-3 w-3" style={{ color: s.color }} />
                <span className="text-[8px] font-mono tracking-[0.2em] text-white/40">
                  {s.label}
                </span>
              </div>
              <p
                className="text-[22px] leading-none font-black font-mono tabular-nums"
                style={{ color: s.color }}
              >
                <Counter value={s.value} loading={loading} />
              </p>
            </div>
          );
        })}
      </div>

      {/* Dev saturation bar */}
      {!loading && (
        <div
          className="rounded-2xl px-3 py-2.5"
          style={{
            background: "rgba(0,12,28,0.72)",
            border: "1px solid rgba(167,139,250,0.12)",
          }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3 text-[#a78bfa]" />
              <span className="text-[9px] font-mono tracking-[0.15em] text-white/50">
                DEVELOPER SATURATION
              </span>
            </div>
            <span className="text-[10px] font-mono font-black text-[#a78bfa] tabular-nums">
              {pct}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-black/60 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${pct}%`,
                background:
                  "linear-gradient(90deg, rgba(167,139,250,0.3), #a78bfa, #00c8ff)",
                boxShadow: "0 0 12px rgba(167,139,250,0.5)",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
