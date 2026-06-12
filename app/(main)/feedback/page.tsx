"use client";

import { useState } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import {
  Bug, Lightbulb, Send, Check, Loader2,
  MessageSquarePlus, BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

type FeedbackType = "bug" | "suggestion" | null;

export default function FeedbackPage() {
  const { user, userDoc, isLoggedIn } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();

  const [type, setType] = useState<FeedbackType>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!text.trim() || text.trim().length < 10 || !type) return;
    setSending(true);
    try {
      const { auth } = await import("@/lib/firebase/client");
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type, text: text.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 429) throw new Error(t("feedback.tooManyRequests"));
        throw new Error(err.error || t("feedback.sendFailed") || "Send Failed");
      }
      setSent(true);
      setText("");
      setType(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : t("feedback.error") || "An error occurred, please try again");
    } finally { setSending(false); }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl mb-5"
          style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))", border: "1px solid rgba(34,197,94,0.25)" }}>
          <Check className="h-10 w-10 text-emerald-400" />
        </div>
        <h2 className="text-xl font-black text-white mb-2">{t("feedback.sent")}</h2>
        <p className="text-sm text-white/40 mb-8 max-w-xs">{t("feedback.thankYouDesc") || "We appreciate your time and contribution to improving the platform."}</p>
        <div className="flex gap-3">
          <button onClick={() => setSent(false)}
            className="rounded-2xl px-5 py-2.5 text-sm font-bold transition-all"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>
            {t("feedback.sendAnother") || "Send Another"}
          </button>
          <Link href="/"
            className="rounded-2xl px-5 py-2.5 text-sm font-black text-white transition-all"
            style={{ background: "linear-gradient(135deg, #1d9bf0, #0ea5e9)", boxShadow: "0 4px 16px rgba(29,155,240,0.3)" }}>
            {t("nav.home") || "Home"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-5">
      {/* Header */}
      <div className="mb-2">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ background: "linear-gradient(135deg, rgba(29,155,240,0.15), rgba(99,102,241,0.1))", border: "1px solid rgba(29,155,240,0.2)" }}>
            <MessageSquarePlus className="h-5 w-5 text-sky-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">{t("feedback.title")}</h1>
            <p className="text-xs text-white/35">{t("feedback.subtitle") || "Help us improve RomX"}</p>
          </div>
        </div>
      </div>

      {/* Rules link */}
      <Link href="/feedback/rules"
        className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 transition-all hover:bg-white/5 active:scale-[0.98]"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)" }}>
          <BookOpen className="h-3.5 w-3.5 text-amber-400" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-white/80">{t("feedback.rulesTitle") || "Feedback Rules"}</p>
          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{t("feedback.rulesDesc") || "Read before sending to ensure it's processed quickly"}</p>
        </div>
        <span className="text-white/20 text-xs">←</span>
      </Link>

      {/* Type selector */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            id: "bug" as const,
            icon: Bug,
            title: t("feedback.bugTitle"),
            desc: t("feedback.bugDescText") || "Error or technical issue",
            color: "#fb7185",
            bg: "rgba(251,113,133,0.08)",
            border: "rgba(251,113,133,0.2)",
            glow: "rgba(251,113,133,0.15)",
          },
          {
            id: "suggestion" as const,
            icon: Lightbulb,
            title: t("feedback.suggestTitle"),
            desc: t("feedback.suggestDescText") || "Idea or suggested improvement",
            color: "#fbbf24",
            bg: "rgba(251,191,36,0.08)",
            border: "rgba(251,191,36,0.2)",
            glow: "rgba(251,191,36,0.15)",
          },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setType(item.id)}
            className="relative flex flex-col items-start gap-3 rounded-2xl p-4 text-start transition-all active:scale-[0.97]"
            style={{
              background: type === item.id ? item.bg : "rgba(255,255,255,0.03)",
              border: `1.5px solid ${type === item.id ? item.border : "rgba(255,255,255,0.07)"}`,
              boxShadow: type === item.id ? `0 0 20px ${item.glow}` : "none",
            }}
          >
            {type === item.id && (
              <div className="absolute top-3 end-3 flex h-5 w-5 items-center justify-center rounded-full"
                style={{ background: item.color }}>
                <Check className="h-3 w-3 text-white" />
              </div>
            )}
            <div className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: `${item.color}15`, border: `1px solid ${item.color}25` }}>
              <item.icon className="h-4 w-4" style={{ color: item.color }} />
            </div>
            <div>
              <p className="text-xs font-black text-white">{item.title}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{item.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Text input */}
      {type && (
        <div className="rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
          <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            {type === "bug"
              ? <Bug className="h-3.5 w-3.5 text-rose-400" />
              : <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
            }
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
              {type === "bug" ? t("feedback.bugDesc") : t("feedback.suggestDesc")}
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("feedback.placeholder")}
            rows={5}
            className="w-full bg-transparent px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none resize-none"
          />
          <div className="flex items-center justify-between px-4 pb-3">
            <span className={cn("text-[10px]", text.trim().length < 10 ? "text-white/20" : "text-emerald-400")}>
              {text.trim().length}/10 {text.trim().length >= 10 ? "✓" : ""}
            </span>
            <button
              onClick={handleSend}
              disabled={text.trim().length < 10 || sending}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black text-white transition-all disabled:opacity-40 hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(135deg, #1d9bf0, #6366f1)", boxShadow: "0 4px 12px rgba(29,155,240,0.3)" }}>
              {sending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Send className="h-3.5 w-3.5" />
              }
              {t("common.send")}
            </button>
          </div>
        </div>
      )}


    </div>
  );
}
