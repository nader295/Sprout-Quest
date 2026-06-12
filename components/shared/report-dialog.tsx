"use client";

import { useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { apiSubmitReport } from "@/lib/api/client";
import { useAuth } from "@/lib/hooks/use-auth";
import { REPORT_REASONS } from "@/lib/constants";
import {
  Flag, X, Loader2, Check, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

interface ReportDialogProps {
  open: boolean;
  onClose: () => void;
  targetType: "rom" | "comment" | "user";
  targetId: string;
}

export function ReportDialog({ open, onClose, targetType, targetId }: ReportDialogProps) {
  const { user, userDoc } = useAuth();
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const dragY = useMotionValue(0);
  const backdropOpacity = useTransform(dragY, [0, 200], [1, 0.2]);

  const handleSubmit = async () => {
    if (!user?.uid || !reason) return;
    setSubmitting(true);
    setError("");

    try {
      await apiSubmitReport({
        targetType,
        targetId,
        reason,
        description: description.trim(),
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason("");
    setDescription("");
    setSubmitted(false);
    setError("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ opacity: backdropOpacity }}
            onClick={handleClose}
          />

          {/* Dialog */}
          <motion.div
            className="relative w-full max-w-md rounded-3xl border border-border bg-card p-5 shadow-2xl touch-none"
            style={{ y: dragY }}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 200 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 300) {
                handleClose();
              } else {
                dragY.set(0);
              }
            }}
          >
            <motion.button
              onClick={handleClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="absolute end-3 top-3 rounded-lg p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </motion.button>

            {submitted ? (
              <motion.div
                className="flex flex-col items-center py-6 text-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <Check className="h-10 w-10 mb-3" style={{ color: "var(--primary)" }} />
                <p className="text-foreground font-medium">{t("report.submitted")}</p>
                <p className="text-sm text-muted-foreground mt-1">{t("report.teamReview")}</p>
                <motion.button
                  onClick={handleClose}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: "var(--primary)" }}
                >
                  Close
                </motion.button>
              </motion.div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <Flag className="h-5 w-5 text-destructive" />
                  <h2 className="text-lg font-semibold text-foreground">{t("report.dialog")} {targetType}</h2>
                </div>

                {/* Reason selection */}
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Reason <span className="text-destructive">*</span>
                  </label>
                  <div className="flex flex-col gap-1.5">
                    {REPORT_REASONS.map((r, i) => (
                      <motion.button
                        key={r.value}
                        onClick={() => setReason(r.value)}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04, type: "spring", stiffness: 400, damping: 25 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-start text-sm transition-colors",
                          reason === r.value
                            ? "border-[var(--primary)] bg-primary-dim text-foreground"
                            : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {r.label}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Additional details
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("report.contextPlaceholder")}
                    rows={3}
                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive overflow-hidden"
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-2">
                  <motion.button
                    onClick={handleClose}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={handleSubmit}
                    disabled={submitting || !reason}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    style={{ backgroundColor: "var(--destructive, #ef4444)" }}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
                    Submit Report
                  </motion.button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
