// ── 24 legendary cover gradient presets ────────────────────────────────────
// Used by the profile page cover editor + initial render decoder.

export const COVER_PRESETS = [
  // Row 1 — Cosmic
  { label: "Aurora",        g: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" },
  { label: "Nebula",        g: "linear-gradient(135deg, #1a0533, #6b21a8, #1d4ed8)" },
  { label: "Galaxy",        g: "linear-gradient(135deg, #0d1b2a, #1e3a5f, #0ea5e9, #1e3a5f)" },
  { label: "Deep Space",    g: "linear-gradient(160deg, #020408 0%, #0f172a 50%, #1e1b4b 100%)" },
  // Row 2 — Fire
  { label: "Dragon Fire",   g: "linear-gradient(135deg, #1a0500, #7c2d12, #ea580c, #fbbf24)" },
  { label: "Inferno",       g: "linear-gradient(135deg, #18030a, #881337, #dc2626, #f97316)" },
  { label: "Volcanic",      g: "linear-gradient(135deg, #0c0a00, #713f12, #d97706, #fef08a)" },
  { label: "Sunset",        g: "linear-gradient(135deg, #0f0522, #7e22ce, #db2777, #f97316)" },
  // Row 3 — Ocean
  { label: "Deep Sea",      g: "linear-gradient(135deg, #030712, #0c4a6e, #0284c7, #38bdf8)" },
  { label: "Tsunami",       g: "linear-gradient(135deg, #042f2e, #0f766e, #2dd4bf, #a7f3d0)" },
  { label: "Arctic",        g: "linear-gradient(135deg, #0c1445, #1e40af, #60a5fa, #bfdbfe)" },
  { label: "Hydra",         g: "linear-gradient(135deg, #0a0a2e, #1d4ed8, #7c3aed, #06b6d4)" },
  // Row 4 — Neon
  { label: "Cyber",         g: "linear-gradient(135deg, #0a0a0a, #0d0221, #00ff88, #0d0221, #7700ff)" },
  { label: "Neon Tokyo",    g: "linear-gradient(135deg, #0d0221, #ff0080, #7700ff, #0080ff)" },
  { label: "Matrix",        g: "linear-gradient(135deg, #000000, #003300, #00ff00, #003300)" },
  { label: "Electric",      g: "linear-gradient(135deg, #0a0014, #4c1d95, #7c3aed, #a78bfa)" },
  // Row 5 — Nature
  { label: "Forest",        g: "linear-gradient(135deg, #052e16, #14532d, #16a34a, #4ade80)" },
  { label: "Emerald",       g: "linear-gradient(135deg, #042f2e, #065f46, #059669, #34d399)" },
  { label: "Midnight",      g: "linear-gradient(135deg, #0f172a, #1e293b, #334155, #475569)" },
  { label: "Rose",          g: "linear-gradient(135deg, #1a0010, #9d174d, #ec4899, #fda4af)" },
  // Row 6 — Premium
  { label: "Gold",          g: "linear-gradient(135deg, #1c1100, #713f12, #d97706, #fde68a)" },
  { label: "Chrome",        g: "linear-gradient(135deg, #111827, #374151, #9ca3af, #f9fafb)" },
  { label: "RomX Signature",g: "linear-gradient(135deg, #020408, #0f1f3d, #1d4ed8, #7c3aed, #0ea5e9)" },
  { label: "Evolution",     g: "linear-gradient(135deg, #0d1117, #161b22, #0ea5e9, #6366f1, #8b5cf6)" },
];

// Helper — decode gradient cover string (cover strings starting with "__gradient__" are inline gradients).
export function getCoverStyle(coverImage: string | undefined): { isGradient: boolean; gradient?: string; url?: string } {
  if (!coverImage) return { isGradient: false };
  if (coverImage.startsWith("__gradient__")) {
    return { isGradient: true, gradient: decodeURIComponent(coverImage.replace("__gradient__", "")) };
  }
  return { isGradient: false, url: coverImage };
}
