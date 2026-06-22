'use client';

import { Crown, Home, Plus, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { computeListingLimits } from '@/lib/offerListingLimits';
import { INVESTOR_PRO_PUBLICATION_CREDITS } from '@/lib/investorProGrant';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';

type OfferListingSlotsProps = {
  user: {
    role?: string | null;
    isPro?: boolean | string | null;
    planType?: string | null;
    extraListings?: number | null;
    plusExpiresAt?: Date | string | null;
    proExpiresAt?: Date | string | null;
  } | null;
  activeOffers: Array<Record<string, unknown>>;
  onAddOffer: () => void;
};

export default function OfferListingSlots({ user, activeOffers, onAddOffer }: OfferListingSlotsProps) {
  const limits = computeListingLimits(user);
  const credits = limits.publishCredits;
  const isPro = limits.isPro;
  const isAgent = limits.isAgentAccount;

  const goCennik = () => {
    window.location.href = '/cennik';
  };

  return (
    <motion.div className="mb-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[2rem] border border-white/10 bg-[#0a0a0a]/90 p-5 sm:p-6"
      >
        <div className="flex flex-wrap justify-between gap-4 mb-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 mb-1">
              Kredyty publikacji
            </p>
            <h3 className="text-lg font-black text-white flex items-center gap-2 flex-wrap">
              {isPro ? <Crown size={18} className="text-[#D4AF37]" /> : null}
              <span className={isPro ? 'text-[#D4AF37]' : 'text-emerald-400'}>
                {credits} {credits === 1 ? 'kredyt' : 'kredytów'}
              </span>
              <span className="text-white/40 text-sm font-bold">na koncie</span>
            </h3>
          </div>
          <p className="text-xs text-white/55 max-w-md leading-relaxed">
            {isAgent
              ? 'Biuro publikuje z kredytów przydzielonych przez administratora (pula Partner) lub z Pakietu +.'
              : isPro
              ? `Investor PRO daje ${INVESTOR_PRO_PUBLICATION_CREDITS} kredytów publikacji na okres subskrypcji. Każde wystawienie zużywa 1 kredyt (30 dni na rynku).`
              : 'Basic: pierwsza publikacja może być darmowa (kupon powitalny). Kolejne — Pakiet + lub Investor PRO (5 kredytów).'}
          </p>
        </div>

        {credits <= 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center mb-5">
            <Sparkles className="mx-auto mb-3 text-amber-400/70" size={28} />
            <p className="text-sm font-bold text-white/80 mb-2">Brak aktywnych kredytów publikacji</p>
            <p className="text-xs text-white/45 mb-4">
              {isAgent
                ? 'Poproś administratora biura o kredyty z puli Partner albo dokup Pakiet +.'
                : isPro
                ? 'Wykorzystałeś pulę PRO — dokup Pakiet + lub odnow subskrypcję Investor PRO.'
                : 'Aktywuj Investor PRO (5 kredytów) albo Pakiet + (1 kredyt).'}
            </p>
            <button
              type="button"
              onClick={goCennik}
              className="rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-[#F9E498] hover:bg-[#D4AF37]/20 transition-colors"
            >
              Zobacz cennik
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAddOffer}
            className="mb-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 py-4 text-[10px] font-black uppercase tracking-widest text-emerald-300 hover:bg-emerald-500/15 transition-colors"
          >
            <Plus size={16} /> Dodaj ogłoszenie (zużyje 1 kredyt)
          </button>
        )}

        {activeOffers.length > 0 ? (
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/45 mb-3">
              Aktywne ogłoszenia ({activeOffers.length})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeOffers.map((offer) => {
                const img = resolveOfferPrimaryImage(offer as { images?: unknown });
                return (
                  <motion.a
                    key={String(offer.id)}
                    href={`/oferta/${offer.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-[1.5rem] border border-white/10 bg-[#111] p-4 flex flex-col gap-3 hover:border-emerald-500/30 transition-colors"
                  >
                    <div className="w-full aspect-[4/3] rounded-xl overflow-hidden border border-white/10 bg-black/40">
                      {img ? (
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Home className="text-white/20" size={32} />
                        </div>
                      )}
                    </div>
                    <p className="text-white font-bold text-sm line-clamp-2">{String(offer.title || 'Ogłoszenie')}</p>
                    <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Aktywne</p>
                  </motion.a>
                );
              })}
            </div>
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  );
}
