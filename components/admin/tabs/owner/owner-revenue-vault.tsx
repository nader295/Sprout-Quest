"use client";

import { useEffect, useState } from "react";
import { apiOwnerClaimRevenue, apiOwnerGetRevenueVault, apiOwnerSettleMonth } from "@/lib/api/client";
import { cn, formatCount } from "@/lib/utils";
import { ArrowUpRight, Coins, DollarSign, Loader2, Wallet } from "lucide-react";
import { logger } from "@/lib/logger";

export function OwnerRevenueVault() {
  const [vault, setVault] = useState<{
    unclaimedPlatformShare: number;
    totalClaimed: number;
    totalAdViews: number;
    claims: { id: string; amount: number; claimedAt: unknown; note?: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleMonth, setSettleMonthVal] = useState(new Date().toISOString().slice(0, 7));
  const [settleAmount, setSettleAmount] = useState("");
  const [settleResult, setSettleResult] = useState<{ devPayouts: { uid: string; name: string; views: number; share: number; amount: number }[] } | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const flash = (text: string, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); };

  useEffect(() => {
    // Revenue vault is an owner-only financial panel — a silent load failure
    // means the owner sees a blank widget with no hint why. Surface to Sentry.
    apiOwnerGetRevenueVault()
      .then(setVault)
      .catch((err) => logger.error("owner.revenueVault.load", err))
      .finally(() => setLoading(false));
  }, []);

  const unclaimed = Number(vault?.unclaimedPlatformShare ?? 0);
  const totalClaimed = Number(vault?.totalClaimed ?? 0);
  const totalAdViews = Number(vault?.totalAdViews ?? 0);
  const claims = vault?.claims ?? [];

  const handleClaim = async () => {
    if (!vault || unclaimed <= 0) return;
    if (!confirm(`Claim $${unclaimed.toFixed(4)}? This will reset the counter to $0.00.`)) return;
    setClaiming(true);
    try {
      const res = await apiOwnerClaimRevenue();
      flash(`✅ Claimed $${res.claimed.toFixed(4)} successfully!`);
      setVault(prev => prev ? { ...prev, unclaimedPlatformShare: 0, totalClaimed: prev.totalClaimed + res.claimed } : prev);
    } catch { flash("Failed to claim", false); }
    finally { setClaiming(false); }
  };

  const handleSettle = async () => {
    const amt = parseFloat(settleAmount);
    if (!amt || amt <= 0) { flash("Enter a valid amount", false); return; }
    if (!confirm(`Settle ${settleMonth} with $${amt} actual revenue? This will calculate each developer's fair share.`)) return;
    setSettling(true);
    try {
      const res = await apiOwnerSettleMonth({ month: settleMonth, actualRevenue: amt });
      setSettleResult(res);
      flash(`✅ Settled $${res.settled} across ${res.devPayouts.length} developers`);
    } catch { flash("Settlement failed", false); }
    finally { setSettling(false); }
  };

  if (loading) return <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!vault) return null;

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-card overflow-hidden">
      <div className="relative bg-gradient-to-r from-emerald-500/10 via-transparent to-emerald-500/5 p-5 sm:p-6">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at top left, rgba(16,185,129,0.15), transparent 60%)" }} />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center bg-emerald-500/20 ring-1 ring-emerald-500/40">
                <Wallet className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Revenue Vault</h3>
                <p className="text-[10px] text-muted-foreground">Your platform share (20%)</p>
              </div>
            </div>
            <button onClick={handleClaim} disabled={claiming || unclaimed <= 0}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-40 transition-colors shadow-lg shadow-emerald-500/20">
              {claiming ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUpRight className="h-3 w-3" />}
              Claim All
            </button>
          </div>

          {msg && <div className={cn("rounded-lg px-3 py-2 text-xs font-medium border mb-4", msg.ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : "border-destructive/30 bg-destructive/10 text-destructive")}>{msg.text}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1">Unclaimed</p>
              <p className="text-3xl font-black text-emerald-400">${unclaimed.toFixed(4)}</p>
            </div>
            <div className="rounded-xl bg-black/20 border border-white/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Claimed</p>
              <p className="text-3xl font-black text-foreground">${totalClaimed.toFixed(2)}</p>
            </div>
            <div className="rounded-xl bg-black/20 border border-white/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Ad Views</p>
              <p className="text-3xl font-black text-foreground">{formatCount(totalAdViews)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-emerald-500/20 p-5 sm:p-6 bg-black/10">
        <div className="flex items-center gap-2 mb-4">
          <Coins className="h-4 w-4 text-amber-400" />
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Monthly Pro-Rata Settlement</h4>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">Enter the actual amount you received from Monetag/AdCash this month. The system will calculate each developer&apos;s fair share based on their percentage of total ad views.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="month" value={settleMonth} onChange={e => setSettleMonthVal(e.target.value)} className="h-8 rounded-lg border border-border bg-muted/50 px-3 text-xs" />
          <input type="number" step="0.01" placeholder="Actual revenue ($)" value={settleAmount} onChange={e => setSettleAmount(e.target.value)} className="h-8 flex-1 rounded-lg border border-border bg-muted/50 px-3 text-xs" />
          <button onClick={handleSettle} disabled={settling} className="h-8 rounded-lg bg-amber-500 px-4 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors flex items-center gap-1.5 shrink-0">
            {settling ? <Loader2 className="h-3 w-3 animate-spin" /> : <DollarSign className="h-3 w-3" />} Settle
          </button>
        </div>
        {settleResult && (
          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 max-h-48 overflow-y-auto">
            <p className="text-xs font-bold text-amber-400 mb-2">Settlement Result ({settleResult.devPayouts.length} developers)</p>
            {settleResult.devPayouts.map(d => (
              <div key={d.uid} className="flex items-center justify-between py-1 text-xs border-b border-white/5 last:border-0">
                <span className="text-muted-foreground truncate flex-1">{d.name}</span>
                <span className="text-muted-foreground mx-2">{d.share}%</span>
                <span className="font-mono font-bold text-emerald-400">${d.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {claims.length > 0 && (
        <div className="border-t border-border/50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Claim History</p>
          <div className="space-y-1">
            {claims.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0">
                <span className="text-muted-foreground">{c.claimedAt ? new Date((c.claimedAt as { seconds: number }).seconds * 1000).toLocaleDateString() : "—"}</span>
                <span className="font-mono font-bold text-emerald-400">${(c.amount ?? 0).toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
