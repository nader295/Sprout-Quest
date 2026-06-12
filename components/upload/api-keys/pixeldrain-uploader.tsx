"use client";

/**
 * Pixeldrain in-page uploader.
 *
 * Lets the developer pick a file and upload it directly from their browser
 * using one of their stored API keys. On success, the resulting public URL
 * is sent back via `onUploaded(url, fileName, sizeLabel)` so the caller
 * (step-links) can drop it into the form's downloadUrl/size fields.
 *
 * Two modes:
 *   - "direct" (default for files > 4 MB): browser ↔ Pixeldrain via signed
 *     ticket. Fastest, doesn't touch our server, supports XHR progress.
 *   - "proxy"  (for tiny files): server proxies the upload, useful when the
 *     browser network is restrictive. Hard cap ~4 MB (Vercel body limit).
 *
 * Auto-rotation: if a key fails (402/429/etc.) the server marks it
 * exhausted and the user is shown a banner with "Manage keys" so they can
 * paste a fresh one without leaving the page.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiPixeldrainTicket,
  apiPixeldrainComplete,
  apiListUploadKeys,
  type UploadApiKey,
} from "@/lib/api/client";
import { UploadKeysManager } from "./upload-keys-manager";
import { cn } from "@/lib/utils";
import {
  CloudUpload,
  Loader2,
  KeyRound,
  Check,
  AlertTriangle,
  X,
  Settings as SettingsIcon,
  Link2,
  Server,
  Zap,
} from "lucide-react";

const PIXELDRAIN_GREEN = "#22c55e";
const PROXY_LIMIT_BYTES = 4 * 1024 * 1024;

interface Props {
  /** Called when an upload completes — caller stores url + size into form. */
  onUploaded: (info: { url: string; fileName: string; fileSize: number; sizeLabel: string }) => void;
  /** Called when the developer wants the full Settings page instead. */
  onOpenSettings?: () => void;
}

type Mode = "direct" | "proxy";

interface UploadState {
  status: "idle" | "preparing" | "uploading" | "completing" | "done" | "error";
  progress: number; // 0..100
  message: string;
  fileName?: string;
  fileSize?: number;
  url?: string;
  error?: string;
  rotated?: boolean; // server auto-rotated to a different key
}

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

function bytesToSizeLabel(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(0)} MB`;
  return `${(n / 1024).toFixed(0)} KB`;
}

export function PixeldrainUploader({ onUploaded, onOpenSettings }: Props) {
  const [keys, setKeys] = useState<UploadApiKey[] | null>(null);
  const [keysLoading, setKeysLoading] = useState(true);
  const [keysOpen, setKeysOpen] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>("direct");
  const [state, setState] = useState<UploadState>({ status: "idle", progress: 0, message: "" });
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refreshKeys = useCallback(async () => {
    setKeysLoading(true);
    try {
      const items = await apiListUploadKeys("pixeldrain");
      setKeys(items);
    } catch {
      setKeys([]);
    } finally {
      setKeysLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshKeys();
  }, [refreshKeys]);

  const activeKeys = (keys || []).filter((k) => k.status === "active");
  const hasAnyKey = (keys?.length || 0) > 0;
  const hasActiveKey = activeKeys.length > 0;

  // Auto-pick safer mode based on file size
  useEffect(() => {
    if (!file) return;
    if (file.size > PROXY_LIMIT_BYTES && mode === "proxy") setMode("direct");
  }, [file, mode]);

  const reset = () => {
    setFile(null);
    setState({ status: "idle", progress: 0, message: "" });
    xhrRef.current?.abort();
    abortRef.current?.abort();
  };

  const cancel = () => {
    xhrRef.current?.abort();
    abortRef.current?.abort();
    setState({ status: "idle", progress: 0, message: "Upload cancelled" });
  };

  // ── Direct upload via XHR (browser → Pixeldrain) ─────────────
  const startDirect = async (f: File) => {
    setState({ status: "preparing", progress: 0, message: "Requesting upload ticket…", fileName: f.name, fileSize: f.size });
    let ticket: Awaited<ReturnType<typeof apiPixeldrainTicket>>;
    try {
      ticket = await apiPixeldrainTicket(f.name, f.size);
    } catch (e) {
      setState({ status: "error", progress: 0, message: "", error: (e as Error).message });
      return;
    }
    if (!ticket.ok) {
      setState({ status: "error", progress: 0, message: "", error: ticket.error });
      return;
    }

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("PUT", ticket.uploadUrl, true);
    xhr.setRequestHeader("Authorization", ticket.authHeader);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        const pct = Math.round((ev.loaded / ev.total) * 100);
        setState((s) => ({ ...s, status: "uploading", progress: pct, message: `Uploading… ${pct}%` }));
      }
    };
    xhr.onerror = async () => {
      // Network-level failure — tell the server, attempt rotation server-side.
      const r = await apiPixeldrainComplete({
        ticket: ticket.ticket,
        success: false,
        errorStatus: 0,
        errorBody: "Network error",
      }).catch(() => null);
      setState({
        status: "error",
        progress: 0,
        message: "",
        error: "Network error during upload — please retry.",
        rotated: !!r?.rotated,
      });
    };
    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setState((s) => ({ ...s, status: "completing", message: "Finalising…" }));
        try {
          const json = JSON.parse(xhr.responseText) as { id?: string };
          if (!json.id) throw new Error("Pixeldrain returned no file id");
          const r = await apiPixeldrainComplete({
            ticket: ticket.ticket,
            success: true,
            fileId: json.id,
          });
          if (r.ok && r.url) {
            setState({ status: "done", progress: 100, message: "Upload complete", fileName: f.name, fileSize: f.size, url: r.url });
            onUploaded({ url: r.url, fileName: f.name, fileSize: f.size, sizeLabel: bytesToSizeLabel(f.size) });
          } else {
            throw new Error("Server rejected the completion");
          }
        } catch (e) {
          setState({ status: "error", progress: 0, message: "", error: (e as Error).message });
        }
      } else {
        // Provider-level failure — server classifies and may rotate
        const r = await apiPixeldrainComplete({
          ticket: ticket.ticket,
          success: false,
          errorStatus: xhr.status,
          errorBody: xhr.responseText?.slice(0, 400) || "",
        }).catch(() => null);
        const rotated = !!r?.rotated;
        const reason = r?.reason || `Pixeldrain returned HTTP ${xhr.status}`;
        setState({
          status: "error",
          progress: 0,
          message: "",
          error: rotated
            ? `${reason}. Rotated to your next active key — click "Try again".`
            : reason,
          rotated,
        });
        // Refresh the key list so the user sees the new statuses
        refreshKeys();
      }
    };

    setState((s) => ({ ...s, status: "uploading", progress: 0, message: "Uploading…" }));
    xhr.send(f);
  };

  // ── Server proxy upload (tiny files only) ────────────────────
  const startProxy = async (f: File) => {
    setState({ status: "preparing", progress: 0, message: "Sending file to server…", fileName: f.name, fileSize: f.size });
    const fd = new FormData();
    fd.append("file", f, f.name);

    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/upload/pixeldrain", {
        method: "POST",
        body: fd,
        signal: ac.signal,
      });
      const json = await res.json();
      if (json?.ok && json.url) {
        setState({
          status: "done",
          progress: 100,
          message: "Upload complete",
          fileName: f.name,
          fileSize: f.size,
          url: json.url,
        });
        onUploaded({ url: json.url, fileName: f.name, fileSize: f.size, sizeLabel: bytesToSizeLabel(f.size) });
      } else {
        setState({
          status: "error",
          progress: 0,
          message: "",
          error: json?.error || "Pixeldrain rejected the upload.",
        });
      }
    } catch (e) {
      const err = e as Error;
      setState({
        status: "error",
        progress: 0,
        message: "",
        error: err.name === "AbortError" ? "Upload cancelled" : err.message,
      });
    } finally {
      refreshKeys();
    }
  };

  const handlePick = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setState({ status: "idle", progress: 0, message: "" });
  };

  const start = () => {
    if (!file) return;
    if (mode === "direct") return startDirect(file);
    return startProxy(file);
  };

  const isBusy = state.status === "preparing" || state.status === "uploading" || state.status === "completing";

  // ── Empty state — no keys at all ─────────────────────────────
  if (!keysLoading && !hasAnyKey) {
    return (
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: `${PIXELDRAIN_GREEN}30`, backgroundColor: `${PIXELDRAIN_GREEN}05` }}>
        <UploaderHeader />
        <div className="p-4 space-y-3">
          <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-5 text-center">
            <KeyRound className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
            <p className="text-sm font-bold text-foreground">Add a Pixeldrain API key first</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              You upload with your own key — when it runs out you replace it instantly.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setKeysOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-black text-white hover:bg-emerald-600 transition-colors"
          >
            <KeyRound className="h-4 w-4" /> Add Pixeldrain key
          </button>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex w-full items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Or manage everything in <span className="underline">Settings</span>
            </button>
          )}
        </div>
        {keysOpen && <KeysModal onClose={() => { setKeysOpen(false); refreshKeys(); }} />}
      </div>
    );
  }

  // ── No active key (all exhausted/invalid) ────────────────────
  const allBlocked = !keysLoading && hasAnyKey && !hasActiveKey;

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: `${PIXELDRAIN_GREEN}30`, backgroundColor: `${PIXELDRAIN_GREEN}05` }}
    >
      <UploaderHeader
        right={
          <button
            type="button"
            onClick={() => setKeysOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/15"
          >
            <KeyRound className="h-3 w-3" />
            <span>{keys?.length || 0} key{(keys?.length || 0) === 1 ? "" : "s"}</span>
          </button>
        }
      />

      <div className="p-4 space-y-3">
        {allBlocked && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <div className="flex-1 text-[11px]">
              <p className="font-bold text-amber-400">All your keys are exhausted</p>
              <p className="text-amber-400/80 mt-0.5">Add or replace a key to keep uploading.</p>
            </div>
            <button
              type="button"
              onClick={() => setKeysOpen(true)}
              className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-600"
            >
              Manage
            </button>
          </div>
        )}

        {/* File picker */}
        {!file ? (
          <FilePickerDrop onPick={handlePick} disabled={!hasActiveKey || isBusy} />
        ) : (
          <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                <CloudUpload className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-bold text-foreground" dir="ltr">
                  {file.name}
                </p>
                <p className="text-[11px] text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
              {!isBusy && (
                <button
                  type="button"
                  onClick={reset}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/30"
                  aria-label="Remove file"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Mode toggle (hidden once upload starts) */}
            {state.status === "idle" && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("direct")}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-xl border-2 px-3 py-2 text-start transition-all",
                    mode === "direct"
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : "border-border hover:border-border",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-xs font-black">
                    <Zap className="h-3 w-3 text-emerald-400" /> Direct
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Browser → Pixeldrain. Best for ROMs.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("proxy")}
                  disabled={file.size > PROXY_LIMIT_BYTES}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-xl border-2 px-3 py-2 text-start transition-all disabled:opacity-40 disabled:cursor-not-allowed",
                    mode === "proxy"
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : "border-border hover:border-border",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-xs font-black">
                    <Server className="h-3 w-3 text-muted-foreground" /> Proxy
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Server upload. ≤ {formatBytes(PROXY_LIMIT_BYTES)} only.
                  </span>
                </button>
              </div>
            )}

            {/* Progress bar */}
            {state.status !== "idle" && state.status !== "error" && (
              <div className="space-y-1.5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-[width] duration-200"
                    style={{ width: `${state.progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-emerald-400" />}
                    {state.message}
                  </span>
                  <span className="font-mono">{state.progress}%</span>
                </div>
              </div>
            )}

            {/* Error */}
            {state.status === "error" && state.error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                  <p className="flex-1 text-[11px] text-red-400">{state.error}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={start}
                    className="flex-1 rounded-lg bg-red-500 py-1.5 text-[11px] font-bold text-white hover:bg-red-600"
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={() => setKeysOpen(true)}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground"
                  >
                    <KeyRound className="h-3 w-3 inline mr-1" />
                    Manage keys
                  </button>
                </div>
              </div>
            )}

            {/* Done */}
            {state.status === "done" && state.url && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Check className="h-4 w-4 text-emerald-400" />
                  <p className="text-[11px] font-bold text-emerald-400">Pasted into Download URL field</p>
                </div>
                <a
                  href={state.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 hover:underline truncate"
                  dir="ltr"
                >
                  <Link2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">{state.url}</span>
                </a>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {state.status === "idle" && (
                <button
                  type="button"
                  onClick={start}
                  disabled={!hasActiveKey}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-black text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <CloudUpload className="h-4 w-4" /> Upload to Pixeldrain
                </button>
              )}
              {isBusy && (
                <button
                  type="button"
                  onClick={cancel}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2 text-xs font-bold text-muted-foreground hover:text-red-400 hover:border-red-500/30"
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
              )}
              {state.status === "done" && (
                <button
                  type="button"
                  onClick={reset}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2 text-xs font-bold text-muted-foreground hover:text-foreground"
                >
                  Upload another file
                </button>
              )}
            </div>
          </div>
        )}

        {/* Quick stats footer */}
        {!keysLoading && hasAnyKey && (
          <p className="text-[10px] text-muted-foreground text-center">
            Active: {activeKeys.length} · Total: {keys?.length || 0}
            {onOpenSettings && (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <SettingsIcon className="h-3 w-3" /> Open Settings
                </button>
              </>
            )}
          </p>
        )}
      </div>

      {keysOpen && <KeysModal onClose={() => { setKeysOpen(false); refreshKeys(); }} />}
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────

function UploaderHeader({ right }: { right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${PIXELDRAIN_GREEN}1f`, color: PIXELDRAIN_GREEN }}
      >
        <CloudUpload className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">Upload via Pixeldrain</p>
        <p className="text-[10px] text-muted-foreground">
          Use your own API key — auto-rotates when one runs out
        </p>
      </div>
      {right}
    </div>
  );
}

function FilePickerDrop({
  onPick,
  disabled,
}: {
  onPick: (f: File | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (disabled) return;
        const f = e.dataTransfer.files?.[0];
        if (f) onPick(f);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 transition-all",
        disabled
          ? "cursor-not-allowed opacity-50 border-border"
          : dragOver
          ? "border-emerald-500 bg-emerald-500/10"
          : "border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => onPick(e.target.files?.[0] || null)}
      />
      <CloudUpload className="h-7 w-7 text-emerald-400" />
      <p className="text-sm font-bold text-foreground">
        {dragOver ? "Drop the file" : "Drag a file or click to browse"}
      </p>
      <p className="text-[10px] text-muted-foreground">
        ROMs, kernels, recoveries, GSIs — anything Pixeldrain accepts (≤ 20 GB)
      </p>
    </label>
  );
}

function KeysModal({ onClose }: { onClose: () => void }) {
  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3 sticky top-0 bg-card z-10">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <KeyRound className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-foreground">Pixeldrain API Keys</p>
            <p className="text-[10px] text-muted-foreground">Encrypted · only the last 4 chars are shown back</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">
          <UploadKeysManager provider="pixeldrain" compact />
        </div>
      </div>
    </div>
  );
}
