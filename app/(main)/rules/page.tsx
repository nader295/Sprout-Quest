"use client";

import { Shield, AlertTriangle, CheckCircle2, XCircle, Users, FileWarning, Scale } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function RulesPage() {
  const { t } = useTranslation();

  const SECTIONS = [
    {
      icon: Shield,
      titleKey: "rules.general.title",
      color: "text-blue-400 bg-blue-400/10",
      ruleKeys: ["rules.general.1","rules.general.2","rules.general.3","rules.general.4","rules.general.5"],
    },
    {
      icon: CheckCircle2,
      titleKey: "rules.upload.title",
      color: "text-emerald-400 bg-emerald-400/10",
      ruleKeys: ["rules.upload.1","rules.upload.2","rules.upload.3","rules.upload.4","rules.upload.5","rules.upload.6","rules.upload.7"],
    },
    {
      icon: XCircle,
      titleKey: "rules.prohibited.title",
      color: "text-red-400 bg-red-400/10",
      ruleKeys: ["rules.prohibited.1","rules.prohibited.2","rules.prohibited.3","rules.prohibited.4","rules.prohibited.5","rules.prohibited.6"],
    },
    {
      icon: Users,
      titleKey: "rules.community.title",
      color: "text-cyan-400 bg-cyan-400/10",
      ruleKeys: ["rules.community.1","rules.community.2","rules.community.3","rules.community.4","rules.community.5"],
    },
    {
      icon: Scale,
      titleKey: "rules.enforcement.title",
      color: "text-amber-400 bg-amber-400/10",
      ruleKeys: ["rules.enforcement.1","rules.enforcement.2","rules.enforcement.3","rules.enforcement.4","rules.enforcement.5"],
    },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
      <div className="flex items-center gap-2 mb-4 sm:gap-3 sm:mb-6">
        <FileWarning className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: "var(--primary)" }} />
        <div>
          <h1 className="text-lg font-bold text-foreground sm:text-xl">{t("rules.title")}</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">{t("rules.subtitle")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {SECTIONS.map((s, idx) => (
          <div key={idx} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <h2 className="text-sm font-bold text-foreground">{t(s.titleKey)}</h2>
            </div>
            <ul className="flex flex-col gap-2">
              {s.ruleKeys.map((key) => (
                <li key={key} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
                  {t(key)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-amber-400 mb-2" />
        <p className="text-sm font-bold text-foreground">{t("rules.agree")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("rules.violation")}</p>
      </div>
    </div>
  );
}
