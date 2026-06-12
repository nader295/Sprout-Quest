"use client";

import { useEffect, useState } from "react";
import { apiListRoms } from "@/lib/api/client";
import type { RomItem } from "@/lib/types";
import { formatCount, cn, getContentTypeLabel, getStatusColor } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeftRight, Plus, X, Download, Heart, Eye,
  Check, Minus, Loader2, Smartphone, Shield, TrendingUp,
  Zap, Star, AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { getFullUrl } from "@/lib/cloudinary-utils";

// ─── Comparison helper ────────────────────────────────────────────────────────
type WinState = "a" | "b" | "tie";

function getWin(a: number | undefined, b: number | undefined, higherBetter = true): WinState {
  if (a === undefined || b === undefined) return "tie";
  if (a === b) return "tie";
  if (higherBetter) return a > b ? "a" : "b";
  return a < b ? "a" : "b";
}

// ─── Stat row ─────────────────────────────────────────────────────────────────
function CompareStatRow({
  label, va, vb, numA, numB, higherBetter = true, icon: Icon,
}: {
  label: string;
  va: string;
  vb: string;
  numA?: number;
  numB?: number;
  higherBetter?: boolean;
  icon?: React.ElementType;
}) {
  const win = getWin(numA, numB, higherBetter);
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2.5 border-b border-border/15 last:border-0">
      <div className={cn("flex items-center gap-1", win === "a" ? "text-emerald-400 font-black" : win === "b" ? "text-muted-foreground/40" : "text-foreground")}>
        {win === "a" && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />}
        <span className="text-xs tabular-nums">{va || "—"}</span>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        {Icon && <Icon className="h-3 w-3 text-muted-foreground/30" />}
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40 whitespace-nowrap">{label}</span>
      </div>
      <div className={cn("flex items-center justify-end gap-1", win === "b" ? "text-emerald-400 font-black" : win === "a" ? "text-muted-foreground/40" : "text-foreground")}>
        <span className="text-xs tabular-nums">{vb || "—"}</span>
        {win === "b" && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />}
      </div>
    </div>
  );
}

// ─── Health bar mini ──────────────────────────────────────────────────────────
function HealthBar({ value, side }: { value: number; side: "left" | "right" }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 70 ? "#34d399" : pct >= 45 ? "#f59e0b" : "#fb7185";
  return (
    <div className={cn("flex items-center gap-1.5", side === "right" && "flex-row-reverse")}>
      <span className="text-xs font-black tabular-nums" style={{ color }}>{pct.toFixed(0)}%</span>
      <div className="w-16 h-1.5 rounded-full bg-muted/40 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 4px ${color}80` }} />
      </div>
    </div>
  );
}

export default function ComparePage() {
  const [searchQ, setSearchQ] = useState("");
  const [allRoms, setAllRoms] = useState<RomItem[]>([]);
  const [suggestions, setSuggestions] = useState<RomItem[]>([]);
  const [slots, setSlots] = useState<(RomItem | null)[]>([null, null]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [searching, setSearching] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    setSearching(true);
    apiListRoms({ max: 100, sortBy: "newest" })
      .then(({ items }) => setAllRoms(items))
      .finally(() => setSearching(false));
  }, []);

  useEffect(() => {
    if (searchQ.length < 2) { setSuggestions([]); return; }
    const q = searchQ.toLowerCase();
    setSuggestions(
      allRoms
        .filter((r) => r.name.toLowerCase().includes(q) || r.device?.toLowerCase().includes(q))
        .slice(0, 8)
    );
  }, [searchQ, allRoms]);

  const selectRom = (rom: RomItem) => {
    setSlots((prev) => {
      const next = [...prev];
      next[activeSlot] = rom;
      return next;
    });
    setSearchQ("");
    setSuggestions([]);
    setActiveSlot(activeSlot === 0 ? 1 : 0);
  };

  const removeSlot = (idx: number) => {
    setSlots((prev) => { const next = [...prev]; next[idx] = null; return next; });
  };

  const a = slots[0];
  const b = slots[1];

  // Score summary
  const scoreA = a ? (a.downloads ?? 0) + (a.likesCount ?? 0) * 3 + (a.healthScore ?? 80) : 0;
  const scoreB = b ? (b.downloads ?? 0) + (b.likesCount ?? 0) * 3 + (b.healthScore ?? 80) : 0;
  const winner = a && b ? (scoreA > scoreB ? a : scoreB > scoreA ? b : null) : null;

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6 pb-40 lg:pb-12">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ background: "linear-gradient(135deg, var(--primary-dim), rgba(99,102,241,0.1))", border: "1px solid var(--primary)" }}>
          <ArrowLeftRight className="h-5 w-5" style={{ color: "var(--primary)" }} />
        </div>
        <div>
          <h1 className="text-base font-black text-foreground">{t("compare.title")}</h1>
          <p className="text-[10px] text-muted-foreground/50">{t("compare.subtitle")}</p>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative mb-4">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card/80 px-4 pr-3 py-2.5 backdrop-blur-sm focus-within:border-[var(--primary)]/50 transition-all">
          {searching ? <Loader2 className="h-4 w-4 text-muted-foreground/40 animate-spin shrink-0" /> : <Smartphone className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
          <input
            value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
            placeholder={t("compare.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
          />
          <span className="text-[10px] text-muted-foreground/40 font-mono">
            {t("compare.addingTo") || "Adding to"} <span className="font-black" style={{ color: "var(--primary)" }}>ROM {activeSlot + 1}</span>
          </span>
        </div>

        {suggestions.length > 0 && (
          <div className="absolute top-full z-30 mt-1 w-full rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
            {suggestions.map((r) => (
              <button key={r.id} onClick={() => selectRom(r)}
                className="group flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-muted transition-colors first:rounded-t-2xl last:rounded-b-2xl">
                {r.thumbnail ? (
                  <Image src={getFullUrl(r.thumbnail)} alt="" width={36} height={36}
                    className="rounded-xl object-cover shrink-0" crossOrigin="anonymous" />
                ) : (
                  <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <Smartphone className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate group-hover:text-[var(--primary)] transition-colors">{r.name}</p>
                  <p className="text-[10px] text-muted-foreground/60">{r.device} · {r.brand}</p>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                  <Download className="h-3 w-3" /> {formatCount(r.downloads)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── ROM Slots ── */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {slots.map((rom, idx) => (
          <div key={idx}
            onClick={() => !rom && setActiveSlot(idx)}
            className={cn(
              "relative rounded-2xl border overflow-hidden transition-all duration-300 cursor-pointer",
              rom ? "border-border bg-card shadow-lg" : "border-dashed border-border/50 bg-muted/10",
              !rom && activeSlot === idx && "border-[var(--primary)]/60 bg-[var(--primary-dim)] shadow-lg",
              !rom && activeSlot !== idx && "hover:border-border"
            )}>
            {rom ? (
              <>
                {rom.thumbnail && (
                  <div className="relative h-20 w-full overflow-hidden">
                    <Image src={getFullUrl(rom.thumbnail)} alt={rom.name} fill className="object-cover opacity-75" crossOrigin="anonymous" />
                    <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgb(var(--card)) 0%, transparent 100%)" }} />
                  </div>
                )}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <Link href={`/rom/${rom.id}`} className="text-xs font-black text-foreground hover:text-[var(--primary)] truncate transition-colors">{rom.name}</Link>
                    <button onClick={(e) => { e.stopPropagation(); removeSlot(idx); }} className="shrink-0 text-muted-foreground/40 hover:text-destructive transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground/50">{rom.device} · Android {rom.android}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="rounded-full px-1.5 py-0.5 text-[9px] font-black"
                      style={{
                        background: idx === 0 ? "rgba(29,155,240,0.15)" : "rgba(245,158,11,0.15)",
                        color: idx === 0 ? "#38bdf8" : "#f59e0b",
                        border: `1px solid ${idx === 0 ? "rgba(56,189,248,0.3)" : "rgba(245,158,11,0.3)"}`,
                      }}>
                      ROM {idx + 1}
                    </span>
                    {rom.featured && <Star className="h-3 w-3 text-amber-400 fill-amber-400" />}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-8">
                <div className="h-10 w-10 rounded-2xl flex items-center justify-center"
                  style={{
                    background: activeSlot === idx
                      ? (idx === 0 ? "rgba(29,155,240,0.15)" : "rgba(245,158,11,0.15)")
                      : "rgba(255,255,255,0.04)",
                  }}>
                  <Plus className="h-5 w-5 text-muted-foreground/30" />
                </div>
                <p className="text-[10px] text-muted-foreground/50 text-center px-2">
                  {activeSlot === idx ? (t("compare.typeToSearch") || "Search above ↑") : (t("compare.selectRom") + " " + (idx + 1))}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Comparison Table ── */}
      {a && b && (
        <div className="space-y-3 animate-in fade-in zoom-in-95 duration-400">

          {/* Winner banner */}
          {winner && (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/8 px-4 py-3">
              <Star className="h-5 w-5 text-amber-400 fill-amber-400 shrink-0" />
              <div>
                <p className="text-xs font-black text-amber-400">{t("compare.winner") || "Overall Leader"}</p>
                <p className="text-sm font-black text-foreground">{winner.name}</p>
              </div>
            </div>
          )}

          {/* Stats card */}
          <div className="relative rounded-3xl overflow-hidden gradient-border card-shadow">
            <div className="absolute inset-x-0 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(29,155,240,0.35), transparent)" }} />
            <div className="relative p-4" style={{ background: "rgb(var(--card))" }}>

              {/* Names header */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-4 pb-3 border-b border-border/30">
                <p className="text-xs font-black text-sky-400 truncate">{a.name}</p>
                <span className="text-muted-foreground/25 font-mono text-sm">vs</span>
                <p className="text-xs font-black text-amber-400 truncate text-end">{b.name}</p>
              </div>

              {/* Health Score */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-3 mb-3 rounded-2xl px-3"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <HealthBar value={a.healthScore ?? 80} side="left" />
                <div className="flex flex-col items-center">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground/30 mb-0.5" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">{t("rom.healthScore") || "Health"}</span>
                </div>
                <HealthBar value={b.healthScore ?? 80} side="right" />
              </div>

              {/* Stat rows */}
              <div className="rounded-2xl overflow-hidden bg-muted/10">
                <CompareStatRow label={t("profile.downloads") || "Downloads"} va={formatCount(a.downloads)} vb={formatCount(b.downloads)} numA={a.downloads} numB={b.downloads} icon={Download} />
                <CompareStatRow label={t("profile.likes") || "Likes"} va={formatCount(a.likesCount)} vb={formatCount(b.likesCount)} numA={a.likesCount} numB={b.likesCount} icon={Heart} />
                <CompareStatRow label={t("profile.views") || "Views"} va={formatCount(a.total_views ?? 0)} vb={formatCount(b.total_views ?? 0)} numA={a.total_views ?? 0} numB={b.total_views ?? 0} icon={Eye} />
                <CompareStatRow label={t("rom.trendScore") || "Trend"} va={String(a.trendScore ?? 0)} vb={String(b.trendScore ?? 0)} numA={a.trendScore ?? 0} numB={b.trendScore ?? 0} icon={TrendingUp} />
                <CompareStatRow label="Android" va={a.android ?? "—"} vb={b.android ?? "—"} />
                <CompareStatRow label={t("rom.version") || "Version"} va={a.version ? `v${a.version}` : "—"} vb={b.version ? `v${b.version}` : "—"} />
                <CompareStatRow label={t("compare.label.type") || "Type"} va={getContentTypeLabel(a.contentType)} vb={getContentTypeLabel(b.contentType)} />
              </div>

              {/* Feature flags */}
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/30 mt-4 mb-2 px-1">
                {t("compare.features") || "Features"}
              </p>
              <div className="rounded-2xl overflow-hidden bg-muted/10">
                {[
                  { label: t("rom.featured") || "Featured",     aVal: !!a.featured,        bVal: !!b.featured },
                  { label: t("rom.active") || "Active Status",  aVal: a.romStatus === "active", bVal: b.romStatus === "active" },
                ].map(row => (
                  <div key={row.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2.5 border-b border-border/15 last:border-0 px-3">
                    <div className="flex justify-start">
                      {row.aVal ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-muted-foreground/20" />}
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40 text-center whitespace-nowrap">{row.label}</span>
                    <div className="flex justify-end">
                      {row.bVal ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-muted-foreground/20" />}
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA links */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <Link href={`/rom/${a.id}`}
                  className="flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-black text-white transition-all hover:scale-105 active:scale-95"
                  style={{ background: "linear-gradient(135deg, #1d9bf0, #6366f1)" }}>
                  <Download className="h-3.5 w-3.5" /> {a.name.slice(0, 14)}{a.name.length > 14 ? "…" : ""}
                </Link>
                <Link href={`/rom/${b.id}`}
                  className="flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-black text-white transition-all hover:scale-105 active:scale-95"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)" }}>
                  <Download className="h-3.5 w-3.5" /> {b.name.slice(0, 14)}{b.name.length > 14 ? "…" : ""}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {(!a || !b) && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-5xl mb-4 animate-pulse">⚔️</div>
          <p className="text-sm font-black text-foreground mb-1">{t("compare.emptyTitle") || "Compare Any Two ROMs"}</p>
          <p className="text-xs text-muted-foreground max-w-xs">{t("compare.emptyDesc") || "Search above and select ROMs for a real side-by-side breakdown of health, stats, and features."}</p>
        </div>
      )}
    </div>
  );
}
