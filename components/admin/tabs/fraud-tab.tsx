"use client";

import { useEffect, useState, useRef } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";

interface FraudAlert {
  id: string;
  uid: string;
  date: string;
  reasons: string[];
  ts: string;
  reviewed: boolean;
}

export function FraudTab() {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    setLoading(true);
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch("/api/admin/fraud-alerts?limit=50", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const { items } = (await res.json()) as { items: Array<Record<string, unknown>> };
        setAlerts(
          (items || []).map((d) => ({
            ...(d as object),
            ts: (d as { created_at?: string }).created_at,
          } as unknown as FraudAlert)),
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
      const res = await fetch("/api/admin/fraud-alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, reviewed: true }),
      });
      if (!res.ok) return;
      setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, reviewed: true } : a));
    } catch {
      /* ignore */
    }
  };

  const pending = (alerts || []).filter((a) => !a.reviewed);
  const reviewed = (alerts || []).filter((a) => a.reviewed);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-2xl font-black text-amber-400">{pending.length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">تنبيهات معلقة</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-2xl font-black text-emerald-400">{reviewed.length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">تمت مراجعتها</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <ShieldAlert className="h-10 w-10 text-emerald-400/40 mb-3" />
          <p className="text-sm font-medium text-foreground">لا توجد تنبيهات</p>
          <p className="text-xs text-muted-foreground mt-1">النظام نظيف</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div key={a.id} className={cn(
              "rounded-xl border p-3 transition-all",
              a.reviewed ? "border-border/50 opacity-50" : "border-amber-500/30 bg-amber-500/5"
            )}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldAlert className={cn("h-3.5 w-3.5 shrink-0", a.reviewed ? "text-muted-foreground" : "text-amber-400")} />
                    <p className="text-xs font-bold text-foreground font-mono truncate">{a.uid}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{a.date}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {a.reasons.map((r, i) => (
                      <span key={i} className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5 font-semibold">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                {!a.reviewed && (
                  <button
                    onClick={() => markReviewed(a.id)}
                    className="shrink-0 text-[10px] font-bold text-emerald-400 border border-emerald-500/30 bg-emerald-500/8 rounded-lg px-2.5 py-1 hover:bg-emerald-500/15 transition-colors"
                  >
                    راجعت
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
