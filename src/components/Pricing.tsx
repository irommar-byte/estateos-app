"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Zap, Radar, Crown, Building2, User, ArrowRight, Eye, X, Key, Home } from 'lucide-react';
import { useLocale } from '@/contexts/LocaleContext';

export default function Pricing() {
  const { dict } = useLocale();
  const p = dict.pricing;
  const [isAgency, setIsAgency] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [isBasicModalOpen, setIsBasicModalOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  React.useEffect(() => {
    fetch('/api/auth/check')
      .then((r) => r.json())
      .then((d) => setIsLoggedIn(d.loggedIn))
      .catch(() => {});
  }, []);

  const handleCheckout = async (planName: string) => {
    if (!isLoggedIn) {
      setIsBasicModalOpen(true);
      return;
    }
    try {
      setLoadingPlan(planName);
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnUrl: window.location.origin + '/moje-konto/crm',
          plan: planName,
        }),
      });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (error) {
      console.error('Błąd płatności:', error);
    } finally {
      setLoadingPlan(null);
    }
  };

  const proFeatures = [
    { Icon: Eye, text: p.proF1 },
    { Icon: Check, text: p.proF2 },
    { Icon: Radar, text: p.proF3 },
    { Icon: Crown, text: p.proF4 },
    { Icon: Zap, text: p.proF5 },
  ];

  return (
    <section className="relative py-24 bg-black overflow-hidden font-sans min-h-screen flex items-center">
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#D4AF37]/5 rounded-full blur-[120px] pointer-events-none"
        aria-hidden
      />

      <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
        <motion.div className="text-center mb-16">
          <h2 className="text-sm font-black text-[#D4AF37] tracking-[0.2em] uppercase mb-4">{p.eyebrow}</h2>
          <h3 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-6">
            {p.title}{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#F9E498]">
              {p.titleHighlight}
            </span>
            {p.titleSuffix}
          </h3>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">{p.subtitle}</p>
        </motion.div>

        <div className="flex justify-center mb-16">
          <div className="bg-[#111] p-1.5 rounded-full border border-white/10 flex items-center relative w-full max-w-md">
            <div
              className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-[#222] border border-white/5 rounded-full transition-transform duration-500 ease-out shadow-lg"
              style={{ transform: isAgency ? 'translateX(100%)' : 'translateX(0)' }}
            />
            <button
              type="button"
              onClick={() => setIsAgency(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full relative z-10 font-bold text-sm transition-colors duration-300 ${!isAgency ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
            >
              <User size={16} /> {p.tabPrivate}
            </button>
            <button
              type="button"
              onClick={() => setIsAgency(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full relative z-10 font-bold text-sm transition-colors duration-300 ${isAgency ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
            >
              <Building2 size={16} /> {p.tabAgency}
            </button>
          </div>
        </div>

        {!isAgency && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto animate-in fade-in duration-700">
            <div className="bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-10 flex flex-col relative overflow-hidden group hover:border-white/20 transition-colors">
              <div className="mb-8">
                <h4 className="text-2xl font-black text-white mb-2">{p.basicName}</h4>
                <p className="text-white/50 text-sm">{p.basicDesc}</p>
              </div>
              <div className="mb-8 flex flex-col">
                <span className="text-xl text-transparent font-black mb-1 select-none pointer-events-none">-</span>
                <span className="text-5xl font-black text-white">
                  {p.basicPrice.split(' ')[0]}{' '}
                  <span className="text-lg text-white/50 font-medium">
                    {p.basicPrice.split(' ').slice(1).join(' ') || 'PLN'}
                  </span>
                </span>
              </div>

              <ul className="flex flex-col gap-5 mb-10 flex-1">
                <li className="flex items-start gap-3 text-white/80 text-sm">
                  <Check className="text-white/30 shrink-0" size={20} />
                  <span>{p.basicF1}</span>
                </li>
                <li className="flex items-start gap-3 text-white/80 text-sm">
                  <Radar className="text-emerald-500/80 shrink-0" size={20} />
                  <span>{p.basicF2}</span>
                </li>
                <li className="flex items-start gap-3 text-white/80 text-sm">
                  <Check className="text-white/30 shrink-0" size={20} />
                  <span>{p.basicF3}</span>
                </li>
                <li className="flex items-start gap-3 text-white/40 text-sm italic">
                  <Zap className="text-white/20 shrink-0" size={20} />
                  <span>{p.basicF4}</span>
                </li>
              </ul>

              <button
                type="button"
                onClick={() => setIsBasicModalOpen(true)}
                className="w-full py-5 rounded-2xl bg-[#111] border border-white/10 text-white font-bold hover:bg-[#222] transition-colors flex justify-center items-center gap-2"
              >
                {p.basicCta} <ArrowRight size={16} />
              </button>
            </div>

            <div className="bg-gradient-to-b from-[#1a150b] to-[#0a0a0a] border border-[#D4AF37]/30 rounded-[2.5rem] p-10 flex flex-col relative overflow-hidden group shadow-[0_0_50px_rgba(212,175,55,0.05)]">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#8A6E2F] via-[#F9E498] to-[#8A6E2F]" />
              <div className="absolute top-6 right-6 bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1">
                <Crown size={12} /> {p.proBadge}
              </div>

              <div className="mb-8">
                <h4 className="text-2xl font-black text-[#D4AF37] mb-2">{p.proName}</h4>
                <p className="text-white/50 text-sm">{p.proDesc}</p>
              </div>
              <div className="mb-8 flex flex-col">
                <span className="text-xl text-white/30 line-through decoration-red-500/50 decoration-2 font-black mb-1">
                  {p.proWas}
                </span>
                <span className="text-5xl font-black text-white">
                  {p.proPrice} <span className="text-lg text-white/50 font-medium">PLN / msc</span>
                </span>
              </div>

              <ul className="flex flex-col gap-5 mb-10 flex-1">
                {proFeatures.map(({ Icon, text }, i) => (
                  <li key={i} className="flex items-start gap-3 text-white text-sm">
                    <Icon className="text-[#D4AF37] shrink-0" size={20} />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => handleCheckout('investor')}
                disabled={loadingPlan === 'investor'}
                className="pricing-pro-cta group relative py-5 rounded-[1.25rem] overflow-visible transition-all duration-500 w-full flex items-center justify-center gap-3 border border-[#FFF0AA]/50 cursor-pointer shadow-[0_10px_30px_rgba(0,0,0,0.6)] hover:scale-[1.04] z-10 hover:z-50 disabled:opacity-70 disabled:hover:scale-100"
              >
                <div
                  className="absolute inset-0 w-full h-full rounded-[1.25rem] overflow-hidden pointer-events-none"
                  style={{ background: 'linear-gradient(135deg, #FFE066 0%, #FDB931 50%, #CC8400 100%)' }}
                >
                  <motion.div
                    className="pricing-pro-cta-sheen absolute top-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/80 to-transparent skew-x-[-30deg] pointer-events-none"
                    style={{ left: '-100%' }}
                  />
                </div>
                <Crown
                  className={`text-black relative z-10 transition-all duration-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] ${loadingPlan === 'investor' ? 'animate-bounce' : 'group-hover:-translate-y-1 group-hover:rotate-[20deg] group-hover:scale-125'}`}
                  size={22}
                />
                <span className="text-[14px] font-black uppercase tracking-[0.25em] text-black whitespace-nowrap relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
                  {loadingPlan === 'investor' ? p.proCtaLoading : p.proCta}
                </span>
              </button>
            </div>
          </div>
        )}

        {isAgency && (
          <div className="max-w-4xl mx-auto animate-in fade-in duration-700">
            <div className="bg-[#0a0a0a] border border-white/10 rounded-[3rem] p-8 md:p-14 relative overflow-hidden shadow-2xl min-h-[420px]">
              <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center p-8 bg-black/60 backdrop-blur-sm">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-xs font-black uppercase tracking-[0.35em] mb-4">
                  <Building2 size={14} /> {p.agencySoon}
                </span>
                <h4 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tight">
                  <span className="text-emerald-500">{p.agencySoonTitle}</span>
                </h4>
                <p className="text-white/55 text-sm md:text-base max-w-lg leading-relaxed">{p.agencySoonDesc}</p>
              </div>

              <div
                className="flex flex-col md:flex-row gap-12 relative z-10 opacity-35 pointer-events-none select-none"
                aria-hidden
              >
                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-black uppercase tracking-widest mb-6">
                    <Building2 size={14} /> Pakiet Biznesowy
                  </div>
                  <h4 className="text-4xl font-black text-white mb-4">{p.agencySoonTitle}</h4>
                  <p className="text-white/50 leading-relaxed">CRM • XML • Concierge</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isBasicModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-xl flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-4 sm:p-6"
            onClick={() => setIsBasicModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] w-full max-w-2xl p-8 md:p-12 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none z-0" />

              <button
                type="button"
                onClick={() => setIsBasicModalOpen(false)}
                className="absolute top-6 right-6 p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-white/50 z-20"
              >
                <X size={20} />
              </button>

              <div className="relative z-10 text-center mb-10">
                <h3 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4">
                  {p.modalTitle.replace(/(Cel|Goal)/i, (m) => `__${m}__`)
                    .split('__')
                    .map((part, i) =>
                      part === 'Cel' || part === 'Goal' ? (
                        <span key={i} className="text-emerald-500">
                          {part}
                        </span>
                      ) : (
                        <span key={i}>{part}</span>
                      )
                    )}
                </h3>
                <p className="text-white/50 text-sm md:text-base">{p.modalSubtitle}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = '/szukaj';
                  }}
                  className="flex flex-col items-center text-center gap-4 p-8 bg-[#111] border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] rounded-[2rem] transition-all group"
                >
                  <motion.div className="w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Key size={36} />
                  </motion.div>
                  <div>
                    <div className="font-black text-2xl text-white mb-2 group-hover:text-emerald-500 transition-colors">
                      {p.modalBuy}
                    </div>
                    <p className="text-xs text-white/40 leading-relaxed">{p.modalBuyDesc}</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.location.href = '/dodaj-oferte';
                  }}
                  className="flex flex-col items-center text-center gap-4 p-8 bg-[#111] border border-white/10 hover:border-orange-500/50 hover:bg-orange-500/5 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)] rounded-[2rem] transition-all group"
                >
                  <motion.div className="w-20 h-20 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Home size={36} />
                  </motion.div>
                  <div>
                    <div className="font-black text-2xl text-white mb-2 group-hover:text-orange-500 transition-colors">
                      {p.modalSell}
                    </div>
                    <p className="text-xs text-white/40 leading-relaxed">{p.modalSellDesc}</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
