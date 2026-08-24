"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Building2, Car, CheckCircle2, Home } from "lucide-react";
import {
  HOME_CTA_CONTRACT,
  HomeCtaAnalyticsEvent,
  HomeCtaId,
} from "@/contracts/homeCtaContract";
import { useLocale } from "@/contexts/LocaleContext";
import AppStoreBadgeLink from "@/components/ui/AppStoreBadgeLink";

/** Lżejsze assety: webp + mniejszy w — tło dekoracyjne, nie LCP tekstu. */
const HERO_HOME_IMAGE =
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=960&q=55&fm=webp";
const HERO_CAR_IMAGE =
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=960&q=55&fm=webp";

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
          <h2 className="mt-1 text-base font-semibold tracking-tight text-white sm:text-lg lg:text-xl">
            {title}
          </h2>
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
          className="premium-hero-cta-secondary w-full rounded-full px-6 py-3 text-[10px] font-black uppercase tracking-[0.14em] transition-transform hover:scale-[1.02] active:scale-[0.98] sm:text-[11px]"
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
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/8 ring-1 ring-white/12">
          <Building2 className="size-4 text-amber-300/90" aria-hidden />
        </div>
        <div className="min-w-0">
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
  const reduceMotion = useReducedMotion();
  const [loggedIn, setLoggedIn] = useState(false);
  const [bgReady, setBgReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const preload = (src: string) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = src;
      });

    Promise.all([preload(HERO_HOME_IMAGE), preload(HERO_CAR_IMAGE)]).then(() => {
      if (!cancelled) setBgReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetch("/api/auth/check", { cache: "no-store", credentials: "include" })
      .then((res) => res.json())
      .then((data) => setLoggedIn(Boolean(data?.loggedIn && data?.user?.id)))
      .catch(() => setLoggedIn(false));
  }, []);

  const customEase = [0.16, 1, 0.3, 1] as const;
  const enter = (delay: number) =>
    reduceMotion
      ? { initial: { opacity: 1, y: 0 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0 } }
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, ease: customEase, delay },
        };

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
    <section className="premium-hero-stage relative w-full overflow-x-hidden bg-[#050505]">
      {/* Static background — no scroll-linked transforms (Lenis-friendly). */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden [contain:paint]" aria-hidden>
        <div
          className={[
            "absolute inset-0 flex transition-opacity duration-700",
            bgReady ? "opacity-100" : "opacity-0",
          ].join(" ")}
        >
          <div
            style={{ backgroundImage: `url('${HERO_HOME_IMAGE}')` }}
            className="h-full w-1/2 bg-cover bg-center opacity-[0.38] [content-visibility:auto]"
          />
          <div
            style={{ backgroundImage: `url('${HERO_CAR_IMAGE}')` }}
            className="h-full w-1/2 bg-cover bg-center opacity-[0.36] [content-visibility:auto]"
          />
        </div>

        {/* Static washes — no animated blur orbs / SVG turbulence */}
        <div className="hero-bg-orb hero-bg-orb--home absolute -left-[18%] top-[4%] z-[5] h-[70%] w-[62%]" />
        <div className="hero-bg-orb hero-bg-orb--car absolute -right-[12%] bottom-[0%] z-[5] h-[58%] w-[52%]" />

        <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/78 via-black/42 to-[#050505]" />
        <div className="absolute inset-y-0 left-1/2 z-[9] hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/10 to-transparent md:block" />
        <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(5,5,5,0.28)_50%,#050505_118%)]" />
        <div className="absolute inset-x-0 top-0 z-[11] h-[min(12vh,7rem)] bg-gradient-to-b from-black/90 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 z-[11] h-[min(18vh,10rem)] bg-gradient-to-t from-[#050505] to-transparent" />
      </div>

      <div className="relative z-20 mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-[calc(3.25rem+env(safe-area-inset-bottom))] pt-[calc(5.25rem+env(safe-area-inset-top))] text-center sm:px-6 sm:pb-[calc(3.75rem+env(safe-area-inset-bottom))] sm:pt-[calc(5.75rem+env(safe-area-inset-top))] lg:pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        <motion.p
          {...enter(0.05)}
          className="hero-eyebrow mb-3 shrink-0 text-[10px] font-black uppercase tracking-[0.28em] text-white/80 sm:mb-4 sm:text-xs"
        >
          <span className="text-emerald-400/95">{dict.hero.eyebrowHome}</span>
          <span className="mx-2 text-white/35">·</span>
          <span className="text-sky-400/95">{dict.hero.eyebrowCar}</span>
          <span className="mx-2 text-white/35">·</span>
          <span>{dict.hero.eyebrowSuffix}</span>
        </motion.p>

        <motion.h1
          {...(reduceMotion
            ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
            : {
                initial: { opacity: 0, y: 10 },
                animate: { opacity: 1, y: 0 },
                transition: { duration: 0.6, ease: customEase, delay: 0.08 },
              })}
          className="hero-wordmark shrink-0 text-[clamp(2.85rem,14vw,8.5rem)] font-light leading-[0.86] tracking-[-0.075em] text-white drop-shadow-[0_12px_40px_rgba(0,0,0,0.75)] sm:text-[clamp(4rem,12vw,9.5rem)] md:text-[clamp(5rem,11vw,11rem)]"
        >
          <span className="font-semibold text-emerald-400">E</span>state
          <span className="font-semibold text-emerald-400">O</span>
          <span className="font-semibold text-sky-400">S</span>
          <sup className="ml-1 align-super text-[0.18em] font-black tracking-normal text-white/80">TM</sup>
        </motion.h1>

        <motion.p
          {...enter(0.14)}
          className="mt-3 max-w-2xl px-1 text-sm font-light leading-relaxed text-white/78 sm:mt-4 sm:px-2 sm:text-base"
        >
          {dict.hero.tagline}
        </motion.p>

        <motion.div
          {...enter(0.2)}
          className="hero-audience-grid mt-5 grid w-full gap-3 sm:mt-6 md:mt-8 md:grid-cols-2 md:gap-5"
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

        <motion.div {...enter(0.28)} className="mt-4 w-full md:mt-5">
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

        <motion.div {...enter(0.34)} className="hero-app-badges mt-5 md:mt-7">
          <AppStoreBadgeLink
            label={dict.footer.appStore}
            androidComingSoon
            androidSoonLabel={dict.homeAppPitch.androidSoon}
          />
        </motion.div>

        <motion.div
          {...enter(0.4)}
          className="mt-8 hidden flex-col items-center gap-2 text-white/30 sm:flex"
          aria-hidden
        >
          <span className="text-[9px] font-black uppercase tracking-[0.28em]">{dict.hero.scroll}</span>
          <span className="h-10 w-px bg-gradient-to-b from-white/55 to-transparent" />
        </motion.div>
      </div>
    </section>
  );
}
