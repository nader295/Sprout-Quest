"use client";

import { useMemo } from "react";
import { Sparkles, Flame, Zap, Crown } from "lucide-react";
import type { CountryData } from "./shared";
import { continentOf, flagOf } from "./shared";

interface Props {
  countries: CountryData[];
  total: number;
}

/**
 * Derives 3 insight cards from aggregate country data. Purely client-side
 * so no new backend endpoint is needed yet — all numbers come from the
 * existing /api/community payload.
 */
export function AIInsights({ countries, total }: Props) {
  const insights = useMemo(() => {
    if (!countries.length) return null;

    // 1. Apex region — the #1 country.
    const apex = countries[0];

    // 2. Dev hotspot — country with highest publisher/user ratio (min 3 users).
    const eligible = countries.filter((c) => c.count >= 3);
    const hotspot = eligible
      .map((c) => ({ ...c, ratio: c.count > 0 ? c.publishers / c.count : 0 }))
      .sort((a, b) => b.ratio - a.ratio)[0];

    // 3. Rising continent — which continent holds the largest share.
    const byContinent: Record<string, number> = {};
    countries.forEach((c) => {
      const k = continentOf(c.code);
      byContinent[k] = (byContinent[k] || 0) + c.count;
    });
    const [topContinent, topContinentShare] = Object.entries(byContinent).sort(
      (a, b) => b[1] - a[1],
    )[0] ?? ["—", 0];

    const continentPct = total > 0 ? Math.round((topContinentShare / total) * 100) : 0;

    return { apex, hotspot, topContinent, continentPct };
  }, [countries, total]);

  if (!insights) return null;

  const cards = [
    {
      icon: Crown,
      tag: "APEX",
      color: "#fbbf24",
      title: insights.apex.name,
      flag: flagOf(insights.apex.code),
      value: insights.apex.count.toLocaleString(),
      unit: "nodes",
      caption: "leads the network",
    },
    ...(insights.hotspot
      ? [
          {
            icon: Flame,
            tag: "HOTSPOT",
            color: "#a78bfa",
            title: insights.hotspot.name,
            flag: flagOf(insights.hotspot.code),
            value: `${Math.round((insights.hotspot.publishers / insights.hotspot.count) * 100)}%`,
            unit: "devs",
            caption: "dev density",
          },
        ]
      : []),
    {
      icon: Zap,
      tag: "REGION",
      color: "#00f5c4",
      title: insights.topContinent,
      flag: "🌍",
      value: `${insights.continentPct}%`,
      unit: "share",
      caption: "of global nodes",
    },
  ];

  return (
    <div className="relative z-10 px-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="h-3 w-3 text-[#00f5c4]" />
        <span className="text-[9px] font-mono tracking-[0.22em] text-[#00f5c4]/80 font-black">
          INTEL FEED
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.tag}
              className="relative rounded-2xl p-2.5 overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${c.color}12 0%, rgba(0,12,28,0.85) 70%)`,
                border: `1px solid ${c.color}30`,
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <Icon className="h-3 w-3" style={{ color: c.color }} />
                <span
                  className="text-[7px] font-mono tracking-[0.18em] font-black"
                  style={{ color: c.color }}
                >
                  {c.tag}
                </span>
              </div>
              <div className="flex items-center gap-1 mb-1">
                <span className="text-sm leading-none" aria-hidden>{c.flag}</span>
                <p className="text-[9px] font-bold text-white/90 truncate">{c.title}</p>
              </div>
              <p
                className="text-lg leading-none font-black font-mono tabular-nums"
                style={{ color: c.color }}
              >
                {c.value}
                <span className="text-[8px] font-normal text-white/40 ml-1">{c.unit}</span>
              </p>
              <p className="text-[8px] font-mono text-white/35 mt-1 tracking-wide truncate">
                {c.caption}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
