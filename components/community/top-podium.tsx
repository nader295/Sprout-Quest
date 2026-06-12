"use client";

import { Trophy } from "lucide-react";
import type { CountryData } from "./shared";
import { flagOf } from "./shared";

interface Props {
  countries: CountryData[];
}

type PodiumTier = {
  rank: 1 | 2 | 3;
  height: string;
  color: string;
  medal: string;
  label: string;
};

const TIERS: PodiumTier[] = [
  // Visual order: silver (left) — gold (center) — bronze (right).
  { rank: 2, height: "h-20", color: "#c0c0d6", medal: "●●", label: "SILVER" },
  { rank: 1, height: "h-28", color: "#fbbf24", medal: "★★★", label: "GOLD" },
  { rank: 3, height: "h-16", color: "#d97757", medal: "●",   label: "BRONZE" },
];

export function TopPodium({ countries }: Props) {
  if (countries.length < 3) return null;
  const top3 = countries.slice(0, 3);

  return (
    <div className="relative z-10 px-4">
      <div className="flex items-center gap-1.5 mb-3">
        <Trophy className="h-3 w-3 text-[#fbbf24]" />
        <span className="text-[9px] font-mono tracking-[0.22em] text-[#fbbf24]/80 font-black">
          TOP REGIONS
        </span>
      </div>

      <div
        className="relative rounded-2xl px-3 pt-4 pb-3 overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, rgba(251,191,36,0.04) 0%, rgba(0,12,28,0.9) 80%)",
          border: "1px solid rgba(251,191,36,0.15)",
        }}
      >
        {/* Glow */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-24 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 100% at 50% 0%, rgba(251,191,36,0.15) 0%, transparent 70%)",
          }}
        />

        <div className="relative grid grid-cols-3 gap-2 items-end">
          {TIERS.map((tier) => {
            const country = top3[tier.rank - 1];
            if (!country) return <div key={tier.rank} />;
            return (
              <div key={tier.rank} className="flex flex-col items-center">
                {/* Flag circle */}
                <div
                  className="relative rounded-full flex items-center justify-center text-2xl mb-1.5"
                  style={{
                    width: tier.rank === 1 ? 52 : 44,
                    height: tier.rank === 1 ? 52 : 44,
                    background: "rgba(0,0,0,0.6)",
                    border: `2px solid ${tier.color}`,
                    boxShadow: `0 0 16px ${tier.color}55`,
                  }}
                >
                  <span aria-hidden>{flagOf(country.code)}</span>
                  <span
                    className="absolute -top-1.5 -right-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-black font-mono leading-none"
                    style={{
                      background: tier.color,
                      color: "#000",
                      boxShadow: `0 0 8px ${tier.color}80`,
                    }}
                  >
                    #{tier.rank}
                  </span>
                </div>

                {/* Country name */}
                <p className="text-[10px] font-black text-white text-center leading-tight mb-0.5 line-clamp-1 w-full">
                  {country.name}
                </p>
                <p
                  className="text-[11px] font-black font-mono tabular-nums leading-none"
                  style={{ color: tier.color }}
                >
                  {country.count.toLocaleString()}
                </p>
                <p className="text-[7px] font-mono tracking-[0.15em] text-white/30 mb-1.5">
                  NODES
                </p>

                {/* Podium step */}
                <div
                  className={`w-full ${tier.height} rounded-t-lg relative overflow-hidden`}
                  style={{
                    background: `linear-gradient(180deg, ${tier.color}30 0%, ${tier.color}10 100%)`,
                    border: `1px solid ${tier.color}40`,
                    borderBottom: "none",
                  }}
                >
                  <span
                    aria-hidden
                    className="absolute inset-x-2 top-0 h-px"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${tier.color}, transparent)`,
                    }}
                  />
                  <div className="absolute inset-x-0 top-1.5 flex justify-center">
                    <span
                      className="text-[9px] font-mono tracking-widest font-black"
                      style={{ color: tier.color }}
                    >
                      {tier.medal}
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-1 flex justify-center">
                    <span
                      className="text-[7px] font-mono tracking-[0.2em] font-black"
                      style={{ color: `${tier.color}aa` }}
                    >
                      {tier.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
