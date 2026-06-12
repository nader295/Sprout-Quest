"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { uploadMarketplaceImage } from "@/lib/marketplace/api-client";

export function CoverUploader({
  value,
  onChange,
  folder = "covers",
  aspect = "16/8",
  height = 180,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  folder?: "listings" | "portfolio" | "covers";
  aspect?: string;
  height?: number;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const { url } = await uploadMarketplaceImage(file, folder);
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.currentTarget.value = "";
        }}
      />
      {value ? (
        <div
          className="relative w-full overflow-hidden rounded-2xl border border-border"
          style={{ aspectRatio: aspect, height }}
        >
          <Image src={value} alt="" fill sizes="600px" className="object-cover" unoptimized />
          <div className="absolute right-2 top-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handlePick}
              className="rounded-lg border border-white/20 bg-black/55 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur-sm transition hover:bg-black/75"
            >
              <UploadCloud className="mr-1 inline h-3 w-3" /> Replace
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded-lg border border-rose-300/40 bg-rose-500/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur-sm transition hover:bg-rose-500"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={handlePick}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/30 py-8 text-sm font-bold text-muted-foreground transition hover:border-[color:var(--primary)]/50 hover:text-foreground disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ImagePlus className="h-5 w-5" />
          )}
          {busy ? "Uploading…" : "Add cover image"}
        </button>
      )}
      {error && (
        <p className="text-[11px] font-bold text-destructive">{error}</p>
      )}
    </div>
  );
}
