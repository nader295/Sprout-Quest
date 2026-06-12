// ── Privacy Toggle Row — used in Edit Profile Settings tab ───────────────────
// Pure presentational toggle, no hooks. Parent owns the state.

export function PrivacyToggle({ icon, label, desc, val, set, color }: {
  icon: string; label: string; desc?: string;
  val: boolean; set: (v: boolean) => void; color: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-3 cursor-pointer" onClick={() => set(!val)}>
        <div className="flex items-center gap-2.5">
          <span className="text-base">{icon}</span>
          <div>
            <p className="text-xs font-black text-foreground">{label}</p>
            {desc && <p className="text-[9px] text-muted-foreground/40 mt-0.5">{desc}</p>}
          </div>
        </div>
        <div className="relative shrink-0" style={{ width: 44, height: 24 }}>
          <div className="absolute inset-0 rounded-full transition-all duration-300"
            style={{ background: val ? `linear-gradient(135deg, ${color}, ${color}bb)` : "rgb(var(--muted))", border: val ? "none" : "1px solid rgb(var(--border))", boxShadow: val ? `0 2px 8px ${color}40` : "none" }} />
          <div className="absolute top-0.5 rounded-full bg-white shadow-md transition-transform duration-300"
            style={{ width: 20, height: 20, transform: val ? "translateX(22px)" : "translateX(2px)" }} />
        </div>
      </div>
    </div>
  );
}
