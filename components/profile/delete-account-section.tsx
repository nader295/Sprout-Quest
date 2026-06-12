"use client";

/**
 * DeleteAccountSection — self-contained "delete my account" UI.
 *
 * Extracted from `app/(main)/u/[uid]/page.tsx` (Wave 16) where it owned 3
 * useState hooks + a handler + ~45 lines of JSX inside the settings dialog.
 * The feature is perfectly self-contained: on success it signs out and
 * redirects to /login, so there's nothing to hand back to the parent.
 *
 * Props: only `isOwner` — the parent still decides visibility because the
 * rest of the settings panel is rendered conditionally on the same flag.
 */

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { logger } from "@/lib/logger";
import { useTranslation } from "@/lib/i18n";

export function DeleteAccountSection({ isOwner }: { isOwner: boolean }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const { t } = useTranslation();

  if (!isOwner) return null;

  const handleDelete = async () => {
    if (confirmInput !== "DELETE") return;
    setDeleting(true);
    try {
      const { auth } = await import("@/lib/firebase/client");
      const token = await auth.currentUser?.getIdToken();
      await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "deleteAccount" }),
      });
      const { signOut } = await import("firebase/auth");
      await signOut(auth);
      window.location.href = "/login";
    } catch (err) {
      // Previously swallowed silently; now routed to Sentry via logger →
      // sentry bridge added in Wave 13. Keeps the same UX (reset dialog) but
      // surfaces the cause so we see why a delete attempt failed.
      logger.error("profile.deleteAccount", err);
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,0,0,0.1)" }}>
      {!confirmOpen ? (
        <button
          onClick={() => setConfirmOpen(true)}
          className="flex items-center gap-2 w-full rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all hover:bg-red-500/10"
          style={{ color: "rgba(251,113,133,0.7)", border: "1px solid rgba(251,113,133,0.15)" }}>
          <Trash2 className="h-3.5 w-3.5" />
          {t("profile.deleteAccount")}
        </button>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid rgba(251,113,133,0.3)", background: "rgba(251,113,133,0.05)" }}>
          <div className="px-3.5 py-3 space-y-2.5">
            <p className="text-xs font-black text-rose-400">⚠️ {t("profile.deleteWarningTitle")}</p>
            <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
              {t("profile.deleteWarningDesc")}{" "}
              <strong className="text-white/70">{t("profile.deleteWarningDays")}</strong>.
            </p>
            <input
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={t("profile.deleteConfirmPlaceholder")}
              className="w-full rounded-xl border border-rose-500/30 bg-transparent px-3 py-2 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-rose-500/60"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmInput("");
                }}
                className="flex-1 rounded-xl py-2 text-xs font-bold transition-all"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
                {t("common.cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={confirmInput !== "DELETE" || deleting}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black text-white transition-all disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #dc2626, #991b1b)" }}>
                {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                {t("profile.deleteFinal")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
