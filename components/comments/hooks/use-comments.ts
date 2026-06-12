"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { toast } from "@/components/shared/toast";
import type { Comment, Reply, ReactionEmoji, Reaction } from "@/lib/types";

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

interface UseCommentsOptions {
  romId: string;
}

export function useComments({ romId }: UseCommentsOptions) {
  const { user, userDoc } = useAuth();
  const { t } = useTranslation();
  const [comments, setComments] = useState<Comment[]>([]);
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch main comments
  const fetchComments = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`/api/comments?romId=${encodeURIComponent(romId)}&type=comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.items || []);
      }
    } catch (err) {
      toast.error(t("comments.loadFailed") || "Failed to load comments");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [romId, t]);

  // Fetch replies for a comment
  const loadReplies = useCallback(
    async (commentId: string) => {
      try {
        const res = await fetch(
          `/api/comments?romId=${encodeURIComponent(romId)}&type=replies&commentId=${encodeURIComponent(commentId)}`
        );
        if (res.ok) {
          const data = await res.json();
          setReplies(p => ({ ...p, [commentId]: data.items || [] }));
        }
      } catch (err) {
        console.error("Failed to load replies:", err);
      }
    },
    [romId]
  );

  // Post comment
  const submitComment = useCallback(
    async (text: string) => {
      if (!text.trim() || !user || !userDoc) return;
      const spamCheck = checkSpam(text);
      if (spamCheck.isSpam) {
        throw new Error(spamCheck.reason || "Comment appears to be spam");
      }
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/comments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            romId,
            text: text.trim(),
            name: userDoc.name,
            photo: userDoc.photo || "",
          }),
        });
        if (!res.ok) throw new Error("Failed to post comment");
        const created = await res.json();
        setComments(p => [created as Comment, ...p]);
        toast.success(t("comments.posted") || "Comment posted!");
      } catch (err) {
        toast.error(t("comments.postFailed") || "Failed to post comment");
        throw err;
      }
    },
    [user, userDoc, romId, t]
  );

  // Reply to comment
  const submitReply = useCallback(
    async (commentId: string, text: string) => {
      if (!text.trim() || !user || !userDoc) return;
      const spamCheck = checkSpam(text);
      if (spamCheck.isSpam) {
        throw new Error(spamCheck.reason || "Reply appears to be spam");
      }
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/comments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            romId,
            text: text.trim(),
            name: userDoc.name,
            photo: userDoc.photo || "",
            parentId: commentId,
          }),
        });
        if (!res.ok) throw new Error("Failed to post reply");
        const created = await res.json();
        setReplies(p => ({
          ...p,
          [commentId]: [...(p[commentId] || []), created as Reply],
        }));
        setComments(p =>
          p.map(c =>
            c.id === commentId ? { ...c, replyCount: (c.replyCount || 0) + 1 } : c
          )
        );
        toast.success(t("comments.posted") || "Reply posted!");
      } catch (err) {
        toast.error(t("comments.replyFailed") || "Failed to post reply");
        throw err;
      }
    },
    [user, userDoc, romId, t]
  );

  // Delete comment
  const deleteComment = useCallback(
    async (commentId: string, isReply = false, parentId?: string) => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        let url = `/api/comments?romId=${encodeURIComponent(romId)}&commentId=${encodeURIComponent(commentId)}`;
        if (isReply && parentId) {
          url += `&isReply=true&parentId=${encodeURIComponent(parentId)}`;
        }
        const res = await fetch(url,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (!res.ok) throw new Error("Failed to delete");
        if (isReply && parentId) {
          setReplies(p => ({
            ...p,
            [parentId]: (p[parentId] || []).filter(r => r.id !== commentId),
          }));
          setComments(p =>
            p.map(c =>
              c.id === parentId
                ? { ...c, replyCount: Math.max(0, (c.replyCount || 0) - 1) }
                : c
            )
          );
        } else {
          setComments(p => p.filter(c => c.id !== commentId));
        }
        toast.success(t("comments.deleted") || "Deleted");
      } catch (err) {
        toast.error(t("common.error") || "Error deleting");
        throw err;
      }
    },
    [user, romId, t]
  );

  // Edit comment
  const editComment = useCallback(
    async (commentId: string, text: string, isReply = false, parentId?: string) => {
      if (!text.trim() || !user) return;
      const spamCheck = checkSpam(text);
      if (spamCheck.isSpam) {
        throw new Error(spamCheck.reason || "Edit appears to be spam");
      }
      try {
        const token = await user.getIdToken();
        await fetch("/api/comments", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            commentId,
            text: text.trim(),
            romId,
            isReply,
            parentId,
          }),
        });
        if (isReply && parentId) {
          setReplies(p => ({
            ...p,
            [parentId]: (p[parentId] || []).map(r =>
              r.id === commentId
                ? { ...r, text: text.trim(), edited: true }
                : r
            ),
          }));
        } else {
          setComments(p =>
            p.map(c =>
              c.id === commentId ? { ...c, text: text.trim(), edited: true } : c
            )
          );
        }
        toast.success(t("comments.edited") || "Edited");
      } catch (err) {
        toast.error(t("comments.editFailed") || "Edit failed");
        throw err;
      }
    },
    [user, romId, t]
  );

  // React to comment
  const reactToComment = useCallback(
    async (commentId: string, emoji: ReactionEmoji, isReply = false, parentId?: string) => {
      if (!user) {
        toast.error(t("auth.signInPrompt") || "Sign in first");
        return;
      }

      const updateReactions = (arr: Reaction[] = [], em: ReactionEmoji): Reaction[] => {
        const myPrev = arr.find(r => r.reactedByMe);
        const isSame = myPrev?.emoji === em;
        let result = arr
          .map(r => (r.reactedByMe ? { ...r, count: r.count - 1, reactedByMe: false } : r))
          .filter(r => r.count > 0);
        if (!isSame) {
          const existingNew = result.find(r => r.emoji === em);
          if (existingNew) {
            result = result.map(r =>
              r.emoji === em ? { ...r, count: r.count + 1, reactedByMe: true } : r
            );
          } else {
            result = [...result, { emoji: em, count: 1, reactedByMe: true }];
          }
        }
        return result;
      };

      if (isReply && parentId) {
        setReplies(p => ({
          ...p,
          [parentId]: (p[parentId] || []).map(r =>
            r.id === commentId
              ? { ...r, reactions: updateReactions(r.reactions, emoji) }
              : r
          ),
        }));
      } else {
        setComments(p =>
          p.map(c =>
            c.id === commentId ? { ...c, reactions: updateReactions(c.reactions, emoji) } : c
          )
        );
      }

      try {
        const token = await user.getIdToken();
        await fetch("/api/comments", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            commentId,
            emoji,
            romId,
            isReply,
            parentId,
          }),
        });
      } catch (err) {
        console.error("Failed to react:", err);
      }
    },
    [user, romId, t]
  );

  // Initial fetch
  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  return {
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
  };
}
