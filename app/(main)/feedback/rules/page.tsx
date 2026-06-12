"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, XCircle, Lightbulb, Bug, AlertTriangle, ChevronLeft } from "lucide-react";

import { useTranslation } from "@/lib/i18n";

const getRules = (t: any) => [
  {
    type: "bug" as const,
    icon: Bug,
    color: "#fb7185",
    bg: "rgba(251,113,133,0.08)",
    border: "rgba(251,113,133,0.2)",
    title: t("feedback.rules.bugTitle") || "Report a Bug",
    dos: [
      t("feedback.rules.bugDo1") || "Mention the steps that caused the issue",
      t("feedback.rules.bugDo2") || "Mention the device and browser you are using",
      t("feedback.rules.bugDo3") || "If there's an error message, copy it fully",
      t("feedback.rules.bugDo4") || "Mention when the issue started happening",
      t("feedback.rules.bugDo5") || "Clarify if the issue happens always or sometimes",
    ],
    donts: [
      t("feedback.rules.bugDont1") || "Don't just say 'The site is not working' without details",
      t("feedback.rules.bugDont2") || "Don't report the same issue multiple times",
      t("feedback.rules.bugDont3") || "Don't report an issue if you have a slow internet connection",
    ],
    example: t("feedback.rules.bugExample") || "Good example: 'When I click the download button on DragonX ROM for Poco X7 Pro using Chrome, the page reloads without starting the download.'",
  },
  {
    type: "suggestion" as const,
    icon: Lightbulb,
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.08)",
    border: "rgba(251,191,36,0.2)",
    title: t("feedback.rules.suggestTitle") || "Suggest an Idea",
    dos: [
      t("feedback.rules.suggestDo1") || "Explain the problem your idea solves",
      t("feedback.rules.suggestDo2") || "Clarify the benefit for users or developers",
      t("feedback.rules.suggestDo3") || "If you have a visual concept, describe it",
      t("feedback.rules.suggestDo4") || "Consider the feasibility of implementation",
      t("feedback.rules.suggestDo5") || "One clear suggestion is better than ten vague ones",
    ],
    donts: [
      t("feedback.rules.suggestDont1") || "Don't suggest features that already exist",
      t("feedback.rules.suggestDont2") || "Don't suggest something too generic like 'make the site faster'",
      t("feedback.rules.suggestDont3") || "Don't suggest features unrelated to ROMs and Android",
    ],
    example: t("feedback.rules.suggestExample") || "Good example: 'I suggest adding a filter to search by chipset, because many developers make ROMs for Dimensity 9300 devices and they are hard to find.'",
  },
];

export default function FeedbackRulesPage() {
  const { t } = useTranslation();
  const rules = getRules(t);
  
  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link href="/feedback"
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-90"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-black text-white">{t("feedback.rulesTitle") || "Feedback Rules"}</h1>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{t("feedback.rulesSubtitle") || "To ensure your suggestion is received properly"}</p>
        </div>
      </div>

      {/* General rule */}
      <div className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: "rgba(29,155,240,0.07)", border: "1px solid rgba(29,155,240,0.2)" }}>
        <AlertTriangle className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
          {t("feedback.rulesInfo") || "Clear and specific feedback is received and implemented faster. Every detail you provide saves time and brings the idea closer to implementation."}
        </p>
      </div>

      {/* Rules per type */}
      {rules.map((rule) => (
        <div key={rule.type} className="rounded-2xl overflow-hidden"
          style={{ border: `1px solid ${rule.border}`, background: rule.bg }}>

          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b"
            style={{ borderColor: rule.border }}>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: `${rule.color}15`, border: `1px solid ${rule.color}25` }}>
              <rule.icon className="h-4 w-4" style={{ color: rule.color }} />
            </div>
            <p className="text-sm font-black text-white">{rule.title}</p>
          </div>

          <div className="p-4 space-y-4">
            {/* Do's */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: "#4ade80" }}>✓ {t("feedback.do") || "DO THIS"}</p>
              <ul className="space-y-1.5">
                {rule.dos.map((d, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>{d}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Don'ts */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: "#fb7185" }}>✗ {t("feedback.dont") || "DON'T DO THIS"}</p>
              <ul className="space-y-1.5">
                {rule.donts.map((d, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <XCircle className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{d}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Example */}
            <div className="rounded-xl px-3 py-2.5"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[10px] font-black uppercase tracking-widest mb-1"
                style={{ color: rule.color }}>{t("feedback.example") || "EXAMPLE"}</p>
              <p className="text-[11px] leading-relaxed italic"
                style={{ color: "rgba(255,255,255,0.55)" }}>{rule.example}</p>
            </div>
          </div>
        </div>
      ))}

      {/* CTA */}
      <Link href="/feedback"
        className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white transition-all hover:opacity-90 active:scale-[0.98]"
        style={{ background: "linear-gradient(135deg, #1d9bf0, #6366f1)", boxShadow: "0 6px 20px rgba(29,155,240,0.3)" }}>
        {t("feedback.sendNow") || "Send Feedback Now"}
        <ArrowRight className="h-4 w-4" />
      </Link>

    </div>
  );
}
