"use client";

import type React from "react";
import { useState } from "react";
import {
  Coffee, DollarSign, ExternalLink, Github, Globe, Heart, Link2,
  Plus, Send, Trash2, X as XIcon, Youtube, Zap,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { DonationLink, ProfileLink, UserDoc } from "@/lib/types";

// ── Link / Donation platform registries ─────────────────────────────────────
// Exported so the profile render surface (read-only link strip) can reuse the
// same icon + color palette as the edit surface.

export const LINK_PLATFORMS = [
  { id: "telegram",  label: "Telegram",   icon: Send,         prefix: "t.me/",          placeholder: "username أو channel" },
  { id: "github",    label: "GitHub",     icon: Github,       prefix: "github.com/",    placeholder: "username" },
  { id: "youtube",   label: "YouTube",    icon: Youtube,      prefix: "youtube.com/",   placeholder: "@handle" },
  { id: "tiktok",    label: "TikTok",     icon: Globe,        prefix: "tiktok.com/@",   placeholder: "@username" },
  { id: "instagram", label: "Instagram",  icon: Globe,        prefix: "instagram.com/", placeholder: "username" },
  { id: "twitter",   label: "Twitter/X",  icon: Globe,        prefix: "x.com/",         placeholder: "username" },
  { id: "linkedin",  label: "LinkedIn",   icon: Globe,        prefix: "linkedin.com/in/", placeholder: "username" },
  { id: "xda",       label: "XDA",        icon: ExternalLink, prefix: "",               placeholder: "https://xda-developers.com/..." },
  { id: "website",   label: "Website",    icon: Globe,        prefix: "",               placeholder: "https://yoursite.com" },
] as const;
export type LinkPlatformId = typeof LINK_PLATFORMS[number]["id"];

export const PLATFORM_COLORS: Record<string, string> = {
  telegram:  "#38bdf8", github:    "#e2e8f0", youtube:   "#f87171",
  twitter:   "#94a3b8", xda:       "#f59e0b", website:   "#34d399",
  tiktok:    "#ff0050", instagram: "#e1306c", linkedin:  "#0077b5",
  custom:    "#a78bfa",
};

export const DONATION_PLATFORMS = [
  { id: "buymeacoffee" as const, label: "Buy Me a Coffee", icon: Coffee,       prefix: "buymeacoffee.com/", placeholder: "username",              color: "#FFDD00", textColor: "#000" },
  { id: "paypal"       as const, label: "PayPal",          icon: DollarSign,   prefix: "paypal.me/",       placeholder: "username",              color: "#0070ba", textColor: "#fff" },
  { id: "patreon"      as const, label: "Patreon",         icon: Heart,        prefix: "patreon.com/",     placeholder: "username",              color: "#ff424d", textColor: "#fff" },
  { id: "kofi"         as const, label: "Ko-fi",           icon: Coffee,       prefix: "ko-fi.com/",       placeholder: "username",              color: "#13C3FF", textColor: "#fff" },
  { id: "custom"       as const, label: "رابط مخصص",       icon: Link2,        prefix: "",                  placeholder: "https://...",           color: "#a78bfa", textColor: "#fff" },
] as const;
export type DonationPlatformId = typeof DONATION_PLATFORMS[number]["id"];

export function newDonation(platformId: DonationPlatformId): DonationLink {
  const pl = DONATION_PLATFORMS.find(p => p.id === platformId)!;
  return { platform: platformId, url: "", label: pl.label };
}

export function newLink(platform: LinkPlatformId): ProfileLink {
  return {
    id: Math.random().toString(36).slice(2),
    platform,
    url: "",
    label: LINK_PLATFORMS.find(p => p.id === platform)?.label ?? platform,
    isChannel: false,
  };
}

// First-time migration from old flat user fields → unified profileLinks array.
// If user has intentionally set `profileLinks` (even empty), respect it.
export function buildProfileLinks(u: UserDoc): ProfileLink[] {
  if (u.profileLinks !== undefined) return u.profileLinks;
  const links: ProfileLink[] = [];
  const add = (platform: ProfileLink["platform"], url: string, label: string) => {
    if (url?.trim()) links.push({ id: Math.random().toString(36).slice(2), platform, url: url.trim(), label, isChannel: false });
  };
  if (u.telegram) add("telegram", u.telegram, "Telegram");
  if (u.github)   add("github",   u.github,   "GitHub");
  if (u.youtube)  add("youtube",  u.youtube,  "YouTube");
  if (u.twitter)  add("twitter",  u.twitter,  "Twitter/X");
  if (u.xda)      add("xda",      u.xda,      "XDA");
  if (u.website)  add("website",  u.website,  "Website");
  if (u.channelLinks) {
    links.forEach(l => {
      const cl = u.channelLinks!.find(c => c.platform === l.platform);
      if (cl) l.isChannel = true;
    });
  }
  return links;
}

// ── Edit Donation Links ─────────────────────────────────────────────────────
export function EditDonationLinks({
  donationLinks,
  setDonationLinks,
}: {
  donationLinks: DonationLink[];
  setDonationLinks: React.Dispatch<React.SetStateAction<DonationLink[]>>;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const { t } = useTranslation();
  const update = (idx: number, changes: Partial<DonationLink>) =>
    setDonationLinks(prev => prev.map((l, i) => i === idx ? { ...l, ...changes } : l));
  const remove = (idx: number) =>
    setDonationLinks(prev => prev.filter((_, i) => i !== idx));
  const add = (platformId: DonationPlatformId) => {
    setDonationLinks(prev => [...prev, newDonation(platformId)]);
    setShowPicker(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Heart className="h-3 w-3" /> {t("profile.donationLinks")}
        </p>
      </div>

      <div className="space-y-2 mb-2">
        {donationLinks.map((link, idx) => {
          const pl = DONATION_PLATFORMS.find(p => p.id === link.platform);
          const Icon = pl?.icon ?? Heart;
          const color = pl?.color ?? "#a78bfa";
          return (
            <div key={idx} className="rounded-2xl border border-border overflow-hidden">
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
                  <Icon className="h-3.5 w-3.5" style={{ color }} />
                </div>
                <input value={link.label} onChange={e => update(idx, { label: e.target.value })}
                  className="flex-1 min-w-0 bg-transparent text-xs font-bold text-foreground/80 placeholder:text-muted-foreground/30 focus:outline-none"
                  placeholder={pl?.label ?? t("profile.linkNamePlaceholder")} />
                <button onClick={() => remove(idx)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground/30 hover:text-destructive transition-colors">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <div className="flex items-center gap-1 px-3 pb-2.5">
                {pl?.prefix && <span className="text-[10px] text-muted-foreground/40 shrink-0">{pl.prefix}</span>}
                <input value={link.url} onChange={e => update(idx, { url: e.target.value })}
                  placeholder={pl?.placeholder ?? t("profile.linkUrl")}
                  className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none" />
              </div>
            </div>
          );
        })}
      </div>

      {showPicker ? (
        <div className="rounded-2xl border border-border bg-card/30 p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground font-medium">{t("profile.chooseDonationPlatform")}</p>
            <button onClick={() => setShowPicker(false)} className="text-muted-foreground/40 hover:text-foreground transition-colors">
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {DONATION_PLATFORMS.map((pl) => (
              <button key={pl.id} onClick={() => add(pl.id)}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card/50 p-3 hover:border-[var(--primary)] hover:bg-card transition-all group">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg group-hover:scale-110 transition-transform"
                  style={{ background: `${pl.color}20` }}>
                  <pl.icon className="h-4 w-4" style={{ color: pl.color }} />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors text-center leading-tight">{pl.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button onClick={() => setShowPicker(true)}
          className="flex items-center justify-center gap-2 w-full rounded-2xl border border-dashed border-border py-3 text-xs text-muted-foreground hover:text-foreground hover:border-[var(--primary)] transition-all">
          <Plus className="h-3.5 w-3.5" /> {t("profile.addDonation")}
        </button>
      )}</div>
  );
}

// ── Edit Social Links ───────────────────────────────────────────────────────
export function EditSocialLinks({
  profileLinks,
  setProfileLinks,
}: {
  profileLinks: ProfileLink[];
  setProfileLinks: React.Dispatch<React.SetStateAction<ProfileLink[]>>;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const { t } = useTranslation();

  const updateLink = (id: string, changes: Partial<ProfileLink>) =>
    setProfileLinks(prev => prev.map(l => l.id === id ? { ...l, ...changes } : l));

  const removeLink = (id: string) =>
    setProfileLinks(prev => prev.filter(l => l.id !== id));

  const addLink = (platformId: LinkPlatformId) => {
    setProfileLinks(prev => [...prev, newLink(platformId)]);
    setShowPicker(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Link2 className="h-3 w-3" /> {t("profile.links")}
        </p>
        {profileLinks.length > 0 && (
          <span className="text-[10px] text-muted-foreground/40">{t("profile.linkCount", { n: profileLinks.length })}</span>
        )}
      </div>

      {profileLinks.length > 0 && (
        <p className="text-[10px] text-muted-foreground/50 mb-3 flex items-center gap-1">
          <Zap className="h-3 w-3 shrink-0" style={{ color: "var(--primary)" }} />
          {t("profile.channelLinkHint")}
        </p>
      )}

      <div className="space-y-2 mb-2">
        {profileLinks.map((link) => {
          const pl = LINK_PLATFORMS.find(p => p.id === link.platform);
          const Icon = pl?.icon ?? Link2;
          const color = PLATFORM_COLORS[link.platform] ?? "#94a3b8";
          return (
            <div key={link.id} className={cn(
              "rounded-2xl border overflow-hidden transition-colors",
              link.isChannel ? "border-[var(--primary)]" : "border-border"
            )} style={link.isChannel ? { background: "rgba(29,155,240,0.04)" } : undefined}>
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                  <Icon className="h-3.5 w-3.5" style={{ color }} />
                </div>
                <input
                  value={link.label}
                  onChange={e => updateLink(link.id, { label: e.target.value })}
                  placeholder={pl?.label ?? t("profile.linkNamePlaceholder")}
                  className="flex-1 min-w-0 bg-transparent text-xs font-bold text-foreground/80 placeholder:text-muted-foreground/30 focus:outline-none"
                />
                <button onClick={() => updateLink(link.id, { isChannel: !link.isChannel })}
                  title={link.isChannel ? t("profile.removeFromChannel") : t("profile.addToChannel")}
                  className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors",
                    link.isChannel ? "text-white" : "bg-muted/50 text-muted-foreground/40 hover:text-foreground"
                  )}
                  style={link.isChannel ? { backgroundColor: "var(--primary)" } : undefined}>
                  <Zap className="h-3 w-3" />
                </button>
                <button onClick={() => removeLink(link.id)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground/30 hover:text-destructive transition-colors">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <div className="flex items-center gap-1 px-3 pb-2.5">
                {pl?.prefix && (
                  <span className="text-[10px] text-muted-foreground/40 shrink-0">{pl.prefix}</span>
                )}
                <input
                  value={link.url}
                  onChange={e => updateLink(link.id, { url: e.target.value })}
                  placeholder={pl?.placeholder ?? t("profile.linkUrl")}
                  className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
                />
              </div>
            </div>
          );
        })}
      </div>

      {showPicker ? (
        <div className="rounded-2xl border border-border bg-card/30 p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground font-medium">{t("profile.choosePlatform")}</p>
            <button onClick={() => setShowPicker(false)} className="text-muted-foreground/40 hover:text-foreground transition-colors">
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {LINK_PLATFORMS.map((pl) => (
              <button key={pl.id} onClick={() => addLink(pl.id)}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card/50 p-3 hover:border-[var(--primary)] hover:bg-card transition-all group">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg group-hover:scale-110 transition-transform"
                  style={{ background: `${PLATFORM_COLORS[pl.id]}18` }}>
                  <pl.icon className="h-4 w-4" style={{ color: PLATFORM_COLORS[pl.id] }} />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">{pl.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button onClick={() => setShowPicker(true)}
          className="flex items-center justify-center gap-2 w-full rounded-2xl border border-dashed border-border py-3 text-xs text-muted-foreground hover:text-foreground hover:border-[var(--primary)] transition-all">
          <Plus className="h-3.5 w-3.5" /> {t("profile.addLink")}
        </button>
      )}
    </div>
  );
}
