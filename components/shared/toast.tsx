"use client";

/**
 * Toast System — with framer-motion animations
 * الاستخدام:
 *   import { toast } from "@/components/shared/toast";
 *   toast.success("تم الحفظ بنجاح!");
 *   toast.error("حدث خطأ");
 *   toast.info("معلومة");
 *   toast.loading("جاري التحميل...") → returns id
 *   toast.dismiss(id);
 */

import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, XCircle, Info, Loader2, X, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info" | "loading" | "xp";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // ms, 0 = persistent
}

type Listener = (toasts: ToastItem[]) => void;

// ── Global store (module-level singleton) ─────────────────────────────────
const listeners: Set<Listener> = new Set();
let toasts: ToastItem[] = [];
let nextId = 1;

function notify() {
  listeners.forEach((fn) => fn([...toasts]));
}

function addToast(type: ToastType, message: string, duration = 3500): string {
  const id = `t${nextId++}`;
  toasts = [...toasts, { id, type, message, duration }];
  notify();

  if (duration > 0) {
    setTimeout(() => removeToast(id), duration);
  }
  return id;
}

function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

// ── Public API ────────────────────────────────────────────────────────────
export const toast = {
  success: (msg: string, dur?: number) => addToast("success", msg, dur),
  error:   (msg: string, dur?: number) => addToast("error",   msg, dur ?? 5000),
  info:    (msg: string, dur?: number) => addToast("info",    msg, dur),
  loading: (msg: string)               => addToast("loading", msg, 0),
  xp:      (msg: string, dur?: number) => addToast("xp",      msg, dur ?? 4000),
  dismiss: (id: string)                => removeToast(id),
};

// ── Toast Component ───────────────────────────────────────────────────────
const ICONS = {
  success: CheckCircle2,
  error:   XCircle,
  info:    Info,
  loading: Loader2,
  xp:      Star,
};

const COLORS = {
  success: { border: "rgba(52,211,153,0.3)", bg: "rgba(52,211,153,0.06)", icon: "#34d399", glow: "rgba(52,211,153,0.2)" },
  error:   { border: "rgba(248,113,113,0.4)", bg: "rgba(248,113,113,0.08)", icon: "#f87171", glow: "rgba(248,113,113,0.2)" },
  info:    { border: "rgba(29,155,240,0.3)", bg: "rgba(29,155,240,0.06)", icon: "#38bdf8", glow: "rgba(29,155,240,0.2)" },
  loading: { border: "rgba(168,85,247,0.3)", bg: "rgba(168,85,247,0.06)", icon: "#a855f7", glow: "rgba(168,85,247,0.2)" },
  xp:      { border: "rgba(245,158,11,0.5)", bg: "rgba(245,158,11,0.1)",   icon: "#fbbf24", glow: "rgba(245,158,11,0.4)" },
};

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const Icon = ICONS[item.type];
  const c = COLORS[item.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.85 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, x: 40 }}
      transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.8 }}
      className={cn(
        "relative flex items-center gap-3 rounded-2xl px-4 py-3 shadow-lg max-w-sm w-full",
        item.type === "xp" && "animate-level-up-glow border-amber-500/50"
      )}
      style={{
        background: `rgba(10,10,18,0.92)`,
        border: `1px solid ${c.border}`,
        backdropFilter: "blur(20px)",
        boxShadow: `0 8px 32px ${c.glow}, 0 2px 8px rgba(0,0,0,0.4)`,
      }}
    >
      {/* Icon */}
      <Icon
        className={cn("h-4 w-4 shrink-0", item.type === "loading" && "animate-spin")}
        style={{ color: c.icon, filter: `drop-shadow(0 0 6px ${c.glow})` }}
      />

      {/* Message */}
      <p className="flex-1 text-sm font-semibold text-foreground leading-snug">{item.message}</p>

      {/* Dismiss */}
      {item.type !== "loading" && (
        <motion.button
          onClick={onDismiss}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </motion.button>
      )}

      {/* Bottom progress bar */}
      {item.duration && item.duration > 0 && (
        <motion.div
          className="absolute bottom-0 start-3 end-3 h-0.5 rounded-full origin-start"
          style={{ background: c.icon, opacity: 0.4 }}
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: item.duration / 1000, ease: "linear" }}
        />
      )}
    </motion.div>
  );
}

// ── Toast Container (مكون واحد يتضاف في الـ layout) ─────────────────────
export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  const handleUpdate = useCallback((next: ToastItem[]) => setItems(next), []);

  useEffect(() => {
    listeners.add(handleUpdate);
    return () => { listeners.delete(handleUpdate); };
  }, [handleUpdate]);

  if (items.length === 0) return null;

  return (
    <div
      className="fixed bottom-20 end-3 z-[9999] flex flex-col-reverse gap-2 pointer-events-none sm:bottom-6 sm:end-4"
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout">
        {items.map((item) => (
          <div key={item.id} className="pointer-events-auto">
            <ToastItem item={item} onDismiss={() => removeToast(item.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

