"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRouter } from "next/navigation";
import { Building2, Car, CheckCircle2, Home } from "lucide-react";
import {
  HOME_CTA_CONTRACT,
  HomeCtaAnalyticsEvent,
  HomeCtaId,
} from "@/contracts/homeCtaContract";
import { useLocale } from "@/contexts/LocaleContext";
import AppStoreBadgeLink from "@/components/ui/AppStoreBadgeLink";

const HERO_HOME_IMAGE =
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2075&auto=format&fit=crop";
const HERO_CAR_IMAGE =
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?q=80&w=2070&auto=format&fit=crop";

type HeroVertical = "home" | "car";

function HeroVerticalCard({
  vertical,
  brand,
  title,
  subtitle,
  bullets,
  primaryCta,
  secondaryCta,
  onPrimary,
  onSecondary,
}: {
  vertical: HeroVertical;
  brand: string;
  title: string;
  subtitle: string;
  bullets: string[];
  primaryCta: string;
  secondaryCta: string;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  const isHome = vertical === "home";

  return (
    <article
      className={[
        "hero-audience-card eos-hero-glass flex h-full flex-col rounded-[1.75rem] p-5 text-left sm:p-6",
        isHome ? "ring-1 ring-emerald-400/35" : "ring-1 ring-sky-400/35",
      ].join(" ")}
    >
      <div className="mb-3 flex items-start gap-3 sm:mb-4">
        <div
          className={[
            "flex size-11 shrink-0 items-center justify-center rounded-2xl",
            isHome ? "bg-emerald-500/15" : "bg-sky-500/15",
          ].join(" ")}
        >
          {isHome ? (
            <Home className="size-5 text-emerald-400" aria-hidden />
          ) : (
            <Car className="size-5 text-sky-400" aria-hidden />
          )}
        </div>
        <div className="min-w-0">
          <p
            className={[
              "text-[10px] font-black uppercase tracking-[0.18em]",
              isHome ? "text-emerald-400" : "text-sky-400",
            ].join(" ")}
          >
            {brand}
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-white sm:text-lg lg:text-xl">{title}</h2>
          <p className="hero-audience-subtitle eos-luxury-media-text mt-1.5 text-xs font-light leading-relaxed text-white/75 sm:mt-2 sm:text-sm">
            {subtitle}
          </p>
        </div>
      </div>

      <ul className="hero-audience-bullets mb-5 flex flex-1 flex-col gap-2 sm:mb-6 sm:gap-2.5">
        {bullets.map((item) => (
          <li key={item} className="flex items-start gap-2 text-xs text-white/88 sm:text-sm">
            <CheckCircle2
              className={["mt-0.5 size-4 shrink-0", isHome ? "text-emerald-400" : "text-sky-400"].join(" ")}
              aria-hidden
            />
            <span className="leading-snug">{item}</span>
          </li>
        ))}
      </ul>

      <div className="grid gap-2.5">
        <button
          type="button"
          onClick={onPrimary}
          className={
            isHome
              ? "premium-hero-cta-primary group relative w-full overflow-hidden rounded-full bg-gradient-to-b from-emerald-300 via-emerald-500 to-emerald-700 px-6 py-3.5 text-[10px] font-black uppercase tracking-[0.14em] shadow-[0_14px_32px_rgba(0,0,0,0.42),inset_0_1px_1px_rgba(255,255,255,0.45)] transition-transform hover:scale-[1.02] active:scale-[0.98] sm:text-[11px]"
              : "premium-hero-cta-car group relative w-full overflow-hidden rounded-full bg-gradient-to-b from-sky-300 via-sky-500 to-sky-700 px-6 py-3.5 text-[10px] font-black uppercase tracking-[0.14em] shadow-[0_14px_32px_rgba(0,0,0,0.42),inset_0_1px_1px_rgba(255,255,255,0.45)] transition-transform hover:scale-[1.02] active:scale-[0.98] sm:text-[11px]"
          }
        >
          <span className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
          <span className="relative">{primaryCta}</span>
        </button>
        <button
          type="button"
          onClick={onSecondary}
          className="premium-hero-cta-secondary w-full rounded-full px-6 py-3 text-[10px] font-black uppercase tracking-[0.14em] backdrop-blur-xl transition-all hover:scale-[1.02] active:scale-[0.98] sm:text-[11px]"
        >
          {secondaryCta}
        </button>
      </div>
    </article>
  );
}

function HeroAgencyStrip({
  title,
  subtitle,
  agenciesCta,
  partnerCta,
  onAgencies,
  onPartner,
}: {
  title: string;
  subtitle: string;
  agenciesCta: string;
  partnerCta: string;
  onAgencies: () => void;
  onPartner: () => void;
}) {
  return (
    <div className="hero-agency-strip eos-hero-glass flex flex-col items-start gap-4 rounded-[1.5rem] border border-white/10 px-5 py-4 text-left sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/8 ring-1 ring-white/12">
          <Building2 className="size-4 text-amber-300/90" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-semibold text-white sm:text-base">{title}</p>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/65 sm:text-sm">{subtitle}</p>
        </div>
      </div>
      <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onAgencies}
          className="premium-hero-cta-secondary w-full rounded-full px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] sm:w-auto sm:text-[11px]"
        >
          {agenciesCta}
        </button>
        <button
          type="button"
          onClick={onPartner}
          className="premium-hero-cta-secondary w-full rounded-full px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] sm:w-auto sm:text-[11px]"
        >
          {partnerCta}
        </button>
      </div>
    </div>
  );
}

export default function HeroDepthEffect() {
  const { dict } = useLocale();
  const router = useRouter();
  const ref = useRef<HTMLElement | null>(null);
  const noiseFilterId = useId().replace(/:/g, "");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Mobile / wąski viewport: karty Home + Cars są jedna pod drugą —
    // silny parallax szybko zakrywa CTA aut.
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    fetch("/api/auth/check", { cache: "no-store", credentials: "include" })
      .then((res) => res.json())
      .then((data) => setLoggedIn(Boolean(data?.loggedIn && data?.user?.id)))
      .catch(() => setLoggedIn(false));
  }, []);

  const { scrollYProgress } = useScroll({
    target: ref,
    // Na mobile start parallax dopiero gdy hero jest w połowie — CTA Cars nie znika od razu.
    offset: isCompact ? ["center start", "end start"] : ["start start", "end start"],
  });
  const softMotion = reduceMotion || isCompact;
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", softMotion ? "4%" : "14%"]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1.02, softMotion ? 1.03 : 1.08]);
  // Mobile: prawie bez przesuwania contentu — inaczej Cars znika pod warstwą.
  const contentY = useTransform(
    scrollYProgress,
    [0, 1],
    ["0%", softMotion ? "4%" : "14%"],
  );
  const opacityFade = useTransform(
    scrollYProgress,
    softMotion ? [0, 0.9, 1] : [0, 0.88, 1],
    softMotion ? [1, 0.96, 0.82] : [1, 0.84, 0.55],
  );
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

  const openCta = (ctaId: HomeCtaId, overrideRoute?: string) => {
    const entry = HOME_CTA_CONTRACT[ctaId];
    const route = overrideRoute || entry.webRoute;
    trackHomeCta("home_cta_click", ctaId);
    trackHomeCta("home_cta_route_resolved", ctaId);
    router.push(route);
    trackHomeCta("home_cta_flow_opened", ctaId);
  };

  const homeListRoute = "/dodaj-oferte";
  const homeSecondaryRoute = loggedIn ? "/moje-konto/ogloszenia" : "/oferty";
  const carSecondaryRoute = loggedIn ? "/moje-konto/ogloszenia?vertical=car" : "/cars";

  return (
    <section
      ref={ref}
      className="premium-hero-stage relative min-h-[100svh] w-full overflow-x-hidden bg-[#050505]"
    >
      {/* Tło absolutne — nie przycina treści (treść jest w normalnym flow poniżej). */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
        <motion.div style={{ y: bgY, scale: bgScale }} className="absolute -inset-[10%] z-0 flex origin-center will-change-transform">
          <div
            style={{ backgroundImage: `url('${HERO_HOME_IMAGE}')` }}
            className="h-full w-1/2 bg-cover bg-center opacity-[0.4] grayscale-[0.18]"
          />
          <div
            style={{ backgroundImage: `url('${HERO_CAR_IMAGE}')` }}
            className="h-full w-1/2 bg-cover bg-center opacity-[0.38] grayscale-[0.12]"
          />
        </motion.div>

        <div className="absolute inset-0 z-[6] opacity-[0.04] mix-blend-overlay">
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
            className="absolute -left-[18%] top-[4%] z-[5] h-[86%] w-[76%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(16,185,129,0.2),transparent_72%)] blur-3xl"
            animate={{ x: ["-4%", "6%", "-2%"], y: ["0%", "5%", "-1%"], opacity: [0.22, 0.42, 0.28] }}
            transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {!reduceMotion && (
          <motion.div
            className="absolute -right-[12%] bottom-[0%] z-[5] h-[70%] w-[60%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(56,189,248,0.16),transparent_70%)] blur-3xl"
            animate={{ x: ["2%", "-5%", "1%"], y: ["0%", "-4%", "1%"], opacity: [0.14, 0.28, 0.18] }}
            transition={{ duration: 26, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
          />
        )}

        <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/72 via-black/34 to-[#050505]" />
        <div className="absolute inset-y-0 left-1/2 z-[9] w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
        <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(5,5,5,0.25)_48%,#050505_118%)]" />
        <div className="absolute inset-x-0 top-0 z-[11] h-[min(12vh,7rem)] bg-gradient-to-b from-black/90 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 z-[11] h-[min(22vh,13rem)] bg-gradient-to-t from-[#050505] to-transparent" />

        {!reduceMotion && (
          <motion.div
            className="absolute inset-0 z-[12] opacity-0 sm:opacity-100"
            style={{
              backgroundImage:
                "linear-gradient(115deg, transparent 42%, rgba(255,255,255,0.045) 50%, transparent 58%)",
              backgroundSize: "220% 100%",
            }}
            animate={{ backgroundPosition: ["12% 0%", "88% 0%", "20% 0%"] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>

      <motion.div
        style={{ y: contentY }}
        className="relative z-20 flex w-full items-start justify-center px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[calc(5.25rem+env(safe-area-inset-top))] text-center sm:pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pt-[calc(5.75rem+env(safe-area-inset-top))] md:min-h-[100svh] md:pb-[calc(4rem+env(safe-area-inset-bottom))]"
      >
        <motion.div
          style={{ opacity: opacityFade }}
          className="flex w-full max-w-6xl shrink-0 flex-col items-center"
        >
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: customEase, delay: 0.18 }}
            className="hero-eyebrow mb-3 shrink-0 text-[10px] font-black uppercase tracking-[0.28em] text-white/80 sm:mb-4 sm:text-xs"
          >
            <span className="text-emerald-400/95">{dict.hero.eyebrowHome}</span>
            <span className="mx-2 text-white/35">·</span>
            <span className="text-sky-400/95">{dict.hero.eyebrowCar}</span>
            <span className="mx-2 text-white/35">·</span>
            <span>{dict.hero.eyebrowSuffix}</span>
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 1.05, ease: customEase, delay: 0.1 }}
            className="hero-wordmark shrink-0 text-[clamp(3.75rem,22vw,16rem)] font-light leading-[0.8] tracking-[-0.075em] text-white drop-shadow-[0_18px_60px_rgba(0,0,0,0.9)] sm:text-[clamp(5rem,24vw,16rem)] md:text-[clamp(6.5rem,24vw,18rem)]"
          >
            <span className="font-semibold text-emerald-400">E</span>state
            <span className="font-semibold text-emerald-400">O</span>
            <span className="font-semibold text-sky-400">S</span>
            <sup className="ml-1 align-super text-[0.18em] font-black tracking-normal text-white/80">TM</sup>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, ease: customEase, delay: 0.24 }}
            className="mt-3 max-w-2xl px-2 text-sm font-light leading-relaxed text-white/78 sm:mt-4 sm:text-base"
          >
            {dict.hero.tagline}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: customEase, delay: 0.32 }}
            className="hero-audience-grid mt-5 grid w-full max-w-5xl gap-3 sm:mt-6 md:mt-8 md:grid-cols-2 md:gap-5"
          >
            <HeroVerticalCard
              vertical="home"
              brand={dict.hero.homeCard.brand}
              title={dict.hero.homeCard.title}
              subtitle={dict.hero.homeCard.subtitle}
              bullets={dict.hero.homeCard.bullets}
              primaryCta={dict.hero.homeCard.ctaList}
              secondaryCta={loggedIn ? dict.hero.homeCard.ctaMine : dict.hero.homeCard.ctaBrowse}
              onPrimary={() => openCta("LIST", homeListRoute)}
              onSecondary={() => openCta("HOME_CATALOG", homeSecondaryRoute)}
            />
            <HeroVerticalCard
              vertical="car"
              brand={dict.hero.carCard.brand}
              title={dict.hero.carCard.title}
              subtitle={dict.hero.carCard.subtitle}
              bullets={dict.hero.carCard.bullets}
              primaryCta={dict.hero.carCard.ctaList}
              secondaryCta={loggedIn ? dict.hero.carCard.ctaMine : dict.hero.carCard.ctaBrowse}
              onPrimary={() => openCta("CAR_LIST")}
              onSecondary={() => openCta("CAR_CATALOG", carSecondaryRoute)}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, ease: customEase, delay: 0.46 }}
            className="mt-4 w-full max-w-5xl md:mt-5"
          >
            <HeroAgencyStrip
              title={dict.hero.agencyStrip.title}
              subtitle={dict.hero.agencyStrip.subtitle}
              agenciesCta={dict.hero.agencyStrip.agenciesCta}
              partnerCta={dict.hero.agencyStrip.cta}
              onAgencies={() => {
                trackHomeCta("home_cta_click", "AGENCIES_CATALOG");
                router.push("/agencje");
                trackHomeCta("home_cta_flow_opened", "AGENCIES_CATALOG");
              }}
              onPartner={() => {
                trackHomeCta("home_cta_click", "AGENCY");
                router.push("/cennik?tab=partner");
                trackHomeCta("home_cta_flow_opened", "AGENCY");
              }}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: customEase, delay: 0.58 }}
            className="hero-app-badges mt-5 md:mt-7"
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
        <span className="text-[9px] font-black uppercase tracking-[0.28em]">{dict.hero.scroll}</span>
        <motion.span
          className="h-12 w-px bg-gradient-to-b from-white/60 to-transparent"
          animate={reduceMotion ? undefined : { scaleY: [0.35, 1, 0.35], opacity: [0.25, 0.75, 0.25] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </section>
  );
}
