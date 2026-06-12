"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface LightboxGalleryProps {
  screenshots: string[];
  initialIdx?: number;
  onClose: () => void;
}

export function LightboxGallery({ screenshots, initialIdx = 0, onClose }: LightboxGalleryProps) {
  const { t } = useTranslation();
  const [idx, setIdx] = useState(initialIdx);
  const [animDir, setAnimDir] = useState<"left" | "right" | null>(null);

  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const isDragging = useRef(false);
  const total = screenshots.length;

  const goPrev = useCallback(() => {
    if (total <= 1) return;
    setAnimDir("right");
    setTimeout(() => { setIdx(i => (i - 1 + total) % total); setAnimDir(null); }, 120);
  }, [total]);

  const goNext = useCallback(() => {
    if (total <= 1) return;
    setAnimDir("left");
    setTimeout(() => { setIdx(i => (i + 1) % total); setAnimDir(null); }, 120);
  }, [total]);

  const goTo = useCallback((i: number, current: number) => {
    setAnimDir(i > current ? "left" : "right");
    setTimeout(() => { setIdx(i); setAnimDir(null); }, 120);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goPrev, goNext]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (dx > dy && dx > 8) { isDragging.current = true; e.stopPropagation(); }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) dx < 0 ? goNext() : goPrev();
    isDragging.current = false;
  };

  const hasStrip = total > 3;
  const hasDots  = total > 1 && total <= 3;

  // ارتفاع زر الإغلاق الثابت في الأسفل
  const CLOSE_BTN_H = 56;
  // ارتفاع الشريط أو الدوتس
  const bottomNav = hasStrip ? 80 : hasDots ? 44 : 0;
  // إجمالي المسافة من الأسفل للصورة
  const imgPaddingBottom = CLOSE_BTN_H + bottomNav + 16;

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.96)",
        backdropFilter: "blur(12px)",
        zIndex: 9999,
        animation: "lb-fadein 0.18s ease-out",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Counter top-left ── */}
      <div style={{
        position: "fixed", top: 16, left: 16, zIndex: 99999,
        display: "flex", alignItems: "center", gap: 6,
        background: "rgba(0,0,0,0.65)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 12, padding: "6px 12px",
        backdropFilter: "blur(8px)",
      }}>
        <span style={{ color: "white", fontWeight: 900, fontSize: 14 }}>{idx + 1}</span>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>/</span>
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{total}</span>
      </div>

      {/* ── Image area ── */}
      <div
        style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          paddingTop: 72,
          paddingBottom: imgPaddingBottom,
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Prev */}
        {total > 1 && (
          <button onClick={goPrev} style={{
            position: "absolute", left: 12, zIndex: 100,
            width: 44, height: 44, borderRadius: 14,
            background: "rgba(0,0,0,0.55)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "white", display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer", touchAction: "manipulation",
          }}>
            <ChevronLeft style={{ width: 22, height: 22 }} />
          </button>
        )}

        {/* Image */}
        <div key={idx} style={{
          maxHeight: "100%", maxWidth: "88vw",
          opacity: animDir ? 0 : 1,
          transform: animDir === "left" ? "translateX(-20px)" : animDir === "right" ? "translateX(20px)" : "none",
          transition: "opacity 0.12s, transform 0.12s",
        }}>
          <Image
            src={screenshots[idx]}
            alt={`Screenshot ${idx + 1}`}
            width={400} height={800}
            style={{
              maxHeight: hasStrip ? "60vh" : "70vh",
              maxWidth: "88vw",
              width: "auto", height: "auto",
              borderRadius: 16, objectFit: "contain",
              boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
            }}
            priority
          />
        </div>

        {/* Next */}
        {total > 1 && (
          <button onClick={goNext} style={{
            position: "absolute", right: 12, zIndex: 100,
            width: 44, height: 44, borderRadius: 14,
            background: "rgba(0,0,0,0.55)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "white", display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer", touchAction: "manipulation",
          }}>
            <ChevronRight style={{ width: 22, height: 22 }} />
          </button>
        )}
      </div>

      {/* ── Dots ── */}
      {hasDots && (
        <div style={{
          position: "fixed", bottom: CLOSE_BTN_H + 8, left: 0, right: 0, zIndex: 99999,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          {screenshots.map((_, i) => (
            <button key={i} onClick={() => goTo(i, idx)} style={{
              borderRadius: 99, border: "none", cursor: "pointer",
              height: 8, width: i === idx ? 24 : 8,
              background: i === idx ? "white" : "rgba(255,255,255,0.25)",
              transition: "all 0.2s", padding: 0, touchAction: "manipulation",
            }} />
          ))}
        </div>
      )}

      {/* ── Thumbnails strip ── */}
      {hasStrip && (
        <div style={{
          position: "fixed", bottom: CLOSE_BTN_H, left: 0, right: 0, zIndex: 99999,
          overflowX: "auto", padding: "8px 16px",
          background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
          scrollbarWidth: "none", display: "flex", gap: 8,
        }}>
          {screenshots.map((ss, i) => (
            <button key={i} onClick={() => goTo(i, idx)} style={{
              position: "relative", flexShrink: 0,
              width: 32, height: 56, borderRadius: 10, overflow: "hidden",
              border: `2px solid ${i === idx ? "white" : "transparent"}`,
              opacity: i === idx ? 1 : 0.4,
              transform: i === idx ? "scale(1.1)" : "scale(1)",
              transition: "all 0.2s", cursor: "pointer", padding: 0,
              touchAction: "manipulation",
            }}>
              <Image src={ss} alt="" fill style={{ objectFit: "cover" }} />
            </button>
          ))}
        </div>
      )}

      {/* ── زر إغلاق واحد في آخر الشاشة تماماً ── */}
      <button
        onTouchEnd={(e) => { e.preventDefault(); onClose(); }}
        onClick={onClose}
        aria-label={t("lightbox.closeLabel")}
        style={{
          position: "fixed",
          bottom: 0, left: 0, right: 0,
          zIndex: 99999,
          height: CLOSE_BTN_H,
          background: "rgba(20,20,20,0.95)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          color: "white",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          cursor: "pointer",
          fontSize: 14, fontWeight: 700,
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <X style={{ width: 18, height: 18 }} />
        إغلاق
      </button>

      <style>{`@keyframes lb-fadein { from { opacity:0 } to { opacity:1 } }`}</style>
    </div>
  );
}
