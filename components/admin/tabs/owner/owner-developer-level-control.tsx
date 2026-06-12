"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";

const LEVELS = [
  { xp: 150,  label: "Publisher (Level 3+)" },
  { xp: 600,  label: "Developer (Level 7+)" },
  { xp: 1800, label: "Top Developer (Level 10+)" },
  { xp: 4000, label: "Pro Developer (Level 15+)" },
];

export function OwnerDeveloperLevelControl() {
  const [currentXP, setCurrentXP]   = useState<number | null>(null);
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState<{ text: string; ok: boolean } | null>(null);
  const [customVal, setCustomVal]   = useState("");
  const [customOpen, setCustomOpen] = useState(false);

  const flash = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3500);
  };

  useEffect(() => {
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch("/api/admin?action=getSettings&key=dev_threshold_xp", {
          headers: { Authorization: `Bearer ${token ?? ""}` },
        });
        if (res.ok) {
          const d = await res.json();
          const val = Number(d?.value ?? 0);
          if (val > 0) {
            setCurrentXP(val);
            if (!LEVELS.some(l => l.xp === val)) {
              setCustomOpen(true);
              setCustomVal(String(val));
            }
          }
        }
      } catch { /* silent */ }
    })();
  }, []);

  const save = async (xp: number) => {
    if (!xp || xp <= 0) { flash("أدخل قيمة XP صحيحة أكبر من 0", false); return; }
    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "updateSettings", key: "dev_threshold_xp", value: xp }),
      });
      if (!res.ok) throw new Error("Failed");
      setCurrentXP(xp);
      const preset = LEVELS.find(l => l.xp === xp);
      flash(`✓ تم التحديث — الحد: ${preset ? preset.label : xp + " XP مخصص"}`);
    } catch {
      flash("فشل الحفظ", false);
    } finally {
      setSaving(false);
    }
  };

  const handleCustomSave = () => {
    const xp = parseInt(customVal, 10);
    if (isNaN(xp) || xp <= 0) { flash("أدخل رقماً صحيحاً أكبر من 0", false); return; }
    save(xp);
  };

  const isCustomCurrent = currentXP !== null && !LEVELS.some(l => l.xp === currentXP);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/50 bg-muted/20 px-4 py-3">
        <Users className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-bold text-foreground">Developer Classification Threshold</h3>
        <span className="ms-auto text-[10px] text-muted-foreground font-medium">من يُحسب كمطور في الإحصائيات (Total Devs)؟</span>
      </div>

      {msg && (
        <div className={cn("mx-4 mt-4 rounded-lg px-3 py-2 text-xs font-medium border",
          msg.ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : "border-destructive/30 bg-destructive/10 text-destructive"
        )}>
          {msg.text}
        </div>
      )}

      <div className="p-4 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {LEVELS.map((lvl) => {
          const isActive = currentXP === lvl.xp;
          return (
            <button
              key={lvl.xp}
              onClick={() => { setCustomOpen(false); if (!isActive) save(lvl.xp); }}
              disabled={saving}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60",
                isActive ? "border-emerald-500/50 bg-emerald-500/10" : "border-border bg-muted/20 hover:bg-muted/40"
              )}
            >
              <Users className={cn("h-5 w-5", isActive ? "text-emerald-400" : "text-muted-foreground/40")} />
              <span className={cn("text-[11px] font-bold leading-tight", isActive ? "text-emerald-400" : "text-muted-foreground")}>{lvl.label}</span>
              <span className="text-[9px] text-muted-foreground/40 font-mono">{lvl.xp} XP</span>
              {isActive && <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400/70">● حد حالي</span>}
            </button>
          );
        })}
      </div>

      <div className="px-4 pb-4">
        <button
          onClick={() => setCustomOpen(v => !v)}
          className={cn(
            "w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-start transition-all",
            customOpen || isCustomCurrent ? "border-violet-500/40 bg-violet-500/10" : "border-border bg-muted/20 hover:bg-muted/40"
          )}
        >
          <div className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base font-black",
            customOpen || isCustomCurrent ? "bg-violet-500/20 text-violet-400" : "bg-muted/40 text-muted-foreground/40"
          )}>✎</div>
          <div className="flex-1 min-w-0">
            <p className={cn("text-xs font-bold", customOpen || isCustomCurrent ? "text-violet-400" : "text-muted-foreground")}>
              XP مخصص
              {isCustomCurrent && <span className="ms-2 text-[9px] font-black tracking-widest text-violet-400/70">● حد حالي ({currentXP} XP)</span>}
            </p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">اكتب قيمة XP يدوياً كحد أدنى للتصنيف كمطور</p>
          </div>
          <span className={cn("text-xs font-mono transition-transform duration-200 shrink-0",
            customOpen ? "rotate-180 text-violet-400" : "text-muted-foreground/30"
          )}>▾</span>
        </button>

        {customOpen && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3">
            <input
              type="number"
              min={1}
              placeholder="مثال: 250"
              value={customVal}
              onChange={e => setCustomVal(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCustomSave()}
              className="flex-1 bg-transparent text-sm font-mono text-foreground placeholder:text-muted-foreground/30 outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[10px] text-muted-foreground/40 font-mono shrink-0">XP</span>
            <button
              onClick={handleCustomSave}
              disabled={saving || !customVal}
              className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-40 transition-all hover:scale-105 active:scale-95"
              style={{ background: "linear-gradient(135deg,#8b5cf6,#6d28d9)" }}
            >
              {saving ? "..." : "حفظ"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
