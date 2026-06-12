"use client";

import React from 'react';
import { creatorTranslations, CreatorTranslation } from '@/lib/creators-translations';
import { useTranslation } from '@/lib/i18n';
import { 
  BarChart3, 
  Medal, 
  HeartHandshake, 
  ArrowRight,
  MessageSquareText,
  Rocket,
  ArrowRightLeft,
  LayoutGrid,
  Link2,
  Cpu,
  LineChart,
  HelpCircle,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';

export default function CreatorsPage() {
  const { lang, dir, ready } = useTranslation();
  
  if (!ready) return null;

  const t: CreatorTranslation = creatorTranslations[lang] || creatorTranslations['en'];

  const pillars = [
    {
      icon: <BarChart3 className="w-8 h-8 text-blue-400" />,
      title: t.pillar1Title,
      description: t.pillar1Desc,
      glow: "group-hover:shadow-[0_0_35px_-5px_rgba(59,130,246,0.25)] border-blue-500/10"
    },
    {
      icon: <MessageSquareText className="w-8 h-8 text-indigo-400" />,
      title: t.pillar2Title,
      description: t.pillar2Desc,
      glow: "group-hover:shadow-[0_0_35px_-5px_rgba(99,102,241,0.25)] border-indigo-500/10"
    },
    {
      icon: <Medal className="w-8 h-8 text-amber-400" />,
      title: t.pillar3Title,
      description: t.pillar3Desc,
      glow: "group-hover:shadow-[0_0_35px_-5px_rgba(251,191,36,0.25)] border-amber-500/10"
    },
    {
      icon: <HeartHandshake className="w-8 h-8 text-emerald-400" />,
      title: t.pillar4Title,
      description: t.pillar4Desc,
      glow: "group-hover:shadow-[0_0_35px_-5px_rgba(16,185,129,0.25)] border-emerald-500/10",
      badge: lang === 'ar' ? 'قريباً' : 'Soon'
    }
  ];

  const faqs = [
    { q: t.faq1Q, a: t.faq1A },
    { q: t.faq2Q, a: t.faq2A },
    { q: t.faq3Q, a: t.faq3A },
  ];

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-[#0A0A0B] text-gray-100 overflow-hidden font-sans" dir={dir}>
      
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-purple-900/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute top-[40%] right-[-10%] w-[600px] h-[500px] bg-blue-900/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-32 relative z-10 space-y-32">
        
        {/* HERO SECTION */}
        <section className="text-center max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-xs sm:text-sm text-gray-300 font-semibold backdrop-blur-md shadow-sm transition-colors hover:bg-white/10 mt-10">
            <Rocket className="w-4 h-4 text-purple-400 animate-pulse" />
            Designed exclusively for Custom ROM Developers
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight leading-[1.1]">
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-200 to-gray-500">
              {t.heroTitle}
            </span>
          </h1>
          
          <p className="text-base sm:text-xl text-gray-400 leading-relaxed max-w-3xl mx-auto font-medium">
            {t.heroSubtitle}
          </p>
          
          <div className="pt-6 flex justify-center">
            <Link 
              href="/login" 
              className="group relative flex items-center justify-center gap-3 bg-white text-black px-10 py-4 rounded-full font-bold text-base sm:text-lg hover:scale-[1.02] transition-all duration-300 shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:shadow-[0_0_50px_rgba(255,255,255,0.3)]"
            >
              <span>{t.ctaButton}</span>
              <ArrowRight className={`w-5 h-5 transition-transform duration-300 ${dir === 'rtl' ? 'group-hover:-translate-x-1 rotate-180' : 'group-hover:translate-x-1'}`} />
            </Link>
          </div>
        </section>

        {/* THE SYNERGY SECTION */}
        <section className="animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-150 fill-mode-both">
          <div className="bg-gradient-to-tr from-[#121214] to-[#1a1a1e] border border-white/10 rounded-3xl p-8 sm:p-12 relative overflow-hidden group hover:border-purple-500/20 transition-all">
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full group-hover:bg-purple-500/20 transition-all duration-700" />
            <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center">
              <div className="bg-white/5 p-5 rounded-2xl border border-white/10 flex-shrink-0">
                <ArrowRightLeft className="w-12 h-12 text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 tracking-tight">{t.synergyTitle}</h2>
                <p className="text-gray-400 leading-relaxed text-sm sm:text-base max-w-3xl font-medium">{t.synergyDesc}</p>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS (3 Simple Steps) */}
        <section className="animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200 fill-mode-both">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">{t.howItWorksTitle}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 sm:gap-8 relative max-w-5xl mx-auto">
            
            {/* Connecting Line */}
            <div className="hidden md:block absolute top-[40px] left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent z-0" />

            {/* Step 1 */}
            <div className="relative z-10 flex flex-col items-center text-center group">
              <div className="w-20 h-20 bg-[#121214] border border-white/10 rounded-full flex items-center justify-center mb-6 group-hover:border-purple-500/40 transition-colors shadow-lg shadow-black/50">
                <Link2 className="w-8 h-8 text-gray-400 group-hover:text-purple-400 transition-colors" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3">{t.howItWorksStep1Title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{t.howItWorksStep1Desc}</p>
            </div>

            {/* Step 2 */}
            <div className="relative z-10 flex flex-col items-center text-center group">
              <div className="w-20 h-20 bg-[#121214] border border-white/10 rounded-full flex items-center justify-center mb-6 group-hover:border-blue-500/40 transition-colors shadow-lg shadow-black/50">
                <Cpu className="w-8 h-8 text-gray-400 group-hover:text-blue-400 transition-colors" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3">{t.howItWorksStep2Title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{t.howItWorksStep2Desc}</p>
            </div>

            {/* Step 3 */}
            <div className="relative z-10 flex flex-col items-center text-center group">
              <div className="w-20 h-20 bg-[#121214] border border-white/10 rounded-full flex items-center justify-center mb-6 group-hover:border-emerald-500/40 transition-colors shadow-lg shadow-black/50">
                <LineChart className="w-8 h-8 text-gray-400 group-hover:text-emerald-400 transition-colors" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3">{t.howItWorksStep3Title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{t.howItWorksStep3Desc}</p>
            </div>

          </div>
        </section>

        {/* PILLARS GRID */}
        <section className="animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-300 fill-mode-both">
          <div className="grid md:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto">
            {pillars.map((pillar, idx) => (
              <div 
                key={idx}
                className={`group bg-[#121214]/80 backdrop-blur-md border ${pillar.glow} hover:bg-[#1a1a1e] p-8 rounded-3xl transition-all duration-500 hover:-translate-y-1.5 flex flex-col items-start`}
              >
                <div className="flex justify-between items-start w-full mb-6">
                  <div className="p-4 bg-white/5 rounded-[20px] group-hover:scale-105 transition-transform duration-500 border border-white/5">
                    {pillar.icon}
                  </div>
                  {pillar.badge && (
                    <span className="px-3 py-1 bg-white/5 text-gray-300 border border-white/10 rounded-full text-xs font-bold tracking-widest uppercase">
                      {pillar.badge}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-gray-100 mb-3 tracking-tight">{pillar.title}</h3>
                <p className="text-[15px] text-gray-400 leading-relaxed font-medium">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* WORKFLOW EVOLUTION */}
        <section className="animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500 fill-mode-both text-center">
          <div className="mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">{t.workflowTitle}</h2>
          </div>
          
          <div className="grid md:grid-cols-[1fr_auto_1fr] gap-6 items-stretch max-w-5xl mx-auto text-left">
            {/* Old Way */}
            <div className="bg-[#121214] border border-white/5 rounded-3xl p-8 relative opacity-70 hover:opacity-100 transition-opacity flex flex-col h-full justify-center">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                <span className="text-red-400/80 font-bold tracking-wide uppercase text-sm">{t.workflowOldTitle}</span>
              </div>
              <p className="text-gray-500 text-[15px] leading-relaxed font-medium">
                {t.workflowOldDesc}
              </p>
            </div>

            {/* Divider */}
            <div className="hidden md:flex flex-col items-center justify-center opacity-50">
               <div className="w-[1px] h-16 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
               <div className="bg-[#121214] border border-white/20 text-gray-400 text-xs font-bold px-3 py-2 rounded-full z-10 mx-4 shadow-xl">
                 <ArrowRight className={`w-4 h-4 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
               </div>
               <div className="w-[1px] h-16 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
            </div>

            {/* RomX Way */}
            <div className="bg-gradient-to-b from-purple-900/10 to-[#121214] border border-purple-500/20 rounded-3xl p-8 relative group hover:border-purple-500/50 hover:shadow-[0_0_50px_-10px_rgba(168,85,247,0.15)] transition-all duration-500 flex flex-col h-full justify-center">
              <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="w-3 h-3 rounded-full bg-purple-500 animate-[pulse_2s_ease-in-out_infinite] shadow-[0_0_12px_rgba(168,85,247,0.8)]" />
                <span className="text-purple-400 font-bold tracking-wider uppercase text-sm">{t.workflowRomxTitle}</span>
              </div>
              <p className="text-gray-300 text-[15px] leading-relaxed font-medium relative z-10">
                {t.workflowRomxDesc}
              </p>
            </div>
          </div>
        </section>

        {/* F.A.Q SECTION */}
        <section className="animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500 fill-mode-both max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-10">
            <HelpCircle className="w-8 h-8 text-gray-500" />
            <h2 className="text-3xl font-bold text-white text-center">{t.faqTitle}</h2>
          </div>
          
          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-[#121214]/60 border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors">
                <h3 className="text-lg font-bold text-gray-200 mb-3 flex items-start gap-3">
                  <span className="text-purple-400 font-black mt-0.5">Q.</span> 
                  {faq.q}
                </h3>
                <p className="text-gray-400 text-[15px] leading-relaxed flex items-start gap-3 font-medium">
                  <span className="text-emerald-500 mt-1"><CheckCircle2 className="w-4 h-4" /></span>
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section className="text-center animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-700 fill-mode-both pb-10">
          <div className="p-4 bg-white/5 inline-flex rounded-3xl mb-8 border border-white/10 shadow-xl">
             <LayoutGrid className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight">{t.ctaTitle}</h2>
          <p className="text-gray-400 mb-10 text-lg">{t.ctaDesc}</p>
          <Link 
            href="/login" 
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-12 py-4 rounded-full font-bold text-lg hover:scale-[1.03] transition-all duration-300 shadow-[0_0_30px_-5px_rgba(168,85,247,0.5)] hover:shadow-[0_0_50px_rgba(168,85,247,0.7)]"
          >
            {t.ctaButton}
            <ArrowRight className={`w-5 h-5 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
          </Link>
        </section>

      </div>
    </div>
  );
}
