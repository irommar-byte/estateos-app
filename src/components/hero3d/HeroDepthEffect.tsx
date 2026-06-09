"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  HOME_CTA_CONTRACT,
  HomeCtaAnalyticsEvent,
  HomeCtaId,
} from "@/contracts/homeCtaContract";
import { useLocale } from "@/contexts/LocaleContext";
import AppStoreBadgeLink from "@/components/ui/AppStoreBadgeLink";
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2075&auto=format&fit=crop";

export default function HeroDepthEffect() {
  const { dict } = useLocale();
  const router = useRouter();
  const ref = useRef<HTMLElement | null>(null);
  const noiseFilterId = useId().replace(/:/g, "");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", reduceMotion ? "5%" : "20%"]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1.02, reduceMotion ? 1.03 : 1.13]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", reduceMotion ? "5%" : "32%"]);
  const opacityFade = useTransform(scrollYProgress, [0, 0.82, 1], [1, 0.68, 0.22]);
  const customEase = [0.16, 1, 0.3, 1] as const;

  const trackHomeCta = (event: HomeCtaAnalyticsEvent, ctaId: HomeCtaId) => {
    const entry = HOME_CTA_CONTRACT[ctaId];
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: `/event/${event}?cta=${entry.id}&mode=${entry.mode}&route=${encodeURIComponent(entry.webRoute)}`,
      }),
    }).catch(() => {});
  };

  const openHomeCta = (ctaId: HomeCtaId) => {
    const entry = HOME_CTA_CONTRACT[ctaId];
    trackHomeCta("home_cta_click", ctaId);
    trackHomeCta("home_cta_route_resolved", ctaId);

    router.push(entry.webRoute);

    trackHomeCta("home_cta_flow_opened", ctaId);
  };

  return (
    <section
      ref={ref}
      className="relative h-[100svh] w-full overflow-hidden bg-[#050505]"
    >
      <div className="absolute inset-0 h-full w-full overflow-hidden">
        <motion.div
          style={{ y: bgY, scale: bgScale, backgroundImage: `url('${HERO_IMAGE}')` }}
          className="absolute -inset-[10%] z-0 origin-center bg-cover bg-center opacity-[0.43] grayscale-[0.22] will-change-transform"
        />

        <div
          className="pointer-events-none absolute inset-0 z-[6] opacity-[0.04] mix-blend-overlay"
          aria-hidden
        >
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id={`hero-noise-${noiseFilterId}`} x="0" y="0">
                <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" stitchTiles="stitch" />
              </filter>
            </defs>
            <rect width="100%" height="100%" filter={`url(#hero-noise-${noiseFilterId})`} />
          </svg>
        </div>

        {!reduceMotion && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -left-[18%] top-[4%] z-[5] h-[86%] w-[76%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(16,185,129,0.18),transparent_72%)] blur-3xl"
            animate={{ x: ["-4%", "6%", "-2%"], y: ["0%", "5%", "-1%"], opacity: [0.22, 0.42, 0.28] }}
            transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {!reduceMotion && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -right-[12%] bottom-[0%] z-[5] h-[70%] w-[60%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(212,175,126,0.09),transparent_70%)] blur-3xl"
            animate={{ x: ["2%", "-5%", "1%"], y: ["0%", "-4%", "1%"], opacity: [0.12, 0.22, 0.14] }}
            transition={{ duration: 26, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
          />
        )}

        <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/70 via-black/28 to-[#050505]" />
        <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(5,5,5,0.25)_48%,#050505_118%)]" />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[11] h-[min(12vh,7rem)] bg-gradient-to-b from-black/90 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[11] h-[min(22vh,13rem)] bg-gradient-to-t from-[#050505] to-transparent"
          aria-hidden
        />

        {!reduceMotion && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[12] opacity-0 sm:opacity-100"
            style={{
              backgroundImage:
                "linear-gradient(115deg, transparent 42%, rgba(255,255,255,0.045) 50%, transparent 58%)",
              backgroundSize: "220% 100%",
            }}
            animate={{ backgroundPosition: ["12% 0%", "88% 0%", "20% 0%"] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        <motion.div
          style={{ y: contentY }}
          className="relative z-20 flex h-full items-center justify-center px-4 pb-[calc(4rem+env(safe-area-inset-bottom))] text-center"
        >
          <motion.div
            style={{ opacity: opacityFade }}
            className="flex w-full max-w-6xl flex-col items-center"
          >
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: customEase, delay: 0.18 }}
              className="mb-4 text-[10px] font-black uppercase tracking-[0.32em] text-emerald-400/95 sm:text-xs"
            >
              {dict.hero.eyebrow}
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 1.05, ease: customEase, delay: 0.1 }}
              className="text-[17vw] font-light leading-[0.82] tracking-[-0.075em] text-white drop-shadow-[0_18px_60px_rgba(0,0,0,0.9)] sm:text-[13vw] lg:text-[9.5rem]"
            >
              <span className="font-semibold text-emerald-400">E</span>state
              <span className="font-semibold text-emerald-400">OS</span>
              <sup className="ml-1 align-super text-[0.18em] font-black tracking-normal text-white/80">TM</sup>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: customEase, delay: 0.32 }}
              className="mt-8 max-w-xl text-sm font-light leading-[1.7] text-white/65 sm:max-w-2xl sm:text-base"
            >
              {dict.hero.lead}
              <span className="font-medium text-white/95">{dict.hero.leadBold}</span>
              {dict.hero.leadExtra}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: customEase, delay: 0.48 }}
              className="mt-12 flex w-full max-w-md flex-col justify-center gap-3 sm:max-w-none sm:flex-row sm:gap-4"
            >
              <button
                type="button"
                onClick={() => openHomeCta("RADAR")}
                className="group relative w-full overflow-hidden rounded-full bg-gradient-to-b from-[#d9b58b] via-[#b98c58] to-[#70451f] px-8 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-black shadow-[0_18px_38px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.45)] transition-transform hover:scale-[1.02] active:scale-[0.98] sm:w-auto sm:px-10"
              >
                <span className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
                <span className="relative">{dict.hero.ctaMap}</span>
              </button>
              <button
                type="button"
                onClick={() => openHomeCta("LIST")}
                className="w-full rounded-full border border-white/18 bg-black/50 px-8 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-white shadow-[0_16px_34px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl transition-all hover:border-white/30 hover:bg-white/[0.08] active:scale-[0.98] sm:w-auto sm:px-10"
              >
                {dict.hero.ctaList}
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: customEase, delay: 0.58 }}
              className="mt-6"
            >
              <AppStoreBadgeLink
                label={dict.footer.appStore}
                androidComingSoon
                androidSoonLabel={dict.homeAppPitch.androidSoon}
              />
            </motion.div>
          </motion.div>
        </motion.div>

        <div className="pointer-events-none absolute bottom-8 left-1/2 z-30 hidden -translate-x-1/2 flex-col items-center gap-3 text-white/30 sm:flex">
          <span className="text-[9px] font-black uppercase tracking-[0.28em]">Scroll</span>
          <motion.span
            className="h-12 w-px bg-gradient-to-b from-white/60 to-transparent"
            animate={reduceMotion ? undefined : { scaleY: [0.35, 1, 0.35], opacity: [0.25, 0.75, 0.25] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>
    </section>
  );
}
