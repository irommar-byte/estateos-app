'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, BellRing, LayoutPanelTop, ScanSearch } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1] as const;

type Props = {
  agentName: string;
  agentFirstName: string;
  agentImage: string | null;
  onStart: () => void;
};

/** Ekran powitalny przed pierwszym krokiem: znak EstateOS™, obietnica wyszukiwarki i jeden przycisk. */
export default function BuyerIntakeWelcome({ agentName, agentFirstName, agentImage, onStart }: Props) {
  const reduce = useReducedMotion();
  const rise = (delay: number) =>
    reduce
      ? {}
      : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, delay, ease: EASE } };

  const features = [
    { icon: ScanSearch, title: 'Dopasowanie co do szczegółu', text: 'Lokalizacja, budżet, metraż, piętro, balkon — szukamy dokładnie tego, co opiszesz.' },
    { icon: BellRing, title: 'Nowe oferty od razu', text: `${agentFirstName} dostaje je pierwszy i wysyła Ci tylko te, które pasują.` },
    { icon: LayoutPanelTop, title: 'Wszystko w jednym panelu', text: 'Oferty, oglądania, negocjacje i dokumenty — w Twoim prywatnym panelu.' },
  ];

  return (
    <div className="bi-welcome relative flex min-h-0 flex-1 flex-col items-center text-center">
      {/* Treść przewija się, przycisk „Zaczynamy” zawsze widoczny na dole */}
      <div className="flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto px-2 pt-4 [@media(max-height:760px)]:pt-1">
      <div className="flex flex-1 flex-col items-center justify-center pb-4">
        {/* Znak: monogram w złotym pierścieniu z łagodnym „oddechem” poświaty */}
        <motion.div
          className="bi-welcome__mark relative mb-7 flex size-24 items-center justify-center rounded-[1.9rem] [@media(max-height:760px)]:mb-4 [@media(max-height:760px)]:size-[4.5rem] [@media(max-height:760px)]:rounded-[1.5rem]"
          {...(reduce ? {} : { initial: { opacity: 0, scale: 0.86 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 1.1, ease: EASE } })}
        >
          <span className="bi-welcome__glow absolute inset-0 rounded-[1.9rem]" aria-hidden />
          <span className="bi-welcome__mark-text relative">EOS</span>
        </motion.div>

        <motion.p {...rise(0.15)} className="bi-welcome__wordmark mb-4 text-[13px] font-semibold uppercase tracking-[0.42em]">
          EstateOS<span className="align-super text-[8px] tracking-normal">™</span>
        </motion.p>

        <motion.h1 {...rise(0.25)} className="max-w-md text-[2rem] [@media(max-height:760px)]:text-[1.7rem] font-semibold leading-[1.08] tracking-[-0.02em] bi-ink sm:text-[2.5rem]">
          Najbardziej zaawansowana wyszukiwarka{' '}
          <span className="bi-accent">nieruchomości</span>
        </motion.h1>

        <motion.p {...rise(0.35)} className="mt-4 max-w-sm text-[15px] leading-relaxed bi-ink-3">
          Opisz swój wymarzony dom w 2 minuty. Resztą zajmie się {agentFirstName} — i EstateOS™ Intelligence.
        </motion.p>

        <ul className="mt-8 w-full max-w-sm space-y-2.5 text-left [@media(max-height:760px)]:mt-5 [@media(max-height:760px)]:space-y-2">
          {features.map((feature, index) => (
            <motion.li key={feature.title} {...rise(0.45 + index * 0.08)} className="bi-welcome__feature flex gap-3.5 rounded-2xl p-3.5">
              <span className="bi-welcome__icon flex size-10 shrink-0 items-center justify-center rounded-xl">
                <feature.icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold bi-ink">{feature.title}</span>
                <span className="mt-0.5 block text-[12.5px] leading-snug bi-ink-3">{feature.text}</span>
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
      </div>

      <motion.div {...rise(0.75)} className="w-full max-w-sm shrink-0 pt-3">
        <div className="mb-3 flex items-center justify-center gap-2 text-[12.5px] bi-ink-3">
          {agentImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={agentImage} alt="" className="size-6 rounded-full object-cover" />
          ) : null}
          <span>
            Twój agent: <b className="font-semibold bi-ink">{agentName}</b>
          </span>
        </div>
        <button
          type="button"
          onClick={onStart}
          className="bi-primary-cta group flex w-full items-center justify-center gap-2 rounded-[1.1rem] px-4 py-3.5 text-[15px] font-bold"
        >
          Zaczynamy
          <ArrowRight className="bi-primary-cta__arrow size-5 transition-transform duration-300 group-hover:translate-x-0.5" />
        </button>
        <p className="mt-2.5 text-[11.5px] bi-ink-3">Bezpłatnie · ok. 2 minuty · bez zakładania konta</p>
      </motion.div>
    </div>
  );
}
