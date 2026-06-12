import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { FireTimestamp } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


export function formatCount(n: number): string {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

/** Convert any timestamp format to milliseconds */
function toMillis(ts: FireTimestamp | number | null): number {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (typeof ts === "string") return new Date(ts).getTime() || 0;
  if (typeof ts?.toMillis === "function") return ts.toMillis();
  if (ts?._seconds != null) return ts._seconds * 1000;
  if (ts?.seconds != null) return ts.seconds * 1000;
  return 0;
}

export function fmtDate(ts: FireTimestamp | number | null): string {
  if (!ts) return "";
  try {
    const millis = toMillis(ts);
    if (!millis) return "";
    return new Date(millis).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function timeAgo(ts: FireTimestamp | number | null, t?: (key: string, params?: Record<string, string | number>) => string): string {
  if (!ts) return "";
  const millis = toMillis(ts);
  if (!millis) return "";
  const s = Math.floor((Date.now() - millis) / 1000);
  const tr = t || ((key: string, p?: Record<string, string | number>) => {
    if (key === "time.justNow") return "just now";
    if (key === "time.minutesAgo") return `${p?.n}m ago`;
    if (key === "time.hoursAgo") return `${p?.n}h ago`;
    if (key === "time.daysAgo") return `${p?.n}d ago`;
    return "";
  });
  if (s < 60) return tr("time.justNow");
  const m = Math.floor(s / 60);
  if (m < 60) return tr("time.minutesAgo", { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return tr("time.hoursAgo", { n: h });
  const d = Math.floor(h / 24);
  if (d < 30) return tr("time.daysAgo", { n: d });
  return fmtDate(ts);
}

export function escapeHtml(text: string): string {
  return String(text ?? "").replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[m] ?? m
  );
}

export function sanitizeUrl(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return ["http:", "https:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(fn: T, ms = 350) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function safeImg(src: string | null | undefined, fallback: string): string {
  return src?.startsWith("http") || src?.startsWith("data:") ? src : fallback;
}

export function getContentTypeLabel(type: string): string {
  const map: Record<string, string> = {
    rom: "ROM",
    kernel: "Kernel",
    recovery: "Recovery",
    module: "Module",
    gsi: "GSI",
  };
  return map[type] || "ROM";
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    stable: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    beta: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    alpha: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    discontinued: "text-red-400 bg-red-400/10 border-red-400/20",
  };
  return map[status] || map.stable;
}

