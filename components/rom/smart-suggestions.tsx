"use client";

import { useEffect, useState } from "react";
import { apiListRoms } from "@/lib/api/client";
import type { RomItem } from "@/lib/types";
import { RomCard, RomCardSkeleton } from "@/components/rom/rom-card";
import { Sparkles, TrendingUp, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export function SmartSuggestions() {
  const { t } = useTranslation();
  const [roms, setRoms] = useState<RomItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Intelligent Personalization Algorithm ──
  useEffect(() => {
    async function fetchSuggestions() {
      try {
        let preferredBrand = "";
        try {
          // Analyze user activity from local storage
          const raw = localStorage.getItem("rx_recently_viewed");
          if (raw) {
            const items = JSON.parse(raw);
            if (Array.isArray(items) && items.length > 0) {
              const brandFreq: Record<string, number> = {};
              items.forEach(i => {
                if (i.brand) brandFreq[i.brand] = (brandFreq[i.brand] || 0) + 1;
              });
              const sortedBrands = Object.entries(brandFreq).sort((a, b) => b[1] - a[1]);
              if (sortedBrands.length > 0) {
                preferredBrand = sortedBrands[0][0];
              }
            }
          }
        } catch {}

        // AI/Smart suggestion logic based on personalization
        const res = await apiListRoms({ 
          sortBy: preferredBrand ? "likes" : "trending", 
          brand: preferredBrand || undefined,
          max: 6 
        });
        if (res?.items) setRoms(res.items);
      } catch (e) {
        console.error("Error fetching suggestions", e);
      } finally {
        setLoading(false);
      }
    }
    fetchSuggestions();
  }, []);

  if (!loading && roms.length === 0) return null;

  return (
    <div className="mb-8 mt-2 fade-in">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 group">
            <Sparkles className="h-4.5 w-4.5 text-indigo-400 group-hover:scale-110 transition-transform duration-300" />
            <div className="absolute inset-0 rounded-xl bg-indigo-500/5 mix-blend-screen opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div>
            <h2 className="text-base font-black text-foreground tracking-tight flex items-center gap-1.5">
              {t("home.smartSuggestions") || "Smart Suggestions"}
              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">AI Rated</span>
            </h2>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-purple-400/70" />
              {t("home.suggestionsDesc") || "Personalized based on your interests and activity"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-4 scrollbar-hide -mx-2 px-2 sm:mx-0 sm:px-0">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="min-w-[280px] sm:min-w-[300px] snap-center shrink-0">
              <RomCardSkeleton />
            </div>
          ))
        ) : (
          roms.map((rom) => (
             <div key={rom.id} className="min-w-[280px] sm:min-w-[300px] max-w-[320px] snap-center shrink-0 hover:-translate-y-1 transition-transform duration-300">
              <RomCard rom={rom} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
