"use client";

import { useState, useCallback, useRef } from "react";
import type { ContentType } from "@/lib/types";
import { CLOUDINARY_CONFIG } from "@/lib/constants";

// ── Image helpers (extracted from upload page) ────────────────
let _webpSupported: boolean | null = null;
async function checkWebP(): Promise<boolean> {
  if (_webpSupported !== null) return _webpSupported;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    _webpSupported = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch { _webpSupported = false; }
  return _webpSupported;
}
function loadImg(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Cannot load image")); };
    img.src = url;
  });
}
function toBlob(canvas: HTMLCanvasElement, type: string, q: number): Promise<Blob | null> {
  return new Promise(res => canvas.toBlob(res, type, q));
}
async function compressBeforeUpload(file: File, maxSizeKB = 700): Promise<{ file: File; savings: string }> {
  if (file.type === "image/gif" || file.size < 80 * 1024) return { file, savings: "0%" };
  const webp = await checkWebP();
  const outType = webp ? "image/webp" : "image/jpeg";
  const outExt  = webp ? "webp" : "jpg";
  const img = await loadImg(file);
  let { width, height } = img;
  const MAX_W = 1920, MAX_H = 1080;
  if (width > MAX_W || height > MAX_H) {
    const ratio = Math.min(MAX_W / width, MAX_H / height);
    width = Math.round(width * ratio); height = Math.round(height * ratio);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
  let q = 0.85, blob: Blob | null = null;
  for (let i = 0; i < 6; i++) {
    blob = await toBlob(canvas, outType, q);
    if (!blob) break;
    if (blob.size <= maxSizeKB * 1024) break;
    q -= 0.1; if (q < 0.3) break;
  }
  if (!blob || blob.size >= file.size) return { file, savings: "0%" };
  const savings = Math.round((1 - blob.size / file.size) * 100);
  const compressed = new File([blob], file.name.replace(/\.[^.]+$/, `.${outExt}`), { type: outType });
  return { file: compressed, savings: `${savings}%` };
}
function optimizeCloudinaryUrl(url: string): string {
  if (!url || !url.includes("cloudinary.com")) return url;
  if (url.includes("f_auto")) return url;
  return url.replace("/image/upload/", "/image/upload/f_auto,q_auto/");
}

// ── Validation helpers ────────────────────────────────────────
const BLOCKED_SHORTENERS = ["bit.ly","tinyurl.com","t.co","goo.gl","ow.ly","short.link","rb.gy","cutt.ly","is.gd","v.gd","tiny.cc"];
export function isValidUrl(url: string): boolean {
  if (!url) return true;
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== "https:") return false;
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|::1)/i.test(hostname)) return false;
    if (!hostname.includes(".")) return false;
    if (BLOCKED_SHORTENERS.some((d) => hostname === d || hostname.endsWith("." + d))) return false;
    return true;
  } catch { return false; }
}
export const MD5_REGEX    = /^[a-f0-9]{32}$/i;
export const SHA256_REGEX = /^[a-f0-9]{64}$/i;
export function sanitizeText(text: string): string {
  return text.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "").replace(/<[^>]*>/g, "").replace(/javascript:/gi, "").replace(/on\w+\s*=/gi, "").trim();
}
export const MAX_MIRRORS = 3;

// ── Form shape ────────────────────────────────────────────────
// Channel link type for upload form
export interface UploadChannelLink {
  id: string;
  platform: string;
  url: string;
  label: string;
}

export interface UploadFormState {
  contentType: ContentType;
  name: string; brand: string; device: string; android: string; version: string; size: string;
  downloadUrl: string; mirrors: string[];
  description: string; changelog: string; installGuide: string;
  thumbnail: string; screenshots: string[]; tags: string[];
  romStatus: string; romType: string;
  checksumMd5: string; checksumSha256: string;
  deviceCodename: string;
  variants: { name: string; downloadUrl: string; size?: string; mirrors?: string[]; checksumMd5?: string }[];
  isUniversal: boolean;
  kernelType: "" | "device" | "anykernel3";
  kernelMajor: string; kernelMinor: string;
  anyKernelTargets: string;
  recoveryType: string;
  moduleId: string;
  moduleScope: "universal" | "android" | "device" | "soc";
  moduleManagers: string[];
  minMagisk: string; socFamily: string;
  trebleType: "" | "a-only" | "ab" | "both";
  gsiArch: "" | "arm64" | "arm32" | "arm64+arm32" | "x86" | "x86_64";
  gsiType: "" | "vndklite" | "full" | "go";
  xdaUrl: string; telegramUrl: string; sourceUrl: string;
  knownIssues: string; minRam: string; minStorage: string;
  linkvertiseEnabled: boolean; // هل يريد المطور تفعيل إعلان Linkvertise على رابط التحميل
  // Channel links from profile - synced with profile
  channelLinks: UploadChannelLink[];
  // Donation links from profile - synced with profile
  donationLinks: { platform: string; url: string; label: string }[];
}

export const INITIAL_FORM: UploadFormState = {
  contentType: "rom",
  name: "", brand: "", device: "", android: "", version: "", size: "",
  downloadUrl: "", mirrors: [""],
  description: "", changelog: "", installGuide: "",
  thumbnail: "", screenshots: [], tags: [],
  romStatus: "active", romType: "device",
  checksumMd5: "", checksumSha256: "",
  deviceCodename: "",
  variants: [], isUniversal: false,
  kernelType: "", kernelMajor: "", kernelMinor: "", anyKernelTargets: "",
  recoveryType: "",
  moduleId: "", moduleScope: "universal", moduleManagers: ["any"], minMagisk: "", socFamily: "",
  trebleType: "", gsiArch: "", gsiType: "",
  xdaUrl: "", telegramUrl: "", sourceUrl: "",
  knownIssues: "", minRam: "", minStorage: "",
  linkvertiseEnabled: false,
  channelLinks: [],
  donationLinks: [],
};

// ── Hook ──────────────────────────────────────────────────────
export function useUploadForm(initialType?: ContentType) {
  const [form, setForm] = useState<UploadFormState>({
    ...INITIAL_FORM,
    ...(initialType ? { contentType: initialType } : {}),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  // ── Field update ────────────────────────────────────────
  const updateField = useCallback((key: string, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: "" }));
  }, []);

  // ── Module manager toggle ───────────────────────────────
  const toggleModuleManager = useCallback((id: string) => {
    setForm(prev => {
      const current = prev.moduleManagers;
      if (id === "any") return { ...prev, moduleManagers: ["any"] };
      const without = current.filter(m => m !== "any" && m !== id);
      const next    = current.includes(id) ? without : [...without, id];
      return { ...prev, moduleManagers: next.length ? next : ["any"] };
    });
  }, []);

  // ── Tags ────────────────────────────────────────────────
  const addTag = useCallback((tag: string) => {
    const cleaned = sanitizeText(tag.trim().toLowerCase());
    if (cleaned && form.tags.length < 10 && !form.tags.includes(cleaned)) {
      updateField("tags", [...form.tags, cleaned]);
    }
  }, [form.tags, updateField]);

  // ── Mirrors ─────────────────────────────────────────────
  const addMirror = useCallback(() => {
    if (form.mirrors.length < MAX_MIRRORS)
      setForm(p => ({ ...p, mirrors: [...p.mirrors, ""] }));
  }, [form.mirrors.length]);

  const updateMirror = useCallback((idx: number, value: string) => {
    setForm(p => {
      const updated = [...p.mirrors]; updated[idx] = value;
      return { ...p, mirrors: updated };
    });
  }, []);

  const removeMirror = useCallback((idx: number) => {
    if (form.mirrors.length <= 1) { updateMirror(0, ""); return; }
    setForm(p => ({ ...p, mirrors: p.mirrors.filter((_, i) => i !== idx) }));
  }, [form.mirrors.length, updateMirror]);

  // ── Variants ────────────────────────────────────────────
  const addVariant = useCallback((templateName?: string) => {
    setForm(p => ({
      ...p,
      variants: [...p.variants, { name: templateName || "", downloadUrl: "", size: "", mirrors: [], checksumMd5: "" }],
    }));
  }, []);

  const updateVariant = useCallback((idx: number, field: string, value: string) => {
    setForm(p => {
      const updated = [...p.variants];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...p, variants: updated };
    });
  }, []);

  const removeVariant = useCallback((idx: number) => {
    setForm(p => ({ ...p, variants: p.variants.filter((_, i) => i !== idx) }));
  }, []);

  // ── Image upload ────────────────────────────────────────
  const uploadImage = useCallback(async (file: File): Promise<string> => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) throw new Error("Only JPEG, PNG, WebP, and GIF images are allowed");
    if (file.size > CLOUDINARY_CONFIG.maxSizeMB * 1024 * 1024) throw new Error(`File size must be under ${CLOUDINARY_CONFIG.maxSizeMB}MB`);
    setUploading(true);
    try {
      setUploadProgress("Compressing…");
      const { file: compressed, savings } = await compressBeforeUpload(file, 700);
      setUploadProgress(savings !== "0%" ? `Compressed ${savings} · Uploading…` : "Uploading…");
      const fd = new FormData();
      fd.append("file", compressed);
      fd.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
      fd.append("folder", CLOUDINARY_CONFIG.folder);
      const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (!data.secure_url) throw new Error("Upload failed");
      return optimizeCloudinaryUrl(data.secure_url);
    } finally { setUploading(false); setUploadProgress(""); }
  }, []);

  // ── Kernel version computed ─────────────────────────────
  const getKernelVersion = useCallback(() => {
    if (!form.kernelMajor) return "";
    return form.kernelMinor ? `${form.kernelMajor}.${form.kernelMinor}` : form.kernelMajor;
  }, [form.kernelMajor, form.kernelMinor]);

  // ── isUniversal computed ────────────────────────────────
  const isUniversal = form.contentType === "gsi" || form.isUniversal || form.kernelType === "anykernel3" || (form.contentType === "module" && form.moduleScope === "universal");
  const needsDevice = !isUniversal;

  return {
    form, setForm, errors, setErrors,
    uploading, uploadProgress,
    updateField, toggleModuleManager,
    addTag, addMirror, updateMirror, removeMirror,
    addVariant, updateVariant, removeVariant,
    uploadImage, getKernelVersion,
    isUniversal, needsDevice,
  };
}
