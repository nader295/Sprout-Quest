"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { apiListCollections, apiCreateCollection, apiDeleteCollection } from "@/lib/api/client";
import type { Collection } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import Link from "next/link";
import {
  FolderPlus, Folder, Lock, Globe2, Trash2, Edit3, Plus, X,
  Loader2, Check, Package, ArrowRight,
} from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import PageHero from "@/components/shared/page-hero";

export default function CollectionsPage() {
  const { user, isLoggedIn } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPublic, setNewPublic] = useState(true);
  const [creating, setCreating] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    setLoading(true);
    apiListCollections()
      .then(setCollections)
      .catch(() => setCollections([]))
      .finally(() => setLoading(false));
  }, [user?.uid]);

  const handleCreate = async () => {
    if (!user?.uid || !newName.trim()) return;
    setCreating(true);
    try {
      const { id } = await apiCreateCollection({ name: newName.trim(), description: newDesc.trim(), isPublic: newPublic });
      setCollections((prev) => [{ id, ownerUid: user.uid, name: newName.trim(), description: newDesc.trim(), isPublic: newPublic, romIds: [], romCount: 0, createdAt: null, updatedAt: null }, ...prev]);
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("collections.deleteConfirm"))) return;
    await apiDeleteCollection(id);
    setCollections((prev) => prev.filter((c) => c.id !== id));
  };

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Folder className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-foreground font-medium">{t("collections.signInPrompt")}</p>
        <p className="text-sm text-muted-foreground mt-1">{t("collections.signInDesc")}</p>
        <Link href="/login" className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: "var(--primary)" }}>{t("auth.signIn")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
      <PageHero
        icon={Folder}
        accent="#a78bfa"
        title={t("collections.title")}
        description={t("collections.subtitle")}
        compact
        className="mb-5"
        actions={
          <button onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black text-white active:scale-95 transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg, #a78bfa, #7c3aed)", boxShadow: "0 4px 14px rgba(167,139,250,0.3)" }}>
            <FolderPlus className="h-4 w-4" /> {t("collections.newBtn")}
          </button>
        }
      />
      {showCreate && (
        <div className="mb-4 animate-scale-in rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold text-foreground mb-3">{t("collections.create")}</h3>
          <div className="flex flex-col gap-3">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("collections.namePlaceholder")}
              className="input-field" />
            <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t("collections.descPlaceholder")} rows={2}
              className="textarea-field" />
            <div className="flex items-center gap-3">
              <button onClick={() => setNewPublic(!newPublic)}
                className={cn("flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors",
                  newPublic ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : "border-border text-muted-foreground hover:text-foreground")}>
                {newPublic ? <><Globe2 className="h-3.5 w-3.5" /> {t("collections.public")}</> : <><Lock className="h-3.5 w-3.5" /> {t("collections.private")}</>}
              </button>
              <div className="flex-1" />
              <button onClick={() => setShowCreate(false)} className="rounded-xl border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">{t("collections.cancel")}</button>
              <button onClick={handleCreate} disabled={creating || !newName.trim()}
                className="flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50 active:scale-95 transition-transform"
                style={{ backgroundColor: "var(--primary)" }}>
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} {t("collections.create2")}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="mt-4">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Folder className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{t("collections.noCollections")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 stagger-children">
            {collections.map((c) => (
              <Link key={c.id} href={`/collections/${c.id}`}
                className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:border-[var(--primary)]/30 hover:shadow-sm">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "var(--primary-dim)" }}>
                  <Folder className="h-5 w-5" style={{ color: "var(--primary)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground truncate group-hover:text-[var(--primary)] transition-colors">{c.name}</p>
                    {!c.isPublic && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                  </div>
                  {c.description && <p className="text-xs text-muted-foreground line-clamp-1">{c.description}</p>}
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Package className="h-3 w-3" /> {c.romCount} items
                    {c.updatedAt && <span className="ms-1 opacity-60">· {timeAgo(c.updatedAt)}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(c.id); }}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <ArrowRight className="h-4 w-4 text-muted-foreground icon-dir group-hover:text-[var(--primary)] transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
