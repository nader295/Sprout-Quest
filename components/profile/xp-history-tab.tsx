"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// ─── XP History — recent XP ledger for profile owner/admin view ──────────────
// Self-contained: fetches its own data, uses props only for `uid`.
export function XPHistoryTab({ uid }: { uid: string }) {
  const [history, setHistory] = useState<{ id: string; amount: number; reason: string; before: number; after: number; ts: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, lang } = useTranslation();

  useEffect(() => {
    (async () => {
      try {
        const { auth } = await import("@/lib/firebase/client");
        const token = await auth.currentUser?.getIdToken();
        if (!token) return; // endpoint requires auth (owner or admin)
        const res = await fetch(`/api/users/${encodeURIComponent(uid)}/xp-history?limit=30`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const { items } = (await res.json()) as {
          items: Array<{ id: string; amount: number; reason: string; before_xp: number; after_xp: number; created_at: string }>;
        };
        setHistory(
          (items || []).map((d) => ({
            id: d.id,
            amount: d.amount,
            reason: d.reason,
            before: d.before_xp,
            after: d.after_xp,
            ts: d.created_at,
          })),
        );
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  const REASON_LABELS: Record<string, { labelKey: string; icon: string }> = {
    ROM_PUBLISH:      { labelKey: "xp.reason.romPublish",      icon: "🚀" },
    VERSION_UPDATE:   { labelKey: "xp.reason.versionUpdate",   icon: "🔄" },
    LIKE_RECEIVED:    { labelKey: "xp.reason.likeReceived",    icon: "❤️" },
    DOWNLOADS_PER_10: { labelKey: "xp.reason.downloadsPerTen", icon: "⬇️" },
    COMMENT_FIRST:    { labelKey: "xp.reason.commentFirst",    icon: "💬" },
    NEW_FOLLOWER:     { labelKey: "xp.reason.newFollower",     icon: "👤" },
    CHANNEL_SETUP:    { labelKey: "xp.reason.channelSetup",    icon: "📡" },
    first_rom:        { labelKey: "xp.reason.firstRom",        icon: "🏆" },
    delete_rom:       { labelKey: "xp.reason.deleteRom",       icon: "🗑️" },
    deduction:        { labelKey: "xp.reason.deduction",       icon: "📉" },
    manual:           { labelKey: "xp.reason.manual",          icon: "✏️" },
  };

  if (loading) return (
    <div className="flex justify-center py-8">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
  if (!history.length) return (
    <div className="text-center py-8 text-xs text-muted-foreground">{t("xp.noHistory")}</div>
  );

  return (
    <div className="space-y-1.5 max-h-72 overflow-y-auto px-1">
      {history.map((h) => {
        const isPlus = h.amount > 0;
        const key = Object.keys(REASON_LABELS).find(k => (h.reason || "").includes(k));
        const meta = key ? REASON_LABELS[key] : { labelKey: "", icon: "⚡" };
        const label = meta.labelKey ? t(meta.labelKey) : h.reason;
        return (
          <div key={h.id} className="flex items-center gap-2.5 rounded-xl border border-border bg-card/50 px-3 py-2">
            <span className="text-base shrink-0">{meta.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-foreground truncate">{label}</p>
              <p className="text-[9px] text-muted-foreground">{h.before?.toLocaleString()} → {h.after?.toLocaleString()} XP</p>
            </div>
            <div className="shrink-0 text-end">
              <span className={cn("text-sm font-black", isPlus ? "text-emerald-400" : "text-rose-400")}>
                {isPlus ? "+" : ""}{h.amount?.toLocaleString()}
              </span>
              <p className="text-[9px] text-muted-foreground/50">
                {h.ts ? new Date(h.ts).toLocaleDateString(lang, { month: "short", day: "numeric" }) : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
