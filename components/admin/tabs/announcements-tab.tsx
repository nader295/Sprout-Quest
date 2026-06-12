"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2, Plus, X, Check, Megaphone, ExternalLink as ExternalLinkIcon,
  Settings2, TrendingUp, Trash2,
} from "lucide-react";
import { auth } from "@/lib/firebase/client";
import type { Announcement } from "@/lib/types";
import { fmtDate, cn } from "@/lib/utils";

export function AnnouncementsTab() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", body: "", link: "", pinned: false });
  const [saving, setSaving] = useState(false);

  const getToken = async () => auth.currentUser?.getIdToken();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin?action=listAnnouncements", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setAnnouncements(data.items || []);
    } catch {
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ title: "", body: "", link: "", pinned: false });
    setShowForm(true);
  };
  const openEdit = (a: Announcement) => {
    setEditingId(a.id);
    setForm({ title: a.title, body: a.body, link: (a as any).link || "", pinned: a.pinned });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    setSaving(true);
    try {
      const token = await getToken();
      if (editingId) {
        await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: "updateAnnouncement", id: editingId, title: form.title.trim(), body: form.body.trim(), link: form.link.trim() || null, pinned: form.pinned }),
        });
        setAnnouncements((prev) => prev.map((a) => a.id === editingId ? { ...a, ...form, link: form.link.trim() || undefined } : a));
      } else {
        await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: "createAnnouncement", title: form.title.trim(), body: form.body.trim(), link: form.link.trim() || null, pinned: form.pinned }),
        });
        await load();
      }
      setShowForm(false);
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePin = async (id: string, pinned: boolean) => {
    const token = await getToken();
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "togglePinAnnouncement", id, pinned }),
    });
    setAnnouncements((prev) => prev.map((a) => a.id === id ? { ...a, pinned: !pinned } : a));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    const token = await getToken();
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "deleteAnnouncement", id }),
    });
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">{announcements.length} announcements</p>
        <button onClick={openCreate} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: "var(--primary)" }}>
          <Plus className="h-4 w-4" /> New
        </button>
      </div>

      {showForm && (
        <div className="mb-4 rounded-xl border border-[var(--primary)]/30 bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">{editingId ? "Edit Announcement" : "New Announcement"}</h3>
            <button onClick={() => setShowForm(false)} className="rounded-lg p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex flex-col gap-3">
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Title *" className="h-9 rounded-lg border border-border bg-muted/50 px-3 text-sm text-foreground focus:outline-none focus:border-[var(--primary)]" />
            <textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} placeholder="Message body *" rows={4} className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:border-[var(--primary)]" />
            <input value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} placeholder="Link (optional)" className="h-9 rounded-lg border border-border bg-muted/50 px-3 text-sm text-foreground focus:outline-none focus:border-[var(--primary)]" />
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div onClick={() => setForm((f) => ({ ...f, pinned: !f.pinned }))} className={cn("relative h-5 w-9 rounded-full transition-colors", form.pinned ? "bg-[var(--primary)]" : "bg-muted")}>
                <span className={cn("absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow-sm", form.pinned && "translate-x-4")} />
              </div>
              <span className="text-sm text-muted-foreground">Pin announcement</span>
            </label>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-border px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.title.trim() || !form.body.trim()} className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "var(--primary)" }}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {editingId ? "Save Changes" : "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {announcements.length === 0 ? (
        <div className="text-center py-16">
          <Megaphone className="mx-auto h-10 w-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-foreground font-medium">No announcements</p>
          <p className="text-xs text-muted-foreground mt-1">Create your first announcement.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {announcements.map((a) => (
            <div key={a.id} className={cn("rounded-xl border bg-card p-3", a.pinned ? "border-[var(--primary)]/40 bg-primary/5" : "border-border")}>
              <div className="flex items-start gap-3">
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", a.pinned ? "text-[var(--primary)] bg-primary-dim" : "text-muted-foreground bg-muted")}>
                  <Megaphone className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-semibold text-foreground">{a.title}</span>
                    {a.pinned && <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold text-[var(--primary)] bg-primary-dim">PINNED</span>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{a.body}</p>
                  {(a as any).link && <a href={(a as any).link} target="_blank" rel="noopener noreferrer" className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--primary)] hover:underline"><ExternalLinkIcon className="h-3 w-3" /> {(a as any).link}</a>}
                  <p className="mt-1 text-[10px] text-muted-foreground">{fmtDate(a.createdAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => openEdit(a)} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Edit"><Settings2 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleTogglePin(a.id, a.pinned)} className={cn("rounded-lg p-1.5 transition-colors", a.pinned ? "text-[var(--primary)]" : "text-muted-foreground hover:text-foreground")} title={a.pinned ? "Unpin" : "Pin"}><TrendingUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete(a.id)} className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive transition-colors" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
