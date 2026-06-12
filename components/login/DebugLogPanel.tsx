"use client";

import { useEffect, useRef, useState } from "react";
import { Bug, ChevronDown, ChevronUp, Copy, Check, Trash2, RefreshCw } from "lucide-react";
import { debugLog, type DebugLogEntry } from "@/lib/debug-log";
import { cn } from "@/lib/utils";

function formatTime(ts: number) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function levelClass(level: DebugLogEntry["level"]) {
  switch (level) {
    case "success": return "text-emerald-400";
    case "warn":    return "text-amber-400";
    case "error":   return "text-red-400";
    default:        return "text-sky-300";
  }
}

function levelDot(level: DebugLogEntry["level"]) {
  switch (level) {
    case "success": return "bg-emerald-400";
    case "warn":    return "bg-amber-400";
    case "error":   return "bg-red-400";
    default:        return "bg-sky-400";
  }
}

export function DebugLogPanel() {
  const [entries, setEntries] = useState<DebugLogEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = debugLog.subscribe((_entry, all) => {
      setEntries(all);
    });
    return unsub;
  }, []);

  // Auto-open the panel the first time something interesting (warn/error) happens.
  useEffect(() => {
    if (open) return;
    const last = entries[entries.length - 1];
    if (last && (last.level === "warn" || last.level === "error")) setOpen(true);
  }, [entries, open]);

  useEffect(() => {
    if (!autoScroll || !open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, autoScroll, open]);

  const errorCount = entries.filter((e) => e.level === "error").length;
  const warnCount = entries.filter((e) => e.level === "warn").length;

  const handleCopy = async () => {
    const text = entries
      .map((e) => `${formatTime(e.ts)} [${e.level}] ${e.tag}: ${e.message}${e.data ? ` ${safeJson(e.data)}` : ""}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const handleReload = () => {
    debugLog.info("user", "Manual reload requested");
    setTimeout(() => { window.location.reload(); }, 100);
  };

  return (
    <div
      className={cn(
        "fixed bottom-3 start-3 end-3 z-40 max-w-xl mx-auto rounded-2xl border border-border/60 bg-card/95 backdrop-blur-md shadow-2xl transition-all duration-300",
        "sm:start-auto sm:end-4 sm:bottom-4 sm:max-w-md"
      )}
      role="region"
      aria-label="Sign-in debug log"
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/60">
            <Bug className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="flex flex-col items-start min-w-0">
            <span className="text-xs font-bold text-foreground leading-none">Sign-in log</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">
              {entries.length} event{entries.length === 1 ? "" : "s"}
              {errorCount > 0 && <span className="text-red-400"> · {errorCount} error{errorCount === 1 ? "" : "s"}</span>}
              {warnCount > 0 && <span className="text-amber-400"> · {warnCount} warning{warnCount === 1 ? "" : "s"}</span>}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {entries.length > 0 && (
            <span className={cn("h-2 w-2 rounded-full animate-pulse", levelDot(entries[entries.length - 1]?.level ?? "info"))} />
          )}
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border/60">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/40 bg-muted/20">
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="h-3 w-3 accent-[var(--primary)]"
              />
              Auto-scroll
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleReload}
                title="Reload the page"
                className="flex items-center gap-1 rounded-md border border-border/60 bg-card/50 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-[var(--primary)]/50 transition-colors"
              >
                <RefreshCw className="h-3 w-3" /> Reload
              </button>
              <button
                type="button"
                onClick={handleCopy}
                title="Copy log to clipboard"
                className="flex items-center gap-1 rounded-md border border-border/60 bg-card/50 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-[var(--primary)]/50 transition-colors"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={() => debugLog.clear()}
                title="Clear log"
                className="flex items-center gap-1 rounded-md border border-border/60 bg-card/50 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-destructive/50 hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            </div>
          </div>

          {/* Entries */}
          <div
            ref={listRef}
            className="max-h-56 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed"
          >
            {entries.length === 0 ? (
              <p className="text-muted-foreground/60 text-center py-4">
                No events yet. Try signing in.
              </p>
            ) : (
              entries.map((e) => (
                <div key={e.id} className="flex items-start gap-2 py-0.5 border-b border-border/20 last:border-b-0">
                  <span className="shrink-0 text-muted-foreground/50 tabular-nums">
                    {formatTime(e.ts)}
                  </span>
                  <span className={cn("shrink-0 w-1.5 h-1.5 mt-1.5 rounded-full", levelDot(e.level))} />
                  <span className="shrink-0 text-muted-foreground/80 uppercase tracking-wide text-[9px] pt-0.5">
                    {e.tag}
                  </span>
                  <span className={cn("flex-1 min-w-0 break-words", levelClass(e.level))}>
                    {e.message}
                    {e.data !== undefined && e.data !== null && (
                      <span className="text-muted-foreground/60"> {safeJson(e.data)}</span>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function safeJson(v: unknown) {
  try {
    if (typeof v === "string") return v;
    return JSON.stringify(v, (_k, val) => {
      if (val instanceof Error) return { name: val.name, message: val.message };
      return val;
    });
  } catch {
    return String(v);
  }
}
