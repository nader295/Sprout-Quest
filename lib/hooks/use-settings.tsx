"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { AccentColor, ThemeMode } from "@/lib/types";
import { RX_THEMES } from "@/lib/constants";
import { detectDeviceLanguage } from "@/lib/detect-language";

type ExtendedThemeMode = ThemeMode | "system" | "amoled";
export type BgStyle = "plain" | "aurora" | "stars" | "evox";

interface SettingsState {
  accent: AccentColor;
  mode: ExtendedThemeMode;
  lang: string;
  bgStyle: BgStyle;
  aurora: boolean; // legacy compat
  setAccent: (c: AccentColor) => void;
  setMode: (m: ExtendedThemeMode) => void;
  setLang: (l: string) => void;
  setBgStyle: (s: BgStyle) => void;
  setAurora: (v: boolean) => void; // legacy compat
}

const SettingsContext = createContext<SettingsState>({
  accent: "blue", mode: "dark", lang: "en", bgStyle: "plain", aurora: false,
  setAccent: () => {}, setMode: () => {}, setLang: () => {},
  setBgStyle: () => {}, setAurora: () => {},
});

function getStoredSettings() {
  if (typeof window === "undefined") return { accent: "blue" as AccentColor, mode: "dark" as ExtendedThemeMode, lang: "en", bgStyle: "plain" as BgStyle };
  try {
    const raw = localStorage.getItem("romx_settings");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { accent: "blue" as AccentColor, mode: "dark" as ExtendedThemeMode, lang: "en", bgStyle: "plain" as BgStyle };
}

function getEffectiveMode(mode: ExtendedThemeMode): ThemeMode {
  if (mode === "amoled") return "dark";
  if (mode === "system") {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
    return "dark";
  }
  return mode as ThemeMode;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<AccentColor>("blue");
  const [mode, setModeState] = useState<ExtendedThemeMode>("dark");
  const [lang, setLangState] = useState("en");
  const [bgStyle, setBgStyleState] = useState<BgStyle>("plain");

  useEffect(() => {
    const stored = getStoredSettings();
    setAccentState(stored.accent || "blue");
    setModeState(stored.mode || "dark");

    // Auto-detect language on first visit (when lang not manually set)
    if (stored.lang && stored.lang !== "auto") {
      setLangState(stored.lang);
    } else {
      // First visit OR user chose "auto"
      const detected = detectDeviceLanguage();
      const finalLang = detected || "en";
      setLangState(finalLang);
      // Save "auto" marker so we know user hasn't manually chosen
      if (!stored.lang) persist("lang", "auto");
    }
    // migrate old aurora boolean
    if (stored.bgStyle) setBgStyleState(stored.bgStyle);
    else if (stored.aurora === true) setBgStyleState("aurora");
    else setBgStyleState("plain");
  }, []);

  useEffect(() => {
    const theme = (RX_THEMES as Record<string, typeof RX_THEMES.blue>)[accent] || RX_THEMES.blue;
    const root = document.documentElement;
    root.style.setProperty("--primary", theme.hex);
    root.style.setProperty("--primary-dim", theme.dim);
    root.style.setProperty("--primary-glow", theme.glow);
    root.setAttribute("data-theme", accent);
    const effectiveMode = getEffectiveMode(mode);
    root.classList.remove("light", "dark", "amoled");
    if (mode === "amoled") { root.classList.add("dark", "amoled"); }
    else if (effectiveMode === "light") { root.classList.add("light"); }
    else { root.classList.add("dark"); }
    root.lang = lang;
    root.dir = ["ar", "fa", "he", "ur"].includes(lang) ? "rtl" : "ltr";
    
    // Update ALL theme-color meta tags (handles both static & media-query variants)
    const getThemeColorValue = (resolvedMode: string) => {
      if (mode === "amoled") return "#000000";
      if (resolvedMode === "light") return "#ffffff";
      return "#07070b";
    };

    const applyThemeColor = (resolvedMode: string) => {
      const color = getThemeColorValue(resolvedMode);
      document.querySelectorAll('meta[name="theme-color"]').forEach(el => {
        el.setAttribute("content", color);
      });
    };

    applyThemeColor(effectiveMode);

    if (mode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: light)");
      const handler = (e: MediaQueryListEvent) => {
        const resolved = e.matches ? "light" : "dark";
        if (e.matches) { root.classList.remove("dark"); root.classList.add("light"); }
        else { root.classList.remove("light"); root.classList.add("dark"); }
        applyThemeColor(resolved);
      };
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [accent, mode, lang]);

  const persist = useCallback((key: string, val: string) => {
    try {
      const raw = localStorage.getItem("romx_settings");
      const obj = raw ? JSON.parse(raw) : {};
      obj[key] = val;
      localStorage.setItem("romx_settings", JSON.stringify(obj));
    } catch {}
  }, []);

  const setAccent = useCallback((c: AccentColor) => { setAccentState(c); persist("accent", c); }, [persist]);
  const setMode = useCallback((m: ExtendedThemeMode) => { setModeState(m); persist("mode", m); }, [persist]);
  const setLang = useCallback((l: string) => {
    if (l === "auto") {
      // Re-detect
      const detected = detectDeviceLanguage();
      const finalLang = detected || "en";
      setLangState(finalLang);
      persist("lang", "auto");
    } else {
      setLangState(l);
      persist("lang", l);
    }
  }, [persist]);
  const setBgStyle = useCallback((s: BgStyle) => { setBgStyleState(s); persist("bgStyle", s); }, [persist]);
  const setAurora = useCallback((v: boolean) => { setBgStyle(v ? "aurora" : "plain"); }, [setBgStyle]);

  return (
    <SettingsContext.Provider value={{ accent, mode, lang, bgStyle, aurora: bgStyle !== "plain", setAccent, setMode, setLang, setBgStyle, setAurora }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() { return useContext(SettingsContext); }
