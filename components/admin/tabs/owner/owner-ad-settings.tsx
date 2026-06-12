"use client";

import { useEffect, useState } from "react";
import { apiGetAdConfig, apiUpdateAdConfig } from "@/lib/api/client";
import type { AdConfig } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Loader2, Settings2, Tv } from "lucide-react";
import { logger } from "@/lib/logger";

export function OwnerAdSettings() {
  const [config, setConfig] = useState<AdConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    apiGetAdConfig()
      .then(setConfig)
      .catch((err) => logger.error("owner.adSettings.load", err))
      .finally(() => setLoading(false));
  }, []);

  const flash = (text: string, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3000); };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await apiUpdateAdConfig(config);
      flash("✓ Ad Configuration saved securely.");
    } catch {
      flash("Failed to save configuration.", false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!config || !config.waterfall || !config.limits || !config.revenueSplit) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-card p-6 text-center">
        <Tv className="h-8 w-8 text-amber-500/40 mx-auto mb-2" />
        <p className="text-sm font-semibold text-foreground">Ad Config Not Initialized</p>
        <p className="text-xs text-muted-foreground mt-1">No ad configuration found in settings. Save a config first.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/20 bg-amber-500/5">
        <div className="flex items-center gap-2">
          <Tv className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-bold text-foreground">Intelligent Ad System (Primo v5)</h3>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Settings2 className="h-3 w-3" />} Save Ads Config
        </button>
      </div>

      {msg && (
        <div className={cn("mx-4 mt-4 rounded-lg px-3 py-2 text-xs font-medium border", msg.ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : "border-destructive/30 bg-destructive/10 text-destructive")}>
          {msg.text}
        </div>
      )}

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Ad Waterfall & Networks</h4>
          <div className="space-y-2">
            {config.waterfall.map((net, idx) => (
              <div key={idx} className="flex flex-col gap-2 rounded-xl border border-border bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground capitalize">{net.network}</span>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={net.active} onChange={e => {
                      const newWaterfall = [...config.waterfall];
                      newWaterfall[idx].active = e.target.checked;
                      setConfig({ ...config, waterfall: newWaterfall });
                    }} className="accent-amber-500 h-3.5 w-3.5" />
                    Active
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-muted-foreground">Weight (Priority)</span>
                    <input type="number" value={net.weight} onChange={e => {
                      const newWaterfall = [...config.waterfall];
                      newWaterfall[idx].weight = Number(e.target.value);
                      setConfig({ ...config, waterfall: newWaterfall });
                    }} className="mt-1 h-7 w-full rounded-md border border-border bg-muted/50 px-2 text-xs" />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">Zone/Placement ID</span>
                    <input type="text" value={net.zoneId} onChange={e => {
                      const newWaterfall = [...config.waterfall];
                      newWaterfall[idx].zoneId = e.target.value;
                      setConfig({ ...config, waterfall: newWaterfall });
                    }} className="mt-1 h-7 w-full rounded-md border border-border bg-muted/50 px-2 text-xs" placeholder="e.g. 1234567" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Revenue Split</h4>
            <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-3">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground">Dev Share (%)</label>
                <input type="number" disabled value={config.revenueSplit.developer} className="mt-1 h-7 w-full rounded-md border border-border bg-muted/50 px-2 text-xs font-mono text-emerald-400 opacity-70" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground">Platform Share (%)</label>
                <input type="number" disabled value={config.revenueSplit.platform} className="mt-1 h-7 w-full rounded-md border border-border bg-muted/50 px-2 text-xs font-mono text-[var(--primary)] opacity-70" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Note: Splitting logic is enforced at API level (90/10).</p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Anti-fraud & Limits</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-card p-3">
                <label className="text-[10px] text-muted-foreground">Max Daily Watches (User)</label>
                <input type="number" value={config.limits.dailyWatchesPerUser} onChange={e => setConfig({ ...config, limits: { ...config.limits, dailyWatchesPerUser: Number(e.target.value) } })} className="mt-1 h-7 w-full rounded-md border border-border bg-muted/50 px-2 text-xs font-mono" />
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <label className="text-[10px] text-muted-foreground">Cooldown (Minutes)</label>
                <input type="number" value={config.limits.cooldownMinutes} onChange={e => setConfig({ ...config, limits: { ...config.limits, cooldownMinutes: Number(e.target.value) } })} className="mt-1 h-7 w-full rounded-md border border-border bg-muted/50 px-2 text-xs font-mono" />
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <label className="text-[10px] text-muted-foreground">Min Watch Seconds</label>
                <input type="number" value={config.limits.minWatchSeconds} onChange={e => setConfig({ ...config, limits: { ...config.limits, minWatchSeconds: Number(e.target.value) } })} className="mt-1 h-7 w-full rounded-md border border-border bg-muted/50 px-2 text-xs font-mono" />
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <label className="text-[10px] text-emerald-500">Viewer Reward (Points)</label>
                <input type="number" value={config.gamification.pointsPerWatch} onChange={e => setConfig({ ...config, gamification: { pointsPerWatch: Number(e.target.value) } })} className="mt-1 h-7 w-full rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 text-xs font-mono text-emerald-500" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
