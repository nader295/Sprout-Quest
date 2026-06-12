"use client";

import { useEffect, useRef } from "react";
import type { UploadFormState } from "./use-upload-form";
import { useTranslation } from "@/lib/i18n";

const DRAFT_KEY = "romx_upload_draft_v2";

export function useUploadDraft(
  form: UploadFormState,
  setForm: React.Dispatch<React.SetStateAction<UploadFormState>>,
  step: number,
  setStep: React.Dispatch<React.SetStateAction<number>>,
  editId: string | null
) {
  const { t } = useTranslation();
  const draftTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Draft restore ────────────────────────────────────
  useEffect(() => {
    if (editId) return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved) as Partial<UploadFormState> & { _step?: number };
        if (draft.name || draft.device || draft.description) {
          const restore = window.confirm(t("upload.draftRestore"));
          if (restore) {
            const { _step, ...formData } = draft;
            setForm((prev) => ({ ...prev, ...formData }));
            if (_step && _step > 1) setStep(_step);
          } else {
            localStorage.removeItem(DRAFT_KEY);
          }
        }
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Draft auto-save ──────────────────────────────────
  useEffect(() => {
    if (editId) return;
    if (draftTimerRef.current) clearInterval(draftTimerRef.current);
    draftTimerRef.current = setInterval(() => {
      try {
        if (form.name || form.device || form.description) {
          localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form, _step: step }));
        }
      } catch { /* ignore */ }
    }, 30_000);
    
    return () => {
      if (draftTimerRef.current) clearInterval(draftTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, step, editId]);

  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  };

  return { clearDraft };
}
