"use client";

import { useState } from "react";
import { apiSubmitApplication } from "@/lib/api/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";
import {
  BadgeCheck, Github, Send as Telegram, Globe, ExternalLink,
  Loader2, Check, AlertTriangle,
} from "lucide-react";

export default function ApplyPage() {
  const { user, userDoc, isLoggedIn } = useAuth();
  const { t } = useTranslation();
  const [githubUrl, setGithubUrl] = useState("");
  const [xdaUrl, setXdaUrl] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [sampleRomUrl, setSampleRomUrl] = useState("");
  const [experience, setExperience] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <BadgeCheck className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-foreground font-medium">{t("apply.signInPrompt")}</p>
        <p className="text-sm text-muted-foreground mt-1">{t("apply.signInDesc")}</p>
        <Link href="/login" className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: "var(--primary)" }}>{t("auth.signIn")}</Link>
      </div>
    );
  }

  if (userDoc?.role === "verifiedDev" || userDoc?.role === "admin" || userDoc?.role === "owner") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <BadgeCheck className="h-12 w-12 mb-3" style={{ color: "var(--primary)" }} />
        <p className="text-foreground font-medium">{t("apply.alreadyVerified")}</p>
        <p className="text-sm text-muted-foreground mt-1">{t("apply.alreadyVerifiedDesc")}</p>
        <Link href="/upload" className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: "var(--primary)" }}>{t("apply.uploadRom")}</Link>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!user?.uid) return;
    if (!experience.trim() || !reason.trim()) { setError(t("apply.fillRequired")); return; }
    setSubmitting(true);
    setError("");
    try {
      await apiSubmitApplication({
        githubUrl: githubUrl.trim(),
        xdaUrl: xdaUrl.trim(),
        telegramUrl: telegramUrl.trim(),
        sampleRomUrl: sampleRomUrl.trim(),
        experience: experience.trim(),
        reason: reason.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("apply.failedSubmit"));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Check className="h-12 w-12 mb-3" style={{ color: "var(--primary)" }} />
        <p className="text-foreground font-medium">{t("apply.submitted")}</p>
        <p className="text-sm text-muted-foreground mt-1">{t("apply.submittedDesc")}</p>
        <Link href="/" className="mt-4 text-sm font-medium" style={{ color: "var(--primary)" }}>{t("apply.backHome")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: "var(--primary-dim)" }}>
            <BadgeCheck className="h-4 w-4" style={{ color: "var(--primary)" }} />
          </div>
          <h1 className="text-lg font-black text-foreground sm:text-xl">{t("apply.title")}</h1>
        </div>
        <p className="text-xs text-muted-foreground sm:text-sm">{t("apply.subtitle")}</p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col gap-4">
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground"><Github className="h-3.5 w-3.5" /> {t("apply.github")}</label>
          <input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/username" className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground"><ExternalLink className="h-3.5 w-3.5" /> {t("apply.xda")}</label>
          <input value={xdaUrl} onChange={(e) => setXdaUrl(e.target.value)} placeholder="https://xdaforums.com/m/username" className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground"><Telegram className="h-3.5 w-3.5" /> {t("apply.telegram")}</label>
          <input value={telegramUrl} onChange={(e) => setTelegramUrl(e.target.value)} placeholder="https://t.me/username" className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground"><Globe className="h-3.5 w-3.5" /> {t("apply.sampleUrl")}</label>
          <input value={sampleRomUrl} onChange={(e) => setSampleRomUrl(e.target.value)} placeholder={t("apply.samplePlaceholder")} className="input-field" />
        </div>
        <div className="h-px bg-border" />
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("apply.experience")} <span className="text-destructive">*</span></label>
          <textarea value={experience} onChange={(e) => setExperience(e.target.value)} placeholder={t("apply.experiencePlaceholder")} rows={4} className="textarea-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("apply.reason")} <span className="text-destructive">*</span></label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("apply.reasonPlaceholder")} rows={3} className="textarea-field" />
        </div>
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        <button onClick={handleSubmit} disabled={submitting}
          className="btn-glow flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50 active:scale-[0.98] transition-transform"
          style={{ backgroundColor: "var(--primary)" }}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
          {t("apply.submit")}
        </button>
      </div>
    </div>
  );
}
