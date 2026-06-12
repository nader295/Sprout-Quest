"use client";

import React, { useState, useRef, useCallback } from "react";
import { cn, safeImg } from "@/lib/utils";
import { DEFAULT_AVATAR } from "@/lib/constants";
import Image from "next/image";

interface CommentInputProps {
  romId: string;
  parentId?: string;
  placeholder?: string;
  onSubmit: (text: string) => Promise<void>;
  autoFocus?: boolean;
  compact?: boolean;
}

// Anti-spam patterns
const SPAM_PATTERNS = [
  /(.)\1{6,}/i,
  /\b(buy|sell|discount|free money|earn \$|click here|subscribe|follow me|check out my|visit my|promo code|coupon|giveaway)\b/i,
  /https?:\/\/[^\s]{,6}\.[a-z]{2,4}/i,
  /(t\.me|bit\.ly|tinyurl|shorturl|linktr\.ee|telegram\.me)/i,
  /\b(whatsapp|telegram|join my|dm me|inbox me)\b/i,
];

const BAD_WORDS_EN = [
  "fuck", "shit", "bitch", "ass", "dick", "pussy", "nigger", "faggot",
  "retard", "whore", "slut", "bastard", "damn", "crap", "cunt",
];

const MAX_LENGTH = 500;

function checkSpam(text: string): { isSpam: boolean; reason?: string } {
  const lower = text.toLowerCase().trim();
  if (lower.length < 2) return { isSpam: true, reason: "Too short" };
  for (const w of BAD_WORDS_EN) {
    if (new RegExp(`\\b${w}\\b`, "i").test(lower)) {
      return { isSpam: true, reason: "Inappropriate language detected" };
    }
  }
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(lower)) {
      return { isSpam: true, reason: "Spam or promotional content detected" };
    }
  }
  if (lower.length > 10) {
    const uppercaseCount = (text.match(/[A-Z]/g) || []).length;
    const letterCount = (text.match(/[a-zA-Z]/g) || []).length;
    if (letterCount > 0 && uppercaseCount / letterCount > 0.7) {
      return { isSpam: true, reason: "Excessive caps — please be respectful" };
    }
  }
  return { isSpam: false };
}

export function CommentInput({
  romId,
  parentId,
  placeholder = "Add a comment...",
  onSubmit,
  autoFocus = false,
  compact = false,
}: CommentInputProps) {
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<{ uid: string; name: string; username: string; photo: string }[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close suggestions on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length > MAX_LENGTH) return;
    setText(value);
    setError(null);

    // Auto-resize textarea
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, compact ? 80 : 120)}px`;
    }

    // Check for mention suggestions
    const lastAt = value.lastIndexOf("@");
    if (lastAt !== -1 && lastAt === value.length - 1 - (value.length - lastAt - 1)) {
      const query = value.slice(lastAt + 1).split(/\s/)[0];
      if (query.length >= 1) {
        setShowSuggestions(true);
        try {
          const res = await fetch(`/api/users?action=search&q=${encodeURIComponent(query)}&max=4`);
          if (res.ok) setSuggestions((await res.json()).items || []);
        } catch {}
        return;
      }
    }
    setShowSuggestions(false);
  }, [compact]);

  const insertMention = useCallback((username: string) => {
    const lastAt = text.lastIndexOf("@");
    const newText = text.slice(0, lastAt) + `@${username} `;
    setText(newText);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  }, [text]);

  const validate = useCallback((value: string): string | null => {
    if (!value.trim()) return "Comment cannot be empty";
    if (value.trim().length < 2) return "Comment is too short";
    const spamCheck = checkSpam(value);
    if (spamCheck.isSpam) return spamCheck.reason || "Comment appears to be spam";
    return null;
  }, []);

  const handleSubmit = useCallback(async () => {
    const validationError = validate(text);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(text.trim());
      setText("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } catch (err) {
      setError("Failed to submit. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [text, validate, onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") setText("");
  }, [handleSubmit]);

  return (
    <div className={`comment-input ${compact ? "compact" : ""}`} ref={containerRef}>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={compact ? 2 : 3}
        className={cn(
          "w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none leading-relaxed",
          compact ? "px-0 py-0.5" : "px-3 py-2"
        )}
        style={{ scrollbarWidth: "none" }}
        aria-label="Comment text"
        aria-invalid={!!error}
      />

      {/* Mention suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-[calc(100%+4px)] start-0 z-50 w-52 rounded-xl border border-white/10 bg-card/95 backdrop-blur-md shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
          {suggestions.map(s => (
            <button
              key={s.uid}
              onClick={() => insertMention(s.username || s.name)}
              className="flex w-full items-center gap-2 px-2.5 py-2 text-start hover:bg-muted transition-colors"
            >
              <Image
                src={safeImg(s.photo, DEFAULT_AVATAR)}
                alt=""
                width={24}
                height={24}
                className="rounded-full object-cover shrink-0 ring-1 ring-border"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-foreground truncate">{s.name}</p>
                {s.username && <p className="text-[9px] text-[var(--primary)] truncate">@{s.username}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Input footer */}
      <div className="comment-input-footer flex items-center justify-between gap-2 mt-2">
        {error && (
          <span className="comment-error text-[10px] text-destructive font-semibold" role="alert">
            {error}
          </span>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <span className="char-count text-[9px] text-muted-foreground/60" aria-live="polite">
            {text.length}/{MAX_LENGTH}
          </span>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !text.trim()}
            className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-[11px] font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            aria-busy={isSubmitting}
          >
            {isSubmitting ? "Posting..." : compact ? "Reply" : "Comment"}
          </button>
        </div>
      </div>
    </div>
  );
}
