"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Loader2, CheckCircle, AlertTriangle, XCircle, Gavel, ExternalLink,
} from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

interface ArchiveReportItem {
  id: string;
  codename: string;
  report_type: string;
  current_value: string;
  suggested_value: string;
  note: string;
  reporter_uid: string;
  reporter_name: string;
  status: "pending" | "approved" | "rejected";
  created_at: { _seconds?: number; seconds?: number } | null;
}

export function ArchiveReportsTab() {
  const [items, setItems] = useState<ArchiveReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [acting, setActing] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [openNote, setOpenNote] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/archive-reports?status=${status}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { items: ArchiveReportItem[] };
      setItems(data.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setActing(id);
    try {
      const token = await auth.currentUser?.getIdToken();

      const res = await fetch("/api/archive-reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, action, admin_note: adminNote }),
      });

      if (res.ok && action === "approve") {
        const item = items.find((i) => i.id === id);
        if (item?.suggested_value && item.codename) {
          const fieldMap: Record<string, string> = {
            wrong_name: "display_name",
            wrong_chipset: "chipset",
            wrong_codename: "codename",
          };
          const field = fieldMap[item.report_type];
          if (field) {
            // Device correction was the whole point of the archive report —
            // if it silently fails the admin thinks they applied the fix but
            // the device row never changed. Log the failure explicitly.
            await fetch("/api/admin/devices", {
              method: "PUT",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ codename: item.codename, [field]: item.suggested_value }),
            }).catch((err) => logger.error("admin.archiveReports.applyCorrection", err, {
              reportId: item.id, codename: item.codename, field,
            }));
          }
        }
      }

      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        setOpenNote(null);
        setAdminNote("");
      }
    } finally {
      setActing(null);
    }
  };

  const TYPE_LABELS: Record<string, string> = {
    wrong_codename: "كودنيم غلط",
    wrong_name: "اسم غلط",
    wrong_chipset: "معالج غلط",
    wrong_rom: "ROM في أرشيف غلط",
    duplicate: "أرشيف مكرر",
    missing_info: "معلومة ناقصة",
    other: "ملاحظة أخرى",
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Archive Correction Reports</h2>
          <p className="text-xs text-muted-foreground">بلاغات تصحيح أخطاء أرشيف الأجهزة من المستخدمين</p>
        </div>
        <div className="flex gap-1.5">
          {(["pending", "approved", "rejected", "all"] as const).map((s) => (
            <button key={s} onClick={() => { setFilter(s); hasLoadedRef.current = false; load(s); }}
              className={cn("rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                filter === s ? "border-[var(--primary)] text-[var(--primary)] bg-primary/10" : "border-border text-muted-foreground hover:text-foreground")}>
              {s === "pending" ? "معلقة" : s === "approved" ? "موافق" : s === "rejected" ? "مرفوض" : "الكل"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <CheckCircle className="h-10 w-10 text-emerald-400/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            {filter === "pending" ? "لا يوجد بلاغات معلقة" : "لا يوجد بلاغات"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-foreground">
                      {TYPE_LABELS[item.report_type] || item.report_type}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                      {item.codename}
                    </span>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                      item.status === "pending" ? "bg-amber-500/10 text-amber-400" :
                        item.status === "approved" ? "bg-emerald-500/10 text-emerald-400" :
                          "bg-destructive/10 text-destructive")}>
                      {item.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    من: {item.reporter_name || item.reporter_uid}
                    {item.created_at && <> · {new Date(
                      item.created_at._seconds
                        ? item.created_at._seconds * 1000
                        : item.created_at.seconds
                          ? item.created_at.seconds * 1000
                          : Date.now(),
                    ).toLocaleDateString("ar-EG")}</>}
                  </p>
                </div>
              </div>

              {(item.current_value || item.suggested_value) && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {item.current_value && (
                    <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2">
                      <p className="text-[10px] text-destructive mb-1 font-medium">الحالي (خاطئ)</p>
                      <p className="font-mono text-foreground">{item.current_value}</p>
                    </div>
                  )}
                  {item.suggested_value && (
                    <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2">
                      <p className="text-[10px] text-emerald-400 mb-1 font-medium">المقترح (صحيح)</p>
                      <p className="font-mono text-foreground">{item.suggested_value}</p>
                    </div>
                  )}
                </div>
              )}

              {item.note && (
                <p className="text-xs text-muted-foreground italic bg-muted/50 rounded-lg px-3 py-2">
                  &quot;{item.note}&quot;
                </p>
              )}

              {item.status === "pending" && (
                <div className="space-y-2">
                  {openNote === item.id ? (
                    <div className="space-y-2">
                      {item.suggested_value && item.report_type !== "duplicate" && item.report_type !== "wrong_rom" && (
                        <div className="rounded-lg border border-sky-500/25 bg-sky-500/8 px-3 py-2">
                          <p className="text-[10px] text-sky-400 font-bold mb-1.5">
                            تطبيق التصحيح مباشرةً على قاعدة البيانات
                          </p>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">
                              {item.report_type === "wrong_codename" ? "codename" :
                                item.report_type === "wrong_name" ? "اسم الجهاز" :
                                  item.report_type === "wrong_chipset" ? "المعالج" : "القيمة"}
                            </span>
                            <span className="text-rose-400 line-through">{item.current_value}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-emerald-400 font-bold">{item.suggested_value}</span>
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        <input value={adminNote} onChange={(e) => setAdminNote(e.target.value)}
                          placeholder="ملاحظة اختيارية..."
                          className="flex-1 min-w-0 h-8 rounded-lg border border-border bg-muted/50 px-2.5 text-xs text-foreground focus:outline-none" />
                        <button onClick={() => handleAction(item.id, "approve")}
                          disabled={!!acting}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60 hover:bg-emerald-400 transition-colors">
                          {acting === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                          موافقة {item.suggested_value ? "+ تطبيق" : ""}
                        </button>
                        <button onClick={() => handleAction(item.id, "reject")}
                          disabled={!!acting}
                          className="flex items-center gap-1.5 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-1.5 text-xs font-bold text-destructive disabled:opacity-60">
                          <XCircle className="h-3 w-3" /> رفض
                        </button>
                        <button onClick={() => { setOpenNote(null); setAdminNote(""); }}
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground">
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setOpenNote(item.id)}
                        className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors">
                        <Gavel className="h-3.5 w-3.5" /> مراجعة
                      </button>
                      <button onClick={() => handleAction(item.id, "reject")}
                        disabled={!!acting}
                        className="flex items-center gap-1.5 rounded-lg border border-destructive/20 px-3 py-1.5 text-xs text-destructive/70 hover:bg-destructive/8 transition-colors">
                        <XCircle className="h-3 w-3" /> رفض سريع
                      </button>
                      <a href={`/devices/${item.codename}`} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <ExternalLink className="h-3 w-3" /> الأرشيف
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
