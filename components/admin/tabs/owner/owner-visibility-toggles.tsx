"use client";

import { useState } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { apiUpdateProfile } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { EyeOff, Settings, Loader2 } from "lucide-react";

export function OwnerVisibilityToggles() {
  const { t } = useTranslation();
  const { userDoc, refreshUserDoc } = useAuth();
  const [hideSupport, setHideSupport] = useState(userDoc?.hideOwnerSupportButton ?? false);
  const [hideStudio, setHideStudio]   = useState(userDoc?.hideOwnerStudioButton  ?? false);
  const [saving, setSaving] = useState<"support" | "studio" | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const flash = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  };

  const toggle = async (field: "hideOwnerSupportButton" | "hideOwnerStudioButton", current: boolean) => {
    const key = field === "hideOwnerSupportButton" ? "support" : "studio";
    setSaving(key);
    try {
      await apiUpdateProfile({ [field]: !current });
      if (field === "hideOwnerSupportButton") setHideSupport(!current);
      else setHideStudio(!current);
      await refreshUserDoc();
      flash(`✓ ${field === "hideOwnerSupportButton" ? "Support button" : "Studio button"} ${!current ? "hidden" : "visible"}.`);
    } catch {
      flash("Failed to save.", false);
    } finally {
      setSaving(null);
    }
  };

  const toggles: {
    key: "support" | "studio";
    field: "hideOwnerSupportButton" | "hideOwnerStudioButton";
    label: string;
    desc: string;
    icon: React.ElementType;
    value: boolean;
    color: string;
  }[] = [
    { key: "support", field: "hideOwnerSupportButton", label: "Hide Support Button", desc: t("admin.hideSupport.desc"), icon: EyeOff, value: hideSupport, color: "rose" },
    { key: "studio",  field: "hideOwnerStudioButton",  label: "Hide Studio Button",  desc: t("admin.hideStudio.desc"),  icon: Settings, value: hideStudio,  color: "violet" },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/50 bg-muted/20 px-4 py-3">
        <EyeOff className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-bold text-foreground">Visibility Controls</h3>
        <span className="ms-auto text-[10px] text-muted-foreground font-medium">{t("admin.temporaryHint")}</span>
      </div>

      {msg && (
        <div className={cn("mx-4 mt-4 rounded-lg px-3 py-2 text-xs font-medium border",
          msg.ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : "border-destructive/30 bg-destructive/10 text-destructive"
        )}>
          {msg.text}
        </div>
      )}

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {toggles.map((tog) => (
          <button
            key={tog.key}
            onClick={() => toggle(tog.field, tog.value)}
            disabled={saving !== null}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl border p-4 text-start transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60",
              tog.value
                ? tog.color === "rose"
                  ? "border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/15"
                  : "border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/15"
                : "border-border bg-muted/20 hover:bg-muted/40"
            )}
          >
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
              tog.value
                ? tog.color === "rose" ? "bg-rose-500/20 ring-1 ring-rose-500/40" : "bg-violet-500/20 ring-1 ring-violet-500/40"
                : "bg-muted/40 ring-1 ring-border"
            )}>
              {saving === tog.key
                ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                : <tog.icon className={cn("h-4 w-4",
                    tog.value
                      ? tog.color === "rose" ? "text-rose-400" : "text-violet-400"
                      : "text-muted-foreground"
                  )} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-xs font-bold leading-tight",
                tog.value ? tog.color === "rose" ? "text-rose-400" : "text-violet-400" : "text-foreground"
              )}>
                {tog.label}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{tog.desc}</p>
            </div>
            <div className={cn(
              "relative h-5 w-9 shrink-0 rounded-full transition-colors",
              tog.value ? tog.color === "rose" ? "bg-rose-500" : "bg-violet-500" : "bg-muted-foreground/30"
            )}>
              <div className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
                tog.value ? "translate-x-4" : "translate-x-0.5"
              )} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
