"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Loader2, Search, Zap, Package, Download, Flag, Clock, CheckCircle, UserCheck, Ban,
} from "lucide-react";
import {
  apiAdminListUsers, apiAdminSetRole, apiAdminBanUser, apiAdminSuspendUser,
  apiAdminUnsuspendUser, apiAdminAdjustXP,
} from "@/lib/api/client";
import type { UserDoc } from "@/lib/types";
import { formatCount, safeImg, cn } from "@/lib/utils";
import { DEFAULT_AVATAR, MODERATION } from "@/lib/constants";

export function UsersTab() {
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [suspendModal, setSuspendModal] = useState<{ uid: string; name: string } | null>(null);
  const [suspendDuration, setSuspendDuration] = useState<string>("24h");
  const [suspendReason, setSuspendReason] = useState("");
  const [xpModal, setXpModal] = useState<{ uid: string; name: string; currentXp: number } | null>(null);
  const [xpAmount, setXpAmount] = useState("");
  const [xpReason, setXpReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const hasLoadedRef = useRef(false); // OPTIMIZATION: منع re-fetch
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    apiAdminListUsers(500).then((items) => setUsers(items || [])).finally(() => setLoading(false));
  }, []);

  const handleRoleChange = async (uid: string, role: string) => {
    await apiAdminSetRole(uid, role);
    setUsers((prev) => prev.map((u) => u.id === uid ? { ...u, role: role as UserDoc["role"] } : u));
  };

  const handleBan = async (uid: string, banned: boolean) => {
    if (!confirm(banned ? "Unban this user?" : "Permanently ban this user?")) return;
    await apiAdminBanUser(uid, !banned);
    setUsers((prev) => prev.map((u) => u.id === uid ? { ...u, banned: !banned } : u));
  };

  const handleSuspend = async () => {
    if (!suspendModal) return;
    setActionLoading(true);
    try {
      const durationMap: Record<string, number> = {
        "1h": 3_600_000, "3h": 10_800_000, "24h": 86_400_000,
        "3d": 259_200_000, "7d": 604_800_000, "30d": 2_592_000_000,
        "perm": 365 * 24 * 3600 * 1000 * 99,
      };
      const durationMs = durationMap[suspendDuration] || MODERATION.SUSPENSION_24H_MS;
      await apiAdminSuspendUser(suspendModal.uid, durationMs, suspendReason || `Suspended by admin`);
      setUsers((prev) => prev.map((u) => u.id === suspendModal.uid ? { ...u, suspended: true } : u));
      setSuspendModal(null);
      setSuspendReason("");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsuspend = async (uid: string) => {
    if (!confirm("Unsuspend this user?")) return;
    await apiAdminUnsuspendUser(uid);
    setUsers((prev) => prev.map((u) => u.id === uid ? { ...u, suspended: false } : u));
  };

  const handleAdjustXP = async () => {
    if (!xpModal) return;
    const amount = parseInt(xpAmount);
    if (isNaN(amount)) return;
    setActionLoading(true);
    try {
      await apiAdminAdjustXP(xpModal.uid, amount, xpReason);
      setUsers((prev) => prev.map((u) => u.id === xpModal.uid ? { ...u, xp: (u.xp || 0) + amount } : u));
      setXpModal(null);
      setXpAmount("");
      setXpReason("");
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = (users || []).filter((u) => {
    const matchSearch = !search.trim() || [u.name, u.email, u.username, u.id].some((v) => v?.toLowerCase().includes(search.toLowerCase()));
    const matchRole = roleFilter === "all" ? true
      : roleFilter === "banned" ? u.banned
      : roleFilter === "suspended" ? (u.suspended && !u.banned)
      : u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const ROLE_FILTERS = ["all", "user", "verifiedDev", "moderator", "admin", "banned", "suspended"];

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="animate-fade-in">
      <div className="mb-3 space-y-2">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, username, UID..." className="h-10 w-full rounded-xl border border-border bg-muted/50 ps-9 pe-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[var(--primary)]" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {ROLE_FILTERS.map((r) => (
            <button key={r} onClick={() => setRoleFilter(r)} className={cn("rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors", roleFilter === r ? "text-white" : "border border-border text-muted-foreground hover:text-foreground")} style={roleFilter === r ? { backgroundColor: "var(--primary)" } : undefined}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-3">{filtered.length} of {users.length} users</p>

      <div className="flex flex-col gap-2">
        {filtered.map((u) => (
          <div key={u.id} className={cn("rounded-xl border bg-card p-3 transition-colors", u.banned ? "border-destructive/30 bg-destructive/5" : u.suspended ? "border-amber-400/30 bg-amber-400/5" : "border-border")}>
            <div className="flex items-center gap-3">
              <Link href={`/u/${u.id}`} className="shrink-0">
                <Image src={safeImg(u.photo, DEFAULT_AVATAR)} alt={u.name} width={38} height={38} className="rounded-full" crossOrigin="anonymous" />
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Link href={`/u/${u.id}`} className="text-sm font-semibold text-foreground hover:text-[var(--primary)] truncate">{u.name}</Link>
                  {u.banned && <span className="rounded-md bg-destructive/20 px-1.5 py-0.5 text-[10px] font-bold text-destructive">BANNED</span>}
                  {u.suspended && !u.banned && <span className="rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">SUSPENDED</span>}
                </div>
                <p className="text-xs text-muted-foreground">@{u.username || "—"} · {u.email}</p>
                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5"><Zap className="h-2.5 w-2.5 text-amber-400" /> {formatCount(u.xp || 0)} XP</span>
                  <span className="flex items-center gap-0.5"><Package className="h-2.5 w-2.5" /> {u.romsCount || 0} ROMs</span>
                  <span className="flex items-center gap-0.5"><Download className="h-2.5 w-2.5" /> {formatCount(u.totalDownloads || 0)}</span>
                  <span className="flex items-center gap-0.5"><Flag className="h-2.5 w-2.5 text-amber-400" /> {u.validReportsCount || 0} reports</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)} className="h-7 rounded-lg border border-border bg-muted/50 px-1.5 text-[11px] text-foreground">
                  <option value="user">User</option>
                  <option value="verifiedDev">Dev</option>
                  <option value="moderator">Mod</option>
                  <option value="admin">Admin</option>
                </select>
                <button onClick={() => { setXpModal({ uid: u.id, name: u.name, currentXp: u.xp || 0 }); setXpAmount(""); setXpReason(""); }} className="rounded-lg p-1.5 text-amber-400 hover:bg-amber-400/10 transition-colors" title="Adjust XP">
                  <Zap className="h-3.5 w-3.5" />
                </button>
                {u.suspended ? (
                  <button onClick={() => handleUnsuspend(u.id)} className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-400/10" title="Unsuspend"><CheckCircle className="h-3.5 w-3.5" /></button>
                ) : (
                  <button onClick={() => { setSuspendModal({ uid: u.id, name: u.name }); setSuspendDuration("24h"); setSuspendReason(""); }} className="rounded-lg p-1.5 text-amber-400 hover:bg-amber-400/10" title="Suspend"><Clock className="h-3.5 w-3.5" /></button>
                )}
                <button onClick={() => handleBan(u.id, u.banned)} className={cn("rounded-lg p-1.5 transition-colors", u.banned ? "text-emerald-400 hover:bg-emerald-400/10" : "text-muted-foreground hover:text-destructive hover:bg-destructive/10")} title={u.banned ? "Unban" : "Permanent Ban"}>
                  {u.banned ? <UserCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {suspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="text-base font-bold text-foreground mb-1">Suspend User</h3>
            <p className="text-sm text-muted-foreground mb-4">{suspendModal.name}</p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Duration</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[["1h", "1 Hour"], ["3h", "3 Hours"], ["24h", "24 Hours"], ["3d", "3 Days"], ["7d", "7 Days"], ["30d", "30 Days"], ["perm", "Permanent"]].map(([val, label]) => (
                    <button key={val} onClick={() => setSuspendDuration(val)} className={cn("rounded-lg py-1.5 text-xs font-medium transition-colors", val === "perm" ? "col-span-2" : "", suspendDuration === val ? "bg-amber-500 text-white" : "border border-border text-muted-foreground hover:text-foreground")}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Reason</label>
                <input value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder="Violation of community guidelines..." className="h-9 w-full rounded-lg border border-border bg-muted/50 px-3 text-sm text-foreground focus:outline-none focus:border-amber-500 transition-colors" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setSuspendModal(null)} className="flex-1 rounded-lg border border-border py-2.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
                <button onClick={handleSuspend} disabled={actionLoading} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-500/90 disabled:opacity-60">
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />} Suspend
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {xpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="text-base font-bold text-foreground mb-1">Adjust XP</h3>
            <p className="text-sm text-muted-foreground mb-1">{xpModal.name}</p>
            <p className="text-xs text-muted-foreground mb-4">Current: <span className="font-bold text-amber-400">{formatCount(xpModal.currentXp)} XP</span></p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Amount (use negative to remove)</label>
                <div className="grid grid-cols-6 gap-1.5 mb-2">
                  {["+10", "+50", "+100", "+500", "-10", "-50"].map((v) => (
                    <button key={v} onClick={() => setXpAmount(v)} className={cn("rounded-lg border px-2.5 py-1 text-xs font-mono font-semibold transition-colors", xpAmount === v ? "border-[var(--primary)] text-[var(--primary)] bg-primary/10" : "border-border text-muted-foreground hover:text-foreground")}>
                      {v}
                    </button>
                  ))}
                </div>
                <input value={xpAmount} onChange={(e) => setXpAmount(e.target.value)} placeholder="e.g. 100 or -50" className="h-9 w-full rounded-lg border border-border bg-muted/50 px-3 text-sm font-mono text-foreground focus:outline-none focus:border-amber-400 transition-colors" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Reason (for logs)</label>
                <input value={xpReason} onChange={(e) => setXpReason(e.target.value)} placeholder="Manual adjustment..." className="h-9 w-full rounded-lg border border-border bg-muted/50 px-3 text-sm text-foreground focus:outline-none focus:border-amber-400 transition-colors" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setXpModal(null)} className="flex-1 rounded-lg border border-border py-2.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
                <button onClick={handleAdjustXP} disabled={actionLoading || !xpAmount || isNaN(parseInt(xpAmount))} className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--primary)" }}>
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
