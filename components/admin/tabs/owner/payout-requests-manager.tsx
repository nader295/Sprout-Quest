"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  apiAdminBatchApproveTrusted,
  apiAdminBatchMarkPaid,
  apiAdminExportPayoutsCSV,
  apiAdminHandlePayout,
  apiAdminListPayouts,
} from "@/lib/api/client";
import type { PayoutRequest, PayoutStatus } from "@/lib/types";
import { cn, fmtDate } from "@/lib/utils";
import {
  Check,
  CheckCircle,
  DollarSign,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
} from "lucide-react";

export function PayoutRequestsManager() {
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("pending");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [batchTx, setBatchTx] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const flash = (text: string, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); };

  const load = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      const items = await apiAdminListPayouts(status || filter);
      setPayouts(items);
    } catch { setPayouts([]); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id: string, status: PayoutStatus, note?: string, txHash?: string, adjustedAmount?: number) => {
    setActionLoading(id);
    try {
      await apiAdminHandlePayout({ id, status, adminNote: note, txHash, adjustedAmount });
      flash(`Payout ${status}`);
      load();
    } catch { flash("Action failed", false); }
    finally { setActionLoading(null); }
  };

  const handleBatchApprove = async () => {
    if (!confirm("Auto-approve all trusted/VIP developer payouts?")) return;
    setActionLoading("batch");
    try {
      const res = await apiAdminBatchApproveTrusted();
      flash(`${res.approved} payouts auto-approved`);
      load();
    } catch { flash("Batch approve failed", false); }
    finally { setActionLoading(null); }
  };

  const handleBatchPay = async () => {
    if (!batchTx) { flash("Enter TX hash first", false); return; }
    if (!confirm(`Mark ALL approved payouts as paid with TX: ${batchTx}?`)) return;
    setActionLoading("batchPay");
    try {
      const res = await apiAdminBatchMarkPaid(batchTx);
      flash(`${res.paid} payouts marked as paid`);
      setBatchTx("");
      load();
    } catch { flash("Batch pay failed", false); }
    finally { setActionLoading(null); }
  };

  const handleExportCSV = async () => {
    try {
      const csv = await apiAdminExportPayoutsCSV();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `romx_payouts_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      flash("CSV downloaded");
    } catch { flash("Export failed", false); }
  };

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    approved: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    processing: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    failed: "bg-red-500/10 text-red-400 border-red-500/30",
    rejected: "bg-red-500/10 text-red-400 border-red-500/30",
    on_hold: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  };

  const trustColors: Record<string, string> = {
    new: "text-muted-foreground",
    trusted: "text-blue-400",
    vip: "text-amber-400",
    flagged: "text-red-400",
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/20">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-[var(--primary)]" />
          <h3 className="text-sm font-bold text-foreground">Payout Requests</h3>
          <span className="text-xs text-muted-foreground">({payouts.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            <FileSpreadsheet className="h-3 w-3" /> CSV
          </button>
          <button onClick={() => load()} className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
      </div>

      {msg && <div className={cn("mx-4 mt-3 rounded-lg px-3 py-2 text-xs font-medium border", msg.ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : "border-destructive/30 bg-destructive/10 text-destructive")}>{msg.text}</div>}

      <div className="flex items-center gap-1 px-4 py-2 border-b border-border/30 overflow-x-auto">
        {["pending", "approved", "processing", "paid", "rejected", "on_hold", "failed"].map(s => (
          <button key={s} onClick={() => setFilter(s)} className={cn("shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-all border", filter === s ? statusColors[s] || "bg-muted text-foreground border-border" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {s.replace("_", " ").toUpperCase()}
          </button>
        ))}
      </div>

      {filter === "pending" && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/5 border-b border-amber-500/10">
          <button onClick={handleBatchApprove} disabled={actionLoading === "batch"} className="flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-600 disabled:opacity-50 transition-colors">
            {actionLoading === "batch" ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />} Auto-Approve Trusted
          </button>
        </div>
      )}
      {filter === "approved" && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/5 border-b border-blue-500/10">
          <input type="text" placeholder="Bulk TX hash / receipt" value={batchTx} onChange={e => setBatchTx(e.target.value)} className="h-7 flex-1 rounded-md border border-border bg-muted/50 px-2 text-xs" />
          <button onClick={handleBatchPay} disabled={actionLoading === "batchPay"} className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors shrink-0">
            {actionLoading === "batchPay" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Mark All Paid
          </button>
        </div>
      )}

      <div className="divide-y divide-border/30 max-h-[500px] overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : payouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <DollarSign className="h-8 w-8 text-muted-foreground/20 mb-2" />
            <p className="text-sm text-muted-foreground">No {filter} payouts</p>
          </div>
        ) : payouts.map(p => (
          <div key={p.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {p.photo ? (
                  <Image src={p.photo} alt="" width={32} height={32} className="h-8 w-8 rounded-full shrink-0" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">{(p.name || "?")[0]}</div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground truncate">{p.name || p.uid}</span>
                    <span className={cn("text-[10px] font-bold uppercase", trustColors[p.trustLevel] || "text-muted-foreground")}>{p.trustLevel}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{p.paymentMethod.replace("_", " ")}</span>
                    <span>•</span>
                    <span className="font-mono truncate max-w-[120px]">{p.walletAddress}</span>
                    {p.createdAt && <span>• {fmtDate(p.createdAt)}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <p className="font-mono text-sm font-black text-foreground">${(p.finalAmount ?? p.amount ?? 0).toFixed(2)}</p>
                  {p.adjustedAmount && p.adjustedAmount !== p.amount && (
                    <p className="text-[9px] text-muted-foreground line-through">${(p.amount ?? 0).toFixed(2)}</p>
                  )}
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase border", statusColors[p.status])}>
                  {p.status}
                </span>
              </div>
            </div>

            {(p.status === "pending" || p.status === "on_hold") && (
              <div className="flex items-center gap-2 mt-2 pl-11">
                <button onClick={() => handleAction(p.id, "approved")} disabled={!!actionLoading} className="rounded-md bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold text-blue-400 hover:bg-blue-500/20 transition-colors">Approve</button>
                <button onClick={() => handleAction(p.id, "rejected", prompt("Rejection reason:") || "Rejected")} disabled={!!actionLoading} className="rounded-md bg-red-500/10 px-2.5 py-1 text-[10px] font-bold text-red-400 hover:bg-red-500/20 transition-colors">Reject</button>
                {p.status === "pending" && <button onClick={() => handleAction(p.id, "on_hold")} disabled={!!actionLoading} className="rounded-md bg-orange-500/10 px-2.5 py-1 text-[10px] font-bold text-orange-400 hover:bg-orange-500/20 transition-colors">Hold</button>}
              </div>
            )}
            {p.status === "approved" && (
              <div className="flex items-center gap-2 mt-2 pl-11">
                <button onClick={() => handleAction(p.id, "processing")} disabled={!!actionLoading} className="rounded-md bg-purple-500/10 px-2.5 py-1 text-[10px] font-bold text-purple-400 hover:bg-purple-500/20 transition-colors">Start Processing</button>
              </div>
            )}
            {p.status === "processing" && (
              <div className="flex items-center gap-2 mt-2 pl-11">
                <input type="text" placeholder="TX hash / receipt ID" className="h-6 rounded-md border border-border bg-muted/50 px-2 text-[10px] flex-1 max-w-[200px]" onKeyDown={e => { if (e.key === "Enter") handleAction(p.id, "paid", undefined, (e.target as HTMLInputElement).value); }} />
                <button onClick={() => { const tx = prompt("Enter TX hash / receipt:"); if (tx) handleAction(p.id, "paid", undefined, tx); }} disabled={!!actionLoading} className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/20 transition-colors">Mark Paid</button>
                <button onClick={() => handleAction(p.id, "failed", "Payment failed")} disabled={!!actionLoading} className="rounded-md bg-red-500/10 px-2.5 py-1 text-[10px] font-bold text-red-400 hover:bg-red-500/20 transition-colors">Failed</button>
              </div>
            )}
            {p.status === "failed" && (
              <div className="flex items-center gap-2 mt-2 pl-11">
                <button onClick={() => handleAction(p.id, "processing")} disabled={!!actionLoading} className="rounded-md bg-purple-500/10 px-2.5 py-1 text-[10px] font-bold text-purple-400 hover:bg-purple-500/20 transition-colors">Retry</button>
              </div>
            )}
            {p.txHash && (
              <div className="mt-1 pl-11 text-[10px] text-muted-foreground font-mono">TX: {p.txHash}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
