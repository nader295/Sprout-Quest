"use client";

import {
  contactHref,
  type ContactChannelKey,
  type ContactChannels,
} from "@/lib/marketplace/types";
import {
  Send,
  MessageCircle,
  Mail,
  MessagesSquare,
  ShieldCheck,
  Hash,
  Globe,
  Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CHANNEL_META: Record<
  ContactChannelKey,
  { label: string; Icon: React.ElementType; color: string }
> = {
  telegram: { label: "Telegram", Icon: Send,           color: "#229ED9" },
  whatsapp: { label: "WhatsApp", Icon: MessageCircle,  color: "#25D366" },
  discord:  { label: "Discord",  Icon: MessagesSquare, color: "#5865F2" },
  matrix:   { label: "Matrix",   Icon: ShieldCheck,    color: "#0dbd8b" },
  signal:   { label: "Signal",   Icon: ShieldCheck,    color: "#3a76f0" },
  xmpp:     { label: "XMPP",     Icon: Hash,           color: "#1d9bf0" },
  email:    { label: "Email",    Icon: Mail,           color: "#94a3b8" },
  website:  { label: "Website",  Icon: Globe,          color: "#1d9bf0" },
};

const CHANNEL_ORDER: ContactChannelKey[] = [
  "telegram",
  "whatsapp",
  "signal",
  "matrix",
  "discord",
  "xmpp",
  "email",
  "website",
];

export function ContactPanel({
  channels,
  preferred,
  compact = false,
  onContact,
}: {
  channels: ContactChannels;
  preferred?: ContactChannelKey | null;
  compact?: boolean;
  onContact?: (channel: ContactChannelKey) => void;
}) {
  const entries = CHANNEL_ORDER
    .filter((k) => !!channels[k])
    .map((k) => ({ key: k, handle: channels[k] as string }));

  if (!entries.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-3 text-[11px] font-bold text-muted-foreground">
        No contact channels published yet.
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", compact && "gap-1.5")}>
      {entries.map(({ key, handle }) => {
        const meta = CHANNEL_META[key] ?? {
          label: key,
          Icon: Phone,
          color: "#94a3b8",
        };
        const url = contactHref(key, handle);
        const isPreferred = preferred === key;
        const Icon = meta.Icon;

        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onContact?.(key)}
            className="group flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-2.5 transition-all hover:bg-muted/60"
          >
            <span
              className="flex shrink-0 items-center justify-center rounded-xl border"
              style={{
                width: compact ? 32 : 38,
                height: compact ? 32 : 38,
                background: `color-mix(in srgb, ${meta.color} 12%, transparent)`,
                borderColor: `color-mix(in srgb, ${meta.color} 35%, transparent)`,
                color: meta.color,
              }}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  {meta.label}
                </span>
                {isPreferred && (
                  <span
                    className="rounded-full px-1.5 py-[1px] text-[9px] font-black uppercase tracking-widest"
                    style={{
                      color: "var(--primary)",
                      background: "var(--primary-dim)",
                      border: "1px solid color-mix(in srgb, var(--primary) 35%, transparent)",
                    }}
                  >
                    preferred
                  </span>
                )}
              </div>
              <div className="truncate text-sm font-bold text-foreground">
                {handle}
              </div>
            </div>
            <span className="shrink-0 rounded-lg border border-border px-2 py-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground transition-colors group-hover:border-[color:var(--primary)]/40 group-hover:text-foreground">
              Open
            </span>
          </a>
        );
      })}
    </div>
  );
}
