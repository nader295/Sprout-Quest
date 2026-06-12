"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

interface XpFloatProps {
  /** trigger by mounting with amount > 0 */
  amount: number;
  /** optional label e.g. "+3 XP" */
  label?: string;
  onDone?: () => void;
}

/**
 * XpFloat — Renders a floating "+XP" bubble that rises and fades.
 * Mount it with amount>0, it auto-removes after the animation.
 */
export function XpFloat({ amount, label, onDone }: XpFloatProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (amount <= 0) return;
    // Tiny delay → allow layout to settle before animating
    const t1 = setTimeout(() => setVisible(true), 30);
    const t2 = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [amount, onDone]);

  if (amount <= 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9999] flex items-end justify-center pb-24"
    >
      <div
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(-32px) scale(1)" : "translateY(0px) scale(0.8)",
          transition: "opacity 0.35s ease, transform 1.6s cubic-bezier(0.22,1,0.36,1)",
          willChange: "transform, opacity",
          boxShadow: "0 0 24px rgba(251,191,36,0.3), 0 8px 32px rgba(0,0,0,0.5)",
        }}
        className="flex items-center gap-1.5 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-2.5 backdrop-blur-md"
      >
        <Zap className="h-4 w-4 text-amber-400" />
        <span className="text-sm font-black text-amber-300">
          {label ?? `+${amount} XP`}
        </span>
      </div>
    </div>
  );
}

/**
 * useXpFloat — hook that returns a trigger function and the XpFloat element.
 *
 * Usage:
 *   const { triggerXp, XpFloatEl } = useXpFloat();
 *   ...
 *   <button onClick={() => { doAction(); triggerXp(3); }}>Comment</button>
 *   {XpFloatEl}
 */
export function useXpFloat() {
  const [pending, setPending] = useState(0);
  const [key, setKey] = useState(0);

  const triggerXp = (amount: number) => {
    setPending(amount);
    setKey(k => k + 1); // force re-mount
  };

  const XpFloatEl = pending > 0 ? (
    <XpFloat key={key} amount={pending} onDone={() => setPending(0)} />
  ) : null;

  return { triggerXp, XpFloatEl };
}
