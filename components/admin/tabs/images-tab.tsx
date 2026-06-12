"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";

interface DeviceImageRow {
  codename: string;
  display_name: string;
  brand: string;
  image_url: string | null;
  image_source: string | null;
}

export function ImagesTab() {
  const [devices, setDevices] = useState<DeviceImageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "missing" | "has_image">("all");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ cn: string; text: string; ok: boolean } | null>(null);
  const hasLoaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/devices?limit=500", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = (await res.json()) as { items?: DeviceImageRow[] };
      setDevices(d.items || []);
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    load();
  }, [load]);

  const shown = (devices || []).filter((d) => {
    if (filter === "missing" && d.image_url) return false;
    if (filter === "has_image" && !d.image_url) return false;
    if (search) {
      const q = search.toLowerCase();
      return d.codename.includes(q) || (d.display_name || "").toLowerCase().includes(q) || (d.brand || "").toLowerCase().includes(q);
    }
    return true;
  });

  const missing = (devices || []).filter((d) => !d.image_url).length;
  const hasImage = (devices || []).filter((d) => !!d.image_url).length;

  async function handleUpload(codename: string, url: string) {
    if (!url.trim()) return;
    setUploading(codename);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ codename, image_url: url.trim(), image_source: "admin_manual" }),
      });
      if (res.ok) {
        setDevices((prev) => prev.map((d) => d.codename === codename ? { ...d, image_url: url.trim(), image_source: "admin_manual" } : d));
        setPreviewUrl((p) => ({ ...p, [codename]: "" }));
        setMsg({ cn: codename, text: "تم الحفظ", ok: true });
      } else {
        setMsg({ cn: codename, text: "فشل الحفظ", ok: false });
      }
    } catch {
      setMsg({ cn: codename, text: "خطأ", ok: false });
    } finally {
      setUploading(null);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  async function handleClear(codename: string) {
    setUploading(codename);
    try {
      const token = await auth.currentUser?.getIdToken();
      await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ codename, image_url: null, image_source: null }),
      });
      setDevices((prev) => prev.map((d) => d.codename === codename ? { ...d, image_url: null, image_source: null } : d));
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "إجمالي الأجهزة", value: devices.length, color: "text-foreground" },
          { label: "عندهم صورة", value: hasImage, color: "text-emerald-400" },
          { label: "بدون صورة", value: missing, color: "text-amber-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3 text-center">
            <p className={cn("text-2xl font-black", s.color)}>{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بـ codename أو اسم أو brand..."
          className="flex-1 h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:outline-none"
        />
        <div className="flex gap-1.5">
          {(["all", "missing", "has_image"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all",
                filter === f ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-foreground/30")}>
              {f === "all" ? "الكل" : f === "missing" ? "بدون صورة" : "عندهم صورة"}
            </button>
          ))}
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground">
          <RefreshCw className="h-3.5 w-3.5" /> تحديث
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2.5 text-start text-xs font-semibold text-muted-foreground">الجهاز</th>
                <th className="px-3 py-2.5 text-start text-xs font-semibold text-muted-foreground hidden sm:table-cell">Brand</th>
                <th className="px-3 py-2.5 text-start text-xs font-semibold text-muted-foreground">الصورة الحالية</th>
                <th className="px-3 py-2.5 text-start text-xs font-semibold text-muted-foreground">رفع URL</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, 100).map((d) => (
                <tr key={d.codename} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground text-xs">{d.display_name || d.codename}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{d.codename}</p>
                  </td>
                  <td className="px-3 py-2.5 hidden sm:table-cell">
                    <span className="text-xs text-muted-foreground">{d.brand}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    {d.image_url ? (
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={d.image_url} alt={d.codename} className="h-10 w-8 object-contain rounded border border-border bg-card" />
                        <div>
                          <span className="text-[10px] text-emerald-400 font-medium">موجودة</span>
                          <p className="text-[9px] text-muted-foreground">{d.image_source || "unknown"}</p>
                        </div>
                        <button onClick={() => handleClear(d.codename)}
                          disabled={uploading === d.codename}
                          className="ms-auto text-[10px] text-destructive hover:underline disabled:opacity-50">
                          حذف
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-amber-400">مفيش صورة</span>
                    )}
                    {msg?.cn === d.codename && (
                      <p className={cn("text-[10px] mt-0.5 font-semibold", msg.ok ? "text-emerald-400" : "text-destructive")}>
                        {msg.text}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        value={previewUrl[d.codename] || ""}
                        onChange={(e) => setPreviewUrl((p) => ({ ...p, [d.codename]: e.target.value }))}
                        placeholder="https://..."
                        className="h-7 w-36 sm:w-48 rounded-lg border border-border bg-card px-2 text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                      <button
                        onClick={() => handleUpload(d.codename, previewUrl[d.codename] || "")}
                        disabled={!previewUrl[d.codename] || uploading === d.codename}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-white text-xs font-semibold disabled:opacity-40">
                        {uploading === d.codename ? <Loader2 className="h-3 w-3 animate-spin" /> : "حفظ"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length > 100 && (
            <p className="text-center text-xs text-muted-foreground py-3">
              يعرض 100 من {shown.length} — استخدم البحث للتضييق
            </p>
          )}
          {shown.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-8">لا توجد نتائج</p>
          )}
        </div>
      )}
    </div>
  );
}
