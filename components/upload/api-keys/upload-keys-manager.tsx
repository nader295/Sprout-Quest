"use client";

/**
 * Shared UI for adding / editing / deleting per-user upload provider API keys.
 *
 * Used in:
 *   - app/(main)/settings/page.tsx → wrapped in a SectionCard
 *   - components/upload/steps/step-links.tsx → opened inside a modal via
 *     <UploadKeysModal /> so the developer can swap an exhausted key without
 *     leaving the upload flow.
 */

import { useCallback, useEffect, useState } from "react";
import {
  apiListUploadKeys,
  apiCreateUploadKey,
  apiUpdateUploadKey,
  apiDeleteUploadKey,
  apiTestUploadKey,
  type UploadApiKey,
  type UploadProvider,
} from "@/lib/api/client";
import { cn } from "@/lib/utils";
import {
  Key,
  Plus,
  Trash2,
  Loader2,
  Check,
  AlertTriangle,
  ShieldCheck,
  Eye,
  EyeOff,
  Pencil,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

const PROVIDER_META: Record<UploadProvider, { label: string; help: string; helpUrl: string; accent: string }> = {
  pixeldrain: {
    label: "Pixeldrain",
    help: "Generate from pixeldrain.com → API Keys",
    helpUrl: "https://pixeldrain.com/user/api_keys",
    accent: "#22c55e",
  },
};

const STATUS_META: Record<UploadApiKey["status"], { label: string; tone: "ok" | "warn" | "bad" | "muted" }> = {
  active: { label: "Active", tone: "ok" },
  exhausted: { label: "Exhausted", tone: "warn" },
  invalid: { label: "Invalid", tone: "bad" },
  disabled: { label: "Disabled", tone: "muted" },
};

const TONE_CLASSES: Record<"ok" | "warn" | "bad" | "muted", string> = {
  ok: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  warn: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  bad: "bg-red-500/10 text-red-400 border-red-500/30",
  muted: "bg-muted text-muted-foreground border-border",
};

function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffMs = Date.now() - t;
  if (diffMs < 60_000) return "just now";
  const m = Math.floor(diffMs / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface Props {
  /** Restrict to a single provider (used in the upload modal). */
  provider?: UploadProvider;
  /** Compact spacing for the modal variant. */
  compact?: boolean;
  /** Notify the parent when keys change (so the upload step can refresh). */
  onChange?: () => void;
}

export function UploadKeysManager({ provider, compact = false, onChange }: Props) {
  const [keys, setKeys] = useState<UploadApiKey[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const items = await apiListUploadKeys(provider);
      setKeys(items);
    } catch (e) {
      setErr((e as Error).message || "Failed to load keys");
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Add form ────────────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false);
  const [addProvider, setAddProvider] = useState<UploadProvider>(provider || "pixeldrain");
  const [addKey, setAddKey] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [addReveal, setAddReveal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!addKey.trim()) {
      setAddError("Paste your API key first");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      await apiCreateUploadKey({
        provider: addProvider,
        key: addKey.trim(),
        label: addLabel.trim(),
      });
      setAddKey("");
      setAddLabel("");
      setShowAdd(false);
      await load();
      onChange?.();
    } catch (e) {
      setAddError((e as Error).message || "Failed to add key");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {err && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{err}</span>
          <button onClick={load} className="font-bold hover:underline">
            Retry
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : keys && keys.length > 0 ? (
        <ul className="space-y-2">
          {keys.map((k) => (
            <KeyRow key={k.id} k={k} onChanged={load} onAfterChange={onChange} />
          ))}
        </ul>
      ) : (
        !showAdd && (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
              <Key className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-bold text-foreground">No upload API keys yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add a Pixeldrain key to upload ROMs straight from the site.
            </p>
          </div>
        )
      )}

      {/* Add form */}
      {showAdd ? (
        <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
          {!provider && (
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PROVIDER_META) as UploadProvider[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAddProvider(p)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-bold transition-all",
                    addProvider === p
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {PROVIDER_META[p].label}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>API Key</span>
              <a
                href={PROVIDER_META[addProvider].helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 hover:underline"
              >
                {PROVIDER_META[addProvider].help}
                <ExternalLink className="h-3 w-3" />
              </a>
            </label>
            <div className="relative">
              <input
                type={addReveal ? "text" : "password"}
                value={addKey}
                onChange={(e) => setAddKey(e.target.value)}
                placeholder="Paste your Pixeldrain API key…"
                dir="ltr"
                spellCheck={false}
                autoComplete="off"
                className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2 pe-10 text-xs font-mono focus:border-emerald-500/40 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setAddReveal((v) => !v)}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                aria-label={addReveal ? "Hide key" : "Show key"}
              >
                {addReveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Label <span className="font-normal lowercase opacity-60">(optional)</span>
            </label>
            <input
              type="text"
              value={addLabel}
              maxLength={80}
              onChange={(e) => setAddLabel(e.target.value)}
              placeholder="e.g. Personal account"
              className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs focus:border-emerald-500/40 focus:outline-none"
            />
          </div>

          {addError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {addError}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={adding || !addKey.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2 text-xs font-black text-white transition-all hover:bg-emerald-600 disabled:opacity-50"
            >
              {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              <span>Save key</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setAddError(null);
              }}
              className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>

          <p className="flex items-start gap-2 text-[10px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 shrink-0 mt-0.5 text-emerald-400" />
            Keys are encrypted before being stored. We only ever show the last 4 characters back to you.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-emerald-500/40 py-2.5 text-xs font-black text-emerald-400 transition-all hover:bg-emerald-500/5 active:scale-[0.99]"
        >
          <Plus className="h-3.5 w-3.5" /> <span>Add a {PROVIDER_META[provider || "pixeldrain"].label} key</span>
        </button>
      )}
    </div>
  );
}

// ── Single key row ───────────────────────────────────────────────
function KeyRow({
  k,
  onChanged,
  onAfterChange,
}: {
  k: UploadApiKey;
  onChanged: () => Promise<void> | void;
  onAfterChange?: () => void;
}) {
  const meta = PROVIDER_META[k.provider as UploadProvider] || {
    label: k.provider,
    accent: "#1d9bf0",
  };
  const [busy, setBusy] = useState<"" | "test" | "delete" | "save" | "reactivate">("");
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(k.label);
  const [newKey, setNewKey] = useState("");
  const [reveal, setReveal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; reason: string | null } | null>(null);

  const status = STATUS_META[k.status];

  const test = async () => {
    setBusy("test");
    setTestResult(null);
    try {
      const r = await apiTestUploadKey(k.id);
      setTestResult(r);
      if (r.ok) {
        // Re-activate the key on the server when the user confirms it works
        await apiUpdateUploadKey({ id: k.id, status: "active" });
        await onChanged();
        onAfterChange?.();
      }
    } catch (e) {
      setTestResult({ ok: false, reason: (e as Error).message });
    } finally {
      setBusy("");
    }
  };

  const save = async () => {
    setBusy("save");
    try {
      await apiUpdateUploadKey({
        id: k.id,
        label,
        key: newKey.trim() || undefined,
      });
      setEditing(false);
      setNewKey("");
      await onChanged();
      onAfterChange?.();
    } finally {
      setBusy("");
    }
  };

  const remove = async () => {
    setBusy("delete");
    try {
      await apiDeleteUploadKey(k.id);
      await onChanged();
      onAfterChange?.();
    } finally {
      setBusy("");
    }
  };

  return (
    <li className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${meta.accent}1a`, color: meta.accent }}
        >
          <Key className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-foreground truncate">
              {k.label || meta.label}
            </p>
            <span
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider",
                TONE_CLASSES[status.tone],
              )}
            >
              {status.label}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono truncate" dir="ltr">
            {meta.label.toLowerCase()} · ••••{k.fingerprint || "????"} · {k.uploadsCount} uploads · {formatBytes(k.bytesUploaded)} · {formatRelative(k.lastUsedAt)}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={test}
            disabled={busy !== ""}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-emerald-400 hover:border-emerald-500/40 transition-colors disabled:opacity-50"
            aria-label="Test key"
            title="Test key"
          >
            {busy === "test" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            disabled={busy !== ""}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-50"
            aria-label="Edit"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={busy !== ""}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/40 transition-colors disabled:opacity-50"
            aria-label="Delete"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {testResult && (
        <div
          className={cn(
            "px-3 py-2 text-[11px] font-medium border-t",
            testResult.ok
              ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
              : "border-red-500/20 bg-red-500/5 text-red-400",
          )}
        >
          {testResult.ok ? (
            <span className="flex items-center gap-1.5">
              <Check className="h-3 w-3" /> <span>Key accepted by {meta.label}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" /> <span>{testResult.reason || "Key rejected"}</span>
            </span>
          )}
        </div>
      )}

      {(k.status === "exhausted" || k.status === "invalid") && k.exhaustedReason && !testResult && (
        <div className="px-3 py-2 text-[11px] border-t border-amber-500/20 bg-amber-500/5 text-amber-400 flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span className="flex-1">{k.exhaustedReason}</span>
          <span className="opacity-60">{formatRelative(k.exhaustedAt)}</span>
        </div>
      )}

      {editing && (
        <div className="border-t border-border bg-muted/10 px-3 py-3 space-y-2">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Label
            </label>
            <input
              type="text"
              value={label}
              maxLength={80}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:border-emerald-500/40 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Replace key <span className="font-normal lowercase opacity-60">(leave empty to keep current)</span>
            </label>
            <div className="relative">
              <input
                type={reveal ? "text" : "password"}
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="Paste a new key to replace this one…"
                dir="ltr"
                spellCheck={false}
                autoComplete="off"
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 pe-9 text-xs font-mono focus:border-emerald-500/40 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                className="absolute end-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
                aria-label={reveal ? "Hide" : "Show"}
              >
                {reveal ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy === "save"}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-1.5 text-xs font-black text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {busy === "save" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setNewKey("");
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="border-t border-red-500/20 bg-red-500/5 px-3 py-2.5 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
          <span className="flex-1 text-[11px] text-red-400 font-medium">Delete this key permanently?</span>
          <button
            type="button"
            onClick={remove}
            disabled={busy === "delete"}
            className="rounded-md bg-red-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-600 disabled:opacity-50 flex items-center justify-center min-w-[70px]"
          >
            {busy === "delete" ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>Delete</span>}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="rounded-md border border-border px-2 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}
    </li>
  );
}
