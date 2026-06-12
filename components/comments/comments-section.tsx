"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { timeAgo, safeImg, cn } from "@/lib/utils";
import { DEFAULT_AVATAR } from "@/lib/constants";
import Image from "next/image";
import Link from "next/link";
import {
  MessageSquare,
  Send,
  Trash2,
  ChevronDown,
  RefreshCw,
  Loader2,
  MoreHorizontal,
  Edit2,
  Check,
  X as XIcon,
  Clock,
  Flame,
  AlertTriangle,
} from "lucide-react";
import { toast } from "@/components/shared/toast";
import { useXpFloat } from "@/components/shared/xp-float";
import { CommentInput } from "./comment-input";
import { ReportModal } from "./report-modal";
import { CommentText } from "./comment-text";
import { SingleEmojiPicker, CompactReactions } from "./reactions";
import { useComments } from "./hooks/use-comments";
import type { Comment, Reply, ReactionEmoji } from "@/lib/types";

interface CommentsSectionProps {
  romId: string;
}

// Comment menu with edit/delete/report options
function CommentMenu({
  canEdit,
  canDelete,
  showReport,
  onEdit,
  onDelete,
  onReport,
}: {
  canEdit: boolean;
  canDelete: boolean;
  showReport: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReport?: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!canEdit && !canDelete && !showReport) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen(p => !p);
          setConfirmDelete(false);
        }}
        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-all"
        aria-label="More options"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          className="absolute end-0 top-7 z-50 min-w-[130px] rounded-xl border border-border bg-card shadow-xl overflow-hidden animate-in zoom-in-95 duration-100"
          style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}
        >
          {!confirmDelete ? (
            <>
              {canEdit && (
                <button
                  onClick={() => {
                    setOpen(false);
                    onEdit();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-[11px] font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  <Edit2 className="h-3 w-3 text-muted-foreground" />
                  {t("comments.edit") || "Edit"}
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-[11px] font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  {t("comments.deleteLabel") || "Delete"}
                </button>
              )}
              {showReport && (
                <button
                  onClick={() => {
                    setOpen(false);
                    onReport?.();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-[11px] font-semibold text-amber-500 hover:bg-amber-500/10 transition-colors border-t border-border/30"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {t("comments.report") || "Report"}
                </button>
              )}
            </>
          ) : (
            <div className="p-2.5 bg-destructive/5">
              <p className="text-[10px] font-bold text-destructive mb-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {t("comments.deleteConfirm") || "Delete this comment?"}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setOpen(false);
                    onDelete();
                  }}
                  className="flex-1 rounded-lg bg-destructive hover:bg-destructive/90 text-white text-[10px] font-black py-1.5 transition-colors"
                >
                  {t("common.confirm") || "Yes"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground text-[10px] font-bold py-1.5 transition-colors"
                >
                  {t("common.cancel") || "No"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Renders a single comment item with replies
function CommentItem({
  comment,
  replies,
  editingId,
  editText,
  setEditingId,
  setEditText,
  savingEdit,
  replyTo,
  setReplyTo,
  replyText,
  setReplyText,
  showReplies,
  setShowReplies,
  onDeleteComment,
  onEditComment,
  onReactComment,
  onDeleteReply,
  onEditReply,
  onReactReply,
  onReportComment,
  onLoadReplies,
  onSubmitReply,
}: any) {
  const { user, isLoggedIn, isAdmin } = useAuth();
  const { t } = useTranslation();

  const canEdit = user?.uid === comment.uid;
  const canDelete = user?.uid === comment.uid || isAdmin;
  const showReport = isLoggedIn && user?.uid !== comment.uid;
  const isEditing = editingId === comment.id;

  const handleToggleReplies = () => {
    if (!showReplies[comment.id]) {
      onLoadReplies(comment.id);
    }
    setShowReplies((p: Record<string, boolean>) => ({
      ...p,
      [comment.id]: !p[comment.id],
    }));
  };

  // ── Double-tap-to-like ───────────────────────────────────────────────
  //  - triggers a ❤️ reaction on double-tap/double-click (Instagram-style)
  //  - spawns a short-lived floating heart burst at the tap position
  //  - ignored when the tap target is an interactive element (button, link, input)
  const lastTapRef = useRef<number>(0);
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const heartIdRef = useRef(0);

  const spawnHeart = (x: number, y: number) => {
    heartIdRef.current += 1;
    const id = heartIdRef.current;
    setHearts(h => [...h, { id, x, y }]);
    setTimeout(() => setHearts(h => h.filter(p => p.id !== id)), 900);
  };

  const handleDoubleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isLoggedIn || isEditing) return;
    // Ignore taps that originated on an interactive child (link, button, textarea)
    const el = e.target as HTMLElement;
    if (el.closest("a, button, textarea, input, [role=button]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    spawnHeart(e.clientX - rect.left, e.clientY - rect.top);
    onReactComment(comment.id, "❤️" as ReactionEmoji);
  };

  // Touch handler: detects a quick double-tap on touch devices.
  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isLoggedIn || isEditing) return;
    const el = e.target as HTMLElement;
    if (el.closest("a, button, textarea, input, [role=button]")) return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      const touch = e.changedTouches[0];
      const rect = e.currentTarget.getBoundingClientRect();
      spawnHeart(touch.clientX - rect.left, touch.clientY - rect.top);
      onReactComment(comment.id, "❤️" as ReactionEmoji);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  return (
    <div className="group romx-fade-rise">
      {/* Main comment */}
      <div
        className="relative flex gap-2.5 py-2.5 px-2 rounded-xl hover:bg-muted/30 transition-colors select-text"
        onDoubleClick={handleDoubleTap}
        onTouchEnd={handleTouchEnd}
        title={!isLoggedIn ? undefined : (t("comment.doubleTapToLike") !== "comment.doubleTapToLike" ? t("comment.doubleTapToLike") : undefined)}
      >
        {/* Floating heart burst (double-tap feedback) */}
        {hearts.map(h => (
          <span
            key={h.id}
            aria-hidden
            className="pointer-events-none absolute z-10 text-2xl select-none"
            style={{
              left: h.x,
              top: h.y,
              transform: "translate(-50%, -50%)",
              animation: "romx-heart-burst 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards",
            }}
          >
            ❤️
          </span>
        ))}
        {/* Avatar + thread line */}
        <div className="flex flex-col items-center shrink-0">
          <Link href={`/u/${comment.uid}`}>
            <Image
              src={safeImg(comment.photo, DEFAULT_AVATAR)}
              alt={comment.name}
              width={36}
              height={36}
              className="rounded-full object-cover ring-2 ring-background"
            />
          </Link>
          {/* Thread line for replies */}
          {(comment.replyCount > 0 || replyTo === comment.id) && (
            <div className="flex-1 w-0.5 bg-border/30 rounded-full mt-1.5 min-h-[16px]" />
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          {/* Header: Name + badges + menu */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <Link
              href={`/u/${comment.uid}`}
              className="text-[13px] font-bold text-foreground hover:text-[var(--primary)] transition-colors"
            >
              {comment.name}
            </Link>
            {comment.edited && (
              <span title={t("comments.edited") || "Edited"}>
                <Edit2 className="h-2.5 w-2.5 text-muted-foreground/40" />
              </span>
            )}
            <div className="ms-auto">
              <CommentMenu
                canEdit={canEdit}
                canDelete={canDelete}
                showReport={showReport}
                onEdit={() => {
                  setEditingId(comment.id);
                  setEditText(comment.text);
                }}
                onDelete={() => onDeleteComment(comment.id)}
                onReport={() => onReportComment(comment.id)}
              />
            </div>
          </div>

          {/* Time */}
          <p className="text-[10px] text-muted-foreground/50 mb-1.5">{timeAgo(comment.createdAt)}</p>

          {/* Comment text or edit form */}
          {isEditing ? (
            <div className="mt-1 mb-1">
              <div className="rounded-xl border border-[var(--primary)]/30 bg-card px-3 py-1">
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  rows={2}
                  disabled={savingEdit}
                  autoFocus
                  className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none leading-relaxed px-0 py-0.5"
                />
              </div>
              <div className="flex items-center justify-end gap-2 mt-1.5">
                <button
                  onClick={() => setEditingId(null)}
                  className="px-3 py-1 text-[10px] font-bold text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={() => onEditComment(comment.id, editText)}
                  disabled={savingEdit || !editText.trim()}
                  className="flex items-center gap-1 rounded-xl bg-[var(--primary)] px-3 py-1 text-[10px] font-black text-white transition-all disabled:opacity-50"
                >
                  {savingEdit ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  {t("common.save")}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-foreground/90 leading-snug mb-1.5">
              <CommentText text={comment.text} />
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-1">
            <CompactReactions
              reactions={comment.reactions}
              onReact={(emoji: ReactionEmoji) => onReactComment(comment.id, emoji)}
              disabled={!isLoggedIn}
            />
            <SingleEmojiPicker
              onSelect={(emoji: ReactionEmoji) => onReactComment(comment.id, emoji)}
              disabled={!isLoggedIn}
            />
            {isLoggedIn && (
              <button
                onClick={() => {
                  setReplyTo(replyTo === comment.id ? null : comment.id);
                  setReplyText("");
                }}
                className={cn(
                  "text-[11px] font-bold transition-colors ms-1",
                  replyTo === comment.id
                    ? "text-[var(--primary)]"
                    : "text-muted-foreground/50 hover:text-foreground"
                )}
              >
                {t("comment.reply")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reply input */}
      {replyTo === comment.id && isLoggedIn && (
        <div className="flex gap-2.5 ps-12 mt-1 mb-2 animate-in fade-in duration-200">
          <Image
            src={safeImg(user?.photoURL || "", DEFAULT_AVATAR)}
            alt=""
            width={28}
            height={28}
            className="rounded-full object-cover shrink-0 mt-0.5 ring-1 ring-border"
          />
          <div className="flex-1">
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder={t("comments.replyPlaceholder") || "Reply..."}
              rows={1}
              autoFocus
              className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none leading-relaxed px-0 py-0.5"
            />
            {replyText.trim() && (
              <div className="flex items-center justify-end gap-2 mt-1.5">
                <button
                  onClick={() => {
                    setReplyTo(null);
                    setReplyText("");
                  }}
                  className="px-3 py-1 text-[10px] font-bold text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={() => onSubmitReply(comment.id, replyText)}
                  disabled={!replyText.trim()}
                  className="flex items-center gap-1 rounded-xl px-3 py-1 text-[10px] font-black text-white disabled:opacity-40 transition-all"
                  style={{ background: "linear-gradient(135deg, var(--primary), #6366f1)" }}
                >
                  <Send className="h-3 w-3" />
                  {t("comment.reply")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Replies list */}
      {comment.replyCount > 0 && (
        <div className="ps-12 mt-0.5">
          {!showReplies[comment.id] ? (
            <button
              onClick={handleToggleReplies}
              className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--primary)] hover:opacity-80 transition-opacity py-1"
            >
              <ChevronDown className="h-3 w-3" />
              {comment.replyCount} {comment.replyCount === 1 ? t("comment.reply") : t("comment.replies")}
            </button>
          ) : (
            <div className="space-y-0.5 animate-in fade-in duration-200">
              {(replies[comment.id] || []).map((reply: Reply) => {
                const rCanEdit = user?.uid === reply.uid;
                const rCanDelete = user?.uid === reply.uid || isAdmin;
                const rShowReport = isLoggedIn && user?.uid !== reply.uid;
                const rIsEditing = editingId === reply.id;

                return (
                  <div key={reply.id} className="flex gap-2.5 py-2 px-2 rounded-xl hover:bg-muted/30 transition-colors">
                    <Link href={`/u/${reply.uid}`} className="shrink-0 mt-0.5">
                      <Image
                        src={safeImg(reply.photo, DEFAULT_AVATAR)}
                        alt={reply.name}
                        width={28}
                        height={28}
                        className="rounded-full object-cover ring-1 ring-border"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Link
                          href={`/u/${reply.uid}`}
                          className="text-[12px] font-bold text-foreground hover:text-[var(--primary)] transition-colors"
                        >
                          {reply.name}
                        </Link>
                        {reply.edited && (
                          <Edit2 className="h-2.5 w-2.5 text-muted-foreground/40" />
                        )}
                        <div className="ms-auto">
                          <CommentMenu
                            canEdit={rCanEdit}
                            canDelete={rCanDelete}
                            showReport={rShowReport}
                            onEdit={() => {
                              setEditingId(reply.id);
                              setEditText(reply.text);
                            }}
                            onDelete={() => onDeleteReply(reply.id, comment.id)}
                            onReport={() => onReportComment(reply.id)}
                          />
                        </div>
                      </div>
                      <p className="text-[9px] text-muted-foreground/50 mb-1">{timeAgo(reply.createdAt)}</p>
                      {rIsEditing ? (
                        <div>
                          <textarea
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            rows={2}
                            autoFocus
                            className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none leading-relaxed px-0 py-0.5 mb-1"
                          />
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-2 py-1 text-[9px] font-bold text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors"
                            >
                              {t("common.cancel")}
                            </button>
                            <button
                              onClick={() => onEditReply(reply.id, editText, comment.id)}
                              disabled={savingEdit || !editText.trim()}
                              className="flex items-center gap-1 rounded bg-[var(--primary)] px-2 py-1 text-[9px] font-black text-white transition-all disabled:opacity-50"
                            >
                              {savingEdit ? <Loader2 className="h-2 w-2 animate-spin" /> : <Check className="h-2 w-2" />}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[12px] text-foreground/90 leading-snug mb-1">
                          <CommentText text={reply.text} />
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <CompactReactions
                          reactions={reply.reactions}
                          onReact={(emoji: ReactionEmoji) =>
                            onReactReply(reply.id, emoji, comment.id)
                          }
                          disabled={!isLoggedIn}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Main CommentsSection orchestrator
export function CommentsSection({ romId }: CommentsSectionProps) {
  const { user, userDoc, isLoggedIn } = useAuth();
  const { t } = useTranslation();
  const { triggerXp, XpFloatEl } = useXpFloat();
  const [sortBy, setSortBy] = useState<"newest" | "top">("newest");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [showReplies, setShowReplies] = useState<Record<string, boolean>>({});
  const [submittingReply, setSubmittingReply] = useState(false);

  const {
    comments,
    replies,
    loading,
    refreshing,
    fetchComments,
    loadReplies,
    submitComment,
    submitReply,
    deleteComment,
    editComment,
    reactToComment,
  } = useComments({ romId });

  const handleSubmitReply = async (commentId: string, text: string) => {
    if (!text.trim()) return;
    setSubmittingReply(true);
    try {
      await submitReply(commentId, text);
      setReplyText("");
      setReplyTo(null);
      triggerXp(3);
    } catch (err) {
      console.error("Failed to submit reply:", err);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleReport = async (reason: string, details: string) => {
    toast.success(t("comments.reported") || "Comment reported — thanks!");
    setReportTarget(null);
  };

  const sortedComments = [...comments].sort((a, b) => {
    if (sortBy === "top") {
      const aReacts = (a.reactions || []).reduce((sum: number, r: any) => sum + r.count, 0);
      const bReacts = (b.reactions || []).reduce((sum: number, r: any) => sum + r.count, 0);
      if (aReacts !== bReacts) return bReacts - aReacts;
    }
    const getMs = (t: any) =>
      t && typeof t === "object" && t.seconds ? t.seconds * 1000 : new Date(t || 0).getTime();
    return getMs(b.createdAt) - getMs(a.createdAt);
  });

  return (
    <div className="space-y-4">
      {XpFloatEl}

      {/* Report Modal */}
      <ReportModal
        isOpen={!!reportTarget}
        commentId={reportTarget || ""}
        onClose={() => setReportTarget(null)}
        onSubmit={handleReport}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/30">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl border"
            style={{
              background: "linear-gradient(135deg, var(--primary-dim), rgba(99,102,241,0.1))",
              borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
            }}
          >
            <MessageSquare className="h-4 w-4" style={{ color: "var(--primary)" }} />
          </div>
          <h3 className="text-sm font-black text-foreground">
            {t("rom.comments")}
            <span className="ms-1.5 text-xs font-bold text-muted-foreground tabular-nums">
              {comments.length}
            </span>
          </h3>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setSortBy("newest")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all",
              sortBy === "newest" ? "text-foreground bg-muted" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Clock className="h-3 w-3" /> {t("sort.newest")}
          </button>
          <button
            onClick={() => setSortBy("top")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all",
              sortBy === "top" ? "text-foreground bg-muted" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Flame className="h-3 w-3" /> {t("sort.mostLiked")}
          </button>
          <button
            onClick={() => fetchComments(true)}
            disabled={refreshing}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/50 hover:text-foreground transition-all disabled:opacity-50"
            aria-label={t("common.refresh")}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Input */}
      {isLoggedIn && user && userDoc ? (
        <CommentInput
          romId={romId}
          placeholder={t("comment.write") || "Share your thoughts..."}
          onSubmit={async (text) => {
            await submitComment(text);
            triggerXp(3);
          }}
        />
      ) : (
        <Link
          href="/login"
          className="flex items-center gap-3 rounded-xl border border-dashed border-border/50 bg-card/30 py-4 px-4 transition-all hover:bg-muted/30 hover:border-primary/30 group"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform shrink-0">
            <MessageSquare className="h-4 w-4" />
          </div>
          <p className="text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors">
            {t("comment.signInToComment")}
          </p>
        </Link>
      )}

      {/* Comments list */}
      {loading ? (
        <div className="space-y-4 pt-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse" style={{ opacity: Math.max(0.3, 1 - i * 0.25) }}>
              <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-1.5 pt-0.5">
                <div className="h-3 w-24 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted/50" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground/20 mb-3" />
          <p className="text-sm font-bold text-foreground mb-0.5">{t("comment.noComments")}</p>
          <p className="text-[11px] text-muted-foreground">
            {t("comments.beFirst") || "Be the first to share your thoughts"}
          </p>
        </div>
      ) : (
        <div className="space-y-0.5 pt-1">
          {sortedComments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              replies={replies}
              editingId={editingId}
              editText={editText}
              setEditingId={setEditingId}
              setEditText={setEditText}
              savingEdit={false}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
              replyText={replyText}
              setReplyText={setReplyText}
              showReplies={showReplies}
              setShowReplies={setShowReplies}
              onDeleteComment={(id: string) => deleteComment(id)}
              onEditComment={(id: string, text: string) => editComment(id, text)}
              onReactComment={(id: string, emoji: ReactionEmoji) => reactToComment(id, emoji)}
              onDeleteReply={(id: string, parentId: string) => deleteComment(id, true, parentId)}
              onEditReply={(id: string, text: string, parentId: string) => editComment(id, text, true, parentId)}
              onReactReply={(id: string, emoji: ReactionEmoji, parentId: string) =>
                reactToComment(id, emoji, true, parentId)
              }
              onReportComment={(id: string) => setReportTarget(id)}
              onLoadReplies={loadReplies}
              onSubmitReply={handleSubmitReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}
