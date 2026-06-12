"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, AlertTriangle, CheckCircle, XCircle, Check, ExternalLink } from "lucide-react";
import {
  apiListReports, apiMarkReportValid, apiMarkReportInvalid, apiAdminBulkResolveReports,
} from "@/lib/api/client";
import type { Report } from "@/lib/types";
import { fmtDate, cn } from "@/lib/utils";

export function ReportsTab() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending">("pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [noteModal, setNoteModal] = useState<{ id: string; action: "valid" | "invalid" } | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    setLoading(true);
    setSelected(new Set());
    apiListReports(filter).then((res) => setReports(res || [])).finally(() => setLoading(false));
  }, [filter]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const selectAll = () => setSelected(new Set((reports || []).filter((r) => r.status === "pending").map((r) => r.id)));
  const clearSelect = () => setSelected(new Set());

  const handleMarkValid = async (id: string, adminNote?: string) => {
    await apiMarkReportValid(id, adminNote);
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, status: "valid" as const, adminNote } : r));
    setNoteModal(null);
    setNote("");
  };
  const handleMarkInvalid = async (id: string, adminNote?: string) => {
    await apiMarkReportInvalid(id, adminNote);
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, status: "invalid" as const, adminNote } : r));
    setNoteModal(null);
    setNote("");
  };

  const handleBulkResolve = async (resolution: "valid" | "invalid") => {
    if (!selected.size) return;
    setBulkLoading(true);
    try {
      await apiAdminBulkResolveReports([...selected], resolution);
      setReports((prev) => prev.map((r) => selected.has(r.id) ? { ...r, status: resolution as typeof r.status } : r));
      setSelected(new Set());
    } finally {
      setBulkLoading(false);
    }
  };

  const pending = (reports || []).filter((r) => r.status === "pending");

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">{reports.length} reports</p>
          {pending.length > 0 && <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-400">{pending.length} PENDING</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setFilter("pending")} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", filter === "pending" ? "bg-[var(--primary)] text-white" : "border border-border text-muted-foreground")}>Pending</button>
          <button onClick={() => setFilter("all")} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", filter === "all" ? "bg-[var(--primary)] text-white" : "border border-border text-muted-foreground")}>All</button>
        </div>
      </div>

      {filter === "pending" && pending.length > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
          <button onClick={selected.size === pending.length ? clearSelect : selectAll} className="text-xs text-muted-foreground hover:text-foreground">
            {selected.size === pending.length ? "Deselect All" : `Select All (${pending.length})`}
          </button>
          {selected.size > 0 && (
            <>
              <span className="text-muted-foreground/40">|</span>
              <span className="text-xs text-[var(--primary)] font-medium">{selected.size} selected</span>
              <div className="ms-auto flex gap-1.5">
                <button onClick={() => handleBulkResolve("invalid")} disabled={bulkLoading} className="flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50">
                  {bulkLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />} Dismiss All
                </button>
                <button onClick={() => handleBulkResolve("valid")} disabled={bulkLoading} className="flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50">
                  {bulkLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />} Validate All
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {reports.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle className="mx-auto h-10 w-10 text-emerald-400/30 mb-3" />
          <p className="text-sm font-medium text-foreground">All clear!</p>
          <p className="text-xs text-muted-foreground mt-1">No pending reports.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {reports.map((r) => (
            <div key={r.id} className={cn("rounded-xl border bg-card p-3 transition-colors", r.status === "pending" ? "border-amber-400/30" : r.status === "valid" ? "border-emerald-400/20 opacity-70" : r.status === "invalid" ? "border-destructive/20 opacity-50" : "border-border opacity-50")}>
              <div className="flex items-start gap-3">
                {r.status === "pending" && (
                  <button onClick={() => toggleSelect(r.id)} className={cn("mt-0.5 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors", selected.has(r.id) ? "border-[var(--primary)] bg-[var(--primary)]" : "border-border")}>
                    {selected.has(r.id) && <Check className="h-2.5 w-2.5 text-white" />}
                  </button>
                )}
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", r.status === "pending" ? "text-amber-400 bg-amber-400/10" : r.status === "valid" ? "text-emerald-400 bg-emerald-400/10" : "text-muted-foreground bg-muted")}>
                  {r.status === "pending" ? <AlertTriangle className="h-4 w-4" /> : r.status === "valid" ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-foreground capitalize">{r.targetType}</span>
                    <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">{r.reason}</span>
                    <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold", r.status === "pending" ? "text-amber-400 bg-amber-400/10" : r.status === "valid" ? "text-emerald-400 bg-emerald-400/10" : "text-muted-foreground bg-muted")}>
                      {r.status.toUpperCase()}
                    </span>
                  </div>
                  {r.description && <p className="text-xs text-muted-foreground mb-1 line-clamp-2">{r.description}</p>}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>By: {r.reporterName || "Unknown"}</span>
                    <span>{fmtDate(r.createdAt)}</span>
                    {r.targetType === "rom" && r.targetId && (
                      <Link href={`/rom/${r.targetId}`} className="flex items-center gap-0.5 text-[var(--primary)] hover:underline">
                        <ExternalLink className="h-2.5 w-2.5" /> View ROM
                      </Link>
                    )}
                    {r.targetType === "user" && r.targetId && (
                      <Link href={`/u/${r.targetId}`} className="flex items-center gap-0.5 text-[var(--primary)] hover:underline">
                        <ExternalLink className="h-2.5 w-2.5" /> View Profile
                      </Link>
                    )}
                  </div>
                  {r.adminNote && <p className="mt-1 text-[10px] italic text-muted-foreground/60">Note: {r.adminNote}</p>}
                </div>
                {r.status === "pending" && (
                  <div className="flex shrink-0 flex-col gap-1">
                    <button onClick={() => { setNoteModal({ id: r.id, action: "valid" }); setNote(""); }} className="flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                      <CheckCircle className="h-3 w-3" /> Valid
                    </button>
                    <button onClick={() => { setNoteModal({ id: r.id, action: "invalid" }); setNote(""); }} className="flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-2 py-1 text-[10px] font-medium text-destructive hover:bg-destructive/20 transition-colors">
                      <XCircle className="h-3 w-3" /> Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-foreground mb-1">
              {noteModal.action === "valid" ? "Mark as Valid" : "Dismiss Report"}
            </h3>
            <p className="text-xs text-muted-foreground mb-3">Add an optional admin note (visible in logs).</p>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Admin note..." rows={3} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:border-[var(--primary)] mb-3" />
            <div className="flex gap-2">
              <button onClick={() => setNoteModal(null)} className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground">Cancel</button>
              <button
                onClick={() => noteModal.action === "valid" ? handleMarkValid(noteModal.id, note) : handleMarkInvalid(noteModal.id, note)}
                className={cn("flex-1 rounded-lg py-2 text-sm font-semibold text-white", noteModal.action === "valid" ? "bg-emerald-500 hover:bg-emerald-500/90" : "bg-destructive hover:bg-destructive/90")}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
