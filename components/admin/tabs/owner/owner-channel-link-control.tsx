"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";
import { Loader2, Zap } from "lucide-react";

const LEVELS = [
  { xp: 0,    label: "الكل (Level 1+)" },
  { xp: 150,  label: "Publisher (Level 3+)" },
  { xp: 600,  label: "Developer (Level 7+)" },
  { xp: 1800, label: "Top Developer (Level 10+)" },
];

export function OwnerChannelLinkControl() {
  const [currentXP, setCurrentXP]   = useState<number | null>(null);
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState<{ text: string; ok: boolean } | null>(null);
  const [customVal, setCustomVal]   = useState("");
  const [customOpen, setCustomOpen] = useState(false);

  const flash = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3500);
  };

  const getToken = async () => (await auth.currentUser?.getIdToken()) ?? "";

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch("/api/config", { headers: { Authorization: `Bearer ${token}` } });
        const cfg = res.ok ? await res.json() : null;
        if (cfg?.channelLinkMinXP !== undefined) {
          setCurrentXP(cfg.channelLinkMinXP);
          if (!LEVELS.some(l => l.xp === cfg.channelLinkMinXP) && cfg.channelLinkMinXP > 0) {
            setCustomOpen(true);
            setCustomVal(String(cfg.channelLinkMinXP));
          }
        }
      } catch { /* silent */ }
    })();
  }, []);

  const save = async (xp: number) => {
    if (isNaN(xp) || xp < 0) { flash("قيمة XP غير صالحة", false); return; }
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ channelLinkMinXP: xp }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.error || "Failed");
      }
      setCurrentXP(xp);
      const label = LEVELS.find(l => l.xp === xp)?.label ?? `${xp} XP`;
      flash(`✓ تم التحديث — زر ⚡ يظهر لـ ${label}`);
    } catch (e: any) {
      flash(`فشل الحفظ: ${e?.message ?? "خطأ غير معروف"}`, false);
    } finally {
      setSaving(false);
    }
  };

  const isCustomActive = currentXP !== null && !LEVELS.some(l => l.xp === currentXP);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/50 bg-muted/20 px-4 py-3">
        <Zap className="h-4 w-4 text-sky-400" />
        <h3 className="text-sm font-bold text-foreground">Channel Link Button (⚡)</h3>
        <span className="ms-auto text-[10px] text-muted-foreground font-medium">من يشوف زر إضافة القنوات للمنشورات؟</span>
      </div>

      {msg && (
        <div className={cn("mx-4 mt-4 rounded-lg px-3 py-2 text-xs font-medium border",
          msg.ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : "border-destructive/30 bg-destructive/10 text-destructive"
        )}>
          {msg.text}
        </div>
      )}

      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {LEVELS.map((lvl) => {
          const isActive = currentXP === lvl.xp;
          return (
            <button
              key={lvl.xp}
              onClick={() => { setCustomOpen(false); if (!isActive) save(lvl.xp); }}
              disabled={saving || currentXP === null}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60",
                isActive ? "border-sky-500/50 bg-sky-500/10" : "border-border bg-muted/20 hover:bg-muted/40"
              )}
            >
              {saving && isActive
                ? <Loader2 className="h-5 w-5 animate-spin text-sky-400" />
                : <Zap className={cn("h-5 w-5", isActive ? "text-sky-400" : "text-muted-foreground/40")} />}
              <span className={cn("text-[11px] font-bold leading-tight", isActive ? "text-sky-400" : "text-muted-foreground")}>{lvl.label}</span>
              {isActive && <span className="text-[9px] font-black uppercase tracking-widest text-sky-400/70">● نشط</span>}
            </button>
          );
        })}

        <button
          onClick={() => setCustomOpen(o => !o)}
          disabled={saving || currentXP === null}
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 col-span-2 sm:col-span-4",
            isCustomActive ? "border-amber-500/50 bg-amber-500/10" : "border-dashed border-border bg-muted/10 hover:bg-muted/30"
          )}
        >
          <span className={cn("text-[11px] font-bold", isCustomActive ? "text-amber-400" : "text-muted-foreground")}>
            {isCustomActive ? `✦ مخصص — ${currentXP} XP نشط` : "✦ XP مخصص"}
          </span>
        </button>
      </div>

      {customOpen && (
        <div className="px-4 pb-4 flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={customVal}
            onChange={e => setCustomVal(e.target.value)}
            placeholder="أدخل قيمة XP المطلوبة"
            className="flex-1 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
          />
          <button
            onClick={() => save(parseInt(customVal, 10))}
            disabled={saving || !customVal}
            className="rounded-xl bg-sky-500/20 border border-sky-500/40 px-4 py-2 text-xs font-bold text-sky-400 hover:bg-sky-500/30 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "حفظ"}
          </button>
        </div>
      )}
    </div>
  );
}
