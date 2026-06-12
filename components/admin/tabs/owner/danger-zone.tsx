"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase/client";
import { apiAdminAdjustXP, apiAdminBroadcast, apiAdminWipeResolvedReports } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Download,
  ExternalLink,
  Globe,
  Loader2,
  Radio,
  RefreshCw,
  Send,
  Trash2,
  Zap,
} from "lucide-react";

export function DangerZone() {
  const [exportLoading, setExportLoading] = useState(false);
  const [wipeLoading, setWipeLoading] = useState(false);
  const [resetTourLoading, setResetTourLoading] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcast, setBroadcast] = useState({ title: "", message: "", link: "" });
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [xpTool, setXpToolOpen] = useState(false);
  const [xpUid, setXpUid] = useState("");
  const [xpAmt, setXpAmt] = useState("");
  const [xpNote, setXpNote] = useState("");
  const [xpLoading, setXpLoading] = useState(false);
  const [xpDone, setXpDone] = useState(false);
  const [resetAllXPLoading, setResetAllXPLoading] = useState(false);
  const [clearCountryLoading, setClearCountryLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  const flash = (text: string, type: "ok" | "err" = "ok") => { setActionMsg({ text, type }); setTimeout(() => setActionMsg(null), 3500); };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "exportUsers" }),
      });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "romx_users.csv"; a.click();
      URL.revokeObjectURL(url);
      flash("Users exported successfully!");
    } catch { flash("Export failed", "err"); }
    finally { setExportLoading(false); }
  };

  const handleRecalc = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "recalcStats" }),
      });
      const d = await res.json() as { ok?: boolean; totalRoms?: number; totalUsers?: number };
      if (d.ok) flash(`✅ تم: ${d.totalRoms} روم، ${d.totalUsers} مستخدم`);
      else flash("فشل إعادة الحساب", "err");
    } catch { flash("خطأ في الاتصال", "err"); }
  };

  const handleResetTour = async () => {
    if (!confirm("Reset your onboarding tour flag? You will see the tour again.")) return;
    setResetTourLoading(true);
    try {
      const currentUser = auth.currentUser;
      const token = await currentUser?.getIdToken();
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "resetTour" }),
      });
      if (res.ok) {
        if (currentUser?.uid) sessionStorage.removeItem(`rx_tour_done_${currentUser.uid}`);
        flash("✅ Tour reset! Navigate to any page to see it.");
      } else flash("Reset tour failed", "err");
    } catch { flash("Reset tour failed", "err"); }
    finally { setResetTourLoading(false); }
  };

  const handleWipe = async () => {
    if (!confirm("Delete ALL resolved/invalid/valid reports? This cannot be undone.")) return;
    setWipeLoading(true);
    try {
      const res = await apiAdminWipeResolvedReports();
      flash(`Wiped ${(res as any).deleted || 0} resolved reports`);
    } catch { flash("Wipe failed", "err"); }
    finally { setWipeLoading(false); }
  };

  const handleBroadcast = async () => {
    if (!broadcast.title.trim() || !broadcast.message.trim()) return;
    setBroadcastLoading(true);
    try {
      await apiAdminBroadcast(broadcast.title, broadcast.message, broadcast.link || undefined);
      setBroadcastSent(true);
      setBroadcast({ title: "", message: "", link: "" });
      setTimeout(() => { setBroadcastSent(false); setBroadcastOpen(false); }, 2000);
      flash("Broadcast sent as pinned announcement!");
    } catch { flash("Broadcast failed", "err"); }
    finally { setBroadcastLoading(false); }
  };

  const handleXpAdjust = async () => {
    const amount = parseInt(xpAmt);
    if (!xpUid.trim() || isNaN(amount)) return;
    setXpLoading(true);
    try {
      await apiAdminAdjustXP(xpUid.trim(), amount, xpNote);
      setXpDone(true);
      flash(`${amount > 0 ? "+" : ""}${amount} XP applied to ${xpUid}`);
      setTimeout(() => { setXpDone(false); setXpUid(""); setXpAmt(""); setXpNote(""); setXpToolOpen(false); }, 2000);
    } catch { flash("XP adjust failed", "err"); }
    finally { setXpLoading(false); }
  };

  const handleClearCountryFlags = async () => {
    if (!confirm("سيجعل هذا كل المستخدمين الذين عندهم show_on_map=true لكن بدون country يُعاد اكتشاف دولتهم في الزيارة القادمة. متأكد؟")) return;
    setClearCountryLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "clearCountryPatchFlags" }),
      });
      const d = await res.json() as { ok?: boolean; fixed?: number; message?: string };
      if (d.ok) flash(`✅ ${d.message}`);
      else flash("فشلت العملية", "err");
    } catch { flash("خطأ في الاتصال", "err"); }
    finally { setClearCountryLoading(false); }
  };

  const handleResetAllXP = async () => {
    if (!confirm("⚠️ هذا سيعيد حساب XP لجميع المستخدمين بناءً على بياناتهم الحقيقية.\nهل أنت متأكد؟")) return;
    setResetAllXPLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "resetAllXP" }),
      });
      const d = await res.json() as { ok?: boolean; total?: number; updated?: number; skipped?: number; errors?: string[] };
      if (d.ok) flash(`✅ تم! ${d.updated} مستخدم تحدّث، ${d.skipped} بلا تغيير من أصل ${d.total}`);
      else flash("فشلت العملية", "err");
    } catch { flash("خطأ في الاتصال", "err"); }
    finally { setResetAllXPLoading(false); }
  };

  const TOOLS: { id: string; label: string; desc: string; icon: React.ElementType; risk: "moderate" | "high"; color: string }[] = [
    { id: "recalc",       label: "إعادة حساب الإحصائيات",  desc: "يصلح أي خطأ في عداد الرومات والمستخدمين",       icon: RefreshCw, risk: "moderate", color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/5 hover:bg-emerald-400/10" },
    { id: "reset_all_xp", label: "إعادة حساب XP الكل",     desc: "يعيد حساب XP لكل المستخدمين من بيانات الـ ROMs", icon: Zap,       risk: "high",     color: "text-orange-400 border-orange-400/30 bg-orange-400/5 hover:bg-orange-400/10" },
    { id: "fix_map",      label: "إصلاح خريطة المجتمع",    desc: "يُعيد اكتشاف الدولة للمستخدمين بدون country",   icon: Globe,     risk: "moderate", color: "text-cyan-400 border-cyan-400/30 bg-cyan-400/5 hover:bg-cyan-400/10" },
    { id: "export",       label: "Export Users CSV",       desc: "Download all users as a CSV file",             icon: Download,  risk: "moderate", color: "text-blue-400 border-blue-400/30 bg-blue-400/5 hover:bg-blue-400/10" },
    { id: "broadcast",    label: "Platform Broadcast",     desc: "Send pinned announcement to all users",        icon: Radio,     risk: "moderate", color: "text-[var(--primary)] border-[var(--primary)]/30 bg-primary/5 hover:bg-primary/10" },
    { id: "wipe",         label: "Wipe Resolved Reports",  desc: "Clear all non-pending reports from DB",        icon: Trash2,    risk: "high",     color: "text-amber-400 border-amber-400/30 bg-amber-400/5 hover:bg-amber-400/10" },
    { id: "xp",           label: "Manual XP Adjustment",   desc: "Give or remove XP from any user by UID",       icon: Zap,       risk: "moderate", color: "text-amber-400 border-amber-400/30 bg-amber-400/5 hover:bg-amber-400/10" },
    { id: "reset_tour",   label: "Reset Onboarding Tour",  desc: "View the welcome tour again (Self)",           icon: RefreshCw, risk: "moderate", color: "text-purple-400 border-purple-400/30 bg-purple-400/5 hover:bg-purple-400/10" },
  ];

  return (
    <div className="rounded-xl border border-destructive/30 bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-destructive/20 bg-destructive/5">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <h3 className="text-sm font-bold text-destructive">Danger Zone</h3>
        <span className="ms-auto text-[10px] text-destructive/60 font-mono">OWNER ONLY</span>
      </div>

      {actionMsg && (
        <div className={cn("mx-4 mt-3 rounded-lg border px-3 py-2 text-xs font-medium", actionMsg.type === "ok" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : "border-destructive/30 bg-destructive/10 text-destructive")}>
          {actionMsg.type === "ok" ? "✓ " : "✗ "}{actionMsg.text}
        </div>
      )}

      <div className="p-4 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => {
                if (tool.id === "recalc") handleRecalc();
                else if (tool.id === "reset_all_xp") handleResetAllXP();
                else if (tool.id === "fix_map") handleClearCountryFlags();
                else if (tool.id === "export") handleExport();
                else if (tool.id === "broadcast") setBroadcastOpen((v) => !v);
                else if (tool.id === "wipe") handleWipe();
                else if (tool.id === "xp") setXpToolOpen((v) => !v);
                else if (tool.id === "reset_tour") handleResetTour();
              }}
              disabled={(tool.id === "export" && exportLoading) || (tool.id === "wipe" && wipeLoading) || (tool.id === "reset_tour" && resetTourLoading) || (tool.id === "reset_all_xp" && resetAllXPLoading) || (tool.id === "fix_map" && clearCountryLoading)}
              className={cn("flex items-center gap-3 rounded-xl border p-3 text-start transition-all disabled:opacity-50", tool.color)}
            >
              <div className="shrink-0">
                {(tool.id === "export" && exportLoading) || (tool.id === "wipe" && wipeLoading) || (tool.id === "reset_tour" && resetTourLoading) || (tool.id === "reset_all_xp" && resetAllXPLoading) || (tool.id === "fix_map" && clearCountryLoading)
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <tool.icon className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold">{tool.label}</p>
                <p className="text-[10px] opacity-70">{tool.desc}</p>
              </div>
              <span className={cn("ms-auto text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0", tool.risk === "high" ? "border-destructive/40 text-destructive" : "border-amber-400/40 text-amber-400")}>
                {tool.risk.toUpperCase()}
              </span>
            </button>
          ))}
        </div>

        {broadcastOpen && (
          <div className="rounded-xl border border-[var(--primary)]/30 bg-card p-4 mt-2 space-y-3">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4" style={{ color: "var(--primary)" }} />
              <h4 className="text-sm font-semibold text-foreground">Platform Broadcast</h4>
            </div>
            <input value={broadcast.title} onChange={(e) => setBroadcast((b) => ({ ...b, title: e.target.value }))} placeholder="Broadcast title *" className="h-9 w-full rounded-lg border border-border bg-muted/50 px-3 text-sm text-foreground focus:outline-none focus:border-[var(--primary)]" />
            <textarea value={broadcast.message} onChange={(e) => setBroadcast((b) => ({ ...b, message: e.target.value }))} placeholder="Message to all users *" rows={3} className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:border-[var(--primary)]" />
            <input value={broadcast.link} onChange={(e) => setBroadcast((b) => ({ ...b, link: e.target.value }))} placeholder="Link (optional)" className="h-9 w-full rounded-lg border border-border bg-muted/50 px-3 text-sm text-foreground focus:outline-none focus:border-[var(--primary)]" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setBroadcastOpen(false)} className="rounded-lg border border-border px-4 py-1.5 text-sm text-muted-foreground">Cancel</button>
              <button onClick={handleBroadcast} disabled={broadcastLoading || broadcastSent || !broadcast.title.trim() || !broadcast.message.trim()} className="flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--primary)" }}>
                {broadcastLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : broadcastSent ? <CheckCircle className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                {broadcastSent ? "Sent!" : "Broadcast"}
              </button>
            </div>
          </div>
        )}

        {xpTool && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 mt-2 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              <h4 className="text-sm font-semibold text-foreground">Manual XP Adjustment</h4>
            </div>
            <input value={xpUid} onChange={(e) => setXpUid(e.target.value)} placeholder="User UID..." className="h-9 w-full rounded-lg border border-border bg-muted/50 px-3 text-sm font-mono text-foreground focus:outline-none focus:border-amber-400" />
            <div className="flex gap-2">
              {["+10","+50","+100","+500","-10","-50","-100"].map((v) => (
                <button key={v} onClick={() => setXpAmt(v)} className={cn("rounded-lg border px-2.5 py-1 text-xs font-mono font-semibold shrink-0 transition-colors", xpAmt === v ? "border-amber-400 bg-amber-400/20 text-amber-400" : "border-border text-muted-foreground hover:text-foreground")}>{v}</button>
              ))}
            </div>
            <input value={xpAmt} onChange={(e) => setXpAmt(e.target.value)} placeholder="Custom amount (e.g. 250 or -100)" className="h-9 w-full rounded-lg border border-border bg-muted/50 px-3 text-sm font-mono text-foreground focus:outline-none focus:border-amber-400" />
            <input value={xpNote} onChange={(e) => setXpNote(e.target.value)} placeholder="Reason for logs..." className="h-9 w-full rounded-lg border border-border bg-muted/50 px-3 text-sm text-foreground focus:outline-none focus:border-amber-400" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setXpToolOpen(false)} className="rounded-lg border border-border px-4 py-1.5 text-sm text-muted-foreground">Cancel</button>
              <button onClick={handleXpAdjust} disabled={xpLoading || xpDone || !xpUid.trim() || isNaN(parseInt(xpAmt))} className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
                {xpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : xpDone ? <CheckCircle className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                {xpDone ? "Applied!" : "Apply XP"}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 pt-2 border-t border-border/50">
          <AlertCircle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground/60">For extreme operations (Reset User XP, Force Delete by ID): use Firebase Console directly — safer and audited.</p>
          </div>
          <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
            Firebase <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
