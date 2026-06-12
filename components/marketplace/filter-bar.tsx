"use client";

import { cn } from "@/lib/utils";
import {
  CATEGORY_LABEL,
  type Category,
  type FilterState,
} from "@/lib/marketplace/types";
import { ArrowDownLeft, ArrowUpRight, Filter, Layers, Search, X } from "lucide-react";

export type { FilterState };

export function FilterBar({
  value,
  onChange,
  total,
  hideKind = false,
}: {
  value: FilterState;
  onChange: (next: FilterState) => void;
  total: number;
  hideKind?: boolean;
}) {
  const active =
    (value.kind !== "all" ? 1 : 0) +
    (value.category !== "all" ? 1 : 0) +
    (value.query.trim() ? 1 : 0);

  const clear = () =>
    onChange({ kind: "all", category: "all", query: "", sort: "recent" });

  return (
    <div className="flex flex-col gap-3">
      {/* Search + sort row */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={value.query}
            onChange={(e) => onChange({ ...value, query: e.target.value })}
            placeholder="Search services, devices, tags…"
            className="h-10 w-full rounded-xl border border-border bg-muted/40 pl-9 pr-3 text-sm font-medium text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-[color:var(--primary)]/60"
          />
        </div>

        <select
          value={value.sort}
          onChange={(e) =>
            onChange({ ...value, sort: e.target.value as FilterState["sort"] })
          }
          className="h-10 rounded-xl border border-border bg-muted/40 px-3 text-xs font-bold text-foreground outline-none transition-colors focus:border-[color:var(--primary)]/60"
          aria-label="Sort"
        >
          <option value="recent">Most recent</option>
          <option value="popular">Most viewed</option>
          <option value="budget_high">Budget · high → low</option>
          <option value="budget_low">Budget · low → high</option>
        </select>

        {active > 0 && (
          <button
            onClick={clear}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 text-xs font-black text-destructive transition-colors hover:bg-destructive/20"
          >
            <X className="h-3.5 w-3.5" /> Clear · {active}
          </button>
        )}
      </div>

      {/* Kind toggle */}
      {!hideKind && (
        <div className="flex items-center gap-1 rounded-2xl border border-border bg-card p-1">
          {(
            [
              { id: "all",     label: "All",      Icon: Layers,         accent: "var(--primary)" },
              { id: "request", label: "Requests", Icon: ArrowDownLeft,  accent: "var(--primary)" },
              { id: "offer",   label: "Offers",   Icon: ArrowUpRight,   accent: "#f59e0b" },
            ] as const
          ).map((o) => {
            const selected = value.kind === o.id;
            return (
              <button
                key={o.id}
                onClick={() => onChange({ ...value, kind: o.id })}
                className={cn(
                  "relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition-all",
                  selected
                    ? "text-white shadow-md"
                    : "text-muted-foreground hover:text-foreground",
                )}
                style={
                  selected
                    ? {
                        background: `linear-gradient(135deg, ${o.accent}, color-mix(in srgb, ${o.accent} 70%, #000))`,
                        boxShadow: `0 3px 10px color-mix(in srgb, ${o.accent} 35%, transparent)`,
                      }
                    : undefined
                }
              >
                <o.Icon className="h-3.5 w-3.5" />
                {o.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Category chips */}
      <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none">
        <CategoryChip
          active={value.category === "all"}
          onClick={() => onChange({ ...value, category: "all" })}
          label={`All${total >= 0 ? ` · ${total}` : ""}`}
          icon={<Filter className="h-3 w-3" />}
        />
        {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
          <CategoryChip
            key={c}
            active={value.category === c}
            onClick={() => onChange({ ...value, category: c })}
            label={CATEGORY_LABEL[c]}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black transition-all",
        active
          ? "text-white shadow-md"
          : "border border-border text-muted-foreground hover:border-[color:var(--primary)]/35 hover:text-foreground",
      )}
      style={
        active
          ? {
              background:
                "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 70%, #000))",
              boxShadow: "0 3px 8px var(--primary-glow)",
            }
          : undefined
      }
    >
      {icon}
      {label}
    </button>
  );
}
