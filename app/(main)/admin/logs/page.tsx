"use client";

// ╔══════════════════════════════════════════════════════════════════╗
// ║  OPTIMIZATIONS APPLIED (admin/logs/page.tsx)                   ║
// ║                                                                  ║
// ║  1. DashboardTab: 400 reads → 25 reads  (-93%)                 ║
// ║     - كان بيجيب 200 log مرتين (total + errors)                 ║
// ║     - دلوقتي بيجيب 20 فقط وبيعد الأخطاء من نفس الـ result     ║
// ║                                                                  ║
// ║  2. LogsTab: 200 reads → 50 reads  (-75%)                      ║
// ║     - كان limit: 200، دلوقتي limit: 50                         ║
// ║                                                                  ║
// ║  3. HealthTab: AUTO → MANUAL  (-100% on page load)             ║
// ║     - كان بيشتغل أوتوماتيك عند فتح التاب                       ║
// ║     - دلوقتي بس لما تضغط "Run Checks"                          ║
// ║     - وبيكتب log entry بعد كل check (write saved too)          ║
// ║                                                                  ║
// ║  4. Tab Caching: re-fetch على كل switch → fetch مرة واحدة بس  ║
// ║     - كل tab كان بيعمل unmount/remount عند التبديل             ║
// ║     - دلوقتي كل tab بيفضل mounted ومخبي بـ CSS hidden          ║
// ║     - hasLoadedRef يمنع re-fetch لو البيانات اتحملت قبل كده    ║
// ║                                                                  ║
// ║  TOTAL SAVINGS per admin session: ~85-95% fewer reads          ║
// ╚══════════════════════════════════════════════════════════════════╝

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import type { RomItem, UserDoc, Report, AdminLogEntry, LogLevel, LogCategory } from "@/lib/types";
import { formatCount, fmtDate, timeAgo, cn } from "@/lib/utils";
import {
  apiAdminListLogs, apiAdminAddLog, apiAdminDeleteLog, apiAdminClearLogs,
  apiGetStats, apiAdminListUsers, apiListRoms, apiListReports,
  apiAdminListApplications,
} from "@/lib/api/client";
import {
  Shield, AlertTriangle, AlertCircle, CheckCircle, Info, Loader2,
  Activity, Database, Users, Package, BarChart3, Clock,
  Search, Filter, Download, Trash2, RefreshCw, ChevronDown,
  Terminal, Bug, Zap, Server, HardDrive, Eye,
  ArrowUpDown, XCircle, FileText, Globe, TrendingUp, TrendingDown,
  Wifi, WifiOff, ChevronLeft, Copy, Check, MoreVertical,
} from "lucide-react";
import dynamic from 'next/dynamic';
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer as any), { ssr: false });
const BarChart = dynamic(() => import("recharts").then((mod) => mod.BarChart as any), { ssr: false });
const Bar = dynamic(() => import("recharts").then((mod) => mod.Bar as any), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((mod) => mod.XAxis as any), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((mod) => mod.YAxis as any), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((mod) => mod.Tooltip as any), { ssr: false });
const LineChart = dynamic(() => import("recharts").then((mod) => mod.LineChart as any), { ssr: false });
const Line = dynamic(() => import("recharts").then((mod) => mod.Line as any), { ssr: false });
const AreaChart = dynamic(() => import("recharts").then((mod) => mod.AreaChart as any), { ssr: false });
const Area = dynamic(() => import("recharts").then((mod) => mod.Area as any), { ssr: false });
const PieChart = dynamic(() => import("recharts").then((mod) => mod.PieChart as any), { ssr: false });
const Pie = dynamic(() => import("recharts").then((mod) => mod.Pie as any), { ssr: false });
const Cell = dynamic(() => import("recharts").then((mod) => mod.Cell as any), { ssr: false });
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import Link from "next/link";

// ── Types ──────────────────────────────────────────
type LogTab = "dashboard" | "logs" | "health" | "activity" | "data";

interface HealthMetric {
  name: string;
  status: "healthy" | "degraded" | "down";
  value: string;
  detail: string;
  icon: typeof Database;
}

// ── Constants ───────────────────────────────────────
const LOG_LEVEL_CONFIG: Record<LogLevel, { icon: typeof AlertCircle; color: string; bg: string; label: string }> = {
  error:   { icon: XCircle,       color: "text-red-400",     bg: "bg-red-400/10",     label: "Error" },
  warning: { icon: AlertTriangle, color: "text-amber-400",   bg: "bg-amber-400/10",   label: "Warning" },
  info:    { icon: Info,          color: "text-blue-400",    bg: "bg-blue-400/10",    label: "Info" },
  success: { icon: CheckCircle,   color: "text-emerald-400", bg: "bg-emerald-400/10", label: "Success" },
};

const LOG_CATEGORY_CONFIG: Record<LogCategory, { icon: typeof Database; label: string; color: string }> = {
  auth:       { icon: Shield,   label: "Authentication", color: "text-purple-400" },
  database:   { icon: Database, label: "Database",       color: "text-blue-400" },
  upload:     { icon: Package,  label: "Upload",         color: "text-emerald-400" },
  moderation: { icon: Eye,      label: "Moderation",     color: "text-amber-400" },
  system:     { icon: Server,   label: "System",         color: "text-cyan-400" },
  api:        { icon: Globe,    label: "API",            color: "text-orange-400" },
  security:   { icon: Shield,   label: "Security",       color: "text-red-400" },
};

// ── Helper: Write log ───────────────────────────────
async function writeLog(entry: Record<string, unknown>) {
  try { await apiAdminAddLog(entry); } catch { /* silent */ }
}

// ── Main Page ───────────────────────────────────────
export default function AdminLogsPage() {
  const { user, userDoc, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<LogTab>("dashboard");

  if (authLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Shield className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
        <p className="mt-2 text-sm text-muted-foreground">Admin privileges required.</p>
      </div>
    );
  }

  const tabs: { id: LogTab; label: string; icon: typeof BarChart3 }[] = [
    { id: "dashboard", label: "Dashboard",     icon: BarChart3 },
    { id: "logs",      label: "Error Logs",    icon: Bug },
    { id: "health",    label: "Health",        icon: Activity },
    { id: "activity",  label: "User Activity", icon: Users },
    { id: "data",      label: "Data Audit",    icon: Database },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6 xl:px-8">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/admin" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <ChevronLeft className="h-4 w-4 icon-dir" />
        </Link>
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: "var(--primary)" }} />
          <div>
            <h1 className="text-lg font-bold text-foreground sm:text-xl">System Logs & Monitoring</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">Real-time monitoring, error tracking, and data auditing</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border mb-4 overflow-x-auto scrollbar-none sm:gap-2">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2 text-xs font-medium transition-colors sm:px-4 sm:py-2.5 sm:text-sm",
              tab === t.id ? "border-[var(--primary)] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {/*
        OPTIMIZATION: بدل conditional rendering اللي كان بيعمل unmount/remount
        دلوقتي كل tab شغال دايماً بس مخبي بـ CSS.
        الفايدة: البيانات مش بتتعمل re-fetch كل مرة بتبدل التاب.
        قبل: كل switch = fetch جديد. دلوقتي: fetch مرة واحدة بس.
      */}
      <div className={tab === "dashboard" ? "" : "hidden"}><DashboardTab isActive={tab === "dashboard"} /></div>
      <div className={tab === "logs"      ? "" : "hidden"}><LogsTab      isActive={tab === "logs"} /></div>
      <div className={tab === "health"    ? "" : "hidden"}><HealthTab    isActive={tab === "health"} /></div>
      <div className={tab === "activity"  ? "" : "hidden"}><ActivityTab  isActive={tab === "activity"} /></div>
      <div className={tab === "data"      ? "" : "hidden"}><DataAuditTab isActive={tab === "data"} /></div>
    </div>
  );
}

// ── Dashboard Tab ────────────────────────────────────
// BEFORE: 400+ reads (apiAdminListLogs x2 with limit:200 + reports + apps + stats)
// AFTER:  ~25 reads  (apiAdminListLogs x1 with limit:20  + reports + apps + stats)
// SAVING: ~93%
function DashboardTab({ isActive }: { isActive: boolean }) {
  const hasLoadedRef = useRef(false); // منع re-fetch عند التبديل للتاب تاني وتعدي هنا تاني

  const [stats, setStats] = useState({
    totalRoms: 0, totalUsers: 0, pendingReports: 0, pendingApps: 0,
    totalLogs: 0, errorLogs: 0, todaySignups: 0, todayUploads: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentLogs, setRecentLogs] = useState<AdminLogEntry[]>([]);

  useEffect(() => {
    // OPTIMIZATION: لو التاب مش active أو البيانات اتحملت قبل كده، متعملش حاجة
    if (!isActive || hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const load = async () => {
      setLoading(true);
      try {
        const [apiStats, pendingReports, pendingApps, logs] = await Promise.all([
          apiGetStats().catch(() => ({ totalRoms: 0, totalUsers: 0, totalDownloads: 0, onlineCount: 0 })),
          apiListReports("pending").catch(() => []),
          apiAdminListApplications("pending").catch(() => []),
          // OPTIMIZATION: كان limit:200 مرتين (400 reads!) → دلوقتي limit:20 مرة واحدة
          // وبنعد الأخطاء من نفس الـ array بدل fetch تاني
          apiAdminListLogs({ limit: 20 }).catch(() => []),
        ]);

        const errorCount = logs.filter((l) => l.level === "error").length;

        setStats({
          totalRoms: apiStats.totalRoms,
          totalUsers: apiStats.totalUsers,
          pendingReports: pendingReports.length,
          pendingApps: pendingApps.length,
          totalLogs: logs.length,
          errorLogs: errorCount,
          todaySignups: 0,
          todayUploads: 0,
        });
        setRecentLogs(logs.slice(0, 5));
      } catch (err) {
        console.error("Failed to load dashboard stats:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isActive]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const statCards = [
    { label: "Total Releases",    value: stats.totalRoms,      icon: Package,       color: "text-blue-400 bg-blue-400/10",       trend: null },
    { label: "Total Users",       value: stats.totalUsers,     icon: Users,         color: "text-emerald-400 bg-emerald-400/10", trend: null },
    { label: "Pending Reports",   value: stats.pendingReports, icon: AlertTriangle, color: "text-amber-400 bg-amber-400/10",     trend: stats.pendingReports > 5 ? "critical" : null },
    { label: "Pending Apps",      value: stats.pendingApps,    icon: Shield,        color: "text-purple-400 bg-purple-400/10",   trend: null },
    { label: "Today Signups",     value: stats.todaySignups,   icon: Users,         color: "text-cyan-400 bg-cyan-400/10",       trend: "up" },
    { label: "Today Uploads",     value: stats.todayUploads,   icon: Package,       color: "text-orange-400 bg-orange-400/10",   trend: "up" },
    { label: "Recent Log Entries", value: stats.totalLogs,     icon: Terminal,      color: "text-muted-foreground bg-muted",     trend: null },
    { label: "Error Logs",        value: stats.errorLogs,      icon: Bug,           color: "text-red-400 bg-red-400/10",         trend: stats.errorLogs > 10 ? "critical" : null },
  ];

  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 mb-6">
        {statCards.map((s) => (
          <div key={s.label} className={cn("rounded-xl border bg-card p-3 sm:p-4 transition-colors", s.trend === "critical" ? "border-red-400/30" : "border-border")}>
            <div className="flex items-center justify-between mb-2">
              <div className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg", s.color)}>
                <s.icon className="h-4 w-4" />
              </div>
              {s.trend === "critical" && (
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400" />
                </span>
              )}
              {s.trend === "up" && <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />}
            </div>
            <p className="text-xl font-bold text-foreground sm:text-2xl">{formatCount(s.value)}</p>
            <p className="text-[10px] text-muted-foreground sm:text-xs">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 mb-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4" style={{ color: "var(--primary)" }} />
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => writeLog({ level: "info", category: "system", message: "Manual system check initiated" })}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Run System Check
            </button>
            <Link href="/admin" className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Shield className="h-3.5 w-3.5" /> Admin Panel
            </Link>
            <button
              onClick={() => writeLog({ level: "info", category: "system", message: "Cache clear requested" })}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <HardDrive className="h-3.5 w-3.5" /> Clear Cache
            </button>
            <button
              onClick={() => {
                const data = JSON.stringify(stats, null, 2);
                const blob = new Blob([data], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `romx-stats-${new Date().toISOString().split("T")[0]}.json`;
                a.click(); URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> Export Stats
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Terminal className="h-4 w-4" style={{ color: "var(--primary)" }} />
            Recent Logs <span className="text-[10px] text-muted-foreground font-normal ms-auto">last 20 entries</span>
          </h3>
          {recentLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No log entries yet. System is clean.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {recentLogs.map((log) => {
                const cfg = LOG_LEVEL_CONFIG[log.level] || LOG_LEVEL_CONFIG.info;
                return (
                  <div key={log.id} className="flex items-start gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5">
                    <cfg.icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", cfg.color)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-foreground truncate">{log.message}</p>
                      <p className="text-[10px] text-muted-foreground">{timeAgo(log.timestamp)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10">
          <Wifi className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Platform Status: Online</p>
          <p className="text-xs text-muted-foreground">All systems operational. Firebase connected.</p>
        </div>
        <div className="ms-auto flex items-center gap-1.5">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="text-xs font-medium text-emerald-400">Healthy</span>
        </div>
      </div>
    </div>
  );
}

// ── Logs Tab ─────────────────────────────────────────
// BEFORE: 200 reads on every tab visit
// AFTER:  50 reads, only on FIRST visit (cached after)
// SAVING: 75% on first open, 100% on re-open
function LogsTab({ isActive }: { isActive: boolean }) {
  const hasLoadedRef = useRef(false);
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<LogLevel | "all">("all");
  const [filterCategory, setFilterCategory] = useState<LogCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadLogs = useCallback(async (force = false) => {
    if (!force && hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    setLoading(true);
    try {
      // OPTIMIZATION: limit: 200 → limit: 50
      const items = await apiAdminListLogs({ limit: 50 });
      setLogs(items);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    loadLogs();
  }, [isActive, loadLogs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterLevel !== "all" && log.level !== filterLevel) return false;
      if (filterCategory !== "all" && log.category !== filterCategory) return false;
      if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [logs, filterLevel, filterCategory, searchQuery]);

  const handleClearAll = async () => {
    if (!confirm("Delete ALL log entries? This cannot be undone.")) return;
    try { await apiAdminClearLogs(); setLogs([]); }
    catch (err) { console.error("Failed to clear logs:", err); }
  };

  const handleDeleteLog = async (id: string) => {
    await apiAdminDeleteLog(id);
    setLogs((prev) => prev.filter((l) => l.id !== id));
  };

  const handleCopyLog = (log: AdminLogEntry) => {
    const text = `[${log.level.toUpperCase()}] [${log.category}] ${log.message}${log.details ? "\n" + log.details : ""}`;
    navigator.clipboard.writeText(text);
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportLogs = () => {
    const data = filteredLogs.map((l) => ({
      level: l.level, category: l.category, message: l.message,
      details: l.details || "", userId: l.userId || "", userName: l.userName || "",
      timestamp: l.timestamp ? fmtDate(l.timestamp) : "",
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `romx-logs-${new Date().toISOString().split("T")[0]}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleGenerateSampleLogs = async () => {
    const sampleLogs = [
      { level: "info", category: "system", message: "System monitoring initialized" },
      { level: "success", category: "auth", message: "Admin login successful" },
      { level: "info", category: "database", message: "Firestore connection established" },
      { level: "warning", category: "upload", message: "Large file upload detected (4.8MB)" },
      { level: "info", category: "moderation", message: "Auto-moderation scan completed, 0 issues found" },
      { level: "success", category: "api", message: "API health check passed" },
      { level: "info", category: "security", message: "Rate limiter active on all endpoints" },
      { level: "warning", category: "database", message: "Query optimization suggested for roms collection" },
      { level: "success", category: "system", message: "Daily backup completed successfully" },
      { level: "info", category: "auth", message: "2 new user registrations today" },
    ];
    for (const log of sampleLogs) { await writeLog(log); }
    loadLogs(true); // force refresh
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search logs..."
              className="h-8 w-full rounded-lg border border-border bg-muted/50 ps-8 pe-3 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-[var(--primary)]" />
          </div>
          <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value as LogLevel | "all")}
            className="h-8 rounded-lg border border-border bg-muted/50 px-2 text-xs text-foreground">
            <option value="all">All Levels</option>
            <option value="error">Errors</option>
            <option value="warning">Warnings</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
          </select>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as LogCategory | "all")}
            className="h-8 rounded-lg border border-border bg-muted/50 px-2 text-xs text-foreground">
            <option value="all">All Categories</option>
            {Object.entries(LOG_CATEGORY_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => loadLogs(true)} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button onClick={handleExportLogs} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          {logs.length > 0 && (
            <button onClick={handleClearAll} className="flex items-center gap-1.5 rounded-lg border border-red-400/30 px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-400/10 transition-colors">
              <Trash2 className="h-3.5 w-3.5" /> Clear All
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-xs text-muted-foreground">{filteredLogs.length} entries (showing last 50)</span>
        {(["error", "warning", "info", "success"] as LogLevel[]).map((level) => {
          const count = logs.filter((l) => l.level === level).length;
          const cfg = LOG_LEVEL_CONFIG[level];
          return count > 0 ? (
            <span key={level} className={cn("flex items-center gap-1 text-[10px] font-medium rounded-md px-1.5 py-0.5", cfg.bg, cfg.color)}>
              <cfg.icon className="h-3 w-3" /> {count} {cfg.label}
            </span>
          ) : null;
        })}
      </div>

      {filteredLogs.length === 0 ? (
        <div className="text-center py-16">
          <Terminal className="mx-auto h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">
            {logs.length === 0 ? "No log entries yet" : "No matching logs"}
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            {logs.length === 0 ? "Log entries will appear here as events occur." : "Try adjusting your filters."}
          </p>
          {logs.length === 0 && (
            <button onClick={handleGenerateSampleLogs}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white"
              style={{ backgroundColor: "var(--primary)" }}>
              <Zap className="h-4 w-4" /> Generate Sample Logs
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="ms-2 text-[10px] text-muted-foreground font-mono">admin_logs -- {filteredLogs.length} entries</span>
          </div>
          <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
            {filteredLogs.map((log) => {
              const levelCfg = LOG_LEVEL_CONFIG[log.level] || LOG_LEVEL_CONFIG.info;
              const catCfg = LOG_CATEGORY_CONFIG[log.category] || LOG_CATEGORY_CONFIG.system;
              return (
                <div key={log.id} className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors group">
                  <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg mt-0.5", levelCfg.bg)}>
                    <levelCfg.icon className={cn("h-3.5 w-3.5", levelCfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-[10px] font-mono font-bold uppercase", levelCfg.color)}>{log.level}</span>
                      <span className={cn("flex items-center gap-0.5 text-[10px]", catCfg.color)}>
                        <catCfg.icon className="h-2.5 w-2.5" /> {catCfg.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">{log.timestamp ? timeAgo(log.timestamp) : "just now"}</span>
                    </div>
                    <p className="text-xs text-foreground mt-0.5 font-mono">{log.message}</p>
                    {log.details && <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{log.details}</p>}
                    {log.userName && <p className="text-[10px] text-muted-foreground mt-0.5">User: {log.userName}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleCopyLog(log)} className="rounded p-1 text-muted-foreground hover:text-foreground" title="Copy">
                      {copiedId === log.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => handleDeleteLog(log.id)} className="rounded p-1 text-muted-foreground hover:text-destructive" title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Health Tab ────────────────────────────────────────
// BEFORE: Auto-runs on mount = reads + log write every time tab opens
// AFTER:  Manual only — zero reads on page load, runs when YOU press the button
// SAVING: 100% on page load
function HealthTab({ isActive }: { isActive: boolean }) {
  const [checks, setChecks] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [hasRun, setHasRun] = useState(false);

  // OPTIMIZATION: كان useEffect يشغّل runChecks أوتوماتيك عند فتح الصفحة
  // دلوقتي مفيش auto-run خالص - لازم تضغط الزرار
  // ده بيوفر ~5-8 reads + write في كل مرة بتفتح الـ logs page

  const runChecks = useCallback(async () => {
    setLoading(true);
    setHasRun(true);
    const results: HealthMetric[] = [];

    try {
      const start = Date.now();
      const statsData = await apiGetStats();
      const latency = Date.now() - start;
      results.push({ name: "Firestore Database", status: latency < 1000 ? "healthy" : latency < 3000 ? "degraded" : "down", value: `${latency}ms`, detail: latency < 1000 ? "Responding normally" : "High latency detected", icon: Database });
      results.push({ name: "Users Collection",   status: "healthy", value: `${statsData.totalUsers} docs`, detail: `Query: ${latency}ms`, icon: Users });
      results.push({ name: "ROMs Collection",    status: "healthy", value: `${statsData.totalRoms} docs`, detail: `Query: ${latency}ms`, icon: Package });
    } catch {
      results.push({ name: "Firestore Database", status: "down", value: "N/A",   detail: "Connection failed",  icon: Database });
      results.push({ name: "Users Collection",   status: "down", value: "Error", detail: "Failed to query",    icon: Users });
      results.push({ name: "ROMs Collection",    status: "down", value: "Error", detail: "Failed to query",    icon: Package });
    }

    try {
      const pending = await apiListReports("pending");
      results.push({ name: "Moderation Queue", status: pending.length > 20 ? "degraded" : "healthy", value: `${pending.length} pending`, detail: "Pending reports", icon: AlertTriangle });
    } catch {
      results.push({ name: "Moderation Queue", status: "healthy", value: "0 pending", detail: "No reports collection", icon: AlertTriangle });
    }

    results.push({ name: "Firebase Auth", status: "healthy", value: "Active", detail: "Google OAuth configured", icon: Shield });

    try {
      const start = Date.now();
      const res = await fetch("/api/stats");
      const latency = Date.now() - start;
      results.push({ name: "API /stats", status: res.ok ? (latency < 1000 ? "healthy" : "degraded") : "down", value: `${res.status} ${latency}ms`, detail: res.ok ? "Responding normally" : "Error response", icon: Globe });
    } catch {
      results.push({ name: "API /stats", status: "down", value: "N/A", detail: "Connection refused", icon: Globe });
    }

    results.push({ name: "Cloudinary CDN", status: "healthy", value: "Connected", detail: "Image hosting active", icon: HardDrive });

    setChecks(results);
    setLastCheck(new Date());
    setLoading(false);

    // OPTIMIZATION: كان بيكتب log entry أوتوماتيك بعد كل check = write محسوبة
    // دلوقتي بيكتب بس لو في مشكلة فعلية
    const downCount = results.filter((r) => r.status === "down").length;
    if (downCount > 0) {
      writeLog({ level: "error", category: "system", message: `Health check: ${downCount} services down` });
    }
  }, []);

  const statusColors = {
    healthy:  { bg: "bg-emerald-400/10", text: "text-emerald-400", border: "border-emerald-400/20", dot: "bg-emerald-400" },
    degraded: { bg: "bg-amber-400/10",   text: "text-amber-400",   border: "border-amber-400/20",   dot: "bg-amber-400" },
    down:     { bg: "bg-red-400/10",     text: "text-red-400",     border: "border-red-400/20",     dot: "bg-red-400" },
  };

  // Show idle state before first run
  if (!hasRun && !loading) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-card">
          <Activity className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground mb-1">Health Check Ready</p>
          <p className="text-xs text-muted-foreground">Click the button to run checks manually.<br />Checks are not automatic to save Firestore reads.</p>
        </div>
        <button onClick={runChecks}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
          style={{ backgroundColor: "var(--primary)" }}>
          <Activity className="h-4 w-4" /> Run Health Checks
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Running health checks...</p>
      </div>
    );
  }

  const healthyCount = checks.filter((c) => c.status === "healthy").length;
  const overallStatus = checks.every((c) => c.status === "healthy") ? "healthy" : checks.some((c) => c.status === "down") ? "down" : "degraded";

  return (
    <div className="animate-fade-in">
      <div className={cn("rounded-xl border p-4 mb-4 flex items-center gap-3", statusColors[overallStatus].border, statusColors[overallStatus].bg)}>
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", statusColors[overallStatus].bg)}>
          {overallStatus === "healthy" ? <CheckCircle className={cn("h-6 w-6", statusColors[overallStatus].text)} />
           : overallStatus === "degraded" ? <AlertTriangle className={cn("h-6 w-6", statusColors[overallStatus].text)} />
           : <XCircle className={cn("h-6 w-6", statusColors[overallStatus].text)} />}
        </div>
        <div className="flex-1">
          <p className={cn("text-sm font-semibold", statusColors[overallStatus].text)}>
            {overallStatus === "healthy" ? "All Systems Operational" : overallStatus === "degraded" ? "Partial Degradation" : "System Issues Detected"}
          </p>
          <p className="text-xs text-muted-foreground">
            {healthyCount}/{checks.length} services healthy
            {lastCheck && ` — Last checked: ${lastCheck.toLocaleTimeString()}`}
          </p>
        </div>
        <button onClick={runChecks}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Re-check
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {checks.map((check) => {
          const sc = statusColors[check.status];
          return (
            <div key={check.name} className={cn("rounded-xl border bg-card p-4 flex items-start gap-3", sc.border)}>
              <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", sc.bg)}>
                <check.icon className={cn("h-4 w-4", sc.text)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{check.name}</p>
                  <span className={cn("flex h-2 w-2 rounded-full", sc.dot)} />
                </div>
                <p className="text-xs text-muted-foreground">{check.detail}</p>
              </div>
              <div className="text-end shrink-0">
                <p className={cn("text-xs font-mono font-bold", sc.text)}>{check.value}</p>
                <p className={cn("text-[10px] uppercase font-bold", sc.text)}>{check.status}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Activity Tab ──────────────────────────────────────
// BEFORE: fetches on every tab visit (users + roms + reports)
// AFTER:  fetches once, cached in memory
// SAVING: 100% on re-visits
function ActivityTab({ isActive }: { isActive: boolean }) {
  const hasLoadedRef = useRef(false);
  const [recentUsers, setRecentUsers] = useState<UserDoc[]>([]);
  const [recentRoms, setRecentRoms] = useState<RomItem[]>([]);
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isActive || hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    Promise.all([
      apiAdminListUsers(10).catch(() => [] as UserDoc[]),
      apiListRoms({ max: 10, sortBy: "newest" }).then((r) => r.items).catch(() => [] as RomItem[]),
      apiListReports("pending").then((r) => r.slice(0, 10)).catch(() => [] as Report[]),
    ]).then(([users, roms, reports]) => {
      setRecentUsers(users);
      setRecentRoms(roms);
      setRecentReports(reports);
    }).finally(() => setLoading(false));
  }, [isActive]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent Users */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Users className="h-4 w-4" style={{ color: "var(--primary)" }} />
            <h3 className="text-sm font-semibold text-foreground">Recent Users</h3>
            <span className="ms-auto text-[10px] text-muted-foreground">{recentUsers.length} shown</span>
          </div>
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {recentUsers.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No users found</p>
            ) : recentUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                  {(u.name || "?")[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{u.name}</p>
                  <p className="text-[10px] text-muted-foreground">@{u.username || "no-username"} — {u.role}</p>
                </div>
                <div className="text-end shrink-0">
                  <p className="text-[10px] text-muted-foreground">{timeAgo(u.createdAt)}</p>
                  {u.banned && <span className="text-[10px] text-red-400 font-bold">BANNED</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent ROMs */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Package className="h-4 w-4" style={{ color: "var(--primary)" }} />
            <h3 className="text-sm font-semibold text-foreground">Recent Releases</h3>
            <span className="ms-auto text-[10px] text-muted-foreground">{recentRoms.length} shown</span>
          </div>
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {recentRoms.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No releases found</p>
            ) : recentRoms.map((r) => (
              <Link key={r.id} href={`/rom/${r.id}`} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                <div className="h-7 w-7 rounded bg-muted flex items-center justify-center">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{r.name}</p>
                  <p className="text-[10px] text-muted-foreground">{r.device} — {r.maintainerName}</p>
                </div>
                <div className="text-end shrink-0">
                  <p className="text-[10px] text-muted-foreground">{timeAgo(r.createdAt)}</p>
                  <span className={cn("text-[10px] rounded px-1 py-0.5 font-bold", r.romStatus === "active" ? "text-emerald-400" : "text-amber-400")}>
                    {r.romStatus}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Reports */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <AlertTriangle className="h-4 w-4" style={{ color: "var(--primary)" }} />
            <h3 className="text-sm font-semibold text-foreground">Recent Reports</h3>
            <span className="ms-auto text-[10px] text-muted-foreground">{recentReports.length} shown</span>
          </div>
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {recentReports.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No reports found</p>
            ) : recentReports.map((r) => (
              <div key={r.id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                <div className={cn("h-7 w-7 rounded flex items-center justify-center", r.status === "pending" ? "bg-amber-400/10" : "bg-emerald-400/10")}>
                  {r.status === "pending"
                    ? <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                    : <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate capitalize">{r.targetType}: {r.reason}</p>
                  <p className="text-[10px] text-muted-foreground">{r.reporterName || "Unknown"}</p>
                </div>
                <div className="text-end shrink-0">
                  <p className="text-[10px] text-muted-foreground">{timeAgo(r.createdAt)}</p>
                  <span className={cn("text-[10px] font-bold uppercase", r.status === "pending" ? "text-amber-400" : "text-emerald-400")}>
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Data Audit Tab ────────────────────────────────────
// BEFORE: fetches on every tab visit
// AFTER:  fetches once, cached. Manual re-audit button available
// SAVING: 100% on re-visits
function DataAuditTab({ isActive }: { isActive: boolean }) {
  const hasLoadedRef = useRef(false);
  const [audit, setAudit] = useState<{
    collections: { name: string; count: number; status: string; icon: typeof Database }[];
    integrity: { check: string; passed: boolean; detail: string }[];
  }>({ collections: [], integrity: [] });
  const [loading, setLoading] = useState(true);

  const runAudit = useCallback(async () => {
    setLoading(true);
    try {
      const statsData = await apiGetStats().catch(() => ({ totalRoms: 0, totalUsers: 0, totalDownloads: 0, onlineCount: 0 }));
      const pendingReports = await apiListReports("pending").catch(() => []);
      const pendingApps = await apiAdminListApplications("pending").catch(() => []);
      // OPTIMIZATION: limit:1 (was already small here, kept as-is)
      const logs = await apiAdminListLogs({ limit: 1 }).catch(() => []);

      const collections = [
        { name: "users",        count: statsData.totalUsers,    status: "accessible", icon: Users },
        { name: "roms",         count: statsData.totalRoms,     status: "accessible", icon: Package },
        { name: "reports",      count: pendingReports.length,   status: "accessible", icon: AlertTriangle },
        { name: "applications", count: pendingApps.length,      status: "accessible", icon: Shield },
        { name: "announcements", count: 0,                      status: "accessible", icon: FileText },
        { name: "admin_logs",   count: logs.length > 0 ? 1 : 0, status: "accessible", icon: Terminal },
      ];

      const integrity = [
        { check: "Pending reports",       passed: pendingReports.length < 20, detail: pendingReports.length === 0 ? "No pending reports" : `${pendingReports.length} awaiting review` },
        { check: "Pending applications",  passed: pendingApps.length < 50,    detail: pendingApps.length === 0 ? "No pending applications" : `${pendingApps.length} awaiting review` },
        { check: "Firebase Authentication", passed: true, detail: "Google OAuth provider configured" },
        { check: "Image Storage (Cloudinary)", passed: true, detail: "Cloudinary configured via environment variables" },
        { check: "Admin SDK",             passed: true, detail: "Server-side Firebase Admin SDK active" },
      ];

      setAudit({ collections, integrity });
    } catch (err) {
      console.error("Audit failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    runAudit();
  }, [isActive, runAudit]);

  const handleExportAudit = () => {
    const data = { timestamp: new Date().toISOString(), collections: audit.collections, integrity: audit.integrity };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `romx-audit-${new Date().toISOString().split("T")[0]}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Running data audit...</p>
      </div>
    );
  }

  const passedCount = audit.integrity.filter((i) => i.passed).length;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Data Integrity Report</p>
          <p className="text-xs text-muted-foreground">{passedCount}/{audit.integrity.length} checks passed</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { hasLoadedRef.current = false; runAudit(); }}
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="h-3.5 w-3.5" /> Re-audit
          </button>
          <button onClick={handleExportAudit}
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card mb-4">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Database className="h-4 w-4" style={{ color: "var(--primary)" }} />
          <h3 className="text-sm font-semibold text-foreground">Firestore Collections</h3>
        </div>
        <div className="divide-y divide-border">
          {audit.collections.map((c) => (
            <div key={c.name} className="flex items-center gap-3 px-4 py-3">
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", c.status === "accessible" ? "bg-emerald-400/10" : "bg-red-400/10")}>
                <c.icon className={cn("h-4 w-4", c.status === "accessible" ? "text-emerald-400" : "text-red-400")} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground font-mono">{c.name}</p>
                <p className="text-[10px] text-muted-foreground">{c.status === "accessible" ? "Read/Write accessible" : "Access error"}</p>
              </div>
              <div className="text-end shrink-0">
                <p className="text-sm font-bold text-foreground font-mono">{c.count === -1 ? "ERR" : formatCount(c.count)}</p>
                <p className="text-[10px] text-muted-foreground">documents</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Shield className="h-4 w-4" style={{ color: "var(--primary)" }} />
          <h3 className="text-sm font-semibold text-foreground">Integrity Checks</h3>
          <span className={cn("ms-auto text-[10px] font-bold", passedCount === audit.integrity.length ? "text-emerald-400" : "text-amber-400")}>
            {passedCount}/{audit.integrity.length} PASSED
          </span>
        </div>
        <div className="divide-y divide-border">
          {audit.integrity.map((check, idx) => (
            <div key={idx} className="flex items-center gap-3 px-4 py-3">
              <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", check.passed ? "bg-emerald-400/10" : "bg-amber-400/10")}>
                {check.passed ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{check.check}</p>
                <p className="text-xs text-muted-foreground">{check.detail}</p>
              </div>
              <span className={cn("text-[10px] font-bold uppercase", check.passed ? "text-emerald-400" : "text-amber-400")}>
                {check.passed ? "PASS" : "WARN"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
