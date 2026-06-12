"use client";

import { useSettings } from "@/lib/hooks/use-settings";
import { useCallback, useEffect, useState } from "react";

// All translation keys
export type TranslationKey = keyof typeof import("./translations/en").default;

type Translations = Record<string, string>;

// Lazy-loaded translation modules
const translationModules: Record<string, () => Promise<{ default: Translations }>> = {
  en: () => import("./translations/en"),
  ar: () => import("./translations/ar"),
  es: () => import("./translations/es"),
  fr: () => import("./translations/fr"),
  de: () => import("./translations/de"),
  pt: () => import("./translations/pt"),
  ru: () => import("./translations/ru"),
  zh: () => import("./translations/zh"),
  ja: () => import("./translations/ja"),
  ko: () => import("./translations/ko"),
  hi: () => import("./translations/hi"),
  tr: () => import("./translations/tr"),
  id: () => import("./translations/id"),
  pl: () => import("./translations/pl"),
  it: () => import("./translations/it"),
  nl: () => import("./translations/nl"),
  th: () => import("./translations/th"),
  vi: () => import("./translations/vi"),
  uk: () => import("./translations/uk"),
  fa: () => import("./translations/fa"),
};

// Cache loaded translations
const cache: Record<string, Translations> = {};

// Synchronous fallback - English
import en from "./translations/en";
cache.en = en;

// Preload a language
export async function preloadLanguage(lang: string) {
  if (cache[lang]) return;
  const loader = translationModules[lang];
  if (!loader) return;
  try {
    const mod = await loader();
    cache[lang] = mod.default;
  } catch {
    // fallback to English
  }
}

// Dev-only warning set to avoid spam
const warnedKeys = new Set<string>();

// Get translation synchronously (falls back to English)
function getTranslation(lang: string, key: string, params?: Record<string, string | number>): string {
  const dict = cache[lang] || cache.en || en;
  const enFallback = en[key as keyof typeof en];
  let text = dict[key] || enFallback || key;

  // Dev warning when a non-English locale is missing the key
  if (
    process.env.NODE_ENV !== "production" &&
    lang !== "en" &&
    dict !== en &&
    !dict[key] &&
    enFallback
  ) {
    const warnKey = `${lang}:${key}`;
    if (!warnedKeys.has(warnKey)) {
      warnedKeys.add(warnKey);
      console.warn(`[v0][i18n] Missing "${key}" in "${lang}" (falling back to en)`);
    }
  }

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v));
    });
  }
  return text;
}

// React hook
export function useTranslation() {
  const { lang } = useSettings();
  const [ready, setReady] = useState(!!cache[lang]);

  useEffect(() => {
    if (cache[lang]) {
      setReady(true);
      return;
    }
    setReady(false);
    preloadLanguage(lang).then(() => setReady(true));
  }, [lang]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return getTranslation(lang, key, params);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, ready]
  );

  return { t, lang, dir: isRTL(lang) ? "rtl" as const : "ltr" as const, ready };
}

// RTL languages
export function isRTL(lang: string): boolean {
  return ["ar", "fa", "he", "ur"].includes(lang);
}

// Available languages with metadata
export const LANGUAGES = [
  { code: "en", name: "English", nativeName: "English", flag: "GB" },
  { code: "ar", name: "Arabic", nativeName: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629", flag: "SA" },
  { code: "es", name: "Spanish", nativeName: "Espa\u00F1ol", flag: "ES" },
  { code: "fr", name: "French", nativeName: "Fran\u00E7ais", flag: "FR" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "DE" },
  { code: "pt", name: "Portuguese", nativeName: "Portugu\u00EAs", flag: "BR" },
  { code: "ru", name: "Russian", nativeName: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439", flag: "RU" },
  { code: "zh", name: "Chinese", nativeName: "\u4E2D\u6587", flag: "CN" },
  { code: "ja", name: "Japanese", nativeName: "\u65E5\u672C\u8A9E", flag: "JP" },
  { code: "ko", name: "Korean", nativeName: "\uD55C\uAD6D\uC5B4", flag: "KR" },
  { code: "hi", name: "Hindi", nativeName: "\u0939\u093F\u0928\u094D\u0926\u0940", flag: "IN" },
  { code: "tr", name: "Turkish", nativeName: "T\u00FCrk\u00E7e", flag: "TR" },
  { code: "id", name: "Indonesian", nativeName: "Indonesia", flag: "ID" },
  { code: "pl", name: "Polish", nativeName: "Polski", flag: "PL" },
  { code: "it", name: "Italian", nativeName: "Italiano", flag: "IT" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", flag: "NL" },
  { code: "th", name: "Thai", nativeName: "\u0E44\u0E17\u0E22", flag: "TH" },
  { code: "vi", name: "Vietnamese", nativeName: "Ti\u1EBFng Vi\u1EC7t", flag: "VN" },
  { code: "uk", name: "Ukrainian", nativeName: "\u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430", flag: "UA" },
  { code: "fa", name: "Persian", nativeName: "\u0641\u0627\u0631\u0633\u06CC", flag: "IR" },
] as const;
