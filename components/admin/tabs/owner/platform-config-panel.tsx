"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";
import { Check, Loader2, Settings2 } from "lucide-react";

type CfgSection = "xp_rewards" | "xp_levels" | "level_unlocks" | "moderation" | "features" | "site";

export function PlatformConfigPanel() {
  const [config, setConfig]     = useState<Record<string, unknown> | null>(null);
  const [defaults, setDefaults] = useState<Record<string, unknown> | null>(null);
  const [section, setSection]   = useState<CfgSection>("features");
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState<{ text: string; ok: boolean } | null>(null);
  const [edits, setEdits]       = useState<Record<string, unknown>>({});

  const flash = (text: string, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3000); };

  useEffect(() => {
    setLoading(true);
    const load = async () => {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/config", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json() as { config: Record<string, unknown>; defaults: Record<string, unknown> };
      setConfig(data.config);
      setDefaults(data.defaults);
      setEdits((data.config[section] as Record<string, unknown>) || {});
      setLoading(false);
    };
    load().catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchSection = (s: CfgSection) => {
    setSection(s);
    setEdits(((config?.[s]) as Record<string, unknown>) || {});
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ section, updates: edits }),
      });
      if (!res.ok) throw new Error("Failed");
      setConfig(prev => prev ? { ...prev, [section]: edits } : prev);
      flash(`✓ ${section} saved`);
    } catch { flash("Save failed", false); }
    finally { setSaving(false); }
  };

  const handleReset = async () => {
    if (!confirm(`Reset ${section} to defaults?`)) return;
    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ section }),
      });
      const defVal = (defaults?.[section] as Record<string, unknown>) || {};
      setEdits(defVal);
      setConfig(prev => prev ? { ...prev, [section]: defVal } : prev);
      flash(`✓ ${section} reset to defaults`);
    } catch { flash("Reset failed", false); }
    finally { setSaving(false); }
  };

  const SECTIONS: { id: CfgSection; label: string; icon: string; desc: string }[] = [
    { id: "features",      label: "Features",     icon: "⚡", desc: "تفعيل/تعطيل مميزات الموقع" },
    { id: "xp_rewards",    label: "XP Rewards",   icon: "🎯", desc: "قيمة الـ XP لكل action" },
    { id: "level_unlocks", label: "Level Unlocks", icon: "🔓", desc: "الـ Level المطلوب لكل ميزة" },
    { id: "xp_levels",     label: "XP Levels",    icon: "📊", desc: "الـ XP المطلوب لكل level" },
    { id: "moderation",    label: "Moderation",   icon: "🛡️", desc: "حدود الـ auto-moderation" },
    { id: "site",          label: "Site Settings", icon: "⚙️", desc: "إعدادات عامة للموقع" },
  ];

  const curSec = SECTIONS.find(s => s.id === section);
  const curEdits = edits as Record<string, unknown>;
  const defSec   = (defaults?.[section] as Record<string, unknown>) || {};

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
        <Settings2 className="h-4 w-4" style={{ color: "var(--primary)" }} />
        <h3 className="text-sm font-bold text-foreground">Platform Configuration</h3>
        <span className="ms-auto text-[10px] text-muted-foreground">بدون تعديل ملفات الكود</span>
      </div>

      <div className="flex flex-col sm:flex-row min-h-0">
        <div className="flex flex-row sm:flex-col gap-1 p-3 border-b sm:border-b-0 sm:border-e border-border sm:w-44 overflow-x-auto sm:overflow-visible scrollbar-none">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => switchSection(s.id)}
              className={cn("flex items-center gap-2 rounded-lg px-2.5 py-2 text-start transition-colors shrink-0 sm:w-full",
                section === s.id ? "bg-primary/10 text-[var(--primary)]" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
              <span className="text-sm shrink-0">{s.icon}</span>
              <div className="min-w-0 hidden sm:block">
                <p className="text-xs font-semibold truncate">{s.label}</p>
                <p className="text-[9px] opacity-70 truncate">{s.desc}</p>
              </div>
              <span className="sm:hidden text-xs font-semibold">{s.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold text-foreground">{curSec?.icon} {curSec?.label}</p>
              <p className="text-[11px] text-muted-foreground">{curSec?.desc}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleReset} disabled={saving}
                className="rounded-lg border border-border px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                Reset
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: "var(--primary)" }}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Save
              </button>
            </div>
          </div>

          {msg && (
            <div className={cn("mb-3 rounded-lg border px-3 py-2 text-xs font-medium",
              msg.ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : "border-destructive/30 bg-destructive/10 text-destructive")}>
              {msg.text}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pe-1">
              {section === "features" ? (
                Object.entries(curEdits).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between rounded-xl border border-border bg-card px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground">{key.replace(/_/g, " ")}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Default: {String((defSec as Record<string,unknown>)[key])}
                        {(defSec as Record<string,unknown>)[key] !== val && <span className="ms-2 text-amber-400">modified</span>}
                      </p>
                    </div>
                    <button onClick={() => setEdits(prev => ({ ...prev, [key]: !val }))}
                      className={cn("relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
                        val ? "bg-emerald-500" : "bg-muted")}>
                      <span className={cn("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
                        val ? "translate-x-4" : "translate-x-0")} />
                    </button>
                  </div>
                ))
              ) : section === "xp_levels" ? (
                (curEdits as unknown as { level: number; xp: number; label: string }[]).map((lvl, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-card p-3">
                    <div>
                      <label className="text-[9px] text-muted-foreground uppercase">Level</label>
                      <input type="number" value={lvl.level}
                        onChange={e => { const a=[...(curEdits as unknown as {level:number;xp:number;label:string}[])]; a[i]={...a[i],level:+e.target.value}; setEdits(a as unknown as Record<string,unknown>); }}
                        className="h-8 w-full rounded-lg border border-border bg-muted/50 px-2 text-xs font-mono text-foreground focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground uppercase">XP Required</label>
                      <input type="number" value={lvl.xp}
                        onChange={e => { const a=[...(curEdits as unknown as {level:number;xp:number;label:string}[])]; a[i]={...a[i],xp:+e.target.value}; setEdits(a as unknown as Record<string,unknown>); }}
                        className="h-8 w-full rounded-lg border border-border bg-muted/50 px-2 text-xs font-mono text-foreground focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[9px] text-muted-foreground uppercase">Label</label>
                      <input type="text" value={lvl.label}
                        onChange={e => { const a=[...(curEdits as unknown as {level:number;xp:number;label:string}[])]; a[i]={...a[i],label:e.target.value}; setEdits(a as unknown as Record<string,unknown>); }}
                        className="h-8 w-full rounded-lg border border-border bg-muted/50 px-2 text-xs text-foreground focus:outline-none" />
                    </div>
                  </div>
                ))
              ) : (
                Object.entries(curEdits).map(([key, val]) => {
                  const isMs = key.endsWith("_MS");
                  const displayVal = isMs ? Math.round((val as number) / (60 * 60 * 1000)) : val;
                  const defVal = (defSec as Record<string,unknown>)[key];
                  const modified = defVal !== val;
                  return (
                    <div key={key} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{key.replace(/_/g, " ")}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Default: {isMs ? `${Math.round((defVal as number)/(3600000))}h` : String(defVal)}
                          {modified && <span className="ms-2 text-amber-400">● modified</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isMs && <span className="text-[9px] text-muted-foreground">hrs</span>}
                        <input
                          type={typeof val === "boolean" ? "checkbox" : "number"}
                          checked={typeof val === "boolean" ? val as boolean : undefined}
                          value={typeof val !== "boolean" ? String(displayVal) : undefined}
                          onChange={e => {
                            const newVal = typeof val === "boolean"
                              ? e.target.checked
                              : isMs ? +e.target.value * 3_600_000 : +e.target.value;
                            setEdits(prev => ({ ...prev, [key]: newVal }));
                          }}
                          className={typeof val === "boolean"
                            ? "h-4 w-4 accent-[var(--primary)]"
                            : "h-8 w-24 rounded-lg border border-border bg-muted/50 px-2 text-xs font-mono text-foreground text-end focus:outline-none focus:border-[var(--primary)]"}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
