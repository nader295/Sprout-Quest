"use client";

import { useEffect, useState, useRef } from "react";
import { Loader2, Bug } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";

interface BugReport {
  id: string;
  text: string;
  url: string;
  ua: string;
  ts: { seconds: number } | string;
  reviewed: boolean;
}

export function BugReportsTab() {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch("/api/admin/feedback?limit=50", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const { items } = (await res.json()) as { items: Array<Record<string, unknown>> };
        setReports(
          (items || []).map((d) => ({
            ...(d as object),
            text: (d as { content?: string }).content,
            url: (d as { path?: string }).path,
            ts: (d as { created_at?: string }).created_at,
          } as unknown as BugReport)),
        );
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const markReviewed = async (id: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, reviewed: true }),
      });
      if (!res.ok) return;
      setReports((prev) => prev.map((r) => r.id === id ? { ...r, reviewed: true } : r));
    } catch {
      /* ignore */
    }
  };

  const pending = (reports || []).filter((r) => !r.reviewed);
  const reviewed = (reports || []).filter((r) => r.reviewed);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-2xl font-black text-rose-400">{pending.length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">تقارير معلقة</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-2xl font-black text-emerald-400">{reviewed.length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">تمت مراجعتها</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Bug className="h-10 w-10 text-emerald-400/40 mb-3" />
          <p className="text-sm font-medium text-foreground">لا توجد تقارير أخطاء</p>
          <p className="text-xs text-muted-foreground mt-1">المستخدمون لم يبلغوا عن أي أخطاء بعد</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => {
            const ts = r.ts
              ? typeof r.ts === "object" && "seconds" in r.ts
                ? new Date((r.ts as { seconds: number }).seconds * 1000).toLocaleString("ar-EG")
                : new Date(r.ts as string).toLocaleString("ar-EG")
              : "";
            return (
              <div key={r.id} className={cn(
                "rounded-xl border p-3 transition-all",
                r.reviewed ? "border-border/50 opacity-50" : "border-rose-500/30 bg-rose-500/5"
              )}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Bug className={cn("h-3.5 w-3.5 shrink-0", r.reviewed ? "text-muted-foreground" : "text-rose-400")} />
                    <span className="text-[10px] text-muted-foreground">{ts}</span>
                  </div>
                  {!r.reviewed && (
                    <button
                      onClick={() => markReviewed(r.id)}
                      className="shrink-0 text-[10px] font-bold text-emerald-400 border border-emerald-500/30 bg-emerald-500/8 rounded-lg px-2.5 py-1 hover:bg-emerald-500/15 transition-colors"
                    >
                      راجعت
                    </button>
                  )}
                </div>
                <p className="text-sm text-foreground leading-relaxed mb-2">{r.text}</p>
                {r.url && (
                  <p className="text-[9px] text-muted-foreground/50 font-mono truncate">{r.url}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
