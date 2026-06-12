"use client";

import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import type { CountryData } from "./shared";
import { flagOf } from "./shared";

interface Props {
  countries: CountryData[];
}

interface Event {
  id: number;
  flag: string;
  msg: string;
}

const TEMPLATES = [
  (name: string) => `+1 node joined from ${name}`,
  (name: string) => `Dev published from ${name}`,
  (name: string) => `New signal online · ${name}`,
  (name: string) => `${name} activity rising`,
  (name: string) => `${name} is trending now`,
  (name: string) => `Contributor verified · ${name}`,
];

/**
 * Compact live activity ticker. Generates plausible events from the
 * existing country list (biased toward larger populations) and cycles
 * them in every few seconds. Purely visual — no backend write.
 */
export function ActivityTicker({ countries }: Props) {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (!countries.length) return;

    // Weighted pool: repeat each country proportionally to its count (capped).
    const pool: CountryData[] = [];
    countries.forEach((c) => {
      const weight = Math.min(Math.max(1, Math.round(Math.log2(c.count + 1))), 6);
      for (let i = 0; i < weight; i++) pool.push(c);
    });

    let id = 0;
    const make = (): Event => {
      const c = pool[Math.floor(Math.random() * pool.length)];
      const tpl = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
      return { id: ++id, flag: flagOf(c.code), msg: tpl(c.name) };
    };

    // Seed 3 events.
    setEvents([make(), make(), make()]);

    const interval = setInterval(() => {
      setEvents((prev) => {
        const next = [make(), ...prev];
        return next.slice(0, 4);
      });
    }, 3200);

    return () => clearInterval(interval);
  }, [countries]);

  if (!events.length) return null;

  return (
    <div className="relative z-10 px-4">
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "rgba(0,8,18,0.7)",
          border: "1px solid rgba(0,245,196,0.12)",
        }}
      >
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[rgba(0,245,196,0.08)] bg-[rgba(0,245,196,0.03)]">
          <Radio className="h-3 w-3 text-[#00f5c4] animate-pulse" />
          <span className="text-[9px] font-mono tracking-[0.22em] text-[#00f5c4] font-black">
            LIVE ACTIVITY FEED
          </span>
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#00f5c4] shadow-[0_0_6px_#00f5c4] animate-pulse" />
        </div>

        <ul className="px-3 py-2 space-y-1.5 min-h-[96px]">
          {events.map((e, i) => (
            <li
              key={e.id}
              className="flex items-center gap-2 text-xs transition-all duration-500"
              style={{
                opacity: 1 - i * 0.22,
                transform: `translateY(${i === 0 ? 0 : 0}px)`,
              }}
            >
              <span
                className="h-1 w-1 rounded-full shrink-0"
                style={{
                  background: i === 0 ? "#00f5c4" : "rgba(0,200,255,0.3)",
                  boxShadow: i === 0 ? "0 0 6px #00f5c4" : "none",
                }}
              />
              <span className="text-sm leading-none shrink-0" aria-hidden>
                {e.flag}
              </span>
              <span className="text-[11px] font-mono text-white/80 truncate tracking-wide">
                {e.msg}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
