"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Scale, CheckCircle, XCircle, ExternalLink, Gavel } from "lucide-react";
import { apiAdminListAppeals, apiAdminHandleAppeal } from "@/lib/api/client";
import type { Appeal } from "@/lib/types";
import { fmtDate, safeImg, cn } from "@/lib/utils";
import { DEFAULT_AVATAR } from "@/lib/constants";

export function AppealsTab() {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending">("pending");
  const [decisionModal, setDecisionModal] = useState<{ appeal: Appeal; action: "approved" | "rejected" } | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiAdminListAppeals(filter).then((res) => setAppeals(res || [])).finally(() => setLoading(false));
  }, [filter]);

  const handleDecision = async () => {
    if (!decisionModal) return;
    setActionLoading(true);
    try {
      await apiAdminHandleAppeal(decisionModal.appeal.id, decisionModal.action, adminNote);
      setAppeals((prev) => prev.map((a) => a.id === decisionModal.appeal.id ? { ...a, status: decisionModal.action, adminNote } : a));
      setDecisionModal(null);
      setAdminNote("");
    } finally {
      setActionLoading(false);
    }
  };

  const pending = (appeals || []).filter((a) => a.status === "pending");

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">{appeals.length} appeals</p>
          {pending.length > 0 && <span className="rounded-full bg-blue-400/20 border border-blue-400/30 px-2 py-0.5 text-[10px] font-bold text-blue-400">{pending.length} PENDING</span>}
        </div>
        <div className="flex gap-1">
          <button onClick={() => setFilter("pending")} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", filter === "pending" ? "bg-[var(--primary)] text-white" : "border border-border text-muted-foreground")}>Pending</button>
          <button onClick={() => setFilter("all")} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", filter === "all" ? "bg-[var(--primary)] text-white" : "border border-border text-muted-foreground")}>All</button>
        </div>
      </div>

      {appeals.length === 0 ? (
        <div className="text-center py-16">
          <Scale className="mx-auto h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm font-medium text-foreground">No appeals</p>
          <p className="text-xs text-muted-foreground mt-1">No pending suspension appeals.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {appeals.map((a) => (
            <div key={a.id} className={cn("rounded-xl border bg-card p-4", a.status === "pending" ? "border-blue-400/30" : a.status === "approved" ? "border-emerald-400/20 opacity-70" : "border-destructive/20 opacity-60")}>
              <div className="flex items-start gap-3">
                <Image src={safeImg(a.userPhoto, DEFAULT_AVATAR)} alt={a.userName} width={40} height={40} className="rounded-full shrink-0" crossOrigin="anonymous" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <Link href={`/u/${a.uid}`} className="text-sm font-semibold text-foreground hover:text-[var(--primary)]">{a.userName}</Link>
                    <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold", a.status === "pending" ? "text-blue-400 bg-blue-400/10" : a.status === "approved" ? "text-emerald-400 bg-emerald-400/10" : "text-destructive bg-destructive/10")}>
                      {a.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{a.userEmail}</p>

                  <div className="space-y-1.5">
                    <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-2">
                      <p className="text-[10px] font-semibold text-destructive mb-0.5">SUSPENSION REASON</p>
                      <p className="text-xs text-foreground">{a.suspensionReason}</p>
                      {a.suspendedUntil && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">Until: {fmtDate(a.suspendedUntil)}</p>
                      )}
                    </div>
                    <div className="rounded-lg bg-muted/40 border border-border p-2">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">USER&apos;S EXPLANATION</p>
                      <p className="text-xs text-foreground whitespace-pre-wrap">{a.explanation}</p>
                    </div>
                    {a.evidenceUrl && (
                      <a href={a.evidenceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline">
                        <ExternalLink className="h-3 w-3" /> View Evidence
                      </a>
                    )}
                    {a.adminNote && (
                      <div className="rounded-lg bg-amber-400/5 border border-amber-400/20 p-2">
                        <p className="text-[10px] font-semibold text-amber-400 mb-0.5">ADMIN NOTE</p>
                        <p className="text-xs text-muted-foreground">{a.adminNote}</p>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">{fmtDate(a.createdAt)}</p>
                </div>
                {a.status === "pending" && (
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <button onClick={() => { setDecisionModal({ appeal: a, action: "approved" }); setAdminNote(""); }} className="flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20">
                      <CheckCircle className="h-3.5 w-3.5" /> Approve
                    </button>
                    <button onClick={() => { setDecisionModal({ appeal: a, action: "rejected" }); setAdminNote(""); }} className="flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20">
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {decisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-foreground mb-1">
              {decisionModal.action === "approved" ? "Approve Appeal" : "Reject Appeal"}
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              {decisionModal.action === "approved" ? "User will be unsuspended immediately." : "User will remain suspended."}
            </p>
            <div className="mb-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Admin Note (shown to user)</label>
              <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder={decisionModal.action === "approved" ? "We reviewed your appeal and..." : "Your appeal was rejected because..."} rows={3} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:border-[var(--primary)]" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDecisionModal(null)} className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground">Cancel</button>
              <button onClick={handleDecision} disabled={actionLoading} className={cn("flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-60", decisionModal.action === "approved" ? "bg-emerald-500" : "bg-destructive")}>
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />} Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
