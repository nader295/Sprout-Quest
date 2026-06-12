"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSettings } from "@/lib/hooks/use-settings";
import { RX_THEMES, LEVEL_UNLOCKS, getLevel } from "@/lib/constants";
import type { AccentColor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { signOut, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { apiUpdateProfile, apiRequestPayout, apiGetMyPayouts } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { LanguageSelector } from "@/components/shared/language-selector";
import PageHero from "@/components/shared/page-hero";
import {
  Settings, Palette, Moon, Sun, Monitor, LogOut, User, Languages, Lock,
  Eye, EyeOff, Shield, UserX, Download, Users, Loader2, Check,
  AlertTriangle, Trash2, ChevronRight, ChevronDown, ChevronLeft, Zap, Bell,
  Key, RefreshCw, X, Sparkles, Globe2, MapPin, Tv, DollarSign,
  Wallet, Receipt, ArrowUpRight, Copy, CheckCircle2, History
} from "lucide-react";
import type { PaymentMethod, PayoutRequest, PayoutStatus } from "@/lib/types";
import { PAYOUT_CONFIG } from "@/lib/constants";
import { UploadKeysManager } from "@/components/upload/api-keys/upload-keys-manager";

// ── Animated Toggle ────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        "relative h-6 w-11 rounded-full border-2 transition-all duration-300 focus:outline-none",
        checked ? "border-[var(--primary)]" : "border-border"
      )}
      style={checked ? { backgroundColor: "var(--primary)", boxShadow: "0 0 6px rgba(29,155,240,0.22)" } : { backgroundColor: "var(--muted)" }}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-all duration-300",
          checked ? "start-[22px] scale-110" : "start-0.5 scale-100"
        )}
      />
    </button>
  );
}

// ── Section Card ───────────────────────────────────────────────
function SectionCard({ icon: Icon, title, iconColor, children, accent }: {
  icon: React.ElementType; title: string; iconColor?: string;
  children: React.ReactNode; accent?: string;
}) {
  return (
    <div className="relative rounded-3xl border border-border bg-card overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent || "rgba(29,155,240,0.2)"}, transparent)` }} />
      <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl shrink-0"
          style={{ backgroundColor: accent ? `${accent.replace("rgba(", "rgba(").replace(",0.", ",0.1)")}` : "var(--primary-dim)",
                   border: `1px solid ${accent || "var(--primary)"}` }}>
          <Icon className="h-4 w-4" style={{ color: iconColor || "var(--primary)", filter: `drop-shadow(0 0 3px ${accent || "rgba(29,155,240,0.28)"})` }} />
        </div>
        <h2 className="text-sm font-black text-foreground">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Developer Payout Panel (Primo v5) ─────────────────────────
function DevPayoutPanel({ userDoc }: { userDoc: import("@/lib/types").UserDoc | null }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<PayoutRequest[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(userDoc?.defaultPaymentMethod || "paypal");
  const [wallet, setWallet] = useState(userDoc?.defaultWalletAddress || "");
  const [amountStr, setAmountStr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const earned = userDoc?.adSupportEarnings || 0;
  const withdrawn = userDoc?.totalWithdrawn || 0;
  const pending = userDoc?.pendingWithdrawal || 0;
  const available = earned - withdrawn - pending;

  const flash = (text: string, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); };

  const load = useCallback(async () => {
    try {
      setHistory(await apiGetMyPayouts());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleWithdraw = async () => {
    const amt = parseFloat(amountStr);
    if (!amt || amt < PAYOUT_CONFIG.MIN_PAYOUT_USD) return flash(`أقل مبلغ للسحب هو $${PAYOUT_CONFIG.MIN_PAYOUT_USD}`, false);
    if (amt > available) return flash(t("settings.payout.insufficientBalance"), false);
    if (!wallet.trim()) return flash(t("settings.payout.enterWallet"), false);

    const regex = PAYOUT_CONFIG.WALLET_VALIDATORS[paymentMethod as keyof typeof PAYOUT_CONFIG.WALLET_VALIDATORS];
    if (regex) {
      if (!regex.test(wallet)) return flash(t("settings.payout.invalidWallet"), false);
    }

    setSubmitting(true);
    try {
      await apiRequestPayout({ amount: amt, paymentMethod, walletAddress: wallet });
      flash(t("settings.payout.success"));
      setAmountStr("");
      load();
    } catch (e: any) {
      flash(e.message || "حدث خطأ أثناء الطلب", false);
    } finally {
      setSubmitting(false);
    }
  };

  const statusColors: Record<string, string> = {
    pending: "text-amber-500 bg-amber-500/10",
    approved: "text-blue-500 bg-blue-500/10",
    processing: "text-purple-500 bg-purple-500/10",
    paid: "text-emerald-500 bg-emerald-500/10",
    failed: "text-red-500 bg-red-500/10",
    rejected: "text-red-500 bg-red-500/10",
    on_hold: "text-orange-500 bg-orange-500/10",
  };

  const statusArabic: Record<string, string> = {
    pending: t("settings.payout.status.pending") || "Pending",
    approved: t("settings.payout.status.approved") || "Approved",
    processing: t("settings.payout.status.processing") || "Processing",
    paid: t("settings.payout.status.paid") || "Paid",
    failed: t("settings.payout.status.failed") || "Failed",
    rejected: t("settings.payout.status.rejected") || "Rejected",
    on_hold: t("settings.payout.status.on_hold") || "On Hold",
  };

  return (
    <div className="mt-4 rounded-xl border border-amber-500/20 bg-card overflow-hidden">
      {/* Balances */}
      <div className="grid grid-cols-3 divide-x divide-x-reverse divide-border/50 border-b border-border/50 bg-black/10">
        <div className="p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">{t("settings.payout.availableBalance") || "Available Balance"}</p>
          <p className="text-xl font-black text-emerald-400">${available.toFixed(2)}</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">{t("settings.payout.pending") || "Pending"}</p>
          <p className="text-xl font-bold text-amber-500">${pending.toFixed(2)}</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">{t("settings.payout.totalWithdrawn") || "Total Withdrawn"}</p>
          <p className="text-xl font-bold text-foreground">${withdrawn.toFixed(2)}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Withdraw Form */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpRight className="h-4 w-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-foreground">{t("settings.payout.newRequest") || "New Payout Request"}</h4>
          </div>

          {msg && (
            <div className={cn("rounded-lg px-3 py-2 text-xs font-medium border", msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-500")}>
              {msg.text}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("settings.payout.paymentMethod") || "Payment Method"}</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs focus:outline-none focus:border-amber-500 transition-colors">
                {PAYOUT_CONFIG.PAYMENT_METHODS.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.label} {m.fee > 0 ? `(-$${m.fee} fee)` : "(No fee)"}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("settings.payout.amount") || "Amount"} (Min: ${PAYOUT_CONFIG.MIN_PAYOUT_USD})</label>
              <input type="number" step="0.01" max={available} value={amountStr} onChange={e => setAmountStr(e.target.value)} placeholder={`Max: $${available.toFixed(2)}`} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs focus:outline-none focus:border-amber-500 transition-colors" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("settings.payout.accountWallet") || "Account / Wallet"}</label>
            <input type="text" value={wallet} onChange={e => setWallet(e.target.value)} placeholder={t("settings.payout.accountWalletPlaceholder") || "Enter your account or wallet address carefully"} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs focus:outline-none focus:border-amber-500 focus:font-mono transition-colors" dir="ltr" />
          </div>

          <button onClick={handleWithdraw} disabled={submitting || available < PAYOUT_CONFIG.MIN_PAYOUT_USD} className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-black text-white hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-lg shadow-amber-500/20">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            {t("settings.payout.confirm") || "Confirm Payout"}
          </button>
        </div>

        {/* History Toggle */}
        <button onClick={() => setShowHistory(!showHistory)} className="flex w-full items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-muted/50 transition-colors">
          <span className="flex items-center gap-2"><History className="h-4 w-4" /> {t("settings.payout.history") || "Payout History"} ({history.length})</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", showHistory && "rotate-180")} />
        </button>

        {/* History List */}
        {showHistory && (
          <div className="space-y-2 max-h-[300px] overflow-y-auto pe-1">
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : history.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-4">{t("settings.payout.noHistory") || "No previous payouts"}</p>
            ) : history.map(p => (
              <div key={p.id} className="rounded-lg border border-border/50 bg-black/10 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-bold text-foreground">${p.amount.toFixed(2)}</span>
                  <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-bold border", statusColors[p.status] || "text-muted-foreground bg-muted border-border")}>
                    {statusArabic[p.status] || p.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{p.paymentMethod.replace("_", " ")}</span>
                  {p.createdAt && (
                    <span>
                      {new Date(
                        typeof p.createdAt === "string" || typeof p.createdAt === "number"
                          ? p.createdAt
                          : (p.createdAt as any).seconds
                          ? (p.createdAt as any).seconds * 1000
                          : Date.now()
                      ).toLocaleDateString("ar-EG")}
                    </span>
                  )}
                </div>
                {p.txHash && (
                  <div className="mt-2 text-[10px] font-mono text-emerald-400/80 bg-emerald-400/10 rounded px-2 py-1 truncate flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> TX: {p.txHash}
                  </div>
                )}
                {p.adminNote && (
                  <div className="mt-2 text-[10px] text-red-400/80 bg-red-400/10 rounded px-2 py-1">
                    {t("settings.payout.note") || "Note:"} {p.adminNote}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("tab") === "apiKeys") {
        setActiveTab("apiKeys");
      }
    }
  }, []);

  const { user, userDoc, isLoggedIn, isAdmin } = useAuth();
  const { accent, setAccent, mode, setMode, aurora, setAurora, bgStyle, setBgStyle } = useSettings();
  const isDark = mode !== "light";
  const isPublisher = (userDoc?.romsCount ?? 0) > 0 || (userDoc?.xp ?? 0) >= 150;

  // Community map settings
  const [country, setCountry] = useState(userDoc?.country ?? "");
  const [countryName, setCountryName] = useState(userDoc?.countryName ?? "");
  const [showOnMap, setShowOnMap] = useState(userDoc?.showOnMap ?? false);
  const [savingMap, setSavingMap] = useState(false);
  const [mapSaved, setMapSaved] = useState(false);

  // Monetization — Linkvertise
  const isVerifiedDev = userDoc?.role === "verifiedDev" || userDoc?.role === "admin" || userDoc?.role === "owner";
  const [linkvertiseGlobal, setLinkvertiseGlobal] = useState(userDoc?.linkvertiseGlobalEnabled ?? false);
  const [linkvertisePublisherId, setLinkvertisePublisherId] = useState(userDoc?.linkvertisePublisherId ?? "");
  const [savingAds, setSavingAds] = useState(false);
  const [adsSaved, setAdsSaved] = useState(false);

  const handleSaveMapSettings = async () => {
    setSavingMap(true);
    try {
      await apiUpdateProfile({ country, countryName, showOnMap });
      setMapSaved(true);
      setTimeout(() => setMapSaved(false), 2000);
    } catch { /* ignore */ } finally { setSavingMap(false); }
  };

  const handleSaveAdsSettings = async () => {
    setSavingAds(true);
    try {
      await apiUpdateProfile({
        linkvertiseGlobalEnabled: linkvertiseGlobal,
        linkvertisePublisherId: linkvertisePublisherId.trim(),
      });
      setAdsSaved(true);
      setTimeout(() => setAdsSaved(false), 2000);
    } catch { /* ignore */ } finally { setSavingAds(false); }
  };

  // Preview colors adapt to current mode
  const previewBase = isDark ? "linear-gradient(135deg, #020408 0%, #050912 60%, #030608 100%)" : "linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 60%, #f5f7ff 100%)";
  const router = useRouter();
  const { t } = useTranslation();

  // Privacy
  const [hideDownloads, setHideDownloads]   = useState(userDoc?.hideDownloads ?? false);
  const [hideFollowers, setHideFollowers]   = useState(userDoc?.hideFollowers ?? false);
  const [incognitoMode, setIncognitoMode]   = useState(userDoc?.incognitoMode ?? false);
  const [privateProfile, setPrivateProfile] = useState(userDoc?.privateProfile ?? false);
  const [savingPrivacy, setSavingPrivacy]   = useState(false);
  const [privacySaved, setPrivacySaved]     = useState(false);

  // Danger zone states
  const [showDanger, setShowDanger]               = useState(false);
  const [deleteStep, setDeleteStep]               = useState<0 | 1 | 2>(0);
  const [deletePassword, setDeletePassword]       = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading]         = useState(false);
  const [deleteError, setDeleteError]             = useState("");
  const [signOutConfirm, setSignOutConfirm]       = useState(false);

  const level = getLevel(userDoc?.xp || 0);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const handleSavePrivacy = async () => {
    if (!user?.uid) return;
    setSavingPrivacy(true);
    try {
      await apiUpdateProfile({ hideDownloads, hideFollowers, incognitoMode, privateProfile });
      setPrivacySaved(true);
      setTimeout(() => setPrivacySaved(false), 2000);
    } catch (e) {
      console.error("[settings] privacy save failed:", e);
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (deleteConfirmText !== "DELETE") {
      setDeleteError(t("settings.deleteConfirmWord"));
      return;
    }
    setDeleteLoading(true);
    setDeleteError("");
    try {
      // Re-authenticate if password provided
      if (deletePassword && user.email) {
        const cred = EmailAuthProvider.credential(user.email, deletePassword);
        await reauthenticateWithCredential(user, cred);
      }
      // Delete Firestore data first via API
      await apiUpdateProfile({ deleted: true, deletedAt: Date.now() });
      // Delete Firebase Auth user
      await deleteUser(user);
      router.push("/login");
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e?.code === "auth/requires-recent-login") {
        setDeleteError(t("settings.passwordRequired"));
        setDeleteStep(1);
      } else {
        setDeleteError(e?.message || t("settings.deleteFailed"));
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!isLoggedIn) return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-card">
        <Settings className="h-9 w-9 text-muted-foreground/40" />
      </div>
      <p className="text-base font-black text-foreground mb-2">{t("auth.signInPrompt")}</p>
      <Link href="/login"
        className="mt-3 inline-flex items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-black text-white transition-all hover:scale-105 active:scale-95"
        style={{ background: "linear-gradient(135deg, var(--primary), #3b82f6)", boxShadow: "0 8px 24px rgba(29,155,240,0.35)" }}>
        {t("auth.signIn")}
      </Link>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6 pb-24">

      {/* Holographic Header */}
      <PageHero
        icon={Settings}
        title={t("settings.title")}
        description={t("settings.subtitle")}
        compact
        className="mb-5"
      />

      {/* Tabs */}
      <div className="flex bg-muted/40 p-1.5 rounded-2xl mb-5 mx-1 border border-border/50">
        <button
          onClick={() => {
            setActiveTab("general");
            if (typeof window !== "undefined") {
               const url = new URL(window.location.href);
               url.searchParams.delete("tab");
               window.history.replaceState({}, "", url.toString());
            }
          }}
          className={cn(
            "flex-1 py-2.5 text-sm font-black rounded-xl transition-all",
            activeTab === "general"
              ? "bg-card shadow-sm text-foreground border border-border/50"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("settings.title") || "الإعدادات"}
        </button>
        <button
          onClick={() => {
            setActiveTab("apiKeys");
            if (typeof window !== "undefined") {
               const url = new URL(window.location.href);
               url.searchParams.set("tab", "apiKeys");
               window.history.replaceState({}, "", url.toString());
            }
          }}
          className={cn(
            "flex-1 py-2.5 flex items-center justify-center gap-2 text-sm font-black rounded-xl transition-all",
            activeTab === "apiKeys"
              ? "bg-card shadow-sm text-foreground border border-border/50"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Key className="h-4 w-4" />
          {t("settings.apiKeys.title") || "Manage API Keys"}
        </button>
      </div>

      {activeTab === "apiKeys" ? (
        <div className="flex flex-col gap-3">
          <SectionCard icon={Key} title={t("settings.apiKeys.title") || "Manage API Keys"} iconColor="var(--primary)" accent="rgba(29,155,240,0.3)">
            <UploadKeysManager />
          </SectionCard>
        </div>
      ) : (
        <div className="flex flex-col gap-3">

        {/* ── للجميع ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mt-2">
          <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
          <span className="text-[10px] font-black uppercase tracking-widest px-2"
            style={{ color: "rgba(255,255,255,0.25)" }}>{t("settings.forEveryone") || "FOR EVERYONE"}</span>
          <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>

        {/* ── Appearance ───────────────────────────────────────── */}
        <SectionCard icon={Moon} title={t("settings.appearance")}>
          <div className="flex items-center gap-2">
            {([
              { m: "dark"   as const, labelKey: "settings.dark",   icon: Moon },
              { m: "light"  as const, labelKey: "settings.light",  icon: Sun },
              { m: "system" as const, labelKey: "settings.system", icon: Monitor },
              { m: "amoled" as const, labelKey: "settings.amoled", icon: Zap, desc: "True Black" },
            ]).map((item) => (
              <button key={item.m} onClick={() => setMode(item.m)}
                className={cn(
                  "group relative flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl py-3 text-sm font-black transition-all hover:scale-[1.02] active:scale-[0.97]",
                  mode === item.m ? "text-white shadow-lg" : "border border-border text-muted-foreground hover:text-foreground"
                )}
                style={mode === item.m ? {
                  background: "linear-gradient(135deg, var(--primary), #3b82f6)",
                  boxShadow: "0 6px 20px rgba(29,155,240,0.35)"
                } : undefined}
              >
                <span className="absolute inset-0 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-500 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12" />
                <item.icon className={cn("h-4 w-4 transition-transform", item.m === "light" ? "group-hover:rotate-45" : item.m === "dark" ? "group-hover:rotate-[-15deg]" : "group-hover:scale-110")} />
                {t(item.labelKey) || (item.m === "system" ? "Auto" : item.m)}
              </button>
            ))}
          </div>
        </SectionCard>

        {/* ── Accent Color ──────────────────────────────────────── */}
        <SectionCard icon={Palette} title={t("settings.accentColor")}>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(RX_THEMES) as [AccentColor, typeof RX_THEMES[AccentColor]][]).map(([key, theme]) => (
              <button key={key} onClick={() => setAccent(key)}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-sm font-bold transition-all hover:scale-105 active:scale-90",
                  accent === key ? "border-2 text-foreground shadow-md" : "border-border text-muted-foreground hover:text-foreground"
                )}
                style={accent === key ? { borderColor: theme.hex, backgroundColor: `${theme.hex}15`, boxShadow: `0 4px 16px ${theme.hex}30` } : undefined}
              >
                <span
                  className={cn("h-4 w-4 rounded-full ring-1 ring-border/50 transition-transform", accent === key ? "scale-125" : "group-hover:scale-110")}
                  style={{ backgroundColor: theme.hex, ...(accent === key ? { boxShadow: `0 0 10px ${theme.hex}80` } : {}) }}
                />
                {theme.name}
                {accent === key && <Check className="h-3.5 w-3.5 ms-auto" style={{ color: theme.hex }} />}
              </button>
            ))}
          </div>
        </SectionCard>

        {/* ── Language ─────────────────────────────────────────── */}
        <SectionCard icon={Languages} title={t("settings.language")}>
          <LanguageSelector inline />
        </SectionCard>

        {/* ── Background Style ──────────────────────────────────── */}
        <div className="relative rounded-3xl border border-border bg-card overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.4), rgba(29,155,240,0.3), transparent)" }} />

          <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl shrink-0"
              style={{ backgroundColor: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.4)" }}>
              <Sparkles className="h-4 w-4" style={{ color: "#a78bfa", filter: "drop-shadow(0 0 4px rgba(139,92,246,0.32))" }} />
            </div>
            <div>
              <p className="text-sm font-black text-foreground leading-tight">{t("settings.bgTitle")}</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">{t("settings.bgSubtitle")}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4">
              {([
                {
                  id: "plain", labelKey: "settings.plain", subKey: "settings.plainSub", emoji: "🌑",
                  preview: "linear-gradient(135deg, #020408 0%, #050912 60%, #030608 100%)",
                  badge: null,
                },
                {
                  id: "aurora", labelKey: "settings.aurora", subKey: "settings.auroraSub", emoji: "🌌",
                  preview: null,
                  badge: "✨",
                },
                {
                  id: "stars", labelKey: "settings.stars", subKey: "settings.starsSub", emoji: "��",
                  preview: "radial-gradient(ellipse at 30% 30%, rgba(99,102,241,0.35) 0%, transparent 60%), linear-gradient(135deg,#01020a,#040614)",
                  badge: "🌠",
                },
                {
                  id: "evox", labelKey: "settings.evox", subKey: "settings.evoxSub", emoji: "⚡",
                  preview: null,
                  badge: "🔥",
                },
              ] as const).map((opt) => {
              const active = bgStyle === opt.id;
              return (
                <button key={opt.id} onClick={() => setBgStyle(opt.id as import("@/lib/hooks/use-settings").BgStyle)}
                  className="relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
                  style={{
                    border: active ? "2px solid var(--primary)" : "1px solid rgb(var(--border))",
                    boxShadow: active ? "0 0 20px var(--primary-glow), inset 0 0 12px rgba(255,255,255,0.03)" : "none",
                  }}>

                  {/* Preview thumbnail */}
                  <div className="relative h-24 overflow-hidden">
                    {/* Plain */}
                    {opt.id === "plain" && (
                      <div className="absolute inset-0" style={{ background: previewBase }} />
                    )}
                    {/* Aurora */}
                    {opt.id === "aurora" && (
                      <div className="absolute inset-0" style={{ background: isDark ? "linear-gradient(135deg,#01020c,#020410)" : "linear-gradient(135deg,#f0f7ff,#f5f0ff)" }}>
                        <div className="absolute inset-x-0 top-0 h-12 rounded-full" style={{ background:`linear-gradient(90deg, rgba(29,155,240,${isDark?0.45:0.25}) 0%, rgba(139,92,246,${isDark?0.35:0.18}) 40%, rgba(236,72,153,${isDark?0.28:0.14}) 70%, rgba(20,184,166,${isDark?0.22:0.10}) 100%)`, filter:"blur(12px)", transform:"translateY(-30%)" }} />
                        <div className="absolute inset-x-0 top-4 h-8 rounded-full" style={{ background:`linear-gradient(90deg, rgba(20,184,166,${isDark?0.30:0.15}) 0%, rgba(29,155,240,${isDark?0.25:0.12}) 50%, rgba(245,158,11,${isDark?0.18:0.08}) 100%)`, filter:"blur(10px)" }} />
                        <div className="absolute inset-x-0 top-8 h-7 rounded-full" style={{ background:`linear-gradient(90deg, rgba(139,92,246,${isDark?0.20:0.10}) 0%, rgba(236,72,153,${isDark?0.22:0.10}) 60%, rgba(29,155,240,${isDark?0.15:0.07}) 100%)`, filter:"blur(9px)" }} />
                      </div>
                    )}
                    {/* Stars */}
                    {opt.id === "stars" && (
                      <div className="absolute inset-0" style={{ background: isDark ? "radial-gradient(ellipse at 20% 30%, rgba(99,102,241,0.30) 0%,transparent 55%), radial-gradient(ellipse at 75% 20%, rgba(139,92,246,0.22) 0%,transparent 50%), linear-gradient(135deg,#01020a,#030510)" : "radial-gradient(ellipse at 20% 30%, rgba(99,102,241,0.12) 0%,transparent 55%), linear-gradient(135deg,#eef2ff,#f5f3ff)" }}>
                        {[...Array(isDark?30:14)].map((_,i) => (
                          <div key={i} className="absolute rounded-full"
                            style={{
                              width: `${Math.random()*2.2+0.4}px`, height: `${Math.random()*2.2+0.4}px`,
                              left:`${Math.random()*100}%`, top:`${Math.random()*100}%`,
                              backgroundColor: isDark ? ["#fff","#a5f3fc","#c4b5fd","#fde68a"][i%4] : "rgba(99,102,241,0.5)",
                              opacity: Math.random()*0.7+0.25,
                              boxShadow: isDark ? `0 0 3px currentColor` : "none",
                              animation:`star-twinkle ${2+Math.random()*3}s ease-in-out infinite ${Math.random()*3}s`,
                            }} />
                        ))}
                      </div>
                    )}
                    {/* Evo X */}
                    {opt.id === "evox" && (
                      <div className="absolute inset-0" style={{ background: isDark ? "linear-gradient(135deg,#03010e,#060115)" : "linear-gradient(135deg,#fff5f5,#f5f0ff)" }}>
                        <div className="absolute top-1 right-2 w-20 h-16 rounded-full" style={{ background:`radial-gradient(circle,rgba(220,38,38,${isDark?0.55:0.28}) 0%,transparent 65%)`, filter:"blur(10px)" }} />
                        <div className="absolute top-3 left-1 w-18 h-14 rounded-full" style={{ background:`radial-gradient(circle,rgba(29,78,216,${isDark?0.50:0.24}) 0%,transparent 65%)`, filter:"blur(10px)" }} />
                        <div className="absolute bottom-1 left-1/2 w-14 h-12 rounded-full" style={{ background:`radial-gradient(circle,rgba(139,92,246,${isDark?0.38:0.18}) 0%,transparent 65%)`, filter:"blur(9px)" }} />
                        <div className="absolute bottom-3 left-1/4 w-12 h-10 rounded-full" style={{ background:`radial-gradient(circle,rgba(236,72,153,${isDark?0.30:0.14}) 0%,transparent 65%)`, filter:"blur(8px)" }} />
                      </div>
                    )}

                    {/* Active checkmark */}
                    {active && (
                      <div className="absolute top-2 end-2 flex h-5 w-5 items-center justify-center rounded-full"
                        style={{ background:"var(--primary)", boxShadow:"0 0 10px var(--primary-glow)" }}>
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}

                    {/* Badge */}
                    {opt.badge && (
                      <div className="absolute top-2 start-2 text-sm leading-none">{opt.badge}</div>
                    )}
                  </div>

                  {/* Label */}
                  <div className="px-3 py-2.5 text-start"
                    style={{ background: active ? "rgba(var(--primary-rgb,29,155,240),0.06)" : "rgb(var(--card))" }}>
                    <p className="text-xs font-black text-foreground leading-none">{t(opt.labelKey)}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5 leading-none">{t(opt.subKey)}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Warning for animated styles */}
          {bgStyle !== "plain" && (
            <div className="mx-4 mb-4 rounded-2xl px-3 py-2 flex items-center gap-2"
              style={{ background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.16)" }}>
              <Zap className="h-3 w-3 text-amber-400/70 shrink-0" />
              <p className="text-[10px] text-amber-400/60 font-medium leading-tight">
                {t("settings.bgWarning")}
              </p>
            </div>
          )}
        </div>

        {/* ── للناشر/المطور فقط ───────────────────────────────── */}
        {isPublisher && (
        <div className="flex items-center gap-2 mt-2">
          <div className="h-px flex-1" style={{ background: "rgba(29,155,240,0.15)" }} />
          <span className="text-[10px] font-black uppercase tracking-widest px-2"
            style={{ color: "rgba(29,155,240,0.6)" }}>⚡ {t("settings.forPublishers") || "FOR PUBLISHERS"}</span>
          <div className="h-px flex-1" style={{ background: "rgba(29,155,240,0.15)" }} />
        </div>
        )}

        {/* ── Privacy ──────────────────────────────────────────── */}
        <SectionCard icon={Shield} title={t("privacy.title")}>
          <div className="flex flex-col gap-4">
            {[
              ...(isPublisher ? [{ icon: Download, key: "hideDownloads" as const, labelKey: "privacy.hideDownloads", descKey: undefined as undefined, value: hideDownloads, set: setHideDownloads }] : []),
              { icon: Users,    key: "hideFollowers" as const,  labelKey: "privacy.hideFollowers",    descKey: undefined,                  value: hideFollowers,  set: setHideFollowers },
              { icon: EyeOff,   key: "privateProfile" as const, labelKey: "privacy.privateProfile",   descKey: "privacy.privateProfileDesc", value: privateProfile, set: setPrivateProfile },
              ...((userDoc?.role === "admin" || userDoc?.role === "owner") ? [
                { icon: UserX, key: "incognitoMode" as const, labelKey: "privacy.incognito", descKey: "privacy.incognitoDesc", value: incognitoMode, set: setIncognitoMode },
              ] : []),
            ].map((item, i, arr) => (
              <div key={item.key}>
                <div className="flex items-center justify-between gap-4 cursor-pointer" onClick={() => item.set(!item.value)}>
                  <div className="flex items-start gap-3">
                    <item.icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-foreground">{t(item.labelKey)}</p>
                      {item.descKey && <p className="text-xs text-muted-foreground mt-0.5">{t(item.descKey)}</p>}
                    </div>
                  </div>
                  <Toggle checked={item.value} onChange={() => item.set(!item.value)} />
                </div>
                {i < arr.length - 1 && <div className="mt-4 h-px bg-border/50" />}
              </div>
            ))}

            <button
              onClick={handleSavePrivacy}
              disabled={savingPrivacy}
              className="group relative mt-1 flex items-center justify-center gap-2 overflow-hidden rounded-2xl py-3 text-sm font-black text-white transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, var(--primary), #3b82f6)", boxShadow: "0 6px 20px rgba(29,155,240,0.35)" }}
            >
              <span className="absolute inset-0 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-500 bg-gradient-to-r from-transparent via-white/15 to-transparent skew-x-12" />
              {savingPrivacy
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : privacySaved
                  ? <Check className="h-4 w-4" style={{ filter: "drop-shadow(0 0 3px rgba(255,255,255,0.4))" }} />
                  : null
              }
              {privacySaved ? t("common.done") : t("common.save")}
            </button>
          </div>
        </SectionCard>

        {/* ── Monetization — Linkvertise ─────────────────────────────── */}
        {true && (
          <SectionCard icon={DollarSign} title={t("settings.linkvertise.title") || "💰 Monetize with Linkvertise"} iconColor="#3b82f6" accent="rgba(59,130,246,0.3)">
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground/60">
                {t("settings.linkvertise.desc") || "Enable Linkvertise to monetize download links. Users see an ad badge before downloading. 90% of earnings go to you — 10% to the platform."}
              </p>

              {/* Global toggle */}
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setLinkvertiseGlobal(p => !p)}>
                <div className="flex items-center gap-2.5">
                  <Zap className="h-4 w-4 text-blue-400 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-foreground">{t("settings.linkvertise.enableAll") || "Enable on all my posts"}</p>
                    <p className="text-xs text-muted-foreground/60">{t("settings.linkvertise.enableAllDesc") || "Automatically apply Linkvertise to every download link you post"}</p>
                  </div>
                </div>
                <Toggle checked={linkvertiseGlobal} onChange={() => setLinkvertiseGlobal(p => !p)} />
              </div>

              {/* Publisher ID input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Key className="h-3 w-3" /> {t("settings.linkvertise.publisherId") || "Linkvertise Publisher ID"}
                </label>
                <input
                  value={linkvertisePublisherId}
                  onChange={e => setLinkvertisePublisherId(e.target.value)}
                  placeholder="Example: 4988176"
                  className="w-full rounded-xl border border-border bg-muted/20 px-3 py-2.5 text-sm font-mono focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
                <p className="text-[10px] text-muted-foreground/50">
                  {t("settings.linkvertise.findItIn") || "Find it in"} <a href="https://linkvertise.com/publisher/profile" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">{t("settings.linkvertise.dashboard") || "Linkvertise Dashboard → Profile"}</a>
                </p>
              </div>

              {/* Info box */}
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 px-3 py-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <p className="text-[11px] font-bold text-blue-300">{t("settings.linkvertise.howItWorks") || "How does it work?"}</p>
                </div>
                <ul className="space-y-1 pr-1">
                  {[
                    t("settings.linkvertise.step1") || "Every download link is displayed with an «Ad» badge",
                    t("settings.linkvertise.step2") || "Users see a confirmation modal before redirect",
                    t("settings.linkvertise.step3") || "Control ad settings per post individually",
                    t("settings.linkvertise.step4") || "Earnings appear directly in your Linkvertise dashboard",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                      <span className="text-blue-400 font-bold shrink-0">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/earnings" className="mt-1 inline-flex items-center gap-1 text-[10px] text-blue-400 underline">
                  <ArrowUpRight className="h-3 w-3" /> {t("settings.linkvertise.viewEarnings") || "View your earnings"}
                </Link>
              </div>

              <button
                onClick={handleSaveAdsSettings}
                disabled={savingAds}
                className="group relative w-full flex items-center justify-center gap-2 overflow-hidden rounded-2xl py-3 text-sm font-black text-white transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", boxShadow: "0 6px 20px rgba(59,130,246,0.3)" }}>
                {savingAds ? <Loader2 className="h-4 w-4 animate-spin" /> : adsSaved ? <Check className="h-4 w-4" /> : <DollarSign className="h-4 w-4" />}
                {adsSaved ? (t("common.saved") || "Saved!") : (t("settings.linkvertise.saveBtn") || "Save Linkvertise Settings")}
              </button>

              {/* Developer Payout Panel Component */}
              <DevPayoutPanel userDoc={userDoc} />
            </div>
          </SectionCard>
        )}

        {/* ── المجتمع ──────────────────────────────────────────────── */}
        <SectionCard icon={Globe2} title={t("settings.map.title") || "Community Map"} iconColor="#1d9bf0">
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground/60">{t("settings.map.desc") || "Show up on the global RomX community map"}</p>

            {/* Country selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{t("settings.map.country") || "Your Country"}</label>
              <select
                value={country}
                onChange={e => {
                  const opt = e.target.options[e.target.selectedIndex];
                  setCountry(e.target.value);
                  setCountryName(opt.text);
                }}
                className="w-full rounded-2xl border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-[var(--primary)] transition-colors appearance-none cursor-pointer">
                <option value="">{t("settings.map.selectCountry") || "Select country..."}</option>
                {[
                  ["EG","مصر"],["SA","السعودية"],["AE","الإمارات"],["IQ","العراق"],["MA","المغرب"],
                  ["DZ","الجزائر"],["TN","تونس"],["LB","لبنان"],["JO","الأردن"],["SY","سوريا"],
                  ["LY","ليبيا"],["SD","السودان"],["YE","اليمن"],["KW","الكويت"],["QA","قطر"],
                  ["BH","البحرين"],["OM","عُمان"],["PS","فلسطين"],
                  ["US","United States"],["GB","United Kingdom"],["DE","Germany"],["FR","France"],
                  ["IN","India"],["ID","Indonesia"],["PK","Pakistan"],["TR","Turkey"],["RU","Russia"],
                  ["BR","Brazil"],["NG","Nigeria"],["PH","Philippines"],["VN","Vietnam"],
                  ["MY","Malaysia"],["TH","Thailand"],["KR","South Korea"],["JP","Japan"],
                  ["IT","Italy"],["ES","Spain"],["NL","Netherlands"],["SE","Sweden"],
                  ["PL","Poland"],["UA","Ukraine"],["CA","Canada"],["AU","Australia"],
                  ["MX","Mexico"],["AR","Argentina"],["ZA","South Africa"],["SG","Singapore"],
                ].map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>

            {/* Show on map toggle */}
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowOnMap(p => !p)}>
              <div className="flex items-center gap-2.5">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-bold text-foreground">{t("settings.map.showOnMap") || "Show on Map"}</p>
                  <p className="text-xs text-muted-foreground/60">{t("settings.map.showOnMapDesc") || "Allow community members to see your country"}</p>
                </div>
              </div>
              <Toggle checked={showOnMap} onChange={() => setShowOnMap(p => !p)} />
            </div>

            <button
              onClick={handleSaveMapSettings}
              disabled={savingMap || !country}
              className="group relative w-full flex items-center justify-center gap-2 overflow-hidden rounded-2xl py-3 text-sm font-black text-white transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #1d9bf0, #6366f1)", boxShadow: "0 6px 20px rgba(29,155,240,0.25)" }}>
              {savingMap ? <Loader2 className="h-4 w-4 animate-spin" /> : mapSaved ? <Check className="h-4 w-4" /> : <Globe2 className="h-4 w-4" />}
              {mapSaved ? (t("common.saved") || "Saved!") : (t("common.save") || "Save")}
            </button>
          </div>
        </SectionCard>

        {/* ── للجميع (حساب وأمان) ─────────────────────────────── */}
        <div className="flex items-center gap-2 mt-2">
          <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
          <span className="text-[10px] font-black uppercase tracking-widest px-2"
            style={{ color: "rgba(255,255,255,0.25)" }}>{t("settings.accountSecurity") || "ACCOUNT & SECURITY"}</span>
          <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>

        {/* ── Account Info ─────────────────────────────────────── */}
        <SectionCard icon={User} title={t("settings.account")}>
          <div className="flex flex-col gap-2">
            <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  <span className="text-xs text-muted-foreground">{t("profile.email")}</span>
                </div>
                <span className="text-xs font-bold text-foreground font-mono truncate ms-auto">{user?.email}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />
                  <span className="text-xs text-muted-foreground">{t("profile.karma")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-foreground">{userDoc?.xp || 0} XP</span>
                  <span className="rounded-xl px-2 py-0.5 text-[10px] font-black" style={{ color: "var(--primary)", backgroundColor: "var(--primary-dim)" }}>
                    {level.label}
                  </span>
                </div>
              </div>
              {/* Channel unlock progress */}
              {(userDoc?.xp || 0) < 150 && (
                <div className="mt-2.5 pt-2.5 border-t border-border/50">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      {t("settings.channelUnlockHint")}
                    </span>
                    <span className="text-[10px] font-bold" style={{ color: "var(--primary)" }}>
                      {userDoc?.xp || 0} / 150 XP
                    </span>
                  </div>
                  <div className="relative h-1.5 w-full rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, ((userDoc?.xp || 0) / 150) * 100)}%`,
                        background: "linear-gradient(90deg, var(--primary), #38bdf8)",
                      }} />
                  </div>
                  <p className="text-[9px] text-muted-foreground/50 mt-1">
                    {t("settings.xpToChannel", { n: Math.max(0, 150 - (userDoc?.xp || 0)) })}
                  </p>
                </div>
              )}
              {(userDoc?.xp || 0) >= 150 && (
                <p className="mt-2 text-[10px] text-emerald-400 flex items-center gap-1">
                  {t("settings.channelUnlocked")}
                </p>
              )}
            </div>
            <Link href={`/u/${user?.uid}`}
              className="group flex items-center gap-3 rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm font-bold text-muted-foreground hover:text-foreground hover:border-[var(--primary)]/30 hover:bg-muted transition-all hover:scale-[1.01] active:scale-[0.99]">
              <User className="h-4 w-4 transition-transform group-hover:scale-110" />
              {t("profile.editProfile")}
              <ChevronRight className="h-4 w-4 ms-auto transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </SectionCard>

        {/* ── Sign Out ─────────────────────────────────────────── */}
        {!signOutConfirm ? (
          <button onClick={() => setSignOutConfirm(true)}
            className="group flex items-center justify-center gap-2.5 rounded-3xl border border-border py-3.5 text-sm font-black text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5 transition-all hover:scale-[1.01] active:scale-[0.99]">
            <LogOut className="h-4 w-4 transition-transform group-hover:translate-x-[-2px]" />
            {t("auth.signOut")}
          </button>
        ) : (
          <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm font-bold text-destructive flex-1">{t("settings.confirmSignOut")}</p>
            <button onClick={() => setSignOutConfirm(false)}
              className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:scale-105 active:scale-90 transition-all">
              {t("common.cancel")}
            </button>
            <button onClick={handleSignOut}
              className="rounded-xl px-3 py-1.5 text-xs font-black text-white hover:scale-105 active:scale-90 transition-all"
              style={{ backgroundColor: "var(--destructive)" }}>{t("settings.signOutBtn")}
            </button>
          </div>
        )}

        {/* ── Danger Zone ──────────────────────────────────────── */}
        <div className="rounded-3xl border-2 border-destructive/30 overflow-hidden">
          {/* Header — toggle */}
          <button
            onClick={() => setShowDanger((p) => !p)}
            className="w-full flex items-center gap-3 px-4 py-3.5 bg-destructive/8 hover:bg-destructive/12 transition-colors"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-destructive/15 border border-destructive/30 shrink-0">
              <AlertTriangle className="h-4 w-4 text-destructive" style={{ filter: "drop-shadow(0 0 4px rgba(239,68,68,0.3))" }} />
            </div>
            <div className="text-start flex-1">
              <p className="text-sm font-black text-destructive">Danger Zone</p>
              <p className="text-[10px] text-destructive/60">{t("settings.irreversibleOps")}</p>
            </div>
            <ChevronDown className={cn("h-4 w-4 text-destructive/60 transition-transform duration-300", showDanger ? "rotate-180" : "")} />
          </button>

          {showDanger && (
            <div className="p-4 space-y-4 border-t border-destructive/20 bg-destructive/3">

              {/* Delete account flow */}
              <div className="rounded-2xl border border-destructive/20 bg-card overflow-hidden">
                <div className="flex items-start gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/20 shrink-0 mt-0.5">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-foreground">{t("settings.deleteAccount")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {t("settings.deleteDesc")} <span className="text-destructive font-bold">{t("settings.irreversible")}</span>.
                    </p>
                    {userDoc?.romsCount && userDoc.romsCount > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5">
                        <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                        <p className="text-[10px] text-amber-400">{t("settings.hasRoms", { n: userDoc.romsCount })}</p>
                      </div>
                    )}
                  </div>
                </div>

                {deleteStep === 0 && (
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => setDeleteStep(1)}
                      className="group flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/8 py-2.5 text-sm font-black text-destructive hover:bg-destructive/15 hover:scale-[1.01] active:scale-[0.99] transition-all"
                    >
                      <Trash2 className="h-4 w-4 transition-transform group-hover:scale-110" />
                      {t("settings.wantDeleteBtn")}
                    </button>
                  </div>
                )}

                {deleteStep === 1 && (
                  <div className="px-4 pb-4 space-y-3 border-t border-destructive/10 pt-3">
                    <p className="text-xs text-muted-foreground">
                      {t("settings.typeDelete")} <span className="font-black text-destructive font-mono">DELETE</span>:
                    </p>
                    <input
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder={t("settings.deletePlaceholder")}
                      className={cn(
                        "h-10 w-full rounded-xl border bg-muted/30 px-3 text-sm font-mono text-foreground focus:outline-none transition-all",
                        deleteConfirmText === "DELETE" ? "border-destructive focus:border-destructive" : "border-border focus:border-destructive/50"
                      )}
                    />
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder={t("settings.passwordPlaceholder")}
                      className="h-10 w-full rounded-xl border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:border-destructive/50 transition-all"
                    />
                    {deleteError && (
                      <p className="text-xs text-destructive font-bold">{deleteError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setDeleteStep(0); setDeleteConfirmText(""); setDeletePassword(""); setDeleteError(""); }}
                        className="flex-1 rounded-2xl border border-border py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-all hover:scale-[1.01] active:scale-[0.99]"
                      >{t("common.cancel")}
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleteLoading || deleteConfirmText !== "DELETE"}
                        className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-black text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
                        style={{ backgroundColor: "var(--destructive)", boxShadow: deleteConfirmText === "DELETE" ? "0 4px 14px rgba(239,68,68,0.22)" : "none" }}
                      >
                        {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        {t("settings.confirmDeletion") || "Confirm Deletion"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Warning note */}
              <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-3">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-400/80 leading-relaxed">
                  {t("settings.deactivateHint")}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ⑩ Bug Report + Feedback */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <span className="text-base">🐛</span> {t("settings.support")}
          </h2>
        </div>
        <div className="p-4 space-y-3">
          {/* Report Bug */}
          <a href="/feedback"
            className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3.5 transition-all hover:bg-muted/30 hover:scale-[1.01] active:scale-[0.99]">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl shrink-0"
              style={{ background: "rgba(251,113,133,0.1)", border: "1px solid rgba(251,113,133,0.2)" }}>
              <span className="text-lg">🐛</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-black text-foreground">{t("settings.feedback.title") || "Bug Reports & Feedback"}</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">{t("settings.feedback.desc") || "Report a problem or suggest an improvement"}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
          </a>
          {/* Rules */}
          <a href="/rules" className="flex items-center justify-between rounded-xl border border-border p-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10">
                <span className="text-sm">📋</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">{t("settings.rulesLink")}</p>
                <p className="text-[10px] text-muted-foreground">{t("settings.rulesLinkDesc")}</p>
              </div>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </a>
        </div>
      </div>

    </div>
  );
}

// ─── Bug Report Component ────────────────────────────────────────────
