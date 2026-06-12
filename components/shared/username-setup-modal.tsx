"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { apiCheckUsername, apiUpdateProfile } from "@/lib/api/client";
import { checkUsername } from "@/lib/username-filter";
import { debounce } from "@/lib/utils";
import { AtSign, Check, X, Loader2, Zap, AlertTriangle, ShieldAlert } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

// Client-side validation (mirrors server)
function validateUsername(u: string): string | null {
  if (!u) return "Username is required";
  if (u.length < 5) return "At least 5 characters";
  if (u.length > 32) return "Max 32 characters";
  if (!/^[a-zA-Z]/.test(u)) return "Must start with a letter";
  if (!/^[a-zA-Z0-9_]+$/.test(u)) return "Only letters, numbers and _ allowed";
  return null;
}

export function UsernameSetupModal() {
  const { user, userDoc, isLoggedIn, refreshUserDoc } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();

  const [username, setUsername]     = useState("");
  const [error, setError]           = useState<string | null>(null);
  const [warning, setWarning]       = useState<string | null>(null);
  const [available, setAvailable]   = useState<boolean | null>(null);
  const [checking, setChecking]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [isBlocked, setIsBlocked]   = useState(false);

  const latestUsername = useRef(username);

  // لا تعرض المودال لو:
  // 1. لسه loading (userDoc لسه مش جاهز)
  // 2. المستخدم عنده username بالفعل
  // 3. المستخدم مش logged in
  // 4. في أول 2 ثانية بعد load (منع flash)
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    // انتظر الـ auth يستقر قبل ما تعرض المودال
    const t = setTimeout(() => setSettled(true), 1500);
    return () => clearTimeout(t);
  }, []);
  const authLoading = !userDoc && isLoggedIn;
  const show = settled && isLoggedIn && userDoc !== null && !authLoading && !userDoc?.username;

  // ── Availability check via API ────────────────────────
  const checkAvailability = useCallback(
    debounce(async (val: string) => {
      const err = validateUsername(val);
      if (err) { setError(err); setAvailable(null); setChecking(false); return; }

      setChecking(true);
      try {
        const res = await apiCheckUsername(val, user?.uid);
        if (val !== latestUsername.current) return;
        setAvailable(res.available);
        setError(res.available ? null : "This username is already taken");
      } catch {
        if (val !== latestUsername.current) return;
        setError("Could not check availability");
      } finally {
        if (val === latestUsername.current) setChecking(false);
      }
    }, 500),
    [user?.uid],
  );

  useEffect(() => {
    latestUsername.current = username;

    setWarning(null);
    setIsBlocked(false);
    setAvailable(null);
    setChecking(false);

    if (!username) { setError(null); return; }

    const check = checkUsername(username);
    if (check.status === "blocked") {
      setError(check.message);
      setIsBlocked(true);
      return;
    }
    if (check.status === "warning") {
      setWarning(check.message);
    }

    const err = validateUsername(username);
    if (err) { setError(err); return; }

    setError(null);
    setChecking(true);
    checkAvailability(username);
  }, [username, checkAvailability]);

  // ── Save via API ─────────────────────────────────────
  const handleSave = async () => {
    if (!user?.uid || !username || error || !available || isBlocked) return;
    setSaving(true);
    try {
      await apiUpdateProfile({ username });
      await refreshUserDoc();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // AnimatePresence handles show/hide

  const rules = [
    { label: "5-32 characters",             ok: username.length >= 5 && username.length <= 32 },
    { label: "Starts with a letter",         ok: /^[a-zA-Z]/.test(username) },
    { label: "Letters, numbers and _ only",  ok: /^[a-zA-Z0-9_]*$/.test(username) && username.length > 0 },
  ];

  const canSubmit = available && !error && !saving && !!username && !isBlocked;

  const borderStyle = isBlocked
    ? { borderColor: "var(--destructive)" }
    : warning && !error
    ? { borderColor: "#f59e0b" }
    : undefined;

  return (
    <AnimatePresence>
      {show && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <motion.div
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-2xl"
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 24 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >

        {/* Logo */}
        <div className="flex justify-center mb-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl"
               style={{ backgroundColor: "var(--primary-dim)" }}>
            <Zap className="h-8 w-8" style={{ color: "var(--primary)" }} />
          </div>
        </div>

        <h2 className="text-center text-2xl font-bold text-foreground">Welcome to RomX!</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground leading-relaxed">
          Choose a unique username. This will be your public identity on the platform.
        </p>

        {/* Input */}
        <div className="mt-7">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Username
          </label>
          <div className="mt-1.5 relative">
            <div className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <AtSign className="h-4 w-4" />
            </div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
              placeholder="your_username"
              maxLength={32}
              autoFocus
              className="h-12 w-full rounded-xl border border-border bg-muted/50 ps-9 pe-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[var(--primary)] transition-colors"
              style={borderStyle}
            />
            <div className="absolute end-3 top-1/2 -translate-y-1/2">
              {checking                                          && <Loader2     className="h-4 w-4 animate-spin text-muted-foreground" />}
              {!checking && isBlocked                           && <ShieldAlert  className="h-4 w-4 text-destructive" />}
              {!checking && !isBlocked && available === true    && <Check        className="h-4 w-4 text-emerald-400" />}
              {!checking && !isBlocked && available === false   && <X            className="h-4 w-4 text-destructive" />}
            </div>
          </div>

          {/* Feedback */}
          <div className="mt-2 min-h-[20px] space-y-1">
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <X className="h-3 w-3 shrink-0" /> {error}
              </p>
            )}
            {!error && warning && (
              <p className="text-xs text-amber-400 flex items-start gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" /> {warning}
              </p>
            )}
            {!error && !warning && available && (
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <Check className="h-3 w-3" /> {t("username.available2")}
              </p>
            )}
          </div>

          {/* Rules checklist */}
          <div className="mt-4 space-y-2">
            {rules.map((r) => (
              <div key={r.label} className="flex items-center gap-2 text-xs">
                <div className="flex h-4 w-4 items-center justify-center rounded-full"
                     style={{ backgroundColor: r.ok ? "rgba(16,185,129,0.15)" : "rgba(161,161,170,0.15)" }}>
                  {r.ok
                    ? <Check className="h-2.5 w-2.5 text-emerald-400" />
                    : <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />}
                </div>
                <span className={r.ok ? "text-emerald-400" : "text-muted-foreground"}>{r.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Save */}
        <motion.button
          onClick={handleSave}
          disabled={!canSubmit}
          whileHover={{ scale: canSubmit ? 1.02 : 1 }}
          whileTap={{ scale: canSubmit ? 0.98 : 1 }}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: "var(--primary)" }}
        >
          {saving
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <><Check className="h-4 w-4" /> {t("username.setBtn2")}</>}
        </motion.button>

        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          You can change this later from your profile settings.
        </p>
      </motion.div>
    </div>
      )}
    </AnimatePresence>
  );
}
