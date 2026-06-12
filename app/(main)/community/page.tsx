"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/hooks/use-auth";
import { logger } from "@/lib/logger";

import type { CountryData } from "@/components/community/shared";
import { MissionHeader } from "@/components/community/mission-header";
import { ModeSwitcher, type ViewMode } from "@/components/community/mode-switcher";
import { ViewportFrame } from "@/components/community/viewport-frame";
import { GlobalPulse } from "@/components/community/global-pulse";
import { MySignal } from "@/components/community/my-signal";
import { AIInsights } from "@/components/community/ai-insights";
import { TopPodium } from "@/components/community/top-podium";
import { CountryList } from "@/components/community/country-list";
import { ActivityTicker } from "@/components/community/activity-ticker";

// Heavy WebGL / Canvas components — load client-side only.
const GlobeMap = dynamic(
  () => import("@/components/holographic-map/HolographicMap"),
  { ssr: false }
);
const NeuralNetwork = dynamic(
  () => import("@/components/holographic-map/NeuralNetwork"),
  { ssr: false }
);
const RadarScan = dynamic(
  () => import("@/components/community/radar-scan"),
  { ssr: false }
);

const LOCATION_KEY = "romx_location_ts";
const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // one week
const MODE_STORAGE_KEY = "romx_community_mode";

const MODE_LABELS: Record<ViewMode, string> = {
  globe:   "EARTH · 3D",
  scan:    "RADAR · 360°",
  network: "NEURAL · GRAPH",
};

export default function CommunityPage() {
  const { isLoggedIn, userDoc } = useAuth();
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ViewMode>("globe");
  const [nodeStatus, setNodeStatus] = useState<
    "idle" | "registering" | "live" | "failed"
  >("idle");
  const autoRegDone = useRef(false);

  // Restore last chosen mode (client-only, after hydration).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_STORAGE_KEY);
      if (saved === "globe" || saved === "scan" || saved === "network") {
        setMode(saved);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleModeChange = useCallback((m: ViewMode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  // ── Fetch map data ────────────────────────────────────────────────
  const fetchMapData = useCallback(() => {
    fetch("/api/community")
      .then((r) => (r.ok ? r.json() : { countries: [], total: 0 }))
      .then((d) => {
        setCountries(d.countries || []);
        setTotal(d.total || 0);
      })
      .catch((err) => logger.error("community.map.fetch", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  // ── Auto-register user location (weekly refresh) ──────────────────
  const autoRegister = useCallback(async () => {
    if (!isLoggedIn || autoRegDone.current) return;

    const lastTs = parseInt(localStorage.getItem(LOCATION_KEY) || "0", 10);
    const needsRefresh = Date.now() - lastTs > REFRESH_INTERVAL_MS;

    if (userDoc?.showOnMap && !needsRefresh) {
      setNodeStatus("live");
      autoRegDone.current = true;
      return;
    }

    autoRegDone.current = true;
    setNodeStatus("registering");

    try {
      const { auth } = await import("@/lib/firebase/client");
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setNodeStatus("failed");
        return;
      }

      const { detectCountryFromTimezone } = await import("@/lib/timezone-country");
      const detected = detectCountryFromTimezone();

      const res = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "patchLocation",
          country: detected?.code || "",
          countryName: detected?.name || "",
          showOnMap: true,
        }),
      });

      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        if (!json?.skipped) {
          localStorage.setItem(LOCATION_KEY, String(Date.now()));
          setNodeStatus("live");
          fetchMapData();
        } else {
          setNodeStatus("failed");
        }
      } else {
        setNodeStatus("failed");
      }
    } catch {
      setNodeStatus("failed");
    }
  }, [isLoggedIn, userDoc, fetchMapData]);

  useEffect(() => {
    if (isLoggedIn && userDoc !== undefined) autoRegister();
  }, [isLoggedIn, userDoc, autoRegister]);

  // ── Derived values ────────────────────────────────────────────────
  const devs = useMemo(
    () => countries.reduce((s, c) => s + c.publishers, 0),
    [countries],
  );

  const userCountry = (userDoc?.country as string) || null;
  const userCountryName = (userDoc?.countryName as string) || null;

  return (
    <div className="min-h-screen pb-28 bg-[#000206] relative overflow-x-hidden">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-56 z-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 100% at 50% 0%, rgba(0,200,255,0.14) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,245,196,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,196,1) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* 1. Mission header */}
      <MissionHeader total={total} regions={countries.length} loading={loading} />

      {/* 2. Viewport + mode switcher */}
      <ViewportFrame mode={mode.toUpperCase()} label={MODE_LABELS[mode]}>
        {mode === "globe" && <GlobeMap activeCountries={countries} />}
        {mode === "scan" && <RadarScan countries={countries} />}
        {mode === "network" && <NeuralNetwork activeCountries={countries} />}
      </ViewportFrame>

      <div className="h-3" />
      <ModeSwitcher mode={mode} onChange={handleModeChange} />

      <div className="h-4" />

      {/* 3. Stats */}
      <GlobalPulse
        total={total}
        regions={countries.length}
        devs={devs}
        loading={loading}
      />

      {/* 4. Personal signal */}
      {isLoggedIn && userCountry && (
        <>
          <div className="h-3" />
          <MySignal
            userCountry={userCountry}
            userCountryName={userCountryName}
            countries={countries}
            nodeStatus={nodeStatus}
          />
        </>
      )}

      {/* 5. AI insights */}
      {!loading && countries.length > 0 && (
        <>
          <div className="h-4" />
          <AIInsights countries={countries} total={total} />
        </>
      )}

      {/* 6. Activity ticker */}
      {!loading && countries.length > 0 && (
        <>
          <div className="h-3" />
          <ActivityTicker countries={countries} />
        </>
      )}

      {/* 7. Podium */}
      {!loading && countries.length >= 3 && (
        <>
          <div className="h-4" />
          <TopPodium countries={countries} />
        </>
      )}

      {/* 8. Full list */}
      {!loading && countries.length > 0 && (
        <>
          <div className="h-3" />
          <CountryList
            countries={countries}
            userCountryCode={userCountry}
            skipTop={countries.length >= 3 ? 3 : 0}
          />
        </>
      )}

      {/* Empty state */}
      {!loading && countries.length === 0 && (
        <div className="relative z-10 px-4 mt-6">
          <div
            className="rounded-2xl px-4 py-8 text-center"
            style={{
              background: "rgba(0,12,28,0.7)",
              border: "1px dashed rgba(0,200,255,0.2)",
            }}
          >
            <p className="text-xs font-mono text-white/50 tracking-wider">
              NO SIGNALS DETECTED
            </p>
            <p className="text-[10px] font-mono text-white/30 mt-1">
              Network is initializing — check back soon.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
