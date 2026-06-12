"use client";

import { useEffect, useState } from "react";
import { apiListMigrations, apiRunMigration } from "@/lib/api/client";
import type { MigrationInfo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Activity, AlertTriangle, ChevronDown, Clock, Gavel, Loader2 } from "lucide-react";

export function MigrationsPanel() {
  const [migrations, setMigrations] = useState<MigrationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { affected: number; duration: number; details: string[]; error?: string }>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  useEffect(() => {
    apiListMigrations().then((r) => setMigrations(r.migrations)).finally(() => setLoading(false));
  }, []);

  const handleRun = async (id: string) => {
    if (confirm !== id) { setConfirm(id); return; }

    setConfirm(null);
    setRunning(id);
    try {
      const res = await apiRunMigration(id);
      setResults((prev) => ({ ...prev, [id]: res }));
      apiListMigrations().then((r) => setMigrations(r.migrations));
    } finally {
      setRunning(null);
    }
  };

  const RISK_COLORS = {
    safe: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
    moderate: "text-amber-400 bg-amber-400/10 border-amber-400/30",
    destructive: "text-destructive bg-destructive/10 border-destructive/30",
  };

  if (loading) return (
    <div className="rounded-xl border border-border bg-card p-6 flex justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Gavel className="h-4 w-4" style={{ color: "var(--primary)" }} />
          <h3 className="text-sm font-bold text-foreground">Data Migrations</h3>
        </div>
        <span className="text-xs text-muted-foreground">{migrations.length} migrations available</span>
      </div>

      <div className="flex items-start gap-2 mx-4 mt-3 mb-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Migrations modify Firestore data directly and <strong className="text-foreground">cannot be undone</strong>.
          Always run <span className="text-amber-400 font-medium">safe</span> migrations first.
          <span className="text-amber-400 font-medium"> Moderate</span> migrations change existing values.
        </p>
      </div>

      <div className="divide-y divide-border">
        {migrations.map((m) => {
          const result = results[m.id];
          const isRunning = running === m.id;
          const isConfirming = confirm === m.id;

          return (
            <div key={m.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-semibold text-foreground">{m.name}</span>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", RISK_COLORS[m.risk as keyof typeof RISK_COLORS])}>
                      {m.risk}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{m.description}</p>

                  {m.lastRun && (
                    <p className="mt-1 text-[10px] text-muted-foreground/60 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      Last run: {new Date(m.lastRun.ranAt).toLocaleString()} — {m.lastRun.affected} records affected
                    </p>
                  )}

                  {result && (
                    <div className={cn("mt-2 rounded-lg border p-2", result.error ? "border-destructive/30 bg-destructive/5" : "border-emerald-500/30 bg-emerald-500/5")}>
                      {result.error ? (
                        <p className="text-xs text-destructive font-medium">Error: {result.error}</p>
                      ) : (
                        <>
                          <p className="text-xs text-emerald-400 font-semibold">
                            ✓ Done — {result.affected} records updated in {result.duration}ms
                          </p>
                          {result.details.length > 0 && (
                            <button onClick={() => setExpanded(expanded === m.id ? null : m.id)} className="mt-1 text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                              <ChevronDown className={cn("h-3 w-3 transition-transform", expanded === m.id && "rotate-180")} />
                              {expanded === m.id ? "Hide" : "Show"} details ({result.details.length})
                            </button>
                          )}
                          {expanded === m.id && (
                            <div className="mt-1.5 max-h-32 overflow-y-auto space-y-0.5">
                              {result.details.map((d, i) => (
                                <p key={i} className="text-[10px] font-mono text-muted-foreground">{d}</p>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleRun(m.id)}
                  disabled={isRunning || !!running}
                  className={cn(
                    "shrink-0 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all",
                    isConfirming
                      ? "border-destructive bg-destructive text-white hover:bg-destructive/90"
                      : isRunning
                      ? "border-border text-muted-foreground cursor-not-allowed"
                      : "border-border text-muted-foreground hover:border-[var(--primary)] hover:text-foreground"
                  )}
                >
                  {isRunning ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> Running...</>
                  ) : isConfirming ? (
                    <><AlertTriangle className="h-3 w-3" /> Confirm Run</>
                  ) : (
                    <><Activity className="h-3 w-3" /> Run</>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
