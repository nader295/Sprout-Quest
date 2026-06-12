"use client";

import React, { useRef, useState, useCallback } from "react";
import Image from "next/image";
import type { UploadFormState } from "../hooks/use-upload-form";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { TYPE_KEYS } from "./step-type";
import { 
  X, Upload, Plus, Loader2, RefreshCw, Image as ImageIcon, 
  Sparkles, Info, Check, AlertTriangle, Move, Trash2 
} from "lucide-react";

interface StepMediaProps {
  form: {
    state: UploadFormState;
    updateField: (key: string, value: unknown) => void;
    errors: Record<string, string>;
    handleThumbnail: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    handleScreenshots: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  };
  uploadState: {
    uploading: boolean;
    uploadProgress: string;
  };
}

// Recommended dimensions by content type
const THUMBNAIL_DIMENSIONS: Record<string, { width: number; height: number; label: string }> = {
  rom: { width: 1920, height: 1080, label: "16:9 Landscape" },
  kernel: { width: 1200, height: 675, label: "16:9 Landscape" },
  recovery: { width: 1200, height: 675, label: "16:9 Landscape" },
  module: { width: 800, height: 800, label: "1:1 Square" },
  gsi: { width: 1920, height: 1080, label: "16:9 Landscape" },
};

const SCREENSHOT_DIMENSIONS: Record<string, { width: number; height: number; label: string }> = {
  rom: { width: 1080, height: 2400, label: "9:20 Portrait" },
  kernel: { width: 1080, height: 2400, label: "9:20 Portrait" },
  recovery: { width: 1080, height: 2400, label: "9:20 Portrait" },
  module: { width: 1080, height: 2400, label: "9:20 Portrait" },
  gsi: { width: 1080, height: 2400, label: "9:20 Portrait" },
};

export function StepMedia({ form, uploadState }: StepMediaProps) {
  const { state, updateField, errors, handleThumbnail, handleScreenshots } = form;
  const { uploading, uploadProgress } = uploadState;
  const { t } = useTranslation();
  const replaceThumbnailRef = useRef<HTMLInputElement>(null);
  const thumbnailDropRef = useRef<HTMLDivElement>(null);
  const screenshotsDropRef = useRef<HTMLDivElement>(null);

  const [isDraggingThumbnail, setIsDraggingThumbnail] = useState(false);
  const [isDraggingScreenshots, setIsDraggingScreenshots] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const selectedType = TYPE_KEYS.find(t => t.value === state.contentType);
  const accentColor  = selectedType?.accent ?? "var(--primary)";
  const thumbDims = THUMBNAIL_DIMENSIONS[state.contentType] || THUMBNAIL_DIMENSIONS.rom;
  const ssDims = SCREENSHOT_DIMENSIONS[state.contentType] || SCREENSHOT_DIMENSIONS.rom;

  // Drag & Drop handlers for thumbnail
  const handleThumbnailDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingThumbnail(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const fakeEvent = { target: { files } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleThumbnail(fakeEvent);
    }
  }, [handleThumbnail]);

  // Drag & Drop handlers for screenshots
  const handleScreenshotsDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingScreenshots(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const fakeEvent = { target: { files } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleScreenshots(fakeEvent);
    }
  }, [handleScreenshots]);

  // Reorder screenshots
  const handleReorder = (fromIndex: number, toIndex: number) => {
    const newScreenshots = [...state.screenshots];
    const [moved] = newScreenshots.splice(fromIndex, 1);
    newScreenshots.splice(toIndex, 0, moved);
    updateField("screenshots", newScreenshots);
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${accentColor}15` }}>
          <ImageIcon className="h-4.5 w-4.5" style={{ color: accentColor }} />
        </div>
        <div>
          <h3 className="text-xl font-black tracking-tight text-foreground">{t("upload.step.media")}</h3>
          <p className="text-xs text-muted-foreground">{t("upload.step.media.desc") || "Add images to your post"}</p>
        </div>
      </div>

      {/* Cover/Thumbnail Section */}
      <div className="rounded-2xl border border-border bg-card/30 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: accentColor }} />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t("upload.coverLabel")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/60 px-2 py-1 rounded-lg bg-muted/50">
              {thumbDims.label} • {thumbDims.width}×{thumbDims.height}
            </span>
            <span className="text-[10px] text-muted-foreground/50">JPG · PNG · WebP · GIF</span>
          </div>
        </div>

        {errors.thumbnail && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
            <p className="text-[11px] text-destructive">{errors.thumbnail}</p>
          </div>
        )}

        {state.thumbnail ? (
          <div className="space-y-3">
            {/* Thumbnail preview */}
            <div className="relative aspect-video w-full max-w-md rounded-2xl overflow-hidden border-2 shadow-lg mx-auto"
              style={{ borderColor: `${accentColor}40` }}>
              <Image src={state.thumbnail} alt="Thumbnail" fill className="object-cover" />
              {uploading && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                  <span className="text-xs text-white/80 font-medium">{uploadProgress || t("upload.uploading")}</span>
                </div>
              )}
              {/* Success indicator */}
              {!uploading && (
                <div className="absolute top-3 end-3 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 shadow-lg animate-in zoom-in duration-200">
                  <Check className="h-4 w-4 text-white" strokeWidth={3} />
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
              <label
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground cursor-pointer transition-all",
                  uploading ? "opacity-50 pointer-events-none" : "hover:text-foreground hover:bg-muted hover:border-muted-foreground/30 active:scale-[0.98]"
                )}
              >
                <RefreshCw className="h-4 w-4" />
                {t("upload.replace")}
                <input
                  ref={replaceThumbnailRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleThumbnail}
                  disabled={uploading}
                />
              </label>
              <button
                onClick={() => updateField("thumbnail", "")}
                disabled={uploading}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border border-destructive/30 px-4 py-2.5 text-xs font-semibold text-destructive/80 transition-all",
                  uploading ? "opacity-50 pointer-events-none" : "hover:bg-destructive/10 hover:border-destructive/50 active:scale-[0.98]"
                )}
              >
                <Trash2 className="h-4 w-4" />
                {t("upload.delete")}
              </button>
            </div>
          </div>
        ) : (
          <div
            ref={thumbnailDropRef}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingThumbnail(true); }}
            onDragLeave={() => setIsDraggingThumbnail(false)}
            onDrop={handleThumbnailDrop}
            className={cn(
              "relative group flex flex-col items-center justify-center aspect-video max-w-md mx-auto cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200",
              uploading ? "opacity-50 pointer-events-none border-border" : isDraggingThumbnail ? "border-solid bg-muted/30 scale-[1.02]" : "border-border hover:border-opacity-60 bg-muted/10"
            )}
            style={{ borderColor: isDraggingThumbnail ? accentColor : undefined }}
          >
            <label className="absolute inset-0 cursor-pointer">
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleThumbnail} disabled={uploading} />
            </label>
            
            <div className={cn(
              "flex h-14 w-14 items-center justify-center rounded-2xl mb-3 transition-all duration-300",
              isDraggingThumbnail ? "scale-110" : "group-hover:scale-105"
            )}
              style={{ backgroundColor: `${accentColor}15` }}>
              {uploading ? (
                <Loader2 className="h-7 w-7 animate-spin" style={{ color: accentColor }} />
              ) : (
                <Upload className="h-7 w-7" style={{ color: accentColor }} />
              )}
            </div>
            
            <span className="text-sm font-semibold text-foreground mb-1">
              {uploading ? uploadProgress || t("upload.uploading") : isDraggingThumbnail ? t("upload.droppingImage") : t("upload.dragImageOrClick")}
            </span>
            <span className="text-[11px] text-muted-foreground/60">
              Max 700KB • {thumbDims.width}×{thumbDims.height} {t("upload.recommended")}
            </span>
          </div>
        )}

        {/* Tip */}
        <div className="flex items-start gap-2 rounded-xl border border-dashed border-border bg-muted/10 px-3 py-2.5">
          <Info className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("upload.coverTip")}
          </p>
        </div>
      </div>

      {/* Screenshots Section */}
      <div className="rounded-2xl border border-border bg-card/30 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" style={{ color: accentColor }} />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              {t("upload.screenshotsLabel", { n: `${state.screenshots.length}/10` })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/60 px-2 py-1 rounded-lg bg-muted/50">
              {ssDims.label} • {ssDims.width}×{ssDims.height}
            </span>
            {state.screenshots.length > 1 && (
              <button
                onClick={() => setReorderMode(!reorderMode)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all",
                  reorderMode ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Move className="h-3 w-3" />
                {reorderMode ? t("upload.done") : t("upload.reorder")}
              </button>
            )}
          </div>
        </div>

        {errors.screenshots && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
            <p className="text-[11px] text-destructive">{errors.screenshots}</p>
          </div>
        )}

        <div
          ref={screenshotsDropRef}
          onDragOver={(e) => { e.preventDefault(); if (!reorderMode) setIsDraggingScreenshots(true); }}
          onDragLeave={() => setIsDraggingScreenshots(false)}
          onDrop={!reorderMode ? handleScreenshotsDrop : undefined}
          className={cn(
            "grid gap-3 transition-all duration-200",
            state.screenshots.length === 0 ? "grid-cols-1" : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5"
          )}
        >
          {state.screenshots.map((ss, i) => (
            <div
              key={i}
              draggable={reorderMode}
              onDragStart={() => setDraggedIndex(i)}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); if (reorderMode && draggedIndex !== null && draggedIndex !== i) handleReorder(draggedIndex, i); }}
              className={cn(
                "group relative aspect-[9/16] rounded-xl overflow-hidden border transition-all",
                reorderMode ? "cursor-grab active:cursor-grabbing" : "",
                draggedIndex === i ? "opacity-50 scale-95" : "",
                reorderMode ? "border-primary/30 hover:border-primary" : "border-border hover:border-muted-foreground/30"
              )}
            >
              <Image src={ss} alt={`Screenshot ${i + 1}`} fill className="object-cover" />

              {/* Index badge */}
              <span className="absolute bottom-2 start-2 text-[10px] font-bold text-white bg-black/60 backdrop-blur-sm rounded-md px-2 py-1">
                {i + 1}
              </span>

              {/* Reorder indicator */}
              {reorderMode && (
                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                  <Move className="h-6 w-6 text-white drop-shadow-lg" />
                </div>
              )}

              {/* Delete button */}
              {!reorderMode && (
                <button
                  onClick={() => updateField("screenshots", state.screenshots.filter((_, idx) => idx !== i))}
                  className="absolute end-2 top-2 rounded-full bg-black/70 p-1.5 transition-all
                             sm:opacity-0 sm:group-hover:opacity-100 opacity-100
                             hover:bg-destructive active:scale-90"
                  aria-label={`Remove screenshot ${i + 1}`}
                >
                  <X className="h-3.5 w-3.5 text-white" />
                </button>
              )}
            </div>
          ))}

          {/* Add more screenshots */}
          {state.screenshots.length < 10 && !reorderMode && (
            <label
              className={cn(
                "group flex flex-col items-center justify-center cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200",
                state.screenshots.length === 0 ? "aspect-video" : "aspect-[9/16]",
                isDraggingScreenshots ? "border-solid bg-muted/30 scale-[1.02]" : "border-border hover:border-opacity-60 bg-muted/10"
              )}
              style={{ borderColor: isDraggingScreenshots ? accentColor : undefined }}
            >
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl mb-2 transition-transform",
                isDraggingScreenshots ? "scale-110" : "group-hover:scale-110"
              )}
                style={{ backgroundColor: `${accentColor}15` }}>
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: accentColor }} />
                ) : (
                  <Plus className="h-5 w-5" style={{ color: accentColor }} />
                )}
              </div>
              <span className="text-xs font-semibold text-foreground mb-0.5">
                {uploading ? t("upload.uploading") : isDraggingScreenshots ? t("upload.dropHere") : t("upload.addImages")}
              </span>
              <span className="text-[10px] text-muted-foreground/50">
                {state.screenshots.length === 0 ? t("upload.dragImagesHint") : t("upload.ssRemaining").replace("{n}", String(10 - state.screenshots.length))}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={handleScreenshots}
                disabled={uploading}
              />
            </label>
          )}
        </div>

        {/* Screenshots tip */}
        <div className="flex items-start gap-2 rounded-xl border border-dashed border-border bg-muted/10 px-3 py-2.5">
          <Info className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("upload.screenshotsTip")}
          </p>
        </div>
      </div>
    </div>
  );
}
