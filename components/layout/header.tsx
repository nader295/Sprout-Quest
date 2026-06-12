"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSettings } from "@/lib/hooks/use-settings";
import { RX_THEMES } from "@/lib/constants";
import type { AccentColor, ThemeMode } from "@/lib/types";
import {
  Bell, Settings, LogOut, User, Shield, Heart,
  Sun, Moon, Zap, Check, Sparkles, Plus, Search, LogIn,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { safeImg } from "@/lib/utils";
import { DEFAULT_AVATAR } from "@/lib/constants";
import { LanguageSelector } from "@/components/shared/language-selector";
import { useTranslation } from "@/lib/i18n";
import { toast } from "@/components/shared/toast";
import { CommandPaletteTrigger } from "@/components/shared/command-palette";

function NotificationBell() {
  const { user, userDoc } = useAuth();
  const unread = userDoc?.unreadNotifications ?? 0;
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (unread > 0) { setPulse(true); setTimeout(() => setPulse(false), 1000); }
  }, [unread]);

  return (
    <Link href="/notifications"
      aria-label="Notifications"
      className="relative inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 hover:scale-110 active:scale-90 sm:h-9 sm:w-9">
      <Bell className={`h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-200 ${pulse ? "animate-[bell-ring_0.4s_ease-in-out]" : ""}`} />
      {unread > 0 && (
        <span className="absolute -top-0.5 -end-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white"
          style={{ backgroundColor: "var(--primary)", boxShadow: "0 0 5px rgba(29,155,240,0.25)" }}>
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

export function Header() {
  const { user, userDoc, isLoggedIn, isAdmin, canUpload, logout } = useAuth();
  const { accent, mode, setAccent, setMode, bgStyle, setBgStyle } = useSettings();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSpinning, setSettingsSpinning] = useState(false);
  const [logoZap, setLogoZap] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const { t, dir } = useTranslation();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowUserMenu(false);
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false);
    }
    const handleCloseMenus = () => { setShowUserMenu(false); setShowSettings(false); };
    
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("close-header-menus", handleCloseMenus);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("close-header-menus", handleCloseMenus);
    };
  }, []);



  useEffect(() => {
    setShowUserMenu(false);
    setShowSettings(false);
  }, [pathname]);

  if (pathname === "/login") return null;

  const handleSettingsClick = () => {
    setSettingsSpinning(true);
    setTimeout(() => setSettingsSpinning(false), 600);
    window.dispatchEvent(new CustomEvent("close-lang-menu"));
    setShowSettings(!showSettings);
    setShowUserMenu(false);
  };

  const handleLogoClick = () => {
    setLogoZap(true);
    setTimeout(() => setLogoZap(false), 500);
  };

  return (
    <>
      <header dir={dir} className="sticky top-0 z-50 border-b border-border/70 backdrop-blur-xl safe-area-top"
        style={{ background: "rgb(var(--background) / 0.82)" }}>
        {/* Holographic scan line on top */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
          style={{ background: "linear-gradient(90deg, transparent 0%, var(--primary) 30%, var(--holo-cyan, var(--primary)) 50%, var(--primary) 70%, transparent 100%)" }} />
        {/* Subtle bottom glow line */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent 5%, var(--primary-glow) 50%, transparent 95%)" }} />

        <div className="flex h-14 items-center gap-2 px-4 sm:gap-2 sm:px-5 lg:h-16 lg:px-6">

          {/* Logo (Start Menu) */}
          <Link href="/" onClick={handleLogoClick}
            className="group flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className={`relative flex h-7 w-7 items-center justify-center rounded-xl transition-all duration-300 sm:h-8 sm:w-8 ${logoZap ? "scale-125" : ""}`}
              style={{
                background: "linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, var(--holo-cyan, #00e5ff)) 100%)",
                boxShadow: logoZap
                  ? "0 0 16px var(--primary-glow), 0 0 28px color-mix(in srgb, var(--primary) 35%, transparent)"
                  : "0 2px 10px var(--primary-glow), inset 0 1px 0 rgba(255,255,255,0.2)",
              }}>
              {/* Inner ring */}
              <span className="absolute inset-0.5 rounded-[9px] border border-white/25" aria-hidden />
              <Zap className={`relative h-3.5 w-3.5 sm:h-4 sm:w-4 text-white transition-all duration-300 ${logoZap ? "rotate-12 scale-125" : "group-hover:rotate-6 group-hover:scale-110"}`} />
            </div>
            <span className="text-base font-black text-foreground sm:text-lg tracking-tight transition-all duration-200 group-hover:tracking-wide" dir="ltr">
              Rom<span style={{ color: "var(--primary)" }}>X</span>
            </span>
          </Link>

          {/* ── Desktop-only: Command palette trigger (feature / quick-navigate search) ── */}
          <div className="hidden max-w-sm flex-1 justify-center px-3 sm:flex lg:px-6">
            <CommandPaletteTrigger className="max-w-sm" />
          </div>

          {/* ── End group — Create, Settings, Lang, Bell, Sign In ──
                Pinned to the far edge opposite the logo:
                • mobile (`ms-auto`) → logical auto-margin pushes to the viewport's
                  inline-end, so it's right in LTR and left in RTL automatically.
                • desktop (`sm:ms-0`) → margin resets to 0 because the command-palette
                  trigger in the middle already pushes this group to the end.
                Tight `gap-px sm:gap-0.5` keeps the icon buttons visually unified. */}
          <div className="ms-auto sm:ms-0 flex items-center gap-1 shrink-0">

            {/* Search — always visible, consistent position in both states */}
            <Link
              href="/search"
              className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 active:scale-90 sm:h-9 sm:w-9"
              aria-label={t("nav.search") || "Search"}
              title={t("search.romPlaceholder") || "Search ROMs, devices, users"}
            >
              <Search className="h-4 w-4 sm:h-5 sm:w-5" />
            </Link>

            {/* Prominent Create CTA — visible for logged-in users with upload perms */}
            {canUpload && (
              <Link
                href="/upload"
                className="hidden md:inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-black text-white overflow-hidden relative group transition-all active:scale-95"
                style={{
                  background: "linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, #22c55e) 100%)",
                  boxShadow: "0 2px 10px var(--primary-glow)",
                }}
                aria-label={t("nav.upload")}
              >
                <span className="absolute inset-0 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-500 bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-12" />
                <Plus className="relative h-3.5 w-3.5" />
                <span className="relative">{t("header.create") || "Create"}</span>
              </Link>
            )}

            {/* Settings gear — spinning on click */}
            <div ref={settingsRef} className="relative">
              <button onClick={handleSettingsClick}
                className="group inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 active:scale-90 sm:h-9 sm:w-9"
                aria-label={t("header.settings")}>
                <Settings className={`h-4 w-4 sm:h-5 sm:w-5 transition-all duration-500 ${settingsSpinning ? "rotate-[180deg]" : ""} group-hover:rotate-45`} />
              </button>
              {showSettings && (
                <div dir={dir} className="absolute end-0 top-full mt-2 w-64 rounded-2xl border border-border bg-card p-4 shadow-2xl"
                  style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)", transformOrigin: dir === "rtl" ? "top left" : "top right" }}>
                  {/* Top glow */}
                  <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--primary-glow), transparent)" }} />

                  <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">{t("settings.accentColor")}</h3>
                  <div className="mb-4 flex flex-wrap gap-2.5">
                    {(Object.keys(RX_THEMES) as AccentColor[]).map((key) => (
                      <button key={key} onClick={() => setAccent(key)}
                        className={`relative h-7 w-7 rounded-full transition-all duration-200 hover:scale-125 active:scale-90 ${accent === key ? "scale-110 ring-2 ring-offset-1 ring-offset-card" : ""}`}
                        style={{ backgroundColor: RX_THEMES[key].hex, outline: accent === key ? `2px solid ${RX_THEMES[key].hex}` : undefined }}>
                        {accent === key && (
                          <span className="absolute inset-0 rounded-full"
                            style={{ animation: "ping 1s ease-out", background: RX_THEMES[key].hex, opacity: 0.3 }} />
                        )}
                      </button>
                    ))}
                  </div>

                  <h3 className="mb-2.5 text-xs font-black uppercase tracking-widest text-muted-foreground">{t("settings.appearance")}</h3>
                  <div className="flex gap-2">
                    {(["dark", "light"] as ThemeMode[]).map((m) => (
                      <button key={m} onClick={() => setMode(m)}
                        className={`group flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all hover:scale-105 active:scale-95 ${
                          mode === m ? "border-[var(--primary)] bg-primary-dim text-foreground shadow-md" : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
                        }`}>
                        {m === "dark"
                          ? <Moon className="h-3.5 w-3.5 transition-transform group-hover:rotate-[-15deg]" />
                          : <Sun className="h-3.5 w-3.5 transition-transform group-hover:rotate-45" />
                        }
                        {m === "dark" ? t("settings.dark") : t("settings.light")}
                      </button>
                    ))}
                  </div>

                  {/* Background Style */}
                  <h3 className="mt-4 mb-2.5 text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" style={{ color: "#a78bfa" }} />
                    {t("settings.bgTitle")}
                  </h3>
                  <div className="grid grid-cols-4 gap-1.5">
                    {([
                      { id: "plain",  emoji: "🌑", label: t("settings.bgPlain"),  preview: "linear-gradient(135deg,#020408,#050912)" },
                      { id: "aurora", emoji: "🌌", label: "Aurora", preview: null },
                      { id: "stars",  emoji: "⭐", label: t("settings.bgStars"),  preview: "linear-gradient(135deg,#02030a,#040614)" },
                      { id: "evox",   emoji: "⚡", label: "Evo X", preview: null },
                    ] as const).map((opt) => {
                      const active = bgStyle === opt.id;
                      return (
                        <button key={opt.id}
                          onClick={() => setBgStyle(opt.id as import("@/lib/hooks/use-settings").BgStyle)}
                          className="relative rounded-xl overflow-hidden transition-all hover:scale-105 active:scale-95"
                          style={{ border: active ? "2px solid var(--primary)" : "1px solid rgb(var(--border))" }}>
                          <div className="relative h-10 overflow-hidden">
                            {opt.id === "plain" && <div className="absolute inset-0" style={{ background: "linear-gradient(135deg,#020408,#050912)" }} />}
                            {opt.id === "aurora" && (
                              <div className="absolute inset-0" style={{ background: "linear-gradient(135deg,#020408,#030614)" }}>
                                <div className="absolute -top-2 -start-1 w-10 h-8 rounded-full" style={{ background: "radial-gradient(circle,rgba(29,155,240,0.18) 0%,transparent 65%)", filter: "blur(5px)" }} />
                                <div className="absolute top-0 end-0 w-8 h-7 rounded-full" style={{ background: "radial-gradient(circle,rgba(139,92,246,0.14) 0%,transparent 65%)", filter: "blur(5px)" }} />
                                <div className="absolute bottom-0 start-1/3 w-7 h-6 rounded-full" style={{ background: "radial-gradient(circle,rgba(236,72,153,0.10) 0%,transparent 65%)", filter: "blur(4px)" }} />
                              </div>
                            )}
                            {opt.id === "stars" && (
                              <div className="absolute inset-0" style={{ background: "linear-gradient(135deg,#02030a,#040614)" }}>
                                {[...Array(12)].map((_,i) => (
                                  <div key={i} className="absolute rounded-full bg-white"
                                    style={{ width:"1.5px", height:"1.5px", left:`${(i*17+7)%100}%`, top:`${(i*23+5)%100}%`, opacity:0.5+i%3*0.15 }} />
                                ))}
                              </div>
                            )}
                            {opt.id === "evox" && (
                              <div className="absolute inset-0" style={{ background: "linear-gradient(135deg,#02030e,#050210)" }}>
                                <div className="absolute -top-2 end-0 w-10 h-8 rounded-full" style={{ background: "radial-gradient(circle,rgba(220,38,38,0.16) 0%,transparent 60%)", filter: "blur(5px)" }} />
                                <div className="absolute top-1 -start-1 w-9 h-7 rounded-full" style={{ background: "radial-gradient(circle,rgba(29,78,216,0.16) 0%,transparent 60%)", filter: "blur(5px)" }} />
                              </div>
                            )}
                            {active && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="flex h-4 w-4 items-center justify-center rounded-full" style={{ background: "var(--primary)" }}>
                                  <Check className="h-2.5 w-2.5 text-white" />
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="py-1 text-center" style={{ background: active ? "rgba(29,155,240,0.08)" : "rgb(var(--card))" }}>
                            <p className="text-[9px] font-bold text-muted-foreground leading-none">{opt.label}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Language selector — compact variant renders the same square
               shell as the other trailing action buttons. */}
            <LanguageSelector compact />

            {/* Bell */}
            {isLoggedIn && <NotificationBell />}

            {/* Sign In — same 32/36px square footprint as other trailing actions
               so the header layout stays identical before and after login. On
               ≥sm screens it expands inline to show the label. */}
            {!isLoggedIn && (
              <Link
                href="/login"
                aria-label={t("auth.signIn")}
                title={t("auth.signIn")}
                className="group relative shrink-0 inline-flex h-8 w-8 items-center justify-center gap-1.5 overflow-hidden rounded-xl text-xs font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-95 sm:h-9 sm:w-auto sm:min-w-9 sm:px-3"
                style={{
                  background: "linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 75%, #3b82f6) 100%)",
                }}
              >
                <LogIn className="relative h-4 w-4 shrink-0" />
                <span className="relative hidden whitespace-nowrap sm:inline">{t("auth.signIn")}</span>
              </Link>
            )}

            {/* Avatar + user menu — occupies the same 32/36px square as the
               Sign-In button so the header geometry never shifts between
               logged-out and logged-in states. */}
            {isLoggedIn && (
              <div ref={menuRef} className="relative shrink-0">
                <button
                  onClick={() => { window.dispatchEvent(new CustomEvent("close-lang-menu")); setShowUserMenu(!showUserMenu); setShowSettings(false); }}
                  className="group relative inline-flex h-8 w-8 items-center justify-center rounded-xl hover:bg-muted transition-all duration-200 active:scale-90 sm:h-9 sm:w-9"
                  aria-label={t("header.userMenu")}>
                  <div className="relative h-7 w-7 sm:h-8 sm:w-8">
                    <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: "conic-gradient(from 0deg, var(--primary), #a78bfa, var(--primary))", padding: "1.5px", borderRadius: "50%", animation: showUserMenu ? "spin 2s linear infinite" : "none" }} />
                    <Image
                      src={safeImg(userDoc?.photo || user?.photoURL, DEFAULT_AVATAR)}
                      alt={userDoc?.name || "User"}
                      width={32} height={32}
                      className="relative h-full w-full rounded-full object-cover ring-1 ring-border group-hover:ring-[var(--primary)] transition-all duration-300"
                    />
                    <span className="absolute bottom-0 end-0 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-background"
                      style={{ boxShadow: "0 0 4px rgba(52,211,153,0.28)" }} />
                  </div>
                </button>

                {showUserMenu && (
                  <div dir={dir} className="absolute end-0 top-full mt-2 w-60 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-scale-in-menu"
                    style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)", transformOrigin: dir === "rtl" ? "top right" : "top right" }}>
                    <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--primary-glow), transparent)" }} />

                    <div className="relative flex items-center gap-3 border-b border-border px-4 py-3">
                      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, var(--primary-dim) 0%, transparent 70%)" }} />
                      <Image
                        src={safeImg(userDoc?.photo || user?.photoURL, DEFAULT_AVATAR)}
                        alt={userDoc?.name || "User"}
                        width={36} height={36}
                        className="relative rounded-xl ring-1 ring-border shrink-0"
                      />
                      <div className="relative min-w-0 flex-1">
                        <p className="text-sm font-black text-foreground truncate">{userDoc?.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {userDoc?.username ? `@${userDoc.username}` : userDoc?.email}
                        </p>
                      </div>
                    </div>

                    <div className="py-1">
                      {[
                        { href: `/u/${user?.uid}`, icon: User, label: t("profile.myProfile"), color: undefined },
                        { href: "/favorites", icon: Heart, label: t("nav.favorites"), color: undefined },
                        ...(isAdmin ? [{ href: "/admin", icon: Shield, label: t("nav.admin"), color: "var(--destructive)" as string }] : []),
                      ].map((item) => (
                        <Link key={item.href} href={item.href} onClick={() => setShowUserMenu(false)}
                          className="group flex items-center gap-3 px-4 py-2.5 text-sm transition-all hover:bg-muted/60 active:scale-[0.98]"
                          style={{ color: item.color || "var(--muted-foreground)" }}>
                          <item.icon className="h-4 w-4 transition-transform group-hover:scale-110 group-hover:rotate-[-5deg]" />
                          <span className="group-hover:text-foreground transition-colors">{item.label}</span>
                        </Link>
                      ))}
                    </div>

                    <div className="border-t border-border py-1">
                      <button onClick={() => { logout(); setShowUserMenu(false); }}
                        className="group flex w-full items-center gap-3 px-4 py-2.5 text-sm text-destructive transition-all hover:bg-destructive/10 active:scale-[0.98]">
                        <LogOut className="h-4 w-4 transition-transform group-hover:scale-110 group-hover:translate-x-[-2px]" />
                        {t("auth.signOut")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <style>{`
        @keyframes bell-ring {
          0%, 100% { transform: rotate(0deg); }
          20%       { transform: rotate(15deg); }
          40%       { transform: rotate(-12deg); }
          60%       { transform: rotate(8deg); }
          80%       { transform: rotate(-5deg); }
        }
      `}</style>
    </>
  );
                      }
