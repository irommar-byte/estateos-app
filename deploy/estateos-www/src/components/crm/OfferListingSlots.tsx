'use client';

import { Crown, Plus, Home, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { computeListingLimits } from '@/lib/offerListingLimits';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';

type OfferListingSlotsProps = {
  user: {
    isPro?: boolean | string | null;
    planType?: string | null;
    extraListings?: number | null;
    plusExpiresAt?: Date | string | null;
  } | null;
  activeOffers: Array<Record<string, unknown>>;
  onAddOffer: () => void;
};

function SlotCard({
  variant,
  label,
  offer,
  emptyLabel,
  onAdd,
}: {
  variant: 'gold' | 'basic' | 'plus';
  label: string;
  offer?: Record<string, unknown> | null;
  emptyLabel: string;
  onAdd: () => void;
}) {
  const isGold = variant === 'gold';
  const isPlus = variant === 'plus';
  const border = isGold
    ? 'border-[#D4AF37]/45 hover:border-[#F9E498]/70 shadow-[0_0_30px_rgba(212,175,55,0.12)]'
    : isPlus
      ? 'border-blue-500/40 hover:border-blue-400/70 shadow-[0_0_24px_rgba(59,130,246,0.12)]'
      : 'border-white/15 hover:border-white/30';
  const bg = isGold
    ? 'bg-gradient-to-b from-[#1a150b]/80 to-[#0a0a0a]'
    : isPlus
      ? 'bg-gradient-to-b from-blue-950/30 to-[#0a0a0a]'
      : 'bg-[#0a0a0a]';

  const img = offer ? resolveOfferPrimaryImage(offer as { images?: unknown }) : null;

  if (offer) {
    return (
      <motion.div className={`${bg} border ${border} rounded-[2rem] p-4 min-h-[200px] flex flex-col group`}>
        <span
          className={`text-[9px] font-black uppercase tracking-[0.2em] mb-3 ${
            isGold ? 'text-[#D4AF37]' : isPlus ? 'text-blue-400' : 'text-white/50'
          }`}
        >
          {label}
        </span>
        <a
          href={`/oferta/${offer.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex flex-col gap-3"
        >
          <motion.div
            className={`w-full aspect-[4/3] rounded-2xl overflow-hidden border ${
              isGold ? 'border-[#D4AF37]/30' : isPlus ? 'border-blue-500/25' : 'border-white/10'
            }`}
          >
            {img ? (
              <img src={img} alt="" className="w-full h-full object-cover" />
            ) : (
              <motion.div className="w-full h-full bg-white/5 flex items-center justify-center">
                <Home className="text-white/20" size={32} />
              </motion.div>
            )}
          </motion.div>
          <p className="text-white font-bold text-sm line-clamp-2">{String(offer.title || 'Ogłoszenie')}</p>
          <p className="text-emerald-400 font-black text-xs uppercase tracking-widest">Aktywne</p>
        </a>
      </motion.div>
    );
  }

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 0.98 }}
      whileTap={{ scale: 0.97 }}
      onClick={onAdd}
      className={`${bg} border border-dashed ${border} rounded-[2rem] p-4 min-h-[200px] flex flex-col items-center justify-center gap-3 w-full`}
    >
      <span
        className={`text-[9px] font-black uppercase tracking-[0.2em] ${
          isGold ? 'text-[#D4AF37]/80' : isPlus ? 'text-blue-400/80' : 'text-white/40'
        }`}
      >
        {label}
      </span>
      <motion.div
        className={`w-14 h-14 rounded-full border flex items-center justify-center ${
          isGold ? 'border-[#D4AF37]/40' : isPlus ? 'border-blue-500/40' : 'border-white/20'
        }`}
      >
        {isPlus ? (
          <Plus size={26} className="text-blue-400" />
        ) : isGold ? (
          <Crown size={22} className="text-[#D4AF37]" />
        ) : (
          <Plus size={26} className="text-white/50" />
        )}
      </motion.div>
      <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest text-center px-2">{emptyLabel}</p>
    </motion.button>
  );
}

export default function OfferListingSlots({ user, activeOffers, onAddOffer }: OfferListingSlotsProps) {
  const limits = computeListingLimits(user);
  if (limits.isAgency) return null;

  const baseCount = limits.isPro ? limits.proGoldSlots : limits.basicSlots;
  const plusCount = limits.plusCredits;
  const baseOffers = activeOffers.slice(0, baseCount);
  const plusOffers = activeOffers.slice(baseCount, baseCount + plusCount);
  const showPlusSection =
    plusCount > 0 || limits.isPro || (!limits.isPro && activeOffers.length >= (limits.basicSlots || 1));

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
        <motion.div className="flex flex-wrap justify-between gap-3 mb-5">
          <motion.div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-1">Publikacja ogłoszeń</p>
            <h3 className="text-lg font-black text-white">
              {limits.isPro ? (
                <>
                  <span className="text-[#D4AF37]">3 sloty PRO</span>
                  {plusCount > 0 && <span className="text-white/70"> + {plusCount} Pakiet +</span>}
                </>
              ) : (
                <>
                  1 slot Basic
                  {plusCount > 0 && <span className="text-blue-400"> + {plusCount} Pakiet +</span>}
                </>
              )}
            </h3>
          </motion.div>
          <p className="text-xs text-white/45 max-w-md">
            {limits.isPro
              ? 'Złote sloty w pakiecie Investor PRO. Ogłoszenia 4.+ — Pakiet + (30 dni / kredyt).'
              : 'Basic: 1 ogłoszenie. Więcej — Pakiet + lub Investor PRO (3 złote sloty).'}
          </p>
        </motion.div>

        {limits.isPro && (
          <motion.div className="mb-6">
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#D4AF37] mb-3 flex items-center gap-2">
              <Crown size={12} /> Sloty PRO (złote)
            </p>
            <motion.div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Array.from({ length: baseCount || 3 }).map((_, i) => (
                <SlotCard
                  key={`pro-${i}`}
                  variant="gold"
                  label={`PRO ${i + 1}`}
                  offer={baseOffers[i] || null}
                  emptyLabel="Dodaj ogłoszenie"
                  onAdd={onAddOffer}
                />
              ))}
            </motion.div>
          </motion.div>
        )}

        {!limits.isPro && (
          <motion.div className="mb-6">
            <p className="text-[9px] font-black uppercase text-white/45 mb-3">Slot Basic</p>
            <SlotCard
              variant="basic"
              label="Basic 1"
              offer={baseOffers[0] || null}
              emptyLabel="Dodaj ogłoszenie"
              onAdd={onAddOffer}
            />
          </motion.div>
        )}

        {showPlusSection && (
          <motion.div className={limits.isPro ? 'pt-4 border-t border-white/10' : ''}>
            <p className="text-[9px] font-black uppercase text-blue-400 mb-3 flex items-center gap-2">
              <Zap size={12} /> Pakiet + (30 dni / ogłoszenie)
            </p>
            <p className="text-[11px] text-white/40 mb-4 leading-relaxed">
              {limits.isPro
                ? 'Poza 3 złotymi slotami PRO — każde kolejne ogłoszenie wymaga aktywnego kredytu Pakiet + (jak na planie Basic).'
                : 'Dodatkowy slot ponad limit Basic — jedno ogłoszenie na 30 dni za kredyt.'}
            </p>
            <motion.div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Array.from({ length: Math.max(plusCount, 1) }).map((_, i) => (
                <SlotCard
                  key={`plus-${i}`}
                  variant="plus"
                  label={plusCount > 0 ? `Plus ${i + 1}` : 'Pakiet +'}
                  offer={plusOffers[i] || null}
                  emptyLabel={plusCount > 0 ? 'Opublikuj z kredytu' : 'Kup Pakiet + na 30 dni'}
                  onAdd={plusCount > 0 ? onAddOffer : goCennik}
                />
              ))}
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
