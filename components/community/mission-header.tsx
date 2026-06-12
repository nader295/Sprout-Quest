"use client";

import { useEffect, useState } from "react";
import { Radio, Satellite, Wifi } from "lucide-react";

// Four reference cities scanned by the "global observer".
const CITIES: { code: string; tz: string; label: string }[] = [
  { code: "NYC", tz: "America/New_York", label: "NEW YORK" },
  { code: "LDN", tz: "Europe/London",    label: "LONDON" },
  { code: "TYO", tz: "Asia/Tokyo",       label: "TOKYO" },
  { code: "DXB", tz: "Asia/Dubai",       label: "DUBAI" },
];

function formatTime(tz: string, now: Date) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(now);
  } catch {
    return "--:--";
  }
}

interface Props {
  total: number;
  regions: number;
  loading: boolean;
}

export function MissionHeader({ total, regions, loading }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative z-10">
      {/* Status bar */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00f5c4] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00f5c4]" />
          </span>
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#00f5c4] font-mono">
            SYS · LINK ESTABLISHED
          </p>
        </div>
        <div className="flex items-center gap-1 text-[#00c8ff]/70">
          <Wifi className="h-3 w-3" />
          <span className="text-[9px] font-mono tracking-wider">99.8%</span>
        </div>
      </div>

      {/* Title block */}
      <div className="px-4 pb-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#00c8ff]/50 font-mono mb-1">
              ROMX GLOBAL OBSERVATORY
            </p>
            <h1 className="text-[26px] leading-none font-black text-white font-mono tracking-tight">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Radio className="h-5 w-5 text-[#00c8ff] animate-pulse" />
                  SCANNING_
                </span>
              ) : (
                <>
                  <span className="text-[#00f5c4]">{total.toLocaleString()}</span>
                  <span className="text-white/30"> / </span>
                  <span className="text-[#00c8ff]">{regions}</span>
                </>
              )}
            </h1>
            {!loading && (
              <p className="text-[10px] text-white/40 mt-1.5 tracking-wide">
                nodes active across regions worldwide
              </p>
            )}
          </div>
          <Satellite className="h-6 w-6 text-[#00f5c4]/40 shrink-0 animate-pulse" />
        </div>
      </div>

      {/* World clock row */}
      <div className="mx-4 mb-3 rounded-xl border border-[#00c8ff]/10 bg-[rgba(0,12,28,0.6)] px-2 py-1.5">
        <div className="grid grid-cols-4 gap-1">
          {CITIES.map((c) => (
            <div key={c.code} className="flex flex-col items-center leading-none py-1">
              <span className="text-[7px] font-mono tracking-[0.18em] text-white/35 mb-1">
                {c.label}
              </span>
              <span className="text-[13px] font-black font-mono tabular-nums text-[#00c8ff]">
                {formatTime(c.tz, now)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
