"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Loader2, RefreshCw, Smartphone, Settings2, Trash2, Download, Plus, Check,
} from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";

interface DeviceRow {
  codename: string;
  display_name: string;
  brand: string;
  chipset: string;
  released: string;
  image_url: string | null;
}
interface OrphanRow {
  device_codename: string;
  display_name: string;
  brand: string;
  rom_count: number;
}

export function DevicesTab() {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [orphans, setOrphans] = useState<OrphanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [activeTab, setActiveTab] = useState<"list" | "add" | "orphans" | "import">("list");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; total: number; errors: string[] } | null>(null);
  const hasLoaded = useRef(false);

  async function authHeaders(): Promise<Record<string, string>> {
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      if (!token) return {};
      return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    } catch {
      return {};
    }
  }

  const emptyForm = { codename: "", display_name: "", brand: "", chipset: "", released: "", image_url: "", aliases: "", variant_words: "" };
  const [form, setForm] = useState(emptyForm);
  const [editMode, setEditMode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const hdrs = await authHeaders();
      const [devRes, orphRes] = await Promise.all([
        fetch("/api/admin/devices", { headers: hdrs }).then((r) => r.json()),
        fetch("/api/admin/devices?view=orphans", { headers: hdrs }).then((r) => r.json()),
      ]);
      setDevices(devRes.items ?? []);
      setOrphans(orphRes.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      load();
    }
  }, [load]);

  const filtered = devices.filter((d) =>
    !searchQ || d.codename.includes(searchQ.toLowerCase()) ||
    d.display_name.toLowerCase().includes(searchQ.toLowerCase()) ||
    d.brand.toLowerCase().includes(searchQ.toLowerCase())
  );

  const handleSave = async () => {
    if (!form.codename || !form.display_name || !form.brand) {
      setMsg("codename, display_name, brand مطلوبين");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const body = {
        ...form,
        aliases: form.aliases.split(",").map((s) => s.trim()).filter(Boolean),
        variant_words: form.variant_words.split(",").map((s) => s.trim()).filter(Boolean),
        image_url: form.image_url || null,
      };
      const hdrs = await authHeaders();
      const res = await fetch("/api/admin/devices", {
        method: editMode ? "PUT" : "POST",
        headers: hdrs,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg("خطأ: " + data.error);
        return;
      }
      const autoImg = data.imageAutoFetched ? " — تم جلب الصورة تلقائياً" : "";
      setMsg(`تم ${editMode ? "التعديل" : "الإضافة"}${autoImg}`);
      setForm(emptyForm);
      setEditMode(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (codename: string) => {
    if (!confirm(`حذف جهاز "${codename}"؟`)) return;
    const hdrs = await authHeaders();
    await fetch(`/api/admin/devices?codename=${codename}`, { method: "DELETE", headers: hdrs });
    load();
  };

  const handleRefetchImage = async (d: DeviceRow) => {
    const hdrs = await authHeaders();
    await fetch("/api/admin/devices", {
      method: "PUT",
      headers: hdrs,
      body: JSON.stringify({ codename: d.codename, display_name: d.display_name, brand: d.brand, refetchImage: true }),
    });
    load();
  };

  const handleImportOrphan = (o: OrphanRow) => {
    setForm({ codename: o.device_codename, display_name: o.display_name, brand: o.brand, chipset: "", released: "", image_url: "", aliases: "", variant_words: "" });
    setActiveTab("add");
    setEditMode(null);
  };

  const startEdit = (d: DeviceRow) => {
    setForm({ codename: d.codename, display_name: d.display_name, brand: d.brand, chipset: d.chipset, released: d.released, image_url: d.image_url ?? "", aliases: "", variant_words: "" });
    setEditMode(d.codename);
    setActiveTab("add");
  };

  const handleAutoImport = async () => {
    if (!confirm("سيتم جلب أجهزة من LineageOS و Certified Android Dataset\nهذا قد يستغرق دقيقة. هل تريد المتابعة؟")) return;
    setImporting(true);
    setImportResult(null);
    setMsg("");
    try {
      const hdrs = await authHeaders();
      const res = await fetch("/api/admin/backfill-devices", {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({ sources: ["lineageos", "certified"], limit: 500, skipExisting: true }),
      });
      const data = await res.json();
      setImportResult(data);
      setMsg(data.message || `تم إضافة ${data.added} جهاز جديد`);
      load();
    } catch (e) {
      setMsg("فشل الاستيراد: " + e);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        {([["list", "الأجهزة"], ["orphans", "بدون Entry"], ["add", editMode ? "تعديل" : "إضافة جديد"], ["import", "استيراد تلقائي"]] as [string, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id as "list" | "orphans" | "add" | "import")}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              activeTab === id ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground")}>
            {label}
            {id === "orphans" && orphans.length > 0 && (
              <span className="ms-1.5 bg-amber-500/20 text-amber-400 text-[10px] px-1 rounded">{orphans.length}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "list" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="ابحث بالاسم أو كودنيم..."
              className="flex-1 h-9 rounded-lg border border-border bg-muted/50 px-3 text-sm text-foreground focus:outline-none" />
            <button onClick={load} className="h-9 px-3 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{filtered.length} جهاز في قاعدة البيانات</p>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((d) => (
                <div key={d.codename} className="rounded-xl border border-border bg-card p-3 flex gap-3">
                  <div className="w-14 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {d.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.image_url} alt={d.display_name} className="h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <Smartphone className="h-6 w-6 text-muted-foreground/40" strokeWidth={1} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <p className="text-xs font-mono text-muted-foreground">{d.codename}</p>
                        <p className="text-sm font-semibold text-foreground truncate">{d.display_name}</p>
                        <p className="text-[10px] text-muted-foreground">{d.brand} · {d.released}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => startEdit(d)} className="h-6 w-6 flex items-center justify-center rounded bg-muted hover:bg-primary/20 transition-colors">
                          <Settings2 className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button onClick={() => handleRefetchImage(d)} title="إعادة جلب الصورة" className="h-6 w-6 flex items-center justify-center rounded bg-muted hover:bg-blue-500/20 transition-colors">
                          <RefreshCw className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button onClick={() => handleDelete(d.codename)} className="h-6 w-6 flex items-center justify-center rounded bg-muted hover:bg-destructive/20 transition-colors">
                          <Trash2 className="h-3 w-3 text-destructive/60" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "import" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">استيراد تلقائي من المصادر المفتوحة</p>
                <p className="text-xs text-muted-foreground">LineageOS · Certified Android · TWRP</p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1 border border-border/50 rounded-lg p-3 bg-muted/30">
              <p>يجلب أجهزة جديدة تلقائياً من GitHub</p>
              <p>يضيف بس الأجهزة غير الموجودة (skipExisting)</p>
              <p>يولّد aliases + variant_words تلقائياً</p>
              <p>لا يمسح أو يعدّل الأجهزة الموجودة</p>
            </div>
            <button
              onClick={handleAutoImport}
              disabled={importing}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--primary)" }}
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {importing ? "جاري الاستيراد..." : "ابدأ الاستيراد"}
            </button>
          </div>

          {msg && (
            <div className={cn("rounded-xl border p-3 text-sm font-medium",
              msg.startsWith("خطأ") || msg.startsWith("فشل")
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : "border-emerald-500/30 bg-emerald-500/5 text-emerald-400")}>
              {msg}
            </div>
          )}

          {importResult && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-sm font-bold text-foreground">نتيجة الاستيراد</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "تم جلبهم", value: importResult.total, color: "text-blue-400" },
                  { label: "مضافين جدد", value: importResult.added, color: "text-emerald-400" },
                  { label: "أخطاء", value: importResult.errors?.length || 0, color: "text-amber-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg border border-border bg-muted/30 p-2.5 text-center">
                    <p className={cn("text-xl font-black", color)}>{value}</p>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              {importResult.errors?.length > 0 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
                  <p className="text-[11px] text-amber-400 font-medium mb-1">تفاصيل الأخطاء:</p>
                  {importResult.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-[10px] text-muted-foreground font-mono">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "orphans" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">هذه الأجهزة فيها ROMs لكن مش موجودة في devices DB — انقر &quot;إضافة&quot; لإنشاء entry ليها.</p>
          {orphans.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">كل الأجهزة لديها entries في DB</div>
          ) : (
            <div className="space-y-2">
              {orphans.map((o) => (
                <div key={o.device_codename} className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                  <div>
                    <span className="font-mono text-xs text-amber-400">{o.device_codename}</span>
                    <span className="ms-2 text-sm text-foreground">{o.display_name}</span>
                    <span className="ms-2 text-xs text-muted-foreground">{o.brand} · {o.rom_count} ROMs</span>
                  </div>
                  <button onClick={() => handleImportOrphan(o)}
                    className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors">
                    <Plus className="h-3 w-3" /> إضافة
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "add" && (
        <div className="space-y-3 max-w-lg">
          <h3 className="text-sm font-semibold text-foreground">{editMode ? `تعديل: ${editMode}` : "إضافة جهاز جديد"}</h3>
          {[
            { key: "codename", label: "Codename *", placeholder: "rodin", mono: true, disabled: !!editMode },
            { key: "display_name", label: "الاسم *", placeholder: "Poco X7 Pro" },
            { key: "brand", label: "Brand *", placeholder: "Xiaomi" },
            { key: "chipset", label: "Chipset", placeholder: "Dimensity 8400-Ultra" },
            { key: "released", label: "Released", placeholder: "2025" },
            { key: "image_url", label: "Image URL", placeholder: "https://... (اتركه فاضي للجلب التلقائي)" },
            { key: "aliases", label: "Aliases", placeholder: "pocox7pro, poco x7 pro, x7 pro poco" },
            { key: "variant_words", label: "Variant Words", placeholder: "x7, pro" },
          ].map(({ key, label, placeholder, mono, disabled }) => (
            <div key={key}>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
              <input
                value={(form as Record<string, string>)[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                disabled={disabled}
                className={cn("w-full h-9 rounded-lg border border-border bg-muted/50 px-3 text-sm text-foreground focus:outline-none focus:border-primary",
                  mono && "font-mono", disabled && "opacity-50 cursor-not-allowed")}
              />
            </div>
          ))}
          {msg && <p className={cn("text-sm", msg.startsWith("تم") ? "text-emerald-400" : "text-destructive")}>{msg}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {editMode ? "حفظ التعديل" : "إضافة"}
            </button>
            <button onClick={() => { setForm(emptyForm); setEditMode(null); setActiveTab("list"); }}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              إلغاء
            </button>
          </div>
          {!form.image_url && (
            <p className="text-[10px] text-muted-foreground">اتركت Image URL فاضي؟ النظام هيحاول يجيب الصورة من GSMArena تلقائياً</p>
          )}
        </div>
      )}
    </div>
  );
}
