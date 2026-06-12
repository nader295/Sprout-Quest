"use client";

// Standalone language detection — no imports from i18n or use-settings
// Prevents circular dependency: i18n → use-settings → i18n

const SUPPORTED_LANGS = [
  "en","ar","es","fr","de","pt","ru","zh","ja","ko",
  "hi","tr","id","pl","it","nl","th","vi","uk","fa",
] as const;

type SupportedLang = typeof SUPPORTED_LANGS[number];

export function detectDeviceLanguage(): SupportedLang | null {
  if (typeof navigator === "undefined") return null;
  try {
    const langs = navigator.languages?.length
      ? navigator.languages
      : navigator.language ? [navigator.language] : [];

    for (const raw of langs) {
      const base = raw.toLowerCase().replace("_", "-").split("-")[0];
      const regional: Record<string, SupportedLang> = {
        "zh":"zh","pt":"pt","en":"en","es":"es","fr":"fr","de":"de",
        "ar":"ar","fa":"fa","hi":"hi","ru":"ru","uk":"uk","tr":"tr",
        "id":"id","vi":"vi","th":"th","ko":"ko","ja":"ja","pl":"pl",
        "it":"it","nl":"nl",
      };
      if (regional[base]) return regional[base];
    }
    return null;
  } catch { return null; }
}
