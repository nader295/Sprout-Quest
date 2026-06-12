"use client";

import { useState } from "react";
import { Share2, Link2, Check, X, MessageCircle, Send } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { useTranslation } from "@/lib/i18n";

interface ShareMenuProps {
  open: boolean;
  onClose: () => void;
  url: string;
  title: string;
}

export function ShareMenu({ open, onClose, url, title }: ShareMenuProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const dragY = useMotionValue(0);
  const backdropOpacity = useTransform(dragY, [0, 200], [1, 0.2]);

  const fullUrl = typeof window !== "undefined" ? `${window.location.origin}${url}` : url;
  const encodedUrl = encodeURIComponent(fullUrl);
  const encodedTitle = encodeURIComponent(title);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = fullUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLinks = [
    {
      name: "Telegram",
      icon: <Send className="h-5 w-5" />,
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      color: "#0088cc",
      bg: "rgba(0,136,204,0.1)",
      border: "rgba(0,136,204,0.25)",
    },
    {
      name: "WhatsApp",
      icon: <MessageCircle className="h-5 w-5" />,
      href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      color: "#25d366",
      bg: "rgba(37,211,102,0.1)",
      border: "rgba(37,211,102,0.25)",
    },
    {
      name: "X / Twitter",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      color: "#e7e9ea",
      bg: "rgba(231,233,234,0.08)",
      border: "rgba(231,233,234,0.15)",
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4" style={{ paddingBottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" }}>
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/65 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ opacity: backdropOpacity }}
            onClick={onClose}
          />

          <motion.div
            className="relative w-full max-w-sm rounded-3xl border border-border bg-card overflow-hidden shadow-2xl touch-none"
            style={{ boxShadow: "0 -20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)", y: dragY }}
            initial={{ y: 60, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 200, opacity: 0, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 300) {
                onClose();
              } else {
                dragY.set(0);
              }
            }}
          >

            {/* Top glow */}
            <div className="absolute inset-x-0 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(29,155,240,0.4), transparent)" }} />

            {/* Handle (mobile) */}
            {/* Drag handle (mobile) */}
            <div className="flex justify-center pt-3 pb-0 sm:hidden cursor-grab active:cursor-grabbing">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/25" />
            </div>

            {/* Close btn */}
            <motion.button onClick={onClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="absolute end-3 top-3 flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted hover:border-[var(--primary)]/30 transition-colors">
              <X className="h-4 w-4" />
            </motion.button>

            <div className="p-5 pt-4">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: "var(--primary-dim)", border: "1px solid var(--primary)" }}>
                  <Share2 className="h-4 w-4" style={{ color: "var(--primary)", filter: "drop-shadow(0 0 3px rgba(29,155,240,0.28))" }} />
                </div>
                <h2 className="text-base font-black text-foreground">{t("share.title")}</h2>
              </div>

              {/* Copy link */}
              <motion.button onClick={copyLink}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="group relative flex w-full items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3.5 mb-3 text-start transition-all hover:bg-muted hover:border-[var(--primary)]/30 overflow-hidden">
                {/* Shine sweep */}
                <span className="absolute inset-0 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-500 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12" />

                <div className={`relative flex h-10 w-10 items-center justify-center rounded-2xl shrink-0 transition-all duration-300 ${
                  copied ? "bg-emerald-500/15 scale-110" : "bg-muted"
                }`}>
                  {copied
                    ? <Check className="h-4 w-4 text-emerald-400" style={{ filter: "drop-shadow(0 0 3px rgba(52,211,153,0.28))" }} />
                    : <Link2 className="h-4 w-4 text-muted-foreground group-hover:text-[var(--primary)] transition-colors" />
                  }
                </div>
                <div className="relative flex-1 min-w-0">
                  <p className="text-sm font-black text-foreground transition-colors">
                    {copied ? t("share.copied") : t("share.copyLink")}
                  </p>
                  <p className="text-xs text-muted-foreground truncate font-mono">{fullUrl}</p>
                </div>
              </motion.button>

              {/* Social share buttons */}
              <div className="flex gap-2">
                {shareLinks.map((link, i) => (
                  <motion.a
                    key={link.name}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-1 flex-col items-center gap-1.5 rounded-2xl border p-3.5 transition-colors"
                    style={{ borderColor: link.border, backgroundColor: link.bg }}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.06, type: "spring", stiffness: 400, damping: 25 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span style={{ color: link.color, filter: `drop-shadow(0 0 6px ${link.color}60)` }}
                      className="transition-transform group-hover:scale-125 group-hover:rotate-[-5deg] inline-block">
                      {link.icon}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">{link.name}</span>
                  </motion.a>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

