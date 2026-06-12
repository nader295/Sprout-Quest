"use client";

import { MapPin, Signal, Users2 } from "lucide-react";
import type { CountryData } from "./shared";
import { flagOf } from "./shared";

interface Props {
  userCountry: string | null;
  userCountryName: string | null;
  countries: CountryData[];
  nodeStatus: "idle" | "registering" | "live" | "failed";
}

/**
 * Personal "Your Signal" card. Shown to logged-in users once we know their
 * country. Displays their flag, regional rank, peer count, and live status.
 */
export function MySignal({ userCountry, userCountryName, countries, nodeStatus }: Props) {
  if (!userCountry) return null;

  const code = userCountry.toUpperCase();
  const idx = countries.findIndex((c) => c.code.toUpperCase() === code);
  const me = idx >= 0 ? countries[idx] : null;
  const rank = idx >= 0 ? idx + 1 : null;
  const peers = me ? me.count : 0;
  const devs = me ? me.publishers : 0;

  const status =
    nodeStatus === "live"        ? { label: "LIVE",          color: "#00f5c4", pulse: true }
    : nodeStatus === "registering" ? { label: "SYNCING",     color: "#00c8ff", pulse: true }
    : nodeStatus === "failed"    ? { label: "OFFLINE",        color: "#f87171", pulse: false }
    :                              { label: "STANDBY",        color: "#00c8ff", pulse: false };

  return (
    <div className="relative z-10 px-4">
      <div
        className="relative rounded-2xl p-4 overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(0,245,196,0.08) 0%, rgba(0,200,255,0.04) 40%, rgba(0,12,28,0.95) 100%)",
          border: "1px solid rgba(0,245,196,0.2)",
          boxShadow: "0 8px 32px rgba(0,245,196,0.08), inset 0 1px 0 rgba(0,245,196,0.1)",
        }}
      >
        {/* Decorative grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,245,196,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,196,0.04) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
          aria-hidden
        />

        <div className="relative flex items-center gap-4">
          {/* Flag disc */}
          <div
            className="relative shrink-0 rounded-2xl flex items-center justify-center text-3xl"
            style={{
              width: 60,
              height: 60,
              background: "rgba(0,0,0,0.5)",
              border: "1px solid rgba(0,245,196,0.3)",
              boxShadow: "inset 0 0 16px rgba(0,245,196,0.15)",
            }}
          >
            <span aria-hidden>{flagOf(code)}</span>
            <span
              className="absolute -top-1 -right-1 rounded-full flex items-center justify-center"
              style={{
                width: 16,
                height: 16,
                background: status.color,
                boxShadow: `0 0 10px ${status.color}`,
              }}
            >
              {status.pulse && (
                <span
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{ background: status.color, opacity: 0.4 }}
                />
              )}
              <Signal className="h-2.5 w-2.5 text-black relative" strokeWidth={3} />
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <MapPin className="h-3 w-3 text-[#00f5c4]" />
              <span className="text-[8px] font-mono tracking-[0.22em] text-[#00f5c4]/80 font-black">
                YOUR SIGNAL
              </span>
            </div>
            <p className="text-sm font-black text-white truncate">
              {userCountryName || code}
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              {rank !== null && (
                <div className="flex items-center gap-1">
                  <span className="text-[8px] font-mono text-white/40 tracking-wider">RANK</span>
                  <span className="text-[11px] font-black font-mono text-[#fbbf24] tabular-nums">
                    #{rank}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Users2 className="h-3 w-3 text-[#00c8ff]" />
                <span className="text-[11px] font-black font-mono text-[#00c8ff] tabular-nums">
                  {peers.toLocaleString()}
                </span>
                <span className="text-[8px] font-mono text-white/40 tracking-wider">PEERS</span>
              </div>
              {devs > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-black font-mono text-[#a78bfa] tabular-nums">
                    {devs}
                  </span>
                  <span className="text-[8px] font-mono text-white/40 tracking-wider">DEVS</span>
                </div>
              )}
            </div>
          </div>

          {/* Status badge */}
          <div
            className="shrink-0 rounded-lg px-2 py-1 flex flex-col items-center leading-none"
            style={{
              background: "rgba(0,0,0,0.6)",
              border: `1px solid ${status.color}33`,
            }}
          >
            <span
              className="text-[8px] font-black font-mono tracking-[0.15em]"
              style={{ color: status.color }}
            >
              {status.label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
