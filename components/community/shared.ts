// Shared constants & helpers for the Community (Global Network) page.
// Extracted to keep component files focused.

export const FLAGS: Record<string, string> = {
  // North America
  US: "🇺🇸", CA: "🇨🇦", MX: "🇲🇽", GT: "🇬🇹", BZ: "🇧🇿", HN: "🇭🇳", SV: "🇸🇻", NI: "🇳🇮", CR: "🇨🇷", PA: "🇵🇦",
  CU: "🇨🇺", JM: "🇯🇲", HT: "🇭🇹", DO: "🇩🇴", PR: "🇵🇷", TT: "🇹🇹", BB: "🇧🇧", LC: "🇱🇨", VC: "🇻🇨", GD: "🇬🇩",
  AG: "🇦🇬", DM: "🇩🇲", KN: "🇰🇳", BS: "🇧🇸", TC: "🇹🇨", VG: "🇻🇬", VI: "🇻🇮", AW: "🇦🇼", CW: "🇨🇼",
  // South America
  BR: "🇧🇷", AR: "🇦🇷", CO: "🇨🇴", CL: "🇨🇱", PE: "🇵🇪", VE: "🇻🇪", EC: "🇪🇨", BO: "🇧🇴", PY: "🇵🇾", UY: "🇺🇾",
  GY: "🇬🇾", SR: "🇸🇷", GF: "🇬🇫",
  // Europe
  GB: "🇬🇧", DE: "🇩🇪", FR: "🇫🇷", IT: "🇮🇹", ES: "🇪🇸", PT: "🇵🇹", NL: "🇳🇱", BE: "🇧🇪", CH: "🇨🇭", AT: "🇦🇹",
  IE: "🇮🇪", SE: "🇸🇪", NO: "🇳🇴", DK: "🇩🇰", FI: "🇫🇮", IS: "🇮🇸", LU: "🇱🇺", LI: "🇱🇮", MC: "🇲🇨", AD: "🇦🇩",
  SM: "🇸🇲", VA: "🇻🇦", MT: "🇲🇹", CY: "🇨🇾", GR: "🇬🇷",
  PL: "🇵🇱", UA: "🇺🇦", RU: "🇷🇺", RO: "🇷🇴", CZ: "🇨🇿", HU: "🇭🇺", SK: "🇸🇰", BG: "🇧🇬", HR: "🇭🇷",
  RS: "🇷🇸", SI: "🇸🇮", BA: "🇧🇦", ME: "🇲🇪", MK: "🇲🇰", AL: "🇦🇱", LT: "🇱🇹", LV: "🇱🇻", EE: "🇪🇪",
  BY: "🇧🇾", MD: "🇲🇩", GE: "🇬🇪", AM: "🇦🇲", AZ: "🇦🇿",
  // MENA
  EG: "🇪🇬", SA: "🇸🇦", AE: "🇦🇪", IQ: "🇮🇶", IR: "🇮🇷", SY: "🇸🇾", JO: "🇯🇴", LB: "🇱🇧", PS: "🇵🇸",
  IL: "🇮🇱", YE: "🇾🇪", OM: "🇴🇲", KW: "🇰🇼", QA: "🇶🇦", BH: "🇧🇭", TR: "🇹🇷", MA: "🇲🇦", DZ: "🇩🇿",
  TN: "🇹🇳", LY: "🇱🇾", SD: "🇸🇩", MR: "🇲🇷",
  // SSA
  NG: "🇳🇬", ZA: "🇿🇦", ET: "🇪🇹", KE: "🇰🇪", GH: "🇬🇭", TZ: "🇹🇿", UG: "🇺🇬", CM: "🇨🇲", CI: "🇨🇮",
  SN: "🇸🇳", MG: "🇲🇬", MZ: "🇲🇿", ZM: "🇿🇲", ZW: "🇿🇼", RW: "🇷🇼", ML: "🇲🇱", BF: "🇧🇫", NE: "🇳🇪",
  TD: "🇹🇩", SO: "🇸🇴", ER: "🇪🇷", DJ: "🇩🇯", CD: "🇨🇩", CG: "🇨🇬", AO: "🇦🇴", NA: "🇳🇦", BW: "🇧🇼",
  LS: "🇱🇸", SZ: "🇸🇿", MW: "🇲🇼", SL: "🇸🇱", GN: "🇬🇳", GW: "🇬🇼", GM: "🇬🇲", LR: "🇱🇷", TG: "🇹🇬",
  BJ: "🇧🇯", GQ: "🇬🇶", GA: "🇬🇦", ST: "🇸🇹", CV: "🇨🇻", KM: "🇰🇲", SC: "🇸🇨", MU: "🇲🇺",
  // South Asia
  IN: "🇮🇳", PK: "🇵🇰", BD: "🇧🇩", NP: "🇳🇵", LK: "🇱🇰", BT: "🇧🇹", MV: "🇲🇻", AF: "🇦🇫",
  // SE Asia
  ID: "🇮🇩", VN: "🇻🇳", TH: "🇹🇭", PH: "🇵🇭", MM: "🇲🇲", MY: "🇲🇾", SG: "🇸🇬", KH: "🇰🇭", LA: "🇱🇦",
  TL: "🇹🇱", BN: "🇧🇳",
  // E Asia
  CN: "🇨🇳", JP: "🇯🇵", KR: "🇰🇷", TW: "🇹🇼", HK: "🇭🇰", MO: "🇲🇴", MN: "🇲🇳", KP: "🇰🇵",
  // C Asia
  KZ: "🇰🇿", UZ: "🇺🇿", TM: "🇹🇲", TJ: "🇹🇯", KG: "🇰🇬",
  // Oceania
  AU: "🇦🇺", NZ: "🇳🇿", FJ: "🇫🇯", PG: "🇵🇬", SB: "🇸🇧", VU: "🇻🇺", WS: "🇼🇸", TO: "🇹🇴", KI: "🇰🇮",
  FM: "🇫🇲", MH: "🇲🇭", PW: "🇵🇼", NR: "🇳🇷", TV: "🇹🇻", CK: "🇨🇰",
};

export const flagOf = (code: string) => FLAGS[code?.toUpperCase()] ?? "🌐";

// Map country code → continental cluster (useful for grouping visuals).
export const CONTINENT: Record<string, string> = {
  US: "N.America", CA: "N.America", MX: "N.America",
  BR: "S.America", AR: "S.America", CO: "S.America", CL: "S.America", PE: "S.America", VE: "S.America",
  GB: "Europe", DE: "Europe", FR: "Europe", IT: "Europe", ES: "Europe", NL: "Europe", PL: "Europe",
  UA: "Europe", RU: "Europe", TR: "Europe", BE: "Europe", PT: "Europe", GR: "Europe", SE: "Europe",
  NO: "Europe", IE: "Europe", CZ: "Europe", AT: "Europe", CH: "Europe", HU: "Europe", RO: "Europe",
  EG: "M.East", SA: "M.East", AE: "M.East", IQ: "M.East", IR: "M.East", JO: "M.East", KW: "M.East",
  QA: "M.East", SY: "M.East", LB: "M.East", PS: "M.East", YE: "M.East", OM: "M.East", BH: "M.East",
  NG: "Africa", KE: "Africa", ET: "Africa", ZA: "Africa", GH: "Africa", MA: "Africa", DZ: "Africa",
  TN: "Africa", SD: "Africa", UG: "Africa", TZ: "Africa",
  IN: "S.Asia", PK: "S.Asia", BD: "S.Asia", LK: "S.Asia", NP: "S.Asia",
  CN: "E.Asia", JP: "E.Asia", KR: "E.Asia", TW: "E.Asia", HK: "E.Asia",
  ID: "SE.Asia", VN: "SE.Asia", TH: "SE.Asia", MY: "SE.Asia", PH: "SE.Asia", SG: "SE.Asia",
  AU: "Oceania", NZ: "Oceania",
  KZ: "C.Asia", UZ: "C.Asia",
};

export const continentOf = (code: string) => CONTINENT[code?.toUpperCase()] ?? "Other";

// Strict 5-color palette used across the Mission Control UI.
export const PALETTE = {
  bg: "#000206",
  mint: "#00f5c4",      // live / primary
  blue: "#00c8ff",      // data / info
  gold: "#fbbf24",      // top rank
  purple: "#a78bfa",    // devs
};

export interface CountryData {
  code: string;
  name: string;
  count: number;
  publishers: number;
}
