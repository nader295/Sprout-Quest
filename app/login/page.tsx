"use client";

import { motion } from "framer-motion";
import { useAuth } from "@/lib/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";

// Shared bouncy spring — used for submit / social buttons + toggle.
// Gentler spring — the previous values caused distracting squish on every click.
const BOUNCE = { type: "spring" as const, stiffness: 380, damping: 22, mass: 0.8 };
import { apiCheckUsername, apiUpdateProfile } from "@/lib/api/client";
import { checkUsername } from "@/lib/username-filter";
import { debounce, cn } from "@/lib/utils";
import { LanguageSelector } from "@/components/shared/language-selector";
import {
  AtSign, Check, X, Loader2, ShieldAlert, AlertTriangle,
  ChevronRight, ArrowRight, Zap, Globe, Send, Github,
  User, FileText, Sparkles, Twitter, ExternalLink,
  Plus, Trash2, Link2, Youtube,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { toast } from "@/components/shared/toast";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { debugLog } from "@/lib/debug-log";
import { DebugLogPanel } from "@/components/login/DebugLogPanel";

// ── Supported platforms ───────────────────────────────────────────
const SOCIAL_PLATFORMS = [
  { id: "github",   label: "GitHub",    icon: Github,       prefix: "github.com/",  placeholder: "username" },
  { id: "telegram", label: "Telegram",  icon: Send,         prefix: "t.me/",        placeholder: "username or @channel" },
  { id: "youtube",  label: "YouTube",   icon: Youtube,      prefix: "youtube.com/", placeholder: "@handle or /channel/..." },
  { id: "twitter",  label: "Twitter/X", icon: Twitter,      prefix: "x.com/",       placeholder: "username" },
  { id: "xda",      label: "XDA",       icon: ExternalLink, prefix: "",             placeholder: "https://xda-developers.com/..." },
  { id: "website",  label: "Website",   icon: Globe,        prefix: "",             placeholder: "https://yoursite.com" },
] as const;

type PlatformId = typeof SOCIAL_PLATFORMS[number]["id"];
interface SocialEntry { platform: PlatformId; value: string; }

function validateUsername(u: string): string | null {
  if (!u) return "Username is required";
  if (u.length < 5) return "At least 5 characters";
  if (u.length > 32) return "Max 32 characters";
  if (!/^[a-zA-Z]/.test(u)) return "Must start with a letter";
  if (!/^[a-zA-Z0-9_]+$/.test(u)) return "Only letters, numbers and _ allowed";
  return null;
}

function GridBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-background">
      {/* Modern Grid Line Pattern */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: "linear-gradient(var(--primary) 1px, transparent 1px), linear-gradient(90deg, var(--primary) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      
      {/* Animated Glowing Orbs */}
      <div className="absolute -top-[20%] -start-[10%] h-[600px] w-[600px] animate-[spin_40s_linear_infinite] rounded-full blur-[120px] opacity-[0.15]"
        style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }} />
        
      <div className="absolute -bottom-[20%] -end-[10%] h-[500px] w-[500px] animate-[spin_50s_linear_infinite_reverse] rounded-full blur-[100px] opacity-[0.12]"
        style={{ background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)" }} />

      <div className="absolute top-[30%] start-[50%] h-[400px] w-[400px] animate-[pulse_10s_ease-in-out_infinite] rounded-full blur-[100px] opacity-10"
        style={{ background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)" }} />
    </div>
  );
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-3 mb-10">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 border",
            i + 1 < current  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
            : i + 1 === current ? "border-2 text-white"
            : "bg-muted/50 border-border text-muted-foreground/30"
          )}
            style={i + 1 === current ? { borderColor: "var(--primary)", backgroundColor: "color-mix(in srgb, var(--primary) 15%, transparent)", color: "var(--primary)" } : undefined}
          >
            {i + 1 < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={cn("h-px w-10 transition-all duration-500", i + 1 < current ? "bg-emerald-500/40" : "bg-border/50")} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Left panel ────────────────────────────────────────────────────
function LeftPanel({ step }: { step: number }) {
  const { t } = useTranslation();
  const LEVEL_PERKS = [
    { level: "LV.1",  label: "Member",     xp: "0 XP",    perks: "Upload ROMs · Kernels · Recoveries · Public profile" },
    { level: "LV.3",  label: "Publisher",        xp: "150 XP",  perks: "Custom social links · Pin a release" },
    { level: "LV.7",  label: "Developer",  xp: "600 XP",  perks: "Channel links on every release · Donations · Cover · Analytics" },
    { level: "LV.10", label: "Top Dev",    xp: "1.8K XP", perks: "Priority in Explore · Custom status" },
    { level: "LV.30", label: "Legendary",  xp: "25K XP",  perks: "Featured Developers section · Legendary badge" },
  ];
  const hints = [
    { title: "Sign in instantly", body: "Use Google, GitHub, or X — no passwords or complex forms." },
    { title: "Your identity on RomX", body: "Your unique public identifier — choose a great name." },
    { title: "Let your profile speak", body: "Your links appear automatically on all your releases." },
  ];
  const hint = hints[step - 1];

  return (
    <div className="relative hidden lg:flex flex-col justify-between h-full p-10 overflow-hidden">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60"
          style={{ backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)" }}>
          <Zap className="h-5 w-5" style={{ color: "var(--primary)" }} />
        </div>
        <span className="text-xl font-black tracking-tight text-foreground">
          Rom<span style={{ color: "var(--primary)" }}>X</span>
        </span>
      </div>

      <div>
        <div className="mb-8 rounded-2xl border border-border/50 bg-card/30 p-5 backdrop-blur-sm"
          style={{ borderInlineStart: "3px solid var(--primary)" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--primary)" }}>
            {t("login.step")} {step}
          </p>
          <h3 className="text-base font-bold text-foreground mb-1.5">{hint.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{hint.body}</p>
        </div>

        <div className="space-y-1.5 mt-6">
          {LEVEL_PERKS.map((lp, idx) => (
            <div key={lp.level} className="group flex items-start gap-3 rounded-xl border border-border/40 bg-card/20 px-3 py-2.5 transition-all hover:bg-card/60 hover:border-[var(--primary)]/30 hover:scale-[1.02] animate-in fade-in slide-in-from-start-4" style={{ animationDelay: `${idx * 100}ms`, animationFillMode: "both" }}>
              <span className="mt-0.5 shrink-0 rounded-md bg-muted/60 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground group-hover:text-[var(--primary)] group-hover:bg-[var(--primary)]/10 transition-colors">{lp.level}</span>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-foreground group-hover:text-[var(--primary)] transition-colors">{lp.label} </span>
                <span className="text-[10px] text-muted-foreground/50">{lp.xp}</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">{lp.perks}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-8">
        {[{ val: "10K+", label: "Custom ROMs" }, { val: "2K+", label: "Developers" }, { val: "500K+", label: "Downloads" }].map((s) => (
          <div key={s.label}>
            <p className="text-2xl font-black text-foreground">{s.val}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Step 1: Sign in / Sign up ─────────────────────────────────────
interface SignInStepProps {
  onGoogle: () => void;
  onGithub: () => void;
  onTwitter: () => void;
  onEmail: (e: string, p: string) => void;
  onSignUp: (e: string, p: string, name: string) => void;
  error: string | null;
  loading: boolean;
  activeProvider: string | null;
}

function SignInStep({ onGoogle, onGithub, onTwitter, onEmail, onSignUp, error, loading, activeProvider }: SignInStepProps) {
  const { t } = useTranslation();
  const [isSignUp, setIsSignUp] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleResetPassword = async () => {
    if (!email) {
      setFormError("Please enter your email address first");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success(t("login.resetEmailSent") || "Password reset email sent!");
      setFormError(null);
    } catch (e: any) {
      setFormError(e.message || "Failed to send reset email");
    }
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setFormError(null);
    if (isSignUp) {
      if (!email || !password || !displayName.trim()) {
        setFormError("Please fill in all fields");
        return;
      }
      if (password.length < 6) {
        setFormError("Password must be at least 6 characters");
        return;
      }
      onSignUp(email, password, displayName);
    } else {
      if (!email || !password) {
        setFormError("Please enter your email and password");
        return;
      }
      onEmail(email, password);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-400">
      <StepDots current={1} total={3} />
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-foreground mb-3">
          {isSignUp ? (
            <>Join <span style={{ color: "var(--primary)" }}>RomX</span></>
          ) : (
             <span dangerouslySetInnerHTML={{ __html: t("login.welcomeTitle").replace('RomX', '<span style="color: var(--primary)">RomX</span>') }} />
          )}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
          {isSignUp
            ? "Create your account and start sharing Custom ROMs, Kernels and more."
            : t("login.welcomeDesc")}
        </p>
      </div>

      {/* ── Sign In / Sign Up Toggle ────────────────────────────── */}
      <div className="mb-6 relative flex rounded-xl border border-border/60 bg-card/30 p-1">
        {/* Spring-animated pill that slides to active tab */}
        <motion.div
          aria-hidden
          className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-[var(--primary)] shadow-md"
          initial={false}
          animate={{ x: isSignUp ? "calc(100% + 4px)" : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
        <motion.button
          type="button"
          data-testid="signin-toggle"
          onClick={() => setIsSignUp(false)}
          whileTap={{ scale: 0.96 }}
          transition={BOUNCE}
          className={cn(
            "relative z-10 flex-1 rounded-lg py-2.5 text-sm font-bold transition-colors",
            !isSignUp ? "text-white" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Sign In
        </motion.button>
        <motion.button
          type="button"
          data-testid="signup-toggle"
          onClick={() => setIsSignUp(true)}
          whileTap={{ scale: 0.96 }}
          transition={BOUNCE}
          className={cn(
            "relative z-10 flex-1 rounded-lg py-2.5 text-sm font-bold transition-colors",
            isSignUp ? "text-white" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Sign Up
        </motion.button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {["Custom ROMs", "Kernels", "Recoveries", "Modules", "GSI"].map((t) => (
          <span key={t} className="rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">{t}</span>
        ))}
      </div>

      {(error || formError) && (
        <div role="alert" className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 animate-in zoom-in-95">
          <p className="text-sm font-semibold text-destructive">{isSignUp ? "Sign up failed" : t("login.signInError")}</p>
          <p className="mt-0.5 text-xs text-destructive/80">{formError || error}</p>
          {error?.includes("different provider") && (
            <p className="mt-2 text-xs text-amber-400">{t("login.tryDifferentProvider")}</p>
          )}
          {error?.includes("already in use") && (
            <p className="mt-2 text-xs text-amber-400">This email is already registered. Try signing in instead.</p>
          )}
        </div>
      )}

      {/* ── Email / Password Form ──────────────────────────────── */}
      <form onSubmit={handleSubmit} className="mb-4 flex flex-col gap-3">
        {isSignUp && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <input
              id="displayName"
              data-testid="display-name-input"
              aria-label="Display Name"
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              className="w-full rounded-xl border border-border/60 bg-card/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-[var(--primary)] focus:outline-none transition-colors"
            />
          </div>
        )}
        <input
          id="email"
          data-testid="email-input"
          aria-label="Email address"
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="w-full rounded-xl border border-border/60 bg-card/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-[var(--primary)] focus:outline-none transition-colors"
        />
        <input
          id="password"
          data-testid="password-input"
          aria-label="Password"
          type="password"
          placeholder={isSignUp ? "Password (min 6 characters)" : "Password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isSignUp ? "new-password" : "current-password"}
          className="w-full rounded-xl border border-border/60 bg-card/30 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-[var(--primary)] focus:outline-none transition-colors"
        />
        {isSignUp && password.length > 0 && password.length < 6 && (
          <p className="text-xs text-amber-400 -mt-1 ps-1">Password must be at least 6 characters</p>
        )}
        {!isSignUp && (
          <div className="flex justify-end -mt-1">
            <button type="button" onClick={handleResetPassword} className="text-xs text-muted-foreground hover:text-[var(--primary)] transition-colors pe-1">
              Forgot password?
            </button>
          </div>
        )}
        <motion.button
          type="submit"
          data-testid="submit-btn"
          disabled={loading}
          whileHover={loading ? undefined : { y: -1, scale: 1.01 }}
          whileTap={loading ? undefined : { scale: 0.98 }}
          transition={BOUNCE}
          className="group w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] py-3.5 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
        >
          {loading && activeProvider === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isSignUp ? t("login.createAccount") : t("login.signInCta")}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </motion.button>
      </form>

      {/* ── Divider ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 my-5">
        <div className="flex-1 h-px bg-border/60" />
        <span className="text-xs text-muted-foreground/50 font-medium">{t("login.orContinueWith")}</span>
        <div className="flex-1 h-px bg-border/60" />
      </div>

      {/* ── Primary: Google ─────────────────────────────────────── */}
      <div className="relative group/btn w-full">
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-[var(--primary)] via-[#3b82f6] to-[#8b5cf6] opacity-0 group-hover/btn:opacity-50 blur-md transition-opacity duration-700 animate-[pulse_4s_ease-in-out_infinite]" />
        <motion.button
          onClick={onGoogle}
          disabled={loading}
          whileHover={loading ? undefined : { y: -2, scale: 1.01 }}
          whileTap={loading ? undefined : { scale: 0.98 }}
          transition={BOUNCE}
          className="relative flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 px-6 py-4 text-sm font-black text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden shadow-xl"
          style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 90%, black), color-mix(in srgb, var(--primary) 70%, #3b82f6))", boxShadow: "inset 0 1px 1px rgba(255,255,255,0.2)" }}
        >
          <div className="absolute inset-0 w-1/2 -translate-x-[200%] skew-x-[-20deg] group-hover/btn:translate-x-[200%] transition-transform duration-1000 ease-in-out"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)" }} />
          <div className="flex items-center gap-3 relative z-10 transition-transform group-hover/btn:scale-105 duration-300">
            {loading && activeProvider === "google" ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              <div className="rounded-full bg-white/95 p-1 flex items-center justify-center">
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              </div>
            )}
            <span className="text-base tracking-wide">{loading && activeProvider === "google" ? t("login.signingIn") : t("login.signInGoogle")}</span>
          </div>
          <ArrowRight className="h-4 w-4 relative z-10 transition-transform group-hover/btn:translate-x-1.5 duration-300" />
        </motion.button>
      </div>

      {/* ── Secondary: GitHub + Twitter/X ───────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        {/* GitHub */}
        <motion.button
          onClick={onGithub}
          disabled={loading}
          whileHover={loading ? undefined : { y: -2, scale: 1.02 }}
          whileTap={loading ? undefined : { scale: 0.97 }}
          transition={BOUNCE}
          className="group/gh flex items-center justify-center gap-2.5 rounded-xl border border-border/60 bg-card/50 px-4 py-3.5 text-sm font-bold text-foreground transition-colors hover:bg-card hover:border-foreground/20 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
        >
          {loading && activeProvider === "github" ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <Github className="h-4.5 w-4.5 text-foreground group-hover/gh:scale-110 transition-transform" />
          )}
          <span>GitHub</span>
        </motion.button>

        {/* Twitter/X */}
        <motion.button
          onClick={onTwitter}
          disabled={loading}
          whileHover={loading ? undefined : { y: -2, scale: 1.02 }}
          whileTap={loading ? undefined : { scale: 0.97 }}
          transition={BOUNCE}
          className="group/tw flex items-center justify-center gap-2.5 rounded-xl border border-border/60 bg-card/50 px-4 py-3.5 text-sm font-bold text-foreground transition-colors hover:bg-card hover:border-foreground/20 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
        >
          {loading && activeProvider === "twitter" ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <svg className="h-4 w-4 text-foreground group-hover/tw:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          )}
          <span>X</span>
        </motion.button>
      </div>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        {t("login.termsAgree")}{" "}
        <a href="/rules" className="underline decoration-dotted hover:text-foreground transition-colors">{t("login.termsLink")}</a>
      </p>

      {/* ── Toggle link ─────────────────────────────────────────── */}
      <p className="mt-4 text-center text-sm text-muted-foreground">
        {isSignUp ? t("login.haveAccount") : t("login.noAccount")}{" "}
        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="font-bold transition-colors hover:text-foreground"
          style={{ color: "var(--primary)" }}
        >
          {isSignUp ? t("login.signInCta") : t("login.signUpCta")}
        </button>
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground/40">
        {[t("login.freeForever"), t("login.openCommunity")].map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 opacity-70" />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Step 2: Username ──────────────────────────────────────────────
function UsernameStep({ onDone, uid }: { onDone: () => void; uid: string }) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const latestUsername = useRef(username);

  const doCheck = useCallback(
    debounce(async (val: string) => {
      const err = validateUsername(val);
      if (err) { setError(err); setAvailable(null); setChecking(false); return; }
      setChecking(true);
      try {
        const res = await apiCheckUsername(val, uid);
        if (val !== latestUsername.current) return;
        setAvailable(res.available);
        setError(res.available ? null : t("login.usernameTaken"));
      } catch {
        if (val === latestUsername.current) setError("Could not verify, try again");
      } finally {
        if (val === latestUsername.current) setChecking(false);
      }
    }, 500),
    [uid]
  );

  useEffect(() => {
    latestUsername.current = username;
    setWarning(null); setIsBlocked(false); setAvailable(null); setChecking(false);
    if (!username) { setError(null); return; }
    const check = checkUsername(username);
    if (check.status === "blocked") { setError(check.message); setIsBlocked(true); return; }
    if (check.status === "warning") setWarning(check.message);
    const err = validateUsername(username);
    if (err) { setError(err); return; }
    setError(null); setChecking(true);
    doCheck(username);
  }, [username, doCheck]);

  const handleSave = async () => {
    if (!username || error || !available || isBlocked) return;
    setSaving(true);
    try { await apiUpdateProfile({ username }); onDone(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to save"); }
    finally { setSaving(false); }
  };

  const rules = [
    { label: t("username.rule1"), ok: username.length >= 5 && username.length <= 32 },
    { label: t("username.rule2"), ok: /^[a-zA-Z]/.test(username) },
    { label: t("username.rule3"), ok: /^[a-zA-Z0-9_]*$/.test(username) && username.length > 0 },
  ];
  const canSubmit = available && !error && !saving && !!username && !isBlocked;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-400">
      <StepDots current={2} total={3} />
      <div className="mb-8">
        <h2 className="text-2xl font-black tracking-tight text-foreground mb-2">{t("login.chooseUsername")}</h2>
        <p className="text-sm text-muted-foreground">{t("login.usernameDesc")}</p>
      </div>

      <div className="mb-4">
        <div className="relative">
          <div className="absolute start-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <AtSign className="h-4 w-4 text-muted-foreground" />
            <div className="w-px h-4 bg-border" />
          </div>
          <input
            id="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
            placeholder="your_username"
            maxLength={32}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && canSubmit && handleSave()}
            className="h-14 w-full rounded-2xl border bg-muted/40 ps-14 pe-12 text-base font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none transition-all"
            style={{
              borderColor: isBlocked ? "var(--destructive)" : error ? "rgba(239,68,68,0.5)" : available ? "rgba(16,185,129,0.5)" : "var(--border)",
            }}
          />
          <div className="absolute end-4 top-1/2 -translate-y-1/2">
            {checking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {!checking && isBlocked && <ShieldAlert className="h-4 w-4 text-destructive" />}
            {!checking && !isBlocked && available === true && <Check className="h-4 w-4 text-emerald-400" />}
            {!checking && !isBlocked && available === false && <X className="h-4 w-4 text-destructive" />}
          </div>
        </div>
        <div className="mt-2 min-h-[18px]">
          {error && <p className="text-xs text-destructive flex items-center gap-1"><X className="h-3 w-3 shrink-0" />{error}</p>}
          {!error && warning && <p className="text-xs text-amber-400 flex items-start gap-1"><AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />{warning}</p>}
          {!error && !warning && available && <p className="text-xs text-emerald-400 flex items-center gap-1"><Check className="h-3 w-3" />{t("login.usernameAvailable")}</p>}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-x-5 gap-y-2">
        {rules.map((r) => (
          <div key={r.label} className="flex items-center gap-1.5 text-xs">
            <div className={cn("h-1.5 w-1.5 rounded-full transition-colors", r.ok ? "bg-emerald-400" : "bg-muted-foreground/30")} />
            <span className={cn("transition-colors", r.ok ? "text-emerald-400" : "text-muted-foreground/50")}>{r.label}</span>
          </div>
        ))}
      </div>

      <button onClick={handleSave} disabled={!canSubmit}
        className="group flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
        style={{ backgroundColor: "var(--primary)" }}>
        <span>{t("login.saveUsernameBtn")}</span>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />}
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground/50">{t("login.canChangeLater")}</p>
    </div>
  );
}

// ── Step 3: Profile + Dynamic Links ──────────────────────────────
function ProfileStep({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [bio, setBio] = useState("");
  const [links, setLinks] = useState<SocialEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const SUGGESTIONS = [
    "Custom ROM developer & maintainer",
    "Kernel enthusiast & Android modder",
    "GSI developer & project contributor",
    "Recovery maintainer & tester",
    "Android dev passionate about FOSS",
  ];
  const [suggIdx, setSuggIdx] = useState(0);

  const handleSuggest = () => {
    const next = (suggIdx + 1) % SUGGESTIONS.length;
    setSuggIdx(next);
    setBio(SUGGESTIONS[next]);
  };

  const handleAddLink = (platformId: PlatformId) => {
    setLinks((prev) => [...prev, { platform: platformId, value: "" }]);
    setShowPicker(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, any> = { _isFirstProfile: true };
      if (bio.trim()) updates.bio = bio.trim();
      
      const profileLinks = [];
      const seen = new Set<string>();
      for (const entry of links) {
        if (!entry.value.trim() || seen.has(entry.platform)) continue;
        seen.add(entry.platform);
        let val = entry.value.trim().replace(/^@/, "");
        
        if (entry.platform === "github")   val = val.replace(/^https?:\/\/(www\.)?github\.com\//, "");
        else if (entry.platform === "telegram") val = val.replace(/^https?:\/\/(www\.)?t\.me\//, "");
        else if (entry.platform === "twitter")  val = val.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//, "");
        
        let url = val;
        if (entry.platform === "github" && !val.startsWith("http")) url = `https://github.com/${val}`;
        else if (entry.platform === "telegram" && !val.startsWith("http")) url = `https://t.me/${val}`;
        else if (entry.platform === "twitter" && !val.startsWith("http")) url = `https://x.com/${val}`;
        else if (entry.platform === "youtube" && !val.startsWith("http")) url = val.startsWith("@") ? `https://youtube.com/${val}` : `https://youtube.com/@${val}`;
        else if (!val.startsWith("http")) url = `https://${val}`;

        const plInfo = SOCIAL_PLATFORMS.find(p => p.id === entry.platform);

        profileLinks.push({
          id: Math.random().toString(36).slice(2, 11),
          platform: entry.platform,
          url: url,
          label: plInfo?.label || entry.platform,
          isChannel: false
        });
      }

      if (profileLinks.length > 0) {
        updates.profileLinks = profileLinks;
      }

      await apiUpdateProfile(updates);
      onDone();
    } catch (e: any) {
      toast.error(e.message || "Failed to save profile");
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-400">
      <StepDots current={3} total={3} />
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-tight text-foreground mb-2">{t("login.addLinks")}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("login.addLinksDesc")}
        </p>
      </div>

      {/* Bio */}
      <div className="mb-5">
        <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <FileText className="h-3 w-3" /> {t("login.personalBio")}
        </label>
        <div className="relative">
          <textarea value={bio} onChange={(e) => setBio(e.target.value)}
            placeholder={t("login.bioPlaceholder")}
            maxLength={160} rows={2}
            className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 pb-8 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-[var(--primary)] transition-colors resize-none" />
          <div className="absolute bottom-2.5 start-3 end-3 flex items-center justify-between">
            <button type="button" onClick={handleSuggest}
              className="flex items-center gap-1 rounded-md border border-border bg-card/80 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              <Sparkles className="h-2.5 w-2.5" /> {t("login.suggest")}
            </button>
            <span className="text-[10px] text-muted-foreground/40">{bio.length}/160</span>
          </div>
        </div>
      </div>

      {/* Dynamic links */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Link2 className="h-3 w-3" /> {t("login.socialLinks")}
          </label>
          {links.length > 0 && (
            <span className="text-[10px] text-muted-foreground/40">{links.length} {t("login.socialLinks")}</span>
          )}
        </div>

        {links.length > 0 && (
          <div className="space-y-2 mb-3">
            {links.map((entry, i) => {
              const pl = SOCIAL_PLATFORMS.find((p) => p.id === entry.platform)!;
              return (
                <div key={i} className="flex items-center gap-2 rounded-xl border border-border bg-card/50 px-3 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                    <pl.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {pl.prefix && <p className="text-[9px] text-muted-foreground/40 mb-0.5">{pl.prefix}</p>}
                    <input value={entry.value}
                      onChange={(e) => setLinks((prev) => prev.map((l, idx) => idx === i ? { ...l, value: e.target.value } : l))}
                      placeholder={pl.placeholder}
                      className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none" />
                  </div>
                  <button onClick={() => setLinks((prev) => prev.filter((_, idx) => idx !== i))}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {showPicker ? (
          <div className="rounded-xl border border-border bg-card/30 p-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground font-medium">{t("login.chooseNetwork")}</p>
              <button onClick={() => setShowPicker(false)} className="text-muted-foreground/40 hover:text-foreground transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {SOCIAL_PLATFORMS.map((pl) => (
                <button key={pl.id} onClick={() => handleAddLink(pl.id)}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card/50 p-3 hover:border-[var(--primary)] hover:bg-card transition-all group">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 group-hover:scale-110 transition-transform">
                    <pl.icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">{pl.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button onClick={() => setShowPicker(true)}
            className="flex items-center justify-center gap-2 w-full rounded-xl border border-dashed border-border py-3 text-xs text-muted-foreground hover:text-foreground hover:border-[var(--primary)] transition-all">
            <Plus className="h-3.5 w-3.5" /> {t("login.addLink")}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        <button onClick={handleSave} disabled={saving}
          className="group flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-60 shadow-lg"
          style={{ backgroundColor: "var(--primary)" }}>
          <span>{saving ? t("login.savingProfile") : t("login.completeSetup")}</span>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 group-hover:scale-110 transition-transform" />}
        </button>
        <button onClick={onDone} disabled={saving}
          className="w-full rounded-2xl border border-border py-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors">
          {t("login.skipForNow")}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function LoginPage() {
  const { user, userDoc, userDocLoading, isLoggedIn, loading, signInWithGoogle, signInWithGithub, signInWithTwitter, signInWithEmail, signUpWithEmail, error: authError, refreshUserDoc } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [signing, setSigning] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showProfileStep, setShowProfileStep] = useState(false);

  // If the auth provider surfaces an error (e.g. popup-blocked which we now
  // handle without throwing), release the signing spinner so buttons are
  // enabled again and the user can try another provider or retry after
  // allowing popups.
  useEffect(() => {
    if (authError && signing) {
      setSigning(false);
      setActiveProvider(null);
    }
  }, [authError, signing]);

  // Keep signing state active after auth resolves — spinner stays visible until
  // the redirect actually fires. We only reset on explicit error (handled in catch).
  // COOP/popup hang fallback: if Firebase Auth has the session but React state
  // hasn't updated yet, reload the page after a short delay.
  useEffect(() => {
    if (!signing) return;

    let timeoutId: NodeJS.Timeout;
    const interval = setInterval(() => {
      if (typeof window === "undefined") return;
      const current = auth.currentUser;

      // Firebase Auth completed in the background but popup state is stuck.
      if (current && !isLoggedIn) {
        debugLog.warn(
          "redirect",
          "Firebase has a user but React state is stuck — auto-reloading in 1.5s",
        );
        timeoutId = setTimeout(() => {
          debugLog.info("redirect", "Reloading now (COOP/popup fallback)");
          window.location.reload();
        }, 1500);
        clearInterval(interval);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [signing, isLoggedIn]);

  // ✅ Redirect after successful sign-in.
  // Uses a ref-like global flag scoped per URL to guard against double-firing
  // in React StrictMode, but always re-evaluates on state changes so a stuck
  // session eventually triggers navigation.
  useEffect(() => {
    if (loading || !isLoggedIn) return;

    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const from = params?.get("from") || "/";

    const navigate = (reason: string) => {
      const w = window as unknown as { __romxNavigatingTo?: string };
      if (w.__romxNavigatingTo === from) {
        debugLog.info("redirect", `Already navigating to ${from}, ignoring duplicate (${reason})`);
        return;
      }
      w.__romxNavigatingTo = from;
      debugLog.success("redirect", `Redirecting to ${from} — ${reason}`);
      // Small delay so the log entry is visible before the page unloads.
      setTimeout(() => {
        try {
          window.location.assign(from);
        } catch {
          router.replace(from);
        }
      }, 150);
    };

    // Username set → go home
    if (userDoc?.username && !showProfileStep) {
      navigate("userDoc has username");
      return;
    }

    // userDoc resolved but username missing → stay on page (step 2)
    if (userDoc && !userDoc.username) {
      debugLog.info("redirect", "Logged in but username missing — showing username step");
      return;
    }

    // Optional profile step is active — don't redirect
    if (showProfileStep) {
      debugLog.info("redirect", "Profile step active — waiting for user to finish");
      return;
    }

    // userDoc still loading → fast-path fallback after 2.5s
    if (userDocLoading) {
      debugLog.info("redirect", "userDoc still loading — will redirect in 2.5s if not resolved");
      const timer = setTimeout(() => {
        debugLog.warn("redirect", "Fast-path triggered: userDoc took too long");
        navigate("fast-path (userDoc timeout)");
      }, 2500);
      return () => clearTimeout(timer);
    }

    // userDoc finished loading but returned null → redirect anyway,
    // destination page will pick up Firebase session directly.
    if (!userDoc) {
      debugLog.warn("redirect", "userDoc is null but user is signed in — redirecting anyway");
      navigate("userDoc null fallback");
    }
  }, [loading, isLoggedIn, userDoc, userDocLoading, showProfileStep, router]);

  let currentStep: 1 | 2 | 3 = 1;
  if (isLoggedIn && userDoc && !userDoc.username) currentStep = 2;
  else if (isLoggedIn && userDoc?.username && showProfileStep) currentStep = 3;

  const handleSignIn = async (provider: "google" | "github" | "twitter" | "email", e?: string, p?: string) => {
    setSigning(true);
    setLocalError(null);
    setActiveProvider(provider);
    debugLog.info("ui", `Sign-in button clicked: ${provider}`);

    try {
      if (provider === "google") await signInWithGoogle();
      else if (provider === "github") await signInWithGithub();
      else if (provider === "twitter") await signInWithTwitter();
      else if (provider === "email" && e && p && signInWithEmail) await signInWithEmail(e, p);
    } catch (err) {
      const authErr = err as { code?: string; message?: string };
      if (authErr.code !== "auth/popup-closed-by-user") {
        debugLog.error("ui", "handleSignIn caught error", authErr.message);
        setLocalError(authErr.message || t("login.signInFailed"));
      }
      setSigning(false);
      setActiveProvider(null);
    }
  };

  const handleSignUp = async (email: string, password: string, displayName: string) => {
    setSigning(true);
    setLocalError(null);
    setActiveProvider("email");
    debugLog.info("ui", "Sign-up button clicked (email)");

    try {
      await signUpWithEmail(email, password, displayName);
    } catch (err) {
      const authErr = err as { code?: string; message?: string };
      debugLog.error("ui", "handleSignUp caught error", authErr.message);
      setLocalError(authErr.message || "Registration failed");
      setSigning(false);
      setActiveProvider(null);
    }
  };

  // If we redirected out to a provider (Google/GitHub/Twitter) as a popup
  // fallback, we land back on /login while Firebase parses the result. Show
  // a dedicated "Completing sign-in…" screen during that window so the user
  // doesn't briefly see the login form and think nothing happened.
  const pendingRedirectProvider = typeof window !== "undefined"
    ? sessionStorage.getItem("rx_pending_redirect")
    : null;

  // ✅ FIX: also show the full-page spinner while the userDoc is loading for a
  // signed-in user. Otherwise the username form flashes for returning users
  // before the redirect effect fires, making the page feel stuck.
  // ✅ FIX: show spinner while userDoc is loading OR when logged in but userDoc
  // failed (null) — prevents flashing the sign-in form while redirect fires.
  if (loading || pendingRedirectProvider || (isLoggedIn && userDocLoading) || (isLoggedIn && !userDocLoading && !userDoc && !showProfileStep)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border"
            style={{ backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)" }}>
            <Zap className="h-6 w-6" style={{ color: "var(--primary)" }} />
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {pendingRedirectProvider
              ? `Completing ${pendingRedirectProvider} sign-in…`
              : loading
                ? "Checking session…"
                : "Loading your profile…"}
          </p>
        </div>
        {/* Log panel stays visible even during spinner so the user can see
            exactly where the flow is stuck and reload if needed. */}
        <DebugLogPanel />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen bg-background overflow-hidden">
      <GridBackground />

      {/* Language selector — top right corner */}
      <div className="absolute top-4 end-4 z-20">
        <LanguageSelector compact />
      </div>

      <div className="relative z-10 flex w-full min-h-screen">
        {/* Left panel — desktop only */}
        <div className="hidden lg:block w-[440px] shrink-0 border-e border-border/40 bg-card/15 backdrop-blur-sm">
          <LeftPanel step={currentStep} />
        </div>

        {/* Right panel — form */}
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border"
              style={{ backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)" }}>
              <Zap className="h-4 w-4" style={{ color: "var(--primary)" }} />
            </div>
            <span className="text-lg font-black tracking-tight text-foreground">
              Rom<span style={{ color: "var(--primary)" }}>X</span>
            </span>
          </div>

          <div className="w-full max-w-md">
            {/* User card for steps 2 & 3 */}
            {isLoggedIn && user && currentStep > 1 && (
              <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border/60 bg-card/40 px-4 py-3 backdrop-blur-sm">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ""} className="h-9 w-9 rounded-full object-cover border border-border" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{user.displayName || "User"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30">
                  <Check className="h-3 w-3 text-emerald-400" />
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <SignInStep
                onGoogle={() => handleSignIn("google")}
                onGithub={() => handleSignIn("github")}
                onTwitter={() => handleSignIn("twitter")}
                onEmail={(e, p) => handleSignIn("email", e, p)}
                onSignUp={handleSignUp}
                error={localError || authError}
                loading={signing}
                activeProvider={activeProvider}
              />
            )}
            {currentStep === 2 && user && <UsernameStep onDone={async () => { setShowProfileStep(true); await refreshUserDoc(); }} uid={user.uid} />}
            {currentStep === 3 && <ProfileStep onDone={async () => { await refreshUserDoc(); router.replace("/"); }} />}
          </div>
        </div>
      </div>

      {/* Real-time debug log — shows exactly what happens during sign-in.
          Helpful when the redirect gets stuck so the user can see where
          the flow is blocked and reload from inside the panel. */}
      <DebugLogPanel />
    </div>
  );
}
