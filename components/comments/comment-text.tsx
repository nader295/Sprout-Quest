"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";

interface CommentTextProps {
  text: string;
  /** When text length exceeds this, a "Read more" toggle is shown. */
  collapseAt?: number;
}

/** A single token that came out of the tokenizer below. */
type Token =
  | { type: "text"; value: string }
  | { type: "mention"; value: string; raw: string }
  | { type: "hashtag"; value: string; raw: string }
  | { type: "url"; value: string };

// Order matters: URLs first (so @ or # inside them are not tokenised separately),
// then mentions, then hashtags.
// - URL  : http(s)://... OR www....
// - Mention: @handle (letters, digits, underscore; supports unicode word chars)
// - Hashtag: #tag
const TOKEN_REGEX = /(https?:\/\/[^\s<]+|www\.[^\s<]+)|(@[\p{L}\p{N}_]{1,30})|(#[\p{L}\p{N}_]{1,50})/gu;

function tokenize(raw: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  for (const match of raw.matchAll(TOKEN_REGEX)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) tokens.push({ type: "text", value: raw.slice(lastIndex, idx) });
    if (match[1]) {
      // strip trailing punctuation that was swept into the URL
      const trail = match[1].match(/[.,;:!?)\]]+$/);
      const url = trail ? match[1].slice(0, -trail[0].length) : match[1];
      tokens.push({ type: "url", value: url });
      if (trail) tokens.push({ type: "text", value: trail[0] });
    } else if (match[2]) {
      tokens.push({ type: "mention", value: match[2].slice(1), raw: match[2] });
    } else if (match[3]) {
      tokens.push({ type: "hashtag", value: match[3].slice(1), raw: match[3] });
    }
    lastIndex = idx + match[0].length;
  }
  if (lastIndex < raw.length) tokens.push({ type: "text", value: raw.slice(lastIndex) });
  return tokens;
}

/**
 * Interactive comment renderer.
 *
 *  - Linkifies @mentions, #hashtags and http(s)/www URLs
 *  - Collapses long text behind a "Read more" toggle (per-comment state)
 *  - Preserves whitespace and wraps long words gracefully
 *  - Respects stopPropagation so taps on links do not trigger parent handlers
 *    (e.g. double-tap-to-like on the wrapping comment card).
 */
export function CommentText({ text, collapseAt = 280 }: CommentTextProps) {
  const { t } = useTranslation();
  const safe = text ?? "";
  const canCollapse = safe.length > collapseAt;
  const [expanded, setExpanded] = useState(false);

  const visible = !canCollapse || expanded ? safe : safe.slice(0, collapseAt).trimEnd() + "\u2026";
  const tokens = useMemo(() => tokenize(visible), [visible]);

  const more = t("comment.readMore");
  const less = t("comment.readLess");

  return (
    <span className="whitespace-pre-wrap leading-relaxed" style={{ wordBreak: "break-word" }}>
      {tokens.map((tok, i) => {
        if (tok.type === "text") return <span key={i}>{tok.value}</span>;

        if (tok.type === "mention") {
          return (
            <Link
              key={i}
              href={`/search?q=${encodeURIComponent(tok.value)}`}
              onClick={e => e.stopPropagation()}
              className="font-bold bg-[var(--primary-dim)] rounded px-0.5 transition-colors hover:underline"
              style={{ color: "var(--primary)" }}
            >
              {tok.raw}
            </Link>
          );
        }

        if (tok.type === "hashtag") {
          return (
            <Link
              key={i}
              href={`/search?q=${encodeURIComponent("#" + tok.value)}`}
              onClick={e => e.stopPropagation()}
              className="font-semibold rounded px-0.5 text-foreground/90 hover:text-[var(--primary)] hover:underline transition-colors"
            >
              {tok.raw}
            </Link>
          );
        }

        // URL
        const href = tok.value.startsWith("http") ? tok.value : `https://${tok.value}`;
        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={e => e.stopPropagation()}
            className="underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--primary)]"
            style={{ color: "var(--primary)" }}
          >
            {tok.value}
          </a>
        );
      })}

      {canCollapse && (
        <>
          {" "}
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setExpanded(v => !v);
            }}
            className="inline align-baseline text-[12px] font-semibold text-[var(--primary)] hover:underline"
          >
            {expanded
              ? (less !== "comment.readLess" ? less : "Show less")
              : (more !== "comment.readMore" ? more : "Read more")}
          </button>
        </>
      )}
    </span>
  );
}
