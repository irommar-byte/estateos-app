'use client';

import { useCallback, useEffect, useRef } from 'react';
import { LayoutGroup, motion } from 'framer-motion';

export type CrmSectionTabId = 'klienci' | 'radar' | 'my_offers' | 'offers' | 'planowanie' | 'transakcje';

type TabLabels = {
  klienci: { full: string; short: string };
  radar: { full: string; short: string };
  my_offers: { full: string; short: string };
  offers: { full: string; short: string };
  planowanie: { full: string; short: string };
  transakcje: { full: string; short: string };
};

export default function CrmSectionTabBar({
  tabs,
  activeTab,
  labels,
  onChange,
}: {
  tabs: CrmSectionTabId[];
  activeTab: CrmSectionTabId;
  labels: TabLabels;
  onChange: (tab: CrmSectionTabId) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<CrmSectionTabId, HTMLButtonElement>>>({});

  const scrollActiveIntoView = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const scroller = scrollerRef.current;
    const activeEl = tabRefs.current[activeTab];
    if (!scroller || !activeEl) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const tabRect = activeEl.getBoundingClientRect();
    const padding = 12;
    const leftOverflow = tabRect.left - scrollerRect.left - padding;
    const rightOverflow = tabRect.right - scrollerRect.right + padding;

    if (leftOverflow < 0) {
      scroller.scrollBy({ left: leftOverflow, behavior });
    } else if (rightOverflow > 0) {
      scroller.scrollBy({ left: rightOverflow, behavior });
    }
  }, [activeTab]);

  useEffect(() => {
    scrollActiveIntoView('smooth');
  }, [activeTab, scrollActiveIntoView]);

  return (
    <div className="sticky top-[var(--eos-nav-height)] z-30 -mx-1 mb-6 border-b border-[var(--eos-border)] bg-[var(--eos-bg)]/92 px-1 py-3 backdrop-blur-xl sm:mb-8">
      <div className="relative w-full">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[var(--eos-bg)] to-transparent sm:w-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[var(--eos-bg)] to-transparent sm:w-10" />

      <div
        ref={scrollerRef}
        className="eos-crm-tab-scroller mx-auto w-full max-w-full overflow-x-auto overscroll-x-contain px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <LayoutGroup id="crm-section-tabs">
          <div
            role="tablist"
            aria-label="Sekcje konta"
            className="mx-auto flex w-max min-w-full items-center justify-start gap-1 rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)] p-1.5 shadow-[var(--eos-shadow-soft)] sm:min-w-0 sm:justify-center sm:gap-1.5 md:inline-flex md:w-auto"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab;
              const copy = labels[tab];
              return (
                <button
                  key={tab}
                  ref={(el) => {
                    if (el) tabRefs.current[tab] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onChange(tab)}
                  className={`relative shrink-0 rounded-full px-3.5 py-2.5 text-[9px] font-black uppercase tracking-[0.14em] transition-colors sm:px-4 sm:py-3 sm:text-[10px] sm:tracking-[0.16em] md:px-7 md:text-xs md:tracking-[0.18em] ${
                    isActive ? 'text-black' : 'text-[var(--eos-subtle)] hover:text-[var(--eos-text)]'
                  }`}
                >
                  {isActive ? (
                    <motion.span
                      layoutId="crmSectionTabPill"
                      className="absolute inset-0 rounded-full bg-emerald-500 shadow-[0_0_22px_rgba(16,185,129,0.45)]"
                      transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.85 }}
                    />
                  ) : null}
                  <span className="relative z-10 whitespace-nowrap">
                    <span className="md:hidden">{copy.short}</span>
                    <span className="hidden md:inline">{copy.full}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>
      </div>
      </div>
    </div>
  );
}
