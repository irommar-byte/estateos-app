"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import AppStoreBadgeLink from "@/components/ui/AppStoreBadgeLink";
import { useLocale } from "@/contexts/LocaleContext";

type AudienceKey = "private" | "agency";

const HERO_IMAGES: Record<AudienceKey, string> = {
  private:
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=2070&auto=format&fit=crop",
  agency:
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop",
};

const ease = [0.16, 1, 0.3, 1] as const;

export default function AudienceLanding({ audience }: { audience: AudienceKey }) {
  const { dict } = useLocale();
  const copy = audience === "private" ? dict.audiencePrivate : dict.audienceAgency;
  const registerHref =
    audience === "agency" ? "/rejestracja?kind=agent" : "/rejestracja?kind=private";
  const mapHref = audience === "agency" ? "/oferty" : "/#map";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] pt-[calc(4.5rem+env(safe-area-inset-top))] text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.38] grayscale-[0.15]"
        style={{ backgroundImage: `url('${HERO_IMAGES[audience]}')` }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-[#050505]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(16,185,129,0.16),transparent_42%)]" />

      <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
          className="text-[10px] font-black uppercase tracking-[0.32em] text-emerald-400/95 sm:text-xs"
        >
          {copy.eyebrow}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease, delay: 0.06 }}
          className="mt-5 max-w-4xl text-4xl font-light leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
        >
          {copy.title}{" "}
          <span className="font-semibold text-emerald-400">{copy.titleAccent}</span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease, delay: 0.14 }}
          className="eos-hero-glass mt-8 max-w-3xl rounded-[1.75rem] p-6 sm:p-8"
        >
          <p className="eos-luxury-media-text text-base font-light leading-[1.75] text-white/90 sm:text-lg">
            {copy.subtitle}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease, delay: 0.22 }}
          className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
        >
          <Link
            href={registerHref}
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-b from-emerald-300 via-emerald-500 to-emerald-700 px-8 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-black shadow-[0_18px_38px_rgba(0,0,0,0.45)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {copy.ctaPrimary}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href={mapHref}
            className="inline-flex items-center justify-center rounded-full border border-white/22 bg-white/10 px-8 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-white backdrop-blur-xl transition hover:border-white/35 hover:bg-white/15"
          >
            {copy.ctaSecondary}
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full px-6 py-4 text-[11px] font-bold uppercase tracking-[0.14em] text-white/75 transition hover:text-white"
          >
            {copy.ctaLogin}
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease, delay: 0.3 }}
          className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {copy.features.map((feature, index) => (
            <article
              key={feature.title}
              className="eos-audience-feature rounded-[1.5rem] border border-white/12 bg-white/[0.06] p-6 backdrop-blur-2xl"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <CheckCircle2 className="mb-4 size-5 text-emerald-400" aria-hidden />
              <h2 className="eos-luxury-media-text text-lg font-semibold text-white">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/72">{feature.body}</p>
            </article>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease, delay: 0.38 }}
          className="eos-hero-glass mt-16 rounded-[2rem] p-8 sm:p-10"
        >
          <p className="eos-luxury-media-text text-center text-lg font-light leading-relaxed text-white/88 sm:text-xl">
            {copy.closing}
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href={registerHref}
              className="rounded-full bg-white px-8 py-3.5 text-[11px] font-black uppercase tracking-[0.16em] text-black transition hover:bg-white/92"
            >
              {copy.ctaPrimary}
            </Link>
            {audience === "agency" ? (
              <Link
                href="/cennik?tab=partner"
                className="rounded-full border border-amber-300/40 bg-amber-400/10 px-8 py-3.5 text-[11px] font-black uppercase tracking-[0.16em] text-amber-200 transition hover:bg-amber-400/20"
              >
                {copy.ctaPricing}
              </Link>
            ) : null}
          </div>
          <div className="mt-10 flex justify-center">
            <AppStoreBadgeLink
              label={dict.footer.appStore}
              androidComingSoon
              androidSoonLabel={dict.homeAppPitch.androidSoon}
              androidBetaLabel={dict.homeAppPitch.androidBetaLabel}
              androidBetaBadge={dict.homeAppPitch.androidBetaBadge}
              showAndroidBetaHint
              androidBetaHint={dict.homeAppPitch.androidBetaHint}
            />
          </div>
        </motion.div>
      </div>
    </main>
  );
}
