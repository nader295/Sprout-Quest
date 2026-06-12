"use client";

import { cn } from "@/lib/utils";
import {
  STATUS_LABEL,
  URGENCY_LABEL,
  type ListingKind,
  type ListingStatus,
  type Urgency,
} from "@/lib/marketplace/types";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleDot,
  Loader2,
  XCircle,
  Archive,
  AlertTriangle,
  Gauge,
  Sparkles,
} from "lucide-react";

// ── Kind pill: Request (demand, primary blue) vs Offer (supply, amber) ──
export function KindPill({
  kind,
  size = "sm",
}: {
  kind: ListingKind;
  size?: "xs" | "sm" | "md";
}) {
  const isRequest = kind === "request";
  const Icon = isRequest ? ArrowDownLeft : ArrowUpRight;
  const padding =
    size === "xs"
      ? "px-2 py-0.5 text-[10px]"
      : size === "md"
      ? "px-3 py-1.5 text-xs"
      : "px-2.5 py-1 text-[11px]";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-black uppercase tracking-wider",
        padding,
      )}
      style={{
        color: isRequest ? "var(--primary)" : "#f59e0b",
        borderColor: isRequest
          ? "color-mix(in srgb, var(--primary) 30%, transparent)"
          : "rgba(245,158,11,0.35)",
        background: isRequest
          ? "color-mix(in srgb, var(--primary) 8%, transparent)"
          : "rgba(245,158,11,0.08)",
      }}
    >
      <Icon className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} />
      {isRequest ? "Request" : "Offer"}
    </span>
  );
}

// ── Status pill ──────────────────────────────────────────────────────────
const STATUS_META: Record<
  ListingStatus,
  { color: string; Icon: React.ElementType; border: string; bg: string }
> = {
  open:        { color: "#10b981", Icon: CircleDot,    border: "rgba(16,185,129,0.35)", bg: "rgba(16,185,129,0.08)" },
  in_progress: { color: "#f59e0b", Icon: Loader2,      border: "rgba(245,158,11,0.35)", bg: "rgba(245,158,11,0.08)" },
  closed:      { color: "#6b7280", Icon: XCircle,      border: "rgba(107,114,128,0.35)", bg: "rgba(107,114,128,0.08)" },
  cancelled:   { color: "#ef4444", Icon: XCircle,      border: "rgba(239,68,68,0.35)",   bg: "rgba(239,68,68,0.08)" },
  archived:    { color: "#6b7280", Icon: Archive,      border: "rgba(107,114,128,0.30)", bg: "rgba(107,114,128,0.06)" },
};

export function StatusPill({ status }: { status: ListingStatus }) {
  const cfg = STATUS_META[status];
  const Icon = cfg.Icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide"
      style={{ color: cfg.color, borderColor: cfg.border, background: cfg.bg }}
    >
      <Icon
        className={cn("h-3 w-3", status === "in_progress" && "animate-spin")}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

// ── Urgency pill ─────────────────────────────────────────────────────────
const URGENCY_META: Record<
  Urgency,
  { color: string; Icon: React.ElementType; border: string; bg: string }
> = {
  low:      { color: "#6b7280", Icon: Gauge,         border: "rgba(107,114,128,0.30)", bg: "rgba(107,114,128,0.06)" },
  normal:   { color: "#1d9bf0", Icon: Sparkles,      border: "rgba(29,155,240,0.25)",  bg: "rgba(29,155,240,0.06)" },
  high:     { color: "#f59e0b", Icon: AlertTriangle, border: "rgba(245,158,11,0.30)",  bg: "rgba(245,158,11,0.08)" },
  critical: { color: "#ef4444", Icon: AlertTriangle, border: "rgba(239,68,68,0.35)",   bg: "rgba(239,68,68,0.10)" },
};

export function UrgencyPill({ urgency }: { urgency: Urgency }) {
  // Hide low/normal — only highlight when it actually matters.
  if (urgency === "low" || urgency === "normal") return null;
  const cfg = URGENCY_META[urgency];
  const Icon = cfg.Icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
      style={{ color: cfg.color, borderColor: cfg.border, background: cfg.bg }}
    >
      <Icon className="h-2.5 w-2.5" />
      {URGENCY_LABEL[urgency]}
    </span>
  );
}
