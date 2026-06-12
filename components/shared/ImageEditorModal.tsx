"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import type { Area, Point } from "react-easy-crop";
const Cropper = dynamic(() => import("react-easy-crop"), { ssr: false });
import { X as XIcon, Check, Loader2, RotateCcw, RotateCw, FlipHorizontal, FlipVertical, ZoomIn, ZoomOut } from "lucide-react";
import { getCroppedImg } from "@/lib/utils/cropImage";
import type { ImageFilters, ImageTransform } from "@/lib/utils/cropImage";
import { useTranslation } from "@/lib/i18n";

export type EditorMode = "avatar" | "cover";

interface Props {
  imageSrc: string;
  mode: EditorMode;
  onSave: (blob: Blob) => void;
  onClose: () => void;
  saving?: boolean;
}

const ASPECT: Record<EditorMode, number> = { avatar: 1, cover: 16 / 9 };
const DEFAULT_FILTERS: ImageFilters = { brightness: 1, contrast: 1, saturation: 1 };
const DEFAULT_TRANSFORM: ImageTransform = { rotation: 0, flipH: false, flipV: false };

// ── Filter presets ────────────────────────────────────────────────────────────
interface FilterPreset {
  nameKey: string;
  emoji: string;
  filters: ImageFilters;
}

const FILTER_PRESETS: FilterPreset[] = [
  { nameKey: "imageEditor.preset.original", emoji: "🔄", filters: { brightness: 1, contrast: 1, saturation: 1 } },
  { nameKey: "imageEditor.preset.warm",     emoji: "☀️", filters: { brightness: 1.1, contrast: 1.05, saturation: 1.2 } },
  { nameKey: "imageEditor.preset.cool",     emoji: "❄️", filters: { brightness: 1, contrast: 1.1, saturation: 0.85 } },
  { nameKey: "imageEditor.preset.bw",       emoji: "⬛", filters: { brightness: 1, contrast: 1.15, saturation: 0 } },
  { nameKey: "imageEditor.preset.vivid",    emoji: "🎨", filters: { brightness: 1.05, contrast: 1.15, saturation: 1.5 } },
];

// ── Custom touch-friendly slider ──────────────────────────────────────────────
function Slider({
  label, emoji, value, min, max, accent, onChange, display, isRtl
}: {
  label: string; emoji: string; value: number; min: number; max: number;
  accent: string; onChange: (v: number) => void; display: string; isRtl: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  const seek = useCallback((clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratioRaw = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const ratio = isRtl ? 1 - ratioRaw : ratioRaw;
    onChange(Math.round((min + ratio * (max - min)) * 100) / 100);
  }, [min, max, onChange, isRtl]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    seek(e.clientX);
    const move = (ev: PointerEvent) => seek(ev.clientX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [seek]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-bold" style={{ color: "rgba(255,255,255,0.65)" }}>
          <span className="text-base leading-none">{emoji}</span>{label}
        </span>
        <span className="text-xs font-black tabular-nums" style={{ color: accent }}>{display}</span>
      </div>
      <div
        ref={trackRef}
        className="relative flex items-center cursor-pointer select-none touch-none"
        style={{ height: 28 }}
        onPointerDown={onPointerDown}
      >
        <div className="absolute inset-y-0 my-auto h-2 w-full rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
        <div className="absolute inset-y-0 my-auto h-2 rounded-full" style={{ width: `${pct}%`, [isRtl ? 'right' : 'left']: 0, background: `linear-gradient(${isRtl ? -90 : 90}deg, ${accent}70, ${accent})` }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 rounded-full opacity-20 bg-white" style={{ [isRtl ? 'right' : 'left']: `${((1 - min) / (max - min)) * 100}%` }} />
        <div
          className="absolute top-1/2 h-6 w-6 rounded-full border-2 border-white"
          style={{
            [isRtl ? 'right' : 'left']: `${pct}%`,
            transform: isRtl ? "translate(50%, -50%)" : "translate(-50%, -50%)",
            background: accent,
            boxShadow: `0 0 0 4px ${accent}25, 0 4px 16px rgba(0,0,0,0.5)`,
            transition: "box-shadow 0.15s",
          }}
        />
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function ImageEditorModal({ imageSrc, mode, onSave, onClose, saving = false }: Props) {
  const { t, dir } = useTranslation();
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [filters, setFilters] = useState<ImageFilters>(DEFAULT_FILTERS);
  const [transform, setTransform] = useState<ImageTransform>(DEFAULT_TRANSFORM);
  const [processing, setProcessing] = useState(false);
  const [visible, setVisible] = useState(false);
  const [activePreset, setActivePreset] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); const timer = setTimeout(() => setVisible(true), 20); return () => clearTimeout(timer); }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !processing && !saving) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, processing, saving]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => setCroppedAreaPixels(pixels), []);

  const handleSave = useCallback(async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels, filters, "image/jpeg", 0.92, transform);
      onSave(blob);
    } catch (e) { console.error("Crop failed:", e); }
    finally { setProcessing(false); }
  }, [croppedAreaPixels, imageSrc, filters, transform, onSave]);

  const setF = (k: keyof ImageFilters) => (v: number) => setFilters(p => ({ ...p, [k]: v }));

  const reset = () => {
    setFilters(DEFAULT_FILTERS);
    setTransform(DEFAULT_TRANSFORM);
    setZoom(1);
    setRotation(0);
    setCrop({ x: 0, y: 0 });
    setActivePreset(0);
  };

  const rotateCW = () => {
    const newRot = (rotation + 90) % 360;
    setRotation(newRot);
    setTransform(p => ({ ...p, rotation: newRot }));
  };
  const rotateCCW = () => {
    const newRot = (rotation - 90 + 360) % 360;
    setRotation(newRot);
    setTransform(p => ({ ...p, rotation: newRot }));
  };
  const toggleFlipH = () => setTransform(p => ({ ...p, flipH: !p.flipH }));
  const toggleFlipV = () => setTransform(p => ({ ...p, flipV: !p.flipV }));

  const applyPreset = (idx: number) => {
    setActivePreset(idx);
    setFilters({ ...FILTER_PRESETS[idx].filters });
  };

  const busy = processing || saving;
  const isAvatar = mode === "avatar";
  const changed = filters.brightness !== 1 || filters.contrast !== 1 || filters.saturation !== 1 || zoom !== 1 || rotation !== 0 || transform.flipH || transform.flipV;

  const pct = (v: number) => {
    const sign = v >= 1 ? "+" : "";
    return `${sign}${Math.round((v - 1) * 100)}%`;
  };

  const accentColor = isAvatar ? "#8b5cf6" : "#1d9bf0";
  const accentGrad = isAvatar ? "linear-gradient(135deg, #7c3aed, #6366f1)" : "linear-gradient(135deg, #0ea5e9, #1d9bf0)";
  const isRtl = dir === "rtl";

  const content = (
    <div
      className="fixed inset-0 flex flex-col items-stretch sm:items-center sm:justify-center"
      style={{ zIndex: 9999 }}
      dir={dir}
      role="dialog"
      aria-modal="true"
      aria-label={isAvatar ? "Edit profile picture" : "Edit image"}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background: "rgba(0,0,0,0.88)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
        onClick={!busy ? onClose : undefined}
      />

      {/* Sheet */}
      <div
        className="relative flex flex-col w-full sm:max-w-md sm:mx-auto overflow-hidden sm:rounded-[28px]"
        style={{
          marginTop: "auto",
          borderRadius: "28px 28px 0 0",
          maxHeight: "calc(100dvh - 48px)",
          background: "#111827",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 -40px 80px rgba(0,0,0,0.95)",
          transform: visible ? "translateY(0)" : "translateY(110%)",
          transition: "transform 0.45s cubic-bezier(0.34,1.3,0.64,1)",
        }}
      >
        {/* Top gradient line */}
        <div className="absolute inset-x-0 top-0 h-px pointer-events-none" style={{
          background: isAvatar
            ? "linear-gradient(90deg, transparent 10%, #6366f1 45%, #8b5cf6 55%, transparent 90%)"
            : "linear-gradient(90deg, transparent 10%, #1d9bf0 45%, #06b6d4 55%, transparent 90%)",
        }} />

        {/* Handle */}
        <div className="flex justify-center pt-3.5 pb-1 shrink-0 sm:hidden">
          <div className="h-1 w-12 rounded-full" style={{ background: "rgba(255,255,255,0.18)" }} />
        </div>

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 pb-3">
          <button
            onClick={onClose} disabled={busy}
            className="flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-90 disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}
            aria-label={t("common.close")}
          >
            <XIcon className="h-4 w-4" style={{ color: "rgba(255,255,255,0.6)" }} />
          </button>

          <div className="text-center">
            <p className="text-sm font-black text-white leading-tight">
              {isAvatar ? t("imageEditor.editAvatar") : t("imageEditor.editCover")}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
              {isAvatar ? t("imageEditor.avatarHint") : t("imageEditor.coverHint")}
            </p>
          </div>

          <button
            onClick={reset} disabled={busy || !changed}
            className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-bold transition-all active:scale-90 disabled:opacity-25"
            style={{
              background: changed ? "rgba(255,255,255,0.07)" : "transparent",
              border: `1px solid ${changed ? "rgba(255,255,255,0.12)" : "transparent"}`,
              color: "rgba(255,255,255,0.55)",
            }}
            aria-label={t("imageEditor.reset")}
          >
            <RotateCcw className="h-3 w-3" />
            {t("imageEditor.reset")}
          </button>
        </div>

        {/* ── Crop area ── */}
        <div
          className="relative shrink-0 w-full"
          style={{
            height: isAvatar ? "clamp(200px, 55vw, 280px)" : "clamp(160px, 44vw, 220px)",
            backgroundImage: "linear-gradient(45deg, #1a1f2e 25%, transparent 25%), linear-gradient(-45deg, #1a1f2e 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1f2e 75%), linear-gradient(-45deg, transparent 75%, #1a1f2e 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
            backgroundColor: "#141820",
          }}
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={ASPECT[mode]}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            cropShape={isAvatar ? "round" : "rect"}
            showGrid={!isAvatar}
            objectFit="contain"
            minZoom={1}
            maxZoom={3}
            zoomSpeed={1}
            classes={{}}
            restrictPosition={true}
            mediaProps={{}}
            style={{
              containerStyle: { background: "transparent" },
              cropAreaStyle: {
                border: `2.5px solid ${isAvatar ? "rgba(139,92,246,0.95)" : "rgba(29,155,240,0.95)"}`,
                boxShadow: `0 0 0 9999px rgba(0,0,0,0.72), 0 0 0 1px ${isAvatar ? "rgba(139,92,246,0.25)" : "rgba(29,155,240,0.25)"}, inset 0 0 0 1px rgba(255,255,255,0.05)`,
              },
              mediaStyle: {
                filter: `brightness(${filters.brightness}) contrast(${filters.contrast}) saturate(${filters.saturation})`
              }
            }}
          />
        </div>

        {/* ── Transform tools (rotate/flip) ── */}
        <div className="shrink-0 flex items-center justify-center gap-2 px-4 pt-3 pb-1">
          <button onClick={rotateCCW} disabled={busy}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all active:scale-90"
            aria-label={t("imageEditor.rotateCCW")} title={t("imageEditor.rotateCCW")}>
            <RotateCcw className="h-4 w-4" />
          </button>
          <button onClick={rotateCW} disabled={busy}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all active:scale-90"
            aria-label={t("imageEditor.rotateCW")} title={t("imageEditor.rotateCW")}>
            <RotateCw className="h-4 w-4" />
          </button>

          <div className="w-px h-5 bg-white/10 mx-1" />

          <button onClick={toggleFlipH} disabled={busy}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all active:scale-90 ${transform.flipH ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-white/50 hover:text-white hover:bg-white/10"}`}
            aria-label={t("imageEditor.flipH")} title={t("imageEditor.flipH")}>
            <FlipHorizontal className="h-4 w-4" />
          </button>
          <button onClick={toggleFlipV} disabled={busy}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all active:scale-90 ${transform.flipV ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-white/50 hover:text-white hover:bg-white/10"}`}
            aria-label={t("imageEditor.flipV")} title={t("imageEditor.flipV")}>
            <FlipVertical className="h-4 w-4" />
          </button>

          {rotation !== 0 && (
            <span className="text-[10px] font-bold text-white/30 ms-2 tabular-nums">{rotation}°</span>
          )}
        </div>

        {/* ── Controls ── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-3 pb-2 space-y-4" style={{ scrollbarWidth: "none" }}>

          {/* Zoom with +/- buttons */}
          <div className="flex items-center gap-2">
            <button onClick={() => setZoom(Math.max(1, zoom - 0.1))} disabled={busy || zoom <= 1}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all disabled:opacity-25"
              aria-label={t("imageEditor.zoomOut")}>
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <div className="flex-1">
              <Slider label={t("imageEditor.zoom")} emoji="🔍" value={zoom} min={1} max={3} accent="#38bdf8" onChange={setZoom} display={`${zoom.toFixed(1)}×`} isRtl={isRtl} />
            </div>
            <button onClick={() => setZoom(Math.min(3, zoom + 0.1))} disabled={busy || zoom >= 3}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all disabled:opacity-25"
              aria-label={t("imageEditor.zoomIn")}>
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Filter presets */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
              <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.2)" }}>{t("imageEditor.presets")}</span>
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {FILTER_PRESETS.map((preset, idx) => (
                <button key={idx} onClick={() => applyPreset(idx)} disabled={busy}
                  className={`flex flex-col items-center gap-1.5 rounded-xl px-3 py-2 text-center transition-all shrink-0 ${activePreset === idx ? "ring-1" : "hover:bg-white/5"}`}
                  style={activePreset === idx ? {
                    background: `${accentColor}15`,
                    borderColor: `${accentColor}40`,
                    boxShadow: `0 0 0 1px ${accentColor}50`,
                  } : {
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}>
                  <span className="text-lg">{preset.emoji}</span>
                  <span className="text-[9px] font-bold" style={{ color: activePreset === idx ? accentColor : "rgba(255,255,255,0.4)" }}>
                    {t(preset.nameKey)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Manual filters */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
              <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.2)" }}>{t("imageEditor.adjustments")}</span>
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
            </div>
            <div className="space-y-3">
              <Slider label={t("imageEditor.brightness")} emoji="☀️" value={filters.brightness} min={0.5} max={2} accent="#fbbf24" onChange={setF("brightness")} display={pct(filters.brightness)} isRtl={isRtl} />
              <Slider label={t("imageEditor.contrast")} emoji="⬤" value={filters.contrast} min={0.5} max={2} accent="#a78bfa" onChange={setF("contrast")} display={pct(filters.contrast)} isRtl={isRtl} />
              <Slider label={t("imageEditor.saturation")} emoji="🎨" value={filters.saturation} min={0} max={3} accent="#34d399" onChange={setF("saturation")} display={pct(filters.saturation)} isRtl={isRtl} />
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          className="shrink-0 flex items-center gap-3 px-4 pt-3"
          style={{
            paddingBottom: "max(env(safe-area-inset-bottom, 12px), 12px)",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(0,0,0,0.35)",
            backdropFilter: "blur(24px)",
          }}
        >
          <button
            onClick={onClose} disabled={busy}
            className="flex-1 rounded-2xl py-3.5 text-sm font-bold transition-all active:scale-[0.97] disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.65)" }}
          >
            {t("common.cancel")}
          </button>

          <button
            onClick={handleSave}
            disabled={busy || !croppedAreaPixels}
            className="flex-[2] relative flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white overflow-hidden transition-all active:scale-[0.97] disabled:opacity-50"
            style={{
              background: accentGrad,
              boxShadow: isAvatar
                ? "0 6px 24px rgba(124,58,237,0.5)"
                : "0 6px 24px rgba(14,165,233,0.5)",
            }}
          >
            <span className="absolute inset-0 pointer-events-none" style={{
              background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)",
              animation: "imgEditorShimmer 2.5s ease-in-out infinite",
            }} />
            {busy
              ? <Loader2 className="h-4 w-4 animate-spin relative z-10" />
              : <Check className="h-4 w-4 relative z-10" />
            }
            <span className="relative z-10">
              {busy ? t("imageEditor.saving") : (isAvatar ? t("imageEditor.saveAvatar") : t("imageEditor.saveCover"))}
            </span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes imgEditorShimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        [style*="z-index: 9999"] * { box-sizing: border-box; }
      `}</style>
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}
