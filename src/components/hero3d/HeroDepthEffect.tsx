"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, Home } from "lucide-react";
import {
  HOME_CTA_CONTRACT,
  HomeCtaAnalyticsEvent,
  HomeCtaId,
} from "@/contracts/homeCtaContract";
import { useLocale } from "@/contexts/LocaleContext";
import AppStoreBadgeLink from "@/components/ui/AppStoreBadgeLink";
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2075&auto=format&fit=crop";

type HeroCardVariant = "private" | "agency";

function HeroAudienceCard({
  variant,
  title,
  subtitle,
  bullets,
  cta,
  onCta,
}: {
  variant: HeroCardVariant;
  title: string;
  subtitle: string;
  bullets: string[];
  cta: string;
  onCta: () => void;
}) {
  const isPrivate = variant === "private";

  return (
    <article
      className={[
        "eos-hero-glass flex h-full flex-col rounded-[1.75rem] p-6 text-left sm:p-7",
        isPrivate ? "ring-1 ring-[#d9b58b]/40" : "ring-1 ring-emerald-400/30",
      ].join(" ")}
    >
      <div className="mb-4 flex items-start gap-3">
        <div
          className={[
            "flex size-11 shrink-0 items-center justify-center rounded-2xl",
            isPrivate
              ? "bg-gradient-to-br from-[#d9b58b]/35 to-[#70451f]/25"
              : "bg-emerald-500/15",
          ].join(" ")}
        >
          {isPrivate ? (
            <Home className="size-5 text-[#f0d4a8]" aria-hidden />
          ) : (
            <Building2 className="size-5 text-emerald-400" aria-hidden />
          )}
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{title}</h2>
          <p className="eos-luxury-media-text mt-2 text-sm font-light leading-relaxed text-white/75">
            {subtitle}
          </p>
        </div>
      </div>

      <ul className="mb-6 flex flex-1 flex-col gap-2.5">
        {bullets.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-white/88">
            <CheckCircle2
              className={[
                "mt-0.5 size-4 shrink-0",
                isPrivate ? "text-[#d9b58b]" : "text-emerald-400",
              ].join(" ")}
              aria-hidden
            />
            <span className="leading-snug">{item}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onCta}
        className={
          isPrivate
            ? "premium-hero-cta-primary group relative w-full overflow-hidden rounded-full bg-gradient-to-b from-[#d9b58b] via-[#b98c58] to-[#70451f] px-6 py-3.5 text-[10px] font-black uppercase tracking-[0.14em] shadow-[0_14px_32px_rgba(0,0,0,0.42),inset_0_1px_1px_rgba(255,255,255,0.45)] transition-transform hover:scale-[1.02] active:scale-[0.98] sm:text-[11px]"
            : "premium-hero-cta-secondary w-full rounded-full px-6 py-3.5 text-[10px] font-black uppercase tracking-[0.14em] backdrop-blur-xl transition-all hover:scale-[1.02] active:scale-[0.98] sm:text-[11px]"
        }
      >
        {isPrivate ? (
          <>
            <span className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
            <span className="relative">{cta}</span>
          </>
        ) : (
          cta
        )}
      </button>
    </article>
  );
}

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
      className="premium-hero-stage relative h-[100svh] w-full overflow-hidden bg-[#050505]"
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
          className="relative z-20 flex h-full items-center justify-center overflow-y-auto px-4 pb-[calc(4rem+env(safe-area-inset-bottom))] pt-[calc(4.5rem+env(safe-area-inset-top))] text-center"
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
              className="text-[14vw] font-light leading-[0.82] tracking-[-0.075em] text-white drop-shadow-[0_18px_60px_rgba(0,0,0,0.9)] sm:text-[10vw] lg:text-[7.5rem]"
            >
              <span className="font-semibold text-emerald-400">E</span>state
              <span className="font-semibold text-emerald-400">OS</span>
              <sup className="ml-1 align-super text-[0.18em] font-black tracking-normal text-white/80">TM</sup>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: customEase, delay: 0.32 }}
              className="mt-6 grid w-full max-w-5xl gap-4 md:mt-8 md:grid-cols-2 md:gap-5"
            >
              <HeroAudienceCard
                variant="private"
                title={dict.hero.privateCard.title}
                subtitle={dict.hero.privateCard.subtitle}
                bullets={dict.hero.privateCard.bullets}
                cta={dict.hero.privateCard.cta}
                onCta={() => openHomeCta("PRIVATE")}
              />
              <HeroAudienceCard
                variant="agency"
                title={dict.hero.agencyCard.title}
                subtitle={dict.hero.agencyCard.subtitle}
                bullets={dict.hero.agencyCard.bullets}
                cta={dict.hero.agencyCard.cta}
                onCta={() => openHomeCta("AGENCY")}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: customEase, delay: 0.58 }}
              className="mt-6 md:mt-8"
            >
              <AppStoreBadgeLink
                label={dict.footer.appStore}
                androidComingSoon
                androidSoonLabel={dict.homeAppPitch.androidSoon}
                androidBetaLabel={dict.homeAppPitch.androidBetaLabel}
                androidBetaBadge={dict.homeAppPitch.androidBetaBadge}
                showAndroidBetaHint
                androidBetaHint={dict.homeAppPitch.androidBetaHint}
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
      </div>
    </section>
  );
}
