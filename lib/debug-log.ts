"use client";

/**
 * Lightweight in-memory debug log bus shared between the auth hook and the
 * login page. Used to power the on-screen log panel that shows exactly what
 * is happening during sign-in (especially useful when the redirect gets stuck
 * and the user has to refresh manually).
 */

export type DebugLogLevel = "info" | "success" | "warn" | "error";

export interface DebugLogEntry {
  id: number;
  ts: number;
  level: DebugLogLevel;
  tag: string;
  message: string;
  data?: unknown;
}

type Listener = (entry: DebugLogEntry, all: DebugLogEntry[]) => void;

const MAX_ENTRIES = 200;
let nextId = 1;
const entries: DebugLogEntry[] = [];
const listeners = new Set<Listener>();

function emit(entry: DebugLogEntry) {
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  try {
    // Mirror to console for power users / DevTools inspection.
    const prefix = `[v0][auth:${entry.tag}]`;
    if (entry.level === "error") console.error(prefix, entry.message, entry.data ?? "");
    else if (entry.level === "warn") console.warn(prefix, entry.message, entry.data ?? "");
    else console.log(prefix, entry.message, entry.data ?? "");
  } catch {}
  listeners.forEach((fn) => {
    try { fn(entry, entries.slice()); } catch {}
  });
}

export const debugLog = {
  info(tag: string, message: string, data?: unknown) {
    emit({ id: nextId++, ts: Date.now(), level: "info", tag, message, data });
  },
  success(tag: string, message: string, data?: unknown) {
    emit({ id: nextId++, ts: Date.now(), level: "success", tag, message, data });
  },
  warn(tag: string, message: string, data?: unknown) {
    emit({ id: nextId++, ts: Date.now(), level: "warn", tag, message, data });
  },
  error(tag: string, message: string, data?: unknown) {
    emit({ id: nextId++, ts: Date.now(), level: "error", tag, message, data });
  },
  clear() {
    entries.length = 0;
    listeners.forEach((fn) => {
      try { fn({ id: 0, ts: Date.now(), level: "info", tag: "log", message: "cleared" }, []); } catch {}
    });
  },
  subscribe(fn: Listener) {
    listeners.add(fn);
    // Replay current entries on subscribe so the panel is never empty.
    try { fn({ id: 0, ts: Date.now(), level: "info", tag: "log", message: "subscribed" }, entries.slice()); } catch {}
    return () => { listeners.delete(fn); };
  },
  getAll() {
    return entries.slice();
  },
};
