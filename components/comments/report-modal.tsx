"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flag, Loader2, X as XIcon } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const REPORT_REASONS = [
  { id: "spam", labelKey: "report.spam", fallback: "Spam" },
  { id: "inappropriate", labelKey: "report.inappropriate", fallback: "Inappropriate content" },
  { id: "harassment", labelKey: "report.harassment", fallback: "Harassment" },
  { id: "offtopic", labelKey: "report.offtopic", fallback: "Off-topic" },
  { id: "other", labelKey: "report.other", fallback: "Other" },
];

interface ReportModalProps {
  isOpen: boolean;
  commentId: string;
  onClose: () => void;
  onSubmit: (reason: string, details: string) => Promise<void>;
}

export function ReportModal({ isOpen, commentId, onClose, onSubmit }: ReportModalProps) {
  const { t } = useTranslation();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const needsDetails = selectedReason === "other";
  const canSubmit = selectedReason && (!needsDetails || details.trim().length > 0);

  const handleSubmit = async () => {
    if (!selectedReason) return;
    setSubmitting(true);
    setError("");
    try {
      await onSubmit(selectedReason, details);
      setSelectedReason(null);
      setDetails("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit report");
      console.error("Failed to submit report:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[99] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            <motion.div
              className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl"
              style={{
                boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
              }}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.3 }}
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="report-modal-title"
            >
              {/* Top glow */}
              <div
                className="absolute inset-x-0 top-0 h-px rounded-t-2xl"
                style={{
                  background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.4), transparent)",
                }}
              />

              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <Flag className="h-4 w-4 text-amber-500" />
                  </div>
                  <h3 id="report-modal-title" className="text-sm font-black text-foreground">
                    {t("comments.reportTitle") || "Report Comment"}
                  </h3>
                </div>
                <button
                  onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                  aria-label="Close"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Reasons */}
              <div className="space-y-1.5 mb-4">
                {REPORT_REASONS.map(reason => (
                  <button
                    key={reason.id}
                    onClick={() => setSelectedReason(reason.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all text-start",
                      selectedReason === reason.id
                        ? "bg-amber-500/10 border border-amber-500/30 text-foreground"
                        : "border border-border/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:border-border"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                        selectedReason === reason.id
                          ? "border-amber-500 bg-amber-500"
                          : "border-muted-foreground/30"
                      )}
                    >
                      {selectedReason === reason.id && (
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    {t(reason.labelKey) || reason.fallback}
                  </button>
                ))}
              </div>

              {/* Details textarea */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 text-xs font-semibold text-red-500 bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg"
                  >
                    {error}
                  </motion.div>
                )}
                {selectedReason && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4"
                  >
                    <textarea
                      value={details}
                      onChange={e => setDetails(e.target.value.slice(0, 300))}
                      placeholder={t("comments.reportDetails") || "Additional details (optional)..."}
                      rows={2}
                      className="w-full resize-none rounded-xl border border-border/40 bg-muted/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-amber-500/40 transition-colors"
                    />
                    {needsDetails && !details.trim() && (
                      <p className="text-[10px] text-amber-500 mt-1">
                        {t("comments.reportDetailsRequired") || "Please provide details"}
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-all"
                >
                  {t("common.cancel") || "Cancel"}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitting}
                  className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)" }}
                >
                  {submitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Flag className="h-3.5 w-3.5" />
                  )}
                  {t("comments.submitReport") || "Submit Report"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
