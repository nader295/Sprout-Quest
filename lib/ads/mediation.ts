/**
 * Ad Mediation Engine — Real VAST Video Ad System
 * Revenue: 90% → Developer, 10% → Platform
 *
 * Networks:
 *  - HilltopAds VAST  → Real in-page video 15/30s (highest CPM)
 *  - Monetag OnClick  → Fallback
 */

export interface AdNetwork {
  id: string;
  name: string;
  cpmByTier: { tier1: number; tier2: number; tier3: number };
  enabled: boolean;
  scriptUrl?: string;
  zoneId?: string;
  vastTagUrl?: string;
  adType?: "vast" | "onclick";
  config?: Record<string, string>;
}

export interface AdCandidate {
  network: AdNetwork;
  estimatedCpm: number;
  estimatedPerView: number;
}

const TIER1_COUNTRIES = new Set([
  "US","GB","CA","AU","DE","FR","NL","SE","NO","DK","FI",
  "CH","AT","BE","IE","NZ","JP","KR","SG","IL",
]);
const TIER2_COUNTRIES = new Set([
  "BR","IN","TR","EG","SA","AE","PK","ID","MY","TH","VN",
  "PH","MX","AR","CL","CO","PE","ZA","NG","KE","UA","PL",
  "CZ","RO","HU","RU","TW","HK",
]);

export function getCountryTier(cc: string): "tier1" | "tier2" | "tier3" {
  const c = cc.toUpperCase();
  if (TIER1_COUNTRIES.has(c)) return "tier1";
  if (TIER2_COUNTRIES.has(c)) return "tier2";
  return "tier3";
}

export const DEFAULT_AD_NETWORKS: AdNetwork[] = [
  {
    id: "hilltopads_vast",
    name: "HilltopAds Video",
    // VAST video CPM — higher than onclick
    cpmByTier: { tier1: 3.50, tier2: 0.90, tier3: 0.25 },
    enabled: true,
    adType: "vast",
    // ← رابط VAST الخاص بيك من HilltopAds
    vastTagUrl:
      "https://direct-league.com/dEm.FXzbdzGlNJvYZQGhUt/Ve/mj9euLZRUXlukMPnTnYA5SM/TfcE4GMLDnUstYNXjmk/xxNvzdgCw-O-QG",
  },
  {
    id: "monetag",
    name: "Monetag",
    cpmByTier: { tier1: 2.50, tier2: 0.70, tier3: 0.20 },
    enabled: true,
    adType: "onclick",
    scriptUrl: "https://al5sm.com/tag.min.js",
    zoneId: "10797616",
  },
];

const TZ_COUNTRY_MAP: Record<string, string> = {
  "America/New_York":"US","America/Chicago":"US","America/Denver":"US","America/Los_Angeles":"US",
  "Europe/London":"GB","Europe/Berlin":"DE","Europe/Paris":"FR","Europe/Amsterdam":"NL",
  "Europe/Stockholm":"SE","Europe/Oslo":"NO","Europe/Copenhagen":"DK","Europe/Helsinki":"FI",
  "Europe/Zurich":"CH","Europe/Vienna":"AT","Europe/Brussels":"BE","Europe/Dublin":"IE",
  "Europe/Istanbul":"TR","Europe/Moscow":"RU","Europe/Warsaw":"PL","Europe/Prague":"CZ",
  "Europe/Bucharest":"RO","Europe/Budapest":"HU","Europe/Kiev":"UA","Europe/Rome":"IT",
  "Europe/Madrid":"ES","Europe/Lisbon":"PT",
  "Asia/Tokyo":"JP","Asia/Seoul":"KR","Asia/Shanghai":"CN","Asia/Taipei":"TW",
  "Asia/Hong_Kong":"HK","Asia/Singapore":"SG","Asia/Kolkata":"IN","Asia/Karachi":"PK",
  "Asia/Jakarta":"ID","Asia/Bangkok":"TH","Asia/Ho_Chi_Minh":"VN","Asia/Manila":"PH",
  "Asia/Kuala_Lumpur":"MY","Asia/Riyadh":"SA","Asia/Dubai":"AE","Asia/Jerusalem":"IL",
  "Africa/Cairo":"EG","Africa/Lagos":"NG","Africa/Johannesburg":"ZA","Africa/Nairobi":"KE",
  "America/Sao_Paulo":"BR","America/Argentina/Buenos_Aires":"AR","America/Mexico_City":"MX",
  "America/Santiago":"CL","America/Bogota":"CO","America/Lima":"PE",
  "Australia/Sydney":"AU","Pacific/Auckland":"NZ",
};

export function detectCountry(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TZ_COUNTRY_MAP[tz]) return TZ_COUNTRY_MAP[tz];
    const region = tz?.split("/")[0];
    if (region === "America") return "US";
    if (region === "Europe") return "DE";
    if (region === "Asia") return "IN";
    if (region === "Africa") return "EG";
  } catch { /**/ }
  return "UNKNOWN";
}

export function getHighestPayingNetwork(
  countryCode: string,
  networks: AdNetwork[] = DEFAULT_AD_NETWORKS
): AdCandidate | null {
  const tier = getCountryTier(countryCode);
  return (
    networks
      .filter((n) => n.enabled)
      .map((n) => ({ network: n, estimatedCpm: n.cpmByTier[tier], estimatedPerView: n.cpmByTier[tier] / 1000 }))
      .sort((a, b) => b.estimatedCpm - a.estimatedCpm)[0] ?? null
  );
}

export function getNetworkWaterfall(
  countryCode: string,
  networks: AdNetwork[] = DEFAULT_AD_NETWORKS
): AdCandidate[] {
  const tier = getCountryTier(countryCode);
  return networks
    .filter((n) => n.enabled)
    .map((n) => ({ network: n, estimatedCpm: n.cpmByTier[tier], estimatedPerView: n.cpmByTier[tier] / 1000 }))
    .sort((a, b) => b.estimatedCpm - a.estimatedCpm);
}

export function calculateRevenue(cpm: number, views: number) {
  const gross = (cpm / 1000) * views;
  return {
    gross: +gross.toFixed(6), devShare: +(gross * 0.9).toFixed(6),
    platformShare: +(gross * 0.1).toFixed(6),
    perView: +(cpm / 1000).toFixed(6), devPerView: +((cpm / 1000) * 0.9).toFixed(6),
  };
}

export interface VideoAdResult {
  completed: boolean;
  networkId: string;
  networkName: string;
  watchDuration: number;
  estimatedEarning: number;
  country: string;
  tier: string;
}

// ── IMA SDK instance kept globally so we can destroy it ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentAdsManager: any = null;

/** Call this on component unmount to clean up IMA SDK. */
export function destroyCurrentAd() {
  try { currentAdsManager?.destroy(); } catch { /**/ }
  currentAdsManager = null;
}

/**
 * Show a real rewarded video ad.
 *
 * For VAST networks: uses Google IMA SDK to play in-page video.
 * The component must pass adContainer + videoElement refs.
 *
 * For onclick networks: opens new tab + countdown timer (fallback).
 */
export async function showVideoAd(
  candidate: AdCandidate,
  countryCode: string,
  onProgress?: (secondsRemaining: number, total: number) => void,
  adContainer?: HTMLDivElement | null,
  videoElement?: HTMLVideoElement | null,
): Promise<VideoAdResult> {
  const WATCH_DURATION = 15;
  const tier = getCountryTier(countryCode);
  const { adType, vastTagUrl } = candidate.network;

  // ── Real VAST video via Google IMA SDK ────────────────
  if (adType === "vast" && vastTagUrl && adContainer && videoElement) {
    return playImaVastAd(candidate, countryCode, tier, vastTagUrl, adContainer, videoElement, onProgress);
  }

  // ── OnClick / Popunder fallback ───────────────────────
  return new Promise((resolve) => {
    let elapsed = 0;
    const iv = setInterval(() => {
      elapsed++;
      onProgress?.(WATCH_DURATION - elapsed, WATCH_DURATION);
      if (elapsed >= WATCH_DURATION) {
        clearInterval(iv);
        resolve({ completed: true, networkId: candidate.network.id, networkName: candidate.network.name,
          watchDuration: WATCH_DURATION, estimatedEarning: candidate.estimatedPerView * 0.9, country: countryCode, tier });
      }
    }, 1000);
  });
}

// ── Google IMA SDK VAST Player ─────────────────────────────
async function playImaVastAd(
  candidate: AdCandidate,
  countryCode: string,
  tier: string,
  vastTagUrl: string,
  adContainer: HTMLDivElement,
  videoElement: HTMLVideoElement,
  onProgress?: (secondsRemaining: number, total: number) => void,
): Promise<VideoAdResult> {
  // Load IMA SDK if not already loaded
  await loadScript("https://imasdk.googleapis.com/js/sdkloader/ima3.js", "ima3-sdk");

  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const google = (window as any).google;
    if (!google?.ima) {
      // IMA failed to load — fallback onclick countdown
      let elapsed = 0;
      const DURATION = 15;
      const iv = setInterval(() => {
        elapsed++;
        onProgress?.(DURATION - elapsed, DURATION);
        if (elapsed >= DURATION) {
          clearInterval(iv);
          resolve({ completed: true, networkId: candidate.network.id, networkName: candidate.network.name,
            watchDuration: DURATION, estimatedEarning: 0, country: countryCode, tier });
        }
      }, 1000);
      return;
    }

    const ima = google.ima;
    ima.settings.setVpaidMode(ima.ImaSdkSettings.VpaidMode.ENABLED);

    const adDisplayContainer = new ima.AdDisplayContainer(adContainer, videoElement);
    adDisplayContainer.initialize();

    const adsLoader = new ima.AdsLoader(adDisplayContainer);
    let elapsed = 0;
    let totalDuration = 15;
    let timer: ReturnType<typeof setInterval> | null = null;

    const done = (earning: number) => {
      if (timer) clearInterval(timer);
      resolve({ completed: true, networkId: candidate.network.id, networkName: candidate.network.name,
        watchDuration: Math.max(elapsed, 15), estimatedEarning: earning, country: countryCode, tier });
    };

    adsLoader.addEventListener(ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, (e: any) => {
      const adsManager = e.getAdsManager(videoElement);
      currentAdsManager = adsManager;

      adsManager.addEventListener(ima.AdEvent.Type.STARTED, () => {
        timer = setInterval(() => {
          elapsed++;
          onProgress?.(Math.max(0, totalDuration - elapsed), totalDuration);
          if (elapsed >= totalDuration && timer) clearInterval(timer);
        }, 1000);
        // Get actual duration
        try {
          const dur = adsManager.getCurrentAd()?.getDuration();
          if (dur && dur > 0) totalDuration = Math.ceil(dur);
        } catch { /**/ }
      });

      adsManager.addEventListener(ima.AdEvent.Type.ALL_ADS_COMPLETED, () => done(candidate.estimatedPerView * 0.9));
      adsManager.addEventListener(ima.AdEvent.Type.COMPLETE, () => done(candidate.estimatedPerView * 0.9));

      adsManager.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, () => done(0));

      try {
        adsManager.init(adContainer.offsetWidth || 400, adContainer.offsetHeight || 225, ima.ViewMode.NORMAL);
        adsManager.start();
      } catch {
        done(0);
      }
    });

    adsLoader.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, () => done(0));

    const adsRequest = new ima.AdsRequest();
    adsRequest.adTagUrl = vastTagUrl;
    adsRequest.linearAdSlotWidth = adContainer.offsetWidth || 400;
    adsRequest.linearAdSlotHeight = adContainer.offsetHeight || 225;
    adsRequest.nonLinearAdSlotWidth = adContainer.offsetWidth || 400;
    adsRequest.nonLinearAdSlotHeight = 150;

    adsLoader.requestAds(adsRequest);
  });
}

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") { resolve(); return; }
    if (document.getElementById(id)) { resolve(); return; }
    const s = document.createElement("script");
    s.id = id; s.src = src;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
}
