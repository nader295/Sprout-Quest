"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CONSENT_KEY = "romx_cookie_consent";

// ── Google Consent Mode v2 helpers ─────────────────────────────────────────
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

function grantConsent() {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function (...args: unknown[]) { window.dataLayer.push(args); };
  }
  window.gtag("consent", "update", {
    ad_storage:         "granted",
    ad_user_data:       "granted",
    ad_personalization: "granted",
    analytics_storage:  "granted",
  });
}

function denyConsent() {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function (...args: unknown[]) { window.dataLayer.push(args); };
  }
  window.gtag("consent", "update", {
    ad_storage:         "denied",
    ad_user_data:       "denied",
    ad_personalization: "denied",
    analytics_storage:  "denied",
  });
}
// ───────────────────────────────────────────────────────────────────────────

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
    // Restore consent signal on every page load
    if (consent === "accepted") grantConsent();
    else denyConsent();
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    grantConsent();
    setShow(false);
  };

  const decline = () => {
    localStorage.setItem(CONSENT_KEY, "declined");
    denyConsent();
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <div
          className="fixed bottom-0 inset-x-0 z-[9998] p-4 lg:p-6"
          style={{ pointerEvents: "none" }}
          role="dialog"
          aria-label="Cookie consent"
          aria-describedby="cookie-consent-desc"
        >
          <motion.div
            className="mx-auto max-w-lg rounded-2xl border border-border/60 p-4 shadow-2xl"
            style={{
              backgroundColor: "rgb(var(--card))",
              backdropFilter: "blur(16px)",
              pointerEvents: "auto",
            }}
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-dim)]">
                <Cookie className="h-4.5 w-4.5 text-[var(--primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground mb-1">
                  We use cookies 🍪
                </p>
                <p id="cookie-consent-desc" className="text-xs text-muted-foreground leading-relaxed">
                  We use cookies to improve your experience, serve personalized ads through Google AdSense,
                  and analyze traffic. By clicking &quot;Accept All&quot;, you consent to our use of cookies.{" "}
                  <Link
                    href="/cookie-policy"
                    className="text-[var(--primary)] hover:underline"
                  >
                    Cookie Policy
                  </Link>{" "}
                  ·{" "}
                  <Link
                    href="/privacy"
                    className="text-[var(--primary)] hover:underline"
                  >
                    Privacy Policy
                  </Link>
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <motion.button
                    onClick={accept}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="rounded-xl px-4 py-2 text-xs font-bold text-white transition-all"
                    style={{
                      background: "linear-gradient(135deg, var(--primary), #3b82f6)",
                      boxShadow: "0 4px 12px rgba(29,155,240,0.3)",
                    }}
                  >
                    Accept All
                  </motion.button>
                  <motion.button
                    onClick={decline}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="rounded-xl px-4 py-2 text-xs font-medium text-muted-foreground border border-border hover:bg-muted hover:text-foreground transition-all"
                  >
                    Essential Only
                  </motion.button>
                </div>
              </div>
              <motion.button
                onClick={decline}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
