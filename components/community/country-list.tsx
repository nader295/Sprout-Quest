"use client";

import { List } from "lucide-react";
import type { CountryData } from "./shared";
import { flagOf } from "./shared";

interface Props {
  countries: CountryData[];
  userCountryCode?: string | null;
  /** Number of top rows to skip — usually 3 when the podium already shows them. */
  skipTop?: number;
}

export function CountryList({ countries, userCountryCode, skipTop = 0 }: Props) {
  const rows = countries.slice(skipTop);
  if (!rows.length) return null;

  // Max value for bar scaling (from the visible slice so bars use the full width).
  const max = rows[0]?.count || 1;
  const me = userCountryCode?.toUpperCase();

  return (
    <div className="relative z-10 px-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <List className="h-3 w-3 text-[#00c8ff]" />
          <span className="text-[9px] font-mono tracking-[0.22em] text-[#00c8ff]/80 font-black">
            ALL REGIONS
          </span>
        </div>
        <span className="text-[9px] font-mono tracking-wider text-white/30">
          {rows.length} {rows.length === 1 ? "ENTRY" : "ENTRIES"}
        </span>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "rgba(0,8,18,0.7)",
          border: "1px solid rgba(0,200,255,0.08)",
        }}
      >
        <ul className="divide-y divide-[rgba(0,200,255,0.06)]">
          {rows.map((c, i) => {
            const rank = skipTop + i + 1;
            const width = Math.max(2, Math.round((c.count / max) * 100));
            const isMe = me && c.code.toUpperCase() === me;
            return (
              <li
                key={c.code}
                className="relative px-3 py-2.5 transition-colors"
                style={{
                  background: isMe ? "rgba(0,245,196,0.06)" : "transparent",
                }}
              >
                {/* Pulse bar (background) */}
                <div
                  className="absolute inset-y-0 left-0 rounded-r-xl opacity-40"
                  style={{
                    width: `${width}%`,
                    background:
                      "linear-gradient(90deg, rgba(0,200,255,0.12) 0%, transparent 100%)",
                  }}
                  aria-hidden
                />

                <div className="relative flex items-center gap-3">
                  {/* Rank */}
                  <span
                    className="text-[10px] font-mono font-black tabular-nums w-6 shrink-0 text-right"
                    style={{ color: isMe ? "#00f5c4" : "rgba(0,200,255,0.45)" }}
                  >
                    {String(rank).padStart(2, "0")}
                  </span>

                  {/* Flag */}
                  <span className="text-lg leading-none shrink-0" aria-hidden>
                    {flagOf(c.code)}
                  </span>

                  {/* Name + devs */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate leading-tight">
                      {c.name}
                      {isMe && (
                        <span className="ml-1.5 text-[7px] font-mono tracking-[0.2em] text-[#00f5c4] align-middle">
                          · YOU
                        </span>
                      )}
                    </p>
                    <p className="text-[9px] font-mono text-white/35 mt-0.5">
                      {c.publishers > 0 ? (
                        <>
                          <span className="text-[#a78bfa]">
                            {c.publishers} DEV{c.publishers > 1 ? "S" : ""}
                          </span>
                          <span className="mx-1.5 text-white/20">·</span>
                          <span>{c.code}</span>
                        </>
                      ) : (
                        <span>{c.code}</span>
                      )}
                    </p>
                  </div>

                  {/* Count */}
                  <span className="text-sm font-black font-mono tabular-nums text-[#00c8ff] shrink-0">
                    {c.count.toLocaleString()}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
