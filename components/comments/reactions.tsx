"use client";

import { useState, useEffect, useRef } from "react";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactionEmoji, Reaction } from "@/lib/types";

const REACTION_EMOJIS: ReactionEmoji[] = ["❤️", "🔥", "👍", "😂", "😮", "🎉"];

interface SingleEmojiPickerProps {
  onSelect: (emoji: ReactionEmoji) => void;
  disabled?: boolean;
}

export function SingleEmojiPicker({ onSelect, disabled }: SingleEmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(p => !p)}
        disabled={disabled}
        className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-all disabled:cursor-not-allowed"
        aria-label="Add reaction"
      >
        <Smile className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          className="absolute bottom-8 start-0 z-50 flex items-center gap-0.5 rounded-xl border border-border bg-card/95 backdrop-blur-md p-1.5 shadow-2xl animate-in zoom-in-95 duration-150"
          style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}
        >
          {REACTION_EMOJIS.map((emoji, i) => (
            <button
              key={emoji}
              onClick={() => {
                onSelect(emoji);
                setOpen(false);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-base hover:bg-muted transition-all hover:scale-110 active:scale-90"
              style={{
                animation: `ob-fadeUp 0.2s ease both`,
                animationDelay: `${i * 25}ms`,
              }}
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface CompactReactionsProps {
  reactions?: Reaction[];
  onReact: (emoji: ReactionEmoji) => void;
  disabled?: boolean;
}

export function CompactReactions({
  reactions = [],
  onReact,
  disabled = false,
}: CompactReactionsProps) {
  const active = reactions.filter(r => r.count > 0);
  if (active.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {active.map(r => (
        <button
          key={r.emoji}
          onClick={() => onReact(r.emoji as ReactionEmoji)}
          disabled={disabled}
          className={cn(
            "flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed",
            r.reactedByMe
              ? "bg-[var(--primary-dim)] border border-[var(--primary)]/30 text-[var(--primary)]"
              : "bg-muted/40 border border-border/30 text-muted-foreground hover:text-foreground"
          )}
          title={`${r.count} ${r.emoji}`}
        >
          <span className="text-xs">{r.emoji}</span>
          <span className="tabular-nums text-[9px]">{r.count}</span>
        </button>
      ))}
    </div>
  );
}
