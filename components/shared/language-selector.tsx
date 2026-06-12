"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Globe, Check, Search, ChevronDown, X, Wand2 } from "lucide-react";
import { useSettings } from "@/lib/hooks/use-settings";
import { LANGUAGES, preloadLanguage, isRTL, useTranslation } from "@/lib/i18n";
import { detectDeviceLanguage } from "@/lib/detect-language";

export function LanguageSelector({ compact = false, inline = false }: { compact?: boolean; inline?: boolean }) {
  const { lang, setLang } = useSettings();
  const storedLang = typeof window !== "undefined" ? (() => { try { return JSON.parse(localStorage.getItem("romx_settings") || "{}").lang; } catch { return null; } })() : null;
  const isAuto = storedLang === "auto" || !storedLang;
  const detectedLang = detectDeviceLanguage();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Touch scroll detection — prevent accidental selection on mobile
  const touchStartY = useRef(0);
  const isScrolling = useRef(false);

  const closeDropdown = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
      setSearch("");
    }, 160);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleOutside(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }
    const handleCustomClose = () => { if (open) closeDropdown(); };

    if (open) {
      document.addEventListener("pointerdown", handleOutside, { passive: true });
      window.addEventListener("close-lang-menu", handleCustomClose);
      return () => {
        document.removeEventListener("pointerdown", handleOutside);
        window.removeEventListener("close-lang-menu", handleCustomClose);
      };
    }
  }, [open, closeDropdown]);

  const currentLang = LANGUAGES.find((l) => l.code === lang);
  const displayName = isAuto
    ? (detectedLang ? `تلقائي · ${LANGUAGES.find(l => l.code === detectedLang)?.nativeName || "English"}` : "تلقائي")
    : (currentLang?.nativeName || "English");
  const dir = isRTL(lang) ? "rtl" : "ltr";

  const filtered = LANGUAGES.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.nativeName.toLowerCase().includes(search.toLowerCase()) ||
    l.code.includes(search.toLowerCase())
  );

  // Auto option always shows when no search
  const showAuto = !search;

  const selectLang = useCallback(async (code: string) => {
    if (code === lang || loading) return;
    setLoading(code);
    setOpen(false);
    setSearch("");
    setClosing(false);
    try {
      await preloadLanguage(code);
    } catch {}
    setLang(code);
    setLoading(null);
  }, [lang, loading, setLang]);

  // Inline mode
  if (inline) {
    return (
      <div className="flex flex-col gap-2 w-full">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t("lang.title")}</span>
        <div className="flex flex-wrap gap-1.5">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => selectLang(l.code)}
              className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-all ${
                lang === l.code
                  ? "border-[var(--primary)] bg-primary-dim text-foreground scale-105 shadow-sm"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-105 hover:border-[var(--primary)]/30 active:scale-95"
              }`}
            >
              {l.nativeName}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("close-header-menus"));
          setOpen((p) => {
            if (p) { closeDropdown(); return p; }
            return true;
          });
        }}
        className={`group inline-flex items-center justify-center gap-1.5 rounded-xl text-sm text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90 ${compact ? "h-8 w-8 sm:h-9 sm:w-9" : "px-2.5 py-1.5"}`}
        aria-label="Change language"
        aria-expanded={open}
      >
        <Globe className={`h-4 w-4 transition-all duration-300 group-hover:rotate-12 ${loading ? "animate-spin" : ""}`} />
        {!compact && (
          <>
            <span className="hidden sm:inline font-semibold">{displayName}</span>
            <ChevronDown className={`hidden h-3 w-3 sm:block transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </>
        )}
      </button>

      {/* Dropdown */}
      {(open || closing) && (
        <div
          dir={dir}
          className="absolute end-0 top-full z-[60] mt-2 w-64 rounded-2xl border border-border bg-card overflow-hidden sm:w-72"
          style={{
            boxShadow: "0 20px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)",
            animation: closing
              ? "lang-menu-out 0.16s cubic-bezier(0.4,0,1,1) forwards"
              : "lang-menu-in 0.2s cubic-bezier(0.34,1.4,0.64,1) forwards",
            transformOrigin: dir === "rtl" ? "top left" : "top right",
          }}
        >
          {/* Top glow */}
          <div className="absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(29,155,240,0.4), transparent)" }} />

          {/* Search */}
          <div className="p-2.5 pb-1.5">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background/80 px-2.5 py-2 focus-within:border-[var(--primary)] transition-colors">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("lang.search")}
                className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
              />
              {search && (
                <button
                  onPointerDown={(e) => { e.preventDefault(); setSearch(""); }}
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          </div>

          {/* Current */}
          <div className="px-3 py-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">
              {displayName}
            </p>
          </div>

          {/* List */}
          <div
            className="max-h-48 sm:max-h-60 overflow-y-auto px-1.5 pb-2 scroll-smooth"
            onTouchStart={(e) => {
              touchStartY.current = e.touches[0].clientY;
              isScrolling.current = false;
            }}
            onTouchMove={(e) => {
              const delta = Math.abs(e.touches[0].clientY - touchStartY.current);
              if (delta > 10) {
                isScrolling.current = true;
              }
            }}
          >
            {/* ── Auto option — always first ── */}
            {showAuto && (
              <button
                onClick={() => { if (isScrolling.current) { isScrolling.current = false; return; } selectLang("auto"); }}
                className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-start text-xs transition-all active:scale-[0.98] sm:gap-3 sm:px-3 sm:text-sm ${
                  isAuto ? "bg-[var(--primary-dim)] text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}>
                <div className="flex h-5 w-8 shrink-0 items-center justify-center sm:w-12">
                  <Wand2 className="h-3.5 w-3.5" style={{ color: isAuto ? "var(--primary)" : undefined }} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold">تلقائي</span>
                  {detectedLang && (
                    <span className="ms-1.5 text-[10px] opacity-50">
                      ({LANGUAGES.find(l => l.code === detectedLang)?.nativeName || detectedLang})
                    </span>
                  )}
                </div>
                {isAuto
                  ? <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--primary)" }} />
                  : <ChevronDown className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-30 -rotate-90 transition-opacity" />
                }
              </button>
            )}

            {/* Divider */}
            {showAuto && <div className="my-1 h-px bg-border/50" />}

            {filtered.map((l) => (
              <button
                key={l.code}
                onClick={() => {
                  // Skip selection if user was scrolling
                  if (isScrolling.current) {
                    isScrolling.current = false;
                    return;
                  }
                  selectLang(l.code);
                }}
                className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-start text-xs transition-all active:scale-[0.98] sm:gap-3 sm:px-3 sm:text-sm ${
                  lang === l.code
                    ? "bg-[var(--primary-dim)] text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                } ${loading === l.code ? "opacity-60" : ""}`}
              >
                <span className="w-8 shrink-0 text-[9px] font-black font-mono opacity-40 sm:w-12 sm:text-[10px]">
                  {l.code.toUpperCase()}
                </span>
                <span className="flex-1 font-bold truncate">{l.nativeName}</span>
                <span className="hidden text-[10px] opacity-30 sm:inline">{l.name}</span>
                {lang === l.code
                  ? <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--primary)" }} />
                  : <ChevronDown className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-30 -rotate-90 transition-opacity" />
                }
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">{t("lang.notFound")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
