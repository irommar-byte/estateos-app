"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

export type CrmSectionTabId = "klienci" | "radar" | "my_offers" | "offers" | "planowanie" | "transakcje";

type TabLabels = {
  klienci: { full: string; short: string };
  radar: { full: string; short: string };
  my_offers: { full: string; short: string };
  offers: { full: string; short: string };
  planowanie: { full: string; short: string };
  transakcje: { full: string; short: string };
};

type LuxAccent = "home" | "car" | "rent" | "platinum";

const TAB_ACCENT: Record<CrmSectionTabId, LuxAccent> = {
  klienci: "home",
  radar: "home",
  my_offers: "car",
  offers: "car",
  planowanie: "platinum",
  transakcje: "rent",
};

const spring = { type: "spring" as const, stiffness: 380, damping: 28, mass: 0.7 };

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
  const reduceMotion = useReducedMotion();
  const shellRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Partial<Record<CrmSectionTabId, HTMLButtonElement>>>({});
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  const activeAccent = TAB_ACCENT[activeTab] ?? "home";

  const measurePill = useCallback(() => {
    const shell = shellRef.current;
    const target = btnRefs.current[activeTab];
    if (!shell || !target) {
      setPill(null);
      return;
    }
    const shellBox = shell.getBoundingClientRect();
    const targetBox = target.getBoundingClientRect();
    setPill({ left: targetBox.left - shellBox.left, width: targetBox.width });
  }, [activeTab]);

  useLayoutEffect(() => {
    measurePill();
  }, [measurePill, tabs]);

  useEffect(() => {
    const onResize = () => measurePill();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [measurePill]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const activeEl = btnRefs.current[activeTab];
    if (!scroller || !activeEl) return;
    const scrollerRect = scroller.getBoundingClientRect();
    const tabRect = activeEl.getBoundingClientRect();
    const padding = 16;
    if (tabRect.left < scrollerRect.left + padding) {
      scroller.scrollBy({ left: tabRect.left - scrollerRect.left - padding, behavior: "smooth" });
    } else if (tabRect.right > scrollerRect.right - padding) {
      scroller.scrollBy({ left: tabRect.right - scrollerRect.right + padding, behavior: "smooth" });
    }
    const t = window.setTimeout(measurePill, 320);
    return () => window.clearTimeout(t);
  }, [activeTab, measurePill]);

  return (
    <div className="sticky top-[var(--eos-nav-height)] z-30 mb-5 sm:mb-7">
      <div
        ref={scrollerRef}
        className="eos-crm-tab-scroller w-full overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <motion.div
          ref={shellRef}
          role="tablist"
          aria-label="Sekcje konta"
          className="eos-lux-switch eos-crm-lux-tabs relative mx-auto flex w-max min-w-full items-stretch gap-0.5 p-1 sm:min-w-0 sm:w-full md:inline-flex md:w-auto md:max-w-full"
          whileTap={reduceMotion ? undefined : { scale: 0.992 }}
          transition={spring}
        >
          {!reduceMotion ? <span className="eos-lux-switch__shimmer" aria-hidden /> : null}
          <span className="eos-lux-switch__rim" aria-hidden />
          <span className="eos-lux-switch__well" aria-hidden />

          {pill ? (
            <motion.span
              className={`eos-lux-switch__pill eos-lux-switch__pill--${activeAccent}`}
              initial={false}
              animate={{ left: pill.left, width: pill.width, opacity: 1 }}
              transition={reduceMotion ? { duration: 0.12 } : spring}
              style={{ top: "0.22rem", bottom: "0.22rem" }}
            >
              <span className="eos-lux-switch__pill-glow" />
            </motion.span>
          ) : null}

          {tabs.map((tab) => {
            const pressed = activeTab === tab;
            const copy = labels[tab];
            const accent = TAB_ACCENT[tab];
            return (
              <motion.button
                key={tab}
                ref={(el) => {
                  if (el) btnRefs.current[tab] = el;
                }}
                type="button"
                role="tab"
                aria-selected={pressed}
                aria-pressed={pressed}
                onClick={() => onChange(tab)}
                className={`eos-lux-switch__seg eos-lux-switch__seg--${accent} relative z-[3] flex min-h-[2.85rem] flex-1 items-center justify-center px-3.5 py-2.5 text-[9px] sm:min-h-[3.1rem] sm:px-5 sm:text-[10px] md:px-6 md:text-[11px]`}
                whileHover={reduceMotion ? undefined : { y: -0.5 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                transition={spring}
              >
                <span className="whitespace-nowrap md:hidden">{copy.short}</span>
                <span className="hidden whitespace-nowrap md:inline">{copy.full}</span>
              </motion.button>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
