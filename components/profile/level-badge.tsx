// ── XP Level SVG Badges ──────────────────────────────────────────
// Pure presentational component, no state/hooks/effects. Safe to memoize.

export function LevelBadge({ level, size = 40 }: { level: number; size?: number }) {
  // Member - simple hexagon outline
  if (level < 3) return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <polygon points="20,3 35,11.5 35,28.5 20,37 5,28.5 5,11.5" stroke="var(--primary)" strokeWidth="1.5" fill="var(--primary-dim)" />
      <text x="20" y="24" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--primary)" fontFamily="monospace">M</text>
    </svg>
  );
  // Publisher - hexagon with corner marks
  if (level < 7) return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <polygon points="20,3 35,11.5 35,28.5 20,37 5,28.5 5,11.5" stroke="#6366f1" strokeWidth="1.5" fill="rgba(99,102,241,0.12)" />
      <line x1="20" y1="3" x2="20" y2="8" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
      <line x1="35" y1="11.5" x2="31" y2="14" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
      <line x1="35" y1="28.5" x2="31" y2="26" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
      <text x="20" y="24" textAnchor="middle" fontSize="11" fontWeight="700" fill="#6366f1" fontFamily="monospace">P</text>
    </svg>
  );
  // Developer - hexagon with inner ring
  if (level < 10) return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <polygon points="20,3 35,11.5 35,28.5 20,37 5,28.5 5,11.5" stroke="#10b981" strokeWidth="1.5" fill="rgba(16,185,129,0.12)" />
      <polygon points="20,9 30,14.5 30,25.5 20,31 10,25.5 10,14.5" stroke="#10b981" strokeWidth="1" strokeDasharray="2 2" fill="none" opacity="0.6"/>
      <text x="20" y="24" textAnchor="middle" fontSize="11" fontWeight="700" fill="#10b981" fontFamily="monospace">DEV</text>
    </svg>
  );
  // Top Developer - double hexagon
  if (level < 15) return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" stroke="#0ea5e9" strokeWidth="1.5" fill="rgba(14,165,233,0.1)" />
      <polygon points="20,8 30,14 30,26 20,32 10,26 10,14" stroke="#0ea5e9" strokeWidth="1" fill="rgba(14,165,233,0.08)" />
      <line x1="20" y1="2" x2="20" y2="8" stroke="#0ea5e9" strokeWidth="1.5"/>
      <line x1="36" y1="11" x2="30" y2="14" stroke="#0ea5e9" strokeWidth="1.5"/>
      <line x1="36" y1="29" x2="30" y2="26" stroke="#0ea5e9" strokeWidth="1.5"/>
      <line x1="20" y1="38" x2="20" y2="32" stroke="#0ea5e9" strokeWidth="1.5"/>
      <line x1="4" y1="29" x2="10" y2="26" stroke="#0ea5e9" strokeWidth="1.5"/>
      <line x1="4" y1="11" x2="10" y2="14" stroke="#0ea5e9" strokeWidth="1.5"/>
      <text x="20" y="23" textAnchor="middle" fontSize="8" fontWeight="800" fill="#0ea5e9" fontFamily="monospace">TOP</text>
    </svg>
  );
  // Pro Developer - shield with circuit lines
  if (level < 20) return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path d="M20 3 L34 9 L34 22 C34 30 20 37 20 37 C20 37 6 30 6 22 L6 9 Z" stroke="#3b82f6" strokeWidth="1.5" fill="rgba(59,130,246,0.1)"/>
      <path d="M20 8 L29 13 L29 22 C29 27.5 20 32 20 32 C20 32 11 27.5 11 22 L11 13 Z" stroke="#3b82f6" strokeWidth="1" fill="rgba(59,130,246,0.08)" strokeDasharray="2 1.5"/>
      <line x1="14" y1="16" x2="18" y2="16" stroke="#3b82f6" strokeWidth="1.2"/>
      <line x1="18" y1="16" x2="18" y2="20" stroke="#3b82f6" strokeWidth="1.2"/>
      <line x1="18" y1="20" x2="22" y2="20" stroke="#3b82f6" strokeWidth="1.2"/>
      <line x1="22" y1="20" x2="22" y2="24" stroke="#3b82f6" strokeWidth="1.2"/>
      <line x1="22" y1="24" x2="26" y2="24" stroke="#3b82f6" strokeWidth="1.2"/>
      <circle cx="14" cy="16" r="1.2" fill="#3b82f6"/>
      <circle cx="26" cy="24" r="1.2" fill="#3b82f6"/>
      <text x="20" y="15" textAnchor="middle" fontSize="7" fontWeight="800" fill="#3b82f6" fontFamily="monospace">PRO</text>
    </svg>
  );
  // Expert Developer - star/diamond hybrid
  if (level < 30) return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <polygon points="20,2 24,16 38,20 24,24 20,38 16,24 2,20 16,16" stroke="#a855f7" strokeWidth="1.5" fill="rgba(168,85,247,0.1)"/>
      <polygon points="20,8 22.5,17.5 32,20 22.5,22.5 20,32 17.5,22.5 8,20 17.5,17.5" stroke="#a855f7" strokeWidth="1" fill="rgba(168,85,247,0.08)"/>
      <circle cx="20" cy="20" r="3" fill="rgba(168,85,247,0.3)" stroke="#a855f7" strokeWidth="1"/>
      <line x1="20" y1="2" x2="20" y2="8" stroke="#a855f7" strokeWidth="1" strokeOpacity="0.5"/>
      <line x1="38" y1="20" x2="32" y2="20" stroke="#a855f7" strokeWidth="1" strokeOpacity="0.5"/>
      <line x1="20" y1="38" x2="20" y2="32" stroke="#a855f7" strokeWidth="1" strokeOpacity="0.5"/>
      <line x1="2" y1="20" x2="8" y2="20" stroke="#a855f7" strokeWidth="1" strokeOpacity="0.5"/>
    </svg>
  );
  // Legendary Developer - crown with gems
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <defs>
        <radialGradient id="lgold" cx="50%" cy="30%">
          <stop offset="0%" stopColor="#fde68a"/>
          <stop offset="100%" stopColor="#d97706"/>
        </radialGradient>
      </defs>
      <polygon points="20,2 36,12 36,30 20,38 4,30 4,12" stroke="#f59e0b" strokeWidth="1.5" fill="rgba(245,158,11,0.12)"/>
      <path d="M10 28 L10 17 L16 23 L20 13 L24 23 L30 17 L30 28 Z" fill="url(#lgold)" stroke="#d97706" strokeWidth="0.8"/>
      <circle cx="10" cy="17" r="2" fill="#fbbf24" stroke="#d97706" strokeWidth="0.8"/>
      <circle cx="30" cy="17" r="2" fill="#fbbf24" stroke="#d97706" strokeWidth="0.8"/>
      <circle cx="20" cy="13" r="2.5" fill="#fde68a" stroke="#d97706" strokeWidth="0.8"/>
      <rect x="10" y="27" width="20" height="2.5" rx="1" fill="#f59e0b" opacity="0.8"/>
      <line x1="20" y1="2" x2="20" y2="5" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.7"/>
      <line x1="4" y1="12" x2="7" y2="14" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.7"/>
      <line x1="36" y1="12" x2="33" y2="14" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.7"/>
    </svg>
  );
}

export function DistinctionBadge({ xp }: { xp: number }) {
  if (xp >= 25000) return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
      <LevelBadge level={30} size={14} /> Legendary
    </span>
  );
  if (xp >= 10000) return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-400">
      <LevelBadge level={20} size={14} /> Expert
    </span>
  );
  if (xp >= 5000) return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400">
      <LevelBadge level={15} size={14} /> Pro
    </span>
  );
  return null;
}
