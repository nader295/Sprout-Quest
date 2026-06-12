"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { apiSubmitAppeal, apiGetMyAppeal } from "@/lib/api/client";
import { fmtDate } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import type { Appeal } from "@/lib/types";
import { 
  AlertTriangle, Clock, FileText, Send, Loader2, CheckCircle, XCircle, 
  Upload, ExternalLink
} from "lucide-react";

export function SuspensionOverlay() {
  const { userDoc, isLoggedIn } = useAuth();
  const { t } = useTranslation();
  const [appeal, setAppeal] = useState<Appeal | null>(null);
  const [loadingAppeal, setLoadingAppeal] = useState(true);
  const [explanation, setExplanation] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Check if user is suspended
  const isSuspended = userDoc?.suspended === true && userDoc?.suspendedUntil;
  const suspendedUntil = userDoc?.suspendedUntil ? new Date(
    typeof userDoc.suspendedUntil === "string" 
      ? userDoc.suspendedUntil 
      : typeof userDoc.suspendedUntil === "object" && "seconds" in userDoc.suspendedUntil
        ? userDoc.suspendedUntil.seconds * 1000
        : 0
  ) : null;
  const isStillSuspended = suspendedUntil && suspendedUntil > new Date();

  useEffect(() => {
    if (isSuspended && isStillSuspended) {
      setLoadingAppeal(true);
      apiGetMyAppeal()
        .then(setAppeal)
        .finally(() => setLoadingAppeal(false));
    }
  }, [isSuspended, isStillSuspended]);

  if (!isLoggedIn || !isSuspended || !isStillSuspended) {
    return null;
  }

  const handleSubmit = async () => {
    if (!explanation.trim() || explanation.trim().length < 20) {
      setError("Please provide a detailed explanation (at least 20 characters)");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await apiSubmitAppeal({ explanation: explanation.trim(), evidenceUrl: evidenceUrl.trim() || undefined });
      setSuccess(true);
      // Refresh appeal status
      const newAppeal = await apiGetMyAppeal();
      setAppeal(newAppeal);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit appeal");
    } finally {
      setSubmitting(false);
    }
  };

  const timeLeft = suspendedUntil ? Math.max(0, suspendedUntil.getTime() - Date.now()) : 0;
  const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
  const daysLeft = Math.floor(hoursLeft / 24);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-destructive/30 bg-card p-6 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{t("suspension.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            {t("suspension.description")}
          </p>
        </div>

        {/* Suspension Details */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">{t("suspension.reason")}</span>
            <span className="text-xs font-medium text-foreground">
              {userDoc?.suspensionReason || "Policy violation"}
            </span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">{t("suspension.until")}</span>
            <span className="text-xs font-medium text-foreground">
              {suspendedUntil ? fmtDate(suspendedUntil.toISOString()) : "Unknown"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{t("suspension.timeLeft")}</span>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
              <Clock className="h-3.5 w-3.5" />
              {daysLeft > 0 ? `${daysLeft}d ${hoursLeft % 24}h` : `${hoursLeft}h`}
            </div>
          </div>
        </div>

        {loadingAppeal ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : appeal ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{t("suspension.appealStatus")}</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              {appeal.status === "pending" ? (
                <>
                  <Clock className="h-4 w-4 text-amber-400" />
                  <span className="text-sm text-amber-400">{t("suspension.appealPending")}</span>
                </>
              ) : appeal.status === "approved" ? (
                <>
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm text-emerald-400">{t("suspension.appealApproved")}</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-destructive">{t("suspension.appealRejected")}</span>
                </>
              )}
            </div>
            {appeal.adminNote && (
              <p className="text-xs text-muted-foreground mt-2 p-2 rounded-lg bg-muted/50">
                {appeal.adminNote}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-2">
              {t("suspension.submittedOn")} {fmtDate(appeal.createdAt)}
            </p>
          </div>
        ) : success ? (
          <div className="flex flex-col items-center text-center py-4">
            <CheckCircle className="h-10 w-10 text-emerald-400 mb-2" />
            <p className="text-sm font-medium text-foreground">{t("suspension.appealSubmitted")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("suspension.appealReviewNotice")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" /> {t("suspension.submitAppeal")}
            </h3>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                {t("suspension.explanation")} *
              </label>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder={t("suspension.explanationPlaceholder")}
                rows={4}
                className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[var(--primary)] resize-none"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {explanation.length}/20 {t("common.minChars")}
              </p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Upload className="h-3 w-3" /> {t("suspension.evidence")}
              </label>
              <input
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="https://imgur.com/... or drive.google.com/..."
                className="w-full h-9 rounded-lg border border-border bg-muted/50 px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[var(--primary)]"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("suspension.evidenceHint")}
              </p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting || explanation.trim().length < 20}
              className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--primary)" }}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {t("suspension.submit")}
            </button>
          </div>
        )}

        <p className="text-[10px] text-center text-muted-foreground mt-4">
          {t("suspension.contactSupport")}{" "}
          <a href="mailto:support@romx.app" className="text-[var(--primary)] hover:underline">
            support@romx.app
          </a>
        </p>
      </div>
    </div>
  );
}
