"use client";

import React from "react";
import { cn } from "@/lib/utils";

export const inputCls = "h-10 w-full rounded-xl border border-border bg-muted/30 px-3.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-colors";

export function FormField({ label, error, hint, children, required }: {
  label: string; error?: string; hint?: string; children: React.ReactNode; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
        {label}
        {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[10px] text-muted-foreground/60">{hint}</p>}
      {error && (
        <p className="flex items-center gap-1 text-[10px] text-destructive">
          <span className="h-1 w-1 rounded-full bg-destructive shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

export function AdvancedSection({ children, open, setOpen }: { children: React.ReactNode; open: boolean; setOpen: (v: boolean) => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border overflow-hidden transition-all duration-300">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Advanced Options</span>
          <span className="text-[10px] text-muted-foreground/50 font-normal normal-case tracking-normal">(Optional)</span>
        </div>
        <div className="shrink-0 transition-transform duration-300" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.13523 6.15803C3.3241 5.95657 3.64052 5.94637 3.84197 6.13523L7.5 9.56464L11.158 6.13523C11.3595 5.94637 11.6759 5.95657 11.8648 6.15803C12.0536 6.35949 12.0434 6.67591 11.842 6.86477L7.84197 10.6148C7.64964 10.7951 7.35036 10.7951 7.15803 10.6148L3.15803 6.86477C2.95657 6.67591 2.94637 6.35949 3.13523 6.15803Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-dashed border-border animate-in fade-in slide-in-from-top-2 duration-300 bg-muted/5">
          {children}
        </div>
      )}
    </div>
  );
}

const BLOCKED_SHORTENERS = ["bit.ly","tinyurl.com","t.co","goo.gl","ow.ly","short.link","rb.gy","cutt.ly","is.gd","v.gd","tiny.cc"];
export function isValidUrl(url: string): boolean {
  if (!url) return true;
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== "https:") return false;
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|::1)/i.test(hostname)) return false;
    if (!hostname.includes(".")) return false;
    if (BLOCKED_SHORTENERS.some((d) => hostname === d || hostname.endsWith("." + d))) return false;
    return true;
  } catch { return false; }
}
