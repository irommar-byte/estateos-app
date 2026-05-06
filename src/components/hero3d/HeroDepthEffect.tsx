"use client";
import { useEffect, useId, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  HOME_CTA_CONTRACT,
  HomeCtaAnalyticsEvent,
  HomeCtaId,
} from "@/contracts/homeCtaContract";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2075&auto=format&fit=crop";

export default function HeroDepthEffect() {
  const router = useRouter();
  const ref = useRef(null);
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
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", reduceMotion ? "8%" : "18%"]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, reduceMotion ? 1.02 : 1.07]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", reduceMotion ? "12%" : "26%"]);
  const contentParallax = useTransform(scrollYProgress, [0, 1], ["0%", reduceMotion ? "-2%" : "-5%"]);
  const cinematicFade = useTransform(scrollYProgress, [0, 0.85, 1], [0.55, 0.78, 0.92]);
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

    if (ctaId === "BUY") {
      document.getElementById("map-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", entry.webRoute);
      }
    } else {
      router.push(entry.webRoute);
    }

    trackHomeCta("home_cta_flow_opened", ctaId);
  };

  return (
    <section
      ref={ref}
      className="relative w-full overflow-hidden bg-black h-[calc(100svh-6.5rem-env(safe-area-inset-bottom))] sm:h-[calc(100svh-5.5rem-env(safe-area-inset-bottom))] lg:h-[calc(100svh-5.75rem-env(safe-area-inset-bottom))]"
    >
      <div className="sticky top-0 h-full w-full overflow-hidden">
        {/* Tło: Ken Burns + parallax (spokojny, „apple calm”) */}
        <motion.div
          style={{ y: bgY, scale: bgScale, backgroundImage: `url('${HERO_IMAGE}')` }}
          className="absolute inset-0 z-0 origin-center bg-cover bg-center opacity-[0.42] grayscale-[0.32] will-change-transform"
        />

        {/* Bardzo delikatny „film grain” (SVG) */}
        <div
          className="pointer-events-none absolute inset-0 z-[6] opacity-[0.055] mix-blend-overlay sm:opacity-[0.045]"
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

        {/* Ambientowy blask — powolny drift (wyłączony przy reduced motion) */}
        {!reduceMotion && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -left-[18%] top-[8%] z-[5] h-[95%] w-[85%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(16,185,129,0.16),transparent_72%)] blur-3xl"
            animate={{ x: ["-4%", "6%", "-2%"], y: ["0%", "5%", "-1%"], opacity: [0.28, 0.46, 0.32] }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        {!reduceMotion && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -right-[12%] bottom-[0%] z-[5] h-[70%] w-[60%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(255,255,255,0.07),transparent_70%)] blur-3xl"
            animate={{ x: ["2%", "-5%", "1%"], y: ["0%", "-4%", "1%"], opacity: [0.12, 0.22, 0.14] }}
            transition={{ duration: 26, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
          />
        )}

        {/* Kolorystyka + głębia */}
        <div className="absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.11),transparent_48%)]" />
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/52 via-black/34 to-black/78" />

        {/* Vignette / letterbox feel — czytelność jak w trailerze */}
        <motion.div
          style={{ opacity: cinematicFade }}
          className="pointer-events-none absolute inset-0 z-[11] bg-[radial-gradient(ellipse_at_center,transparent_0%,transparent_42%,rgba(0,0,0,0.62)_100%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[11] h-[min(10vh,5.5rem)] bg-gradient-to-b from-black/70 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[11] h-[min(14vh,7rem)] bg-gradient-to-t from-black/75 to-transparent"
          aria-hidden
        />

        {/* Delikatny „lens shimmer” przy scrollu */}
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
          className="relative z-20 h-full flex items-center justify-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <motion.div
            style={{ y: contentParallax }}
            initial={{ opacity: 0, y: 26, scale: 0.98, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: reduceMotion ? 0.45 : 1.15, ease: customEase }}
            className="w-full max-w-5xl rounded-[1.75rem] sm:rounded-[2.5rem] border border-white/10 bg-black/38 backdrop-blur-[12px] px-4 sm:px-8 md:px-12 py-6 sm:py-10 md:py-12 shadow-[0_25px_80px_rgba(0,0,0,0.68)] ring-1 ring-white/[0.06]"
          >
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.28em] text-emerald-400/95 mb-3 sm:mb-5">
              Prywatny System CRM Nieruchomości
            </p>

            <h1 className="text-[13.5vw] sm:text-[11vw] md:text-[8vw] leading-[0.9] font-black tracking-[-0.045em] text-white drop-shadow-[0_10px_35px_rgba(0,0,0,0.9)]">
              <span className="text-emerald-400">E</span>state<span className="text-emerald-400">OS</span>&trade;
            </h1>

            <p className="mt-4 sm:mt-6 text-[11px] sm:text-sm md:text-base text-white/82 max-w-3xl leading-relaxed sm:leading-relaxed">
              Wystaw nieruchomość <span className="text-white font-bold">całkowicie za darmo</span> lub znajdź wymarzoną.
              <span className="hidden sm:inline"> Ustaw Inteligentny Radar raz, a idealne oferty same przyjdą.</span>
            </p>

            <div className="mt-5 sm:mt-8 flex w-full flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <button
                onClick={() => openHomeCta("BUY")}
                className="w-full sm:w-auto min-w-[190px] rounded-full px-7 py-3.5 bg-gradient-to-b from-[#d2ab7e] via-[#9a7046] to-[#56351c] border border-[#d9b58b] text-white font-black uppercase tracking-[0.14em] text-[11px] shadow-[inset_0_1px_3px_rgba(255,255,255,0.35),0_16px_26px_rgba(0,0,0,0.75)] hover:brightness-110 active:scale-[0.98] transition-all"
              >
                Kupuję
              </button>
              <button
                onClick={() => openHomeCta("SELL")}
                className="w-full sm:w-auto min-w-[190px] rounded-full px-7 py-3.5 bg-gradient-to-b from-[#d2ab7e] via-[#9a7046] to-[#56351c] border border-[#d9b58b] text-white font-black uppercase tracking-[0.14em] text-[11px] shadow-[inset_0_1px_3px_rgba(255,255,255,0.35),0_16px_26px_rgba(0,0,0,0.75)] hover:brightness-110 active:scale-[0.98] transition-all"
              >
                Sprzedaję
              </button>
            </div>

            <button
              onClick={() => openHomeCta("BUY")}
              className="mt-5 sm:mt-6 text-[10px] sm:text-[11px] uppercase tracking-[0.24em] text-white/55 hover:text-emerald-300 transition-colors"
            >
              Zobacz mapę i oferty
            </button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
