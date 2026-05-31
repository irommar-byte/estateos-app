"use client";

import { motion } from "framer-motion";
import { Home, Radar } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import AppStoreBadgeLink from "@/components/ui/AppStoreBadgeLink";

const ease = [0.16, 1, 0.3, 1] as const;

export default function HomeAppPitch() {
  const { dict } = useLocale();
  const p = dict.homeAppPitch;

  return (
    <section
      aria-labelledby="home-app-pitch-heading"
      className="relative overflow-hidden border-b border-[var(--eos-border)] bg-[var(--eos-bg)] py-20 sm:py-28"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.12),transparent_60%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-[20%] bottom-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.06),transparent_70%)] blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.75, ease }}
          className="mx-auto max-w-3xl text-center"
        >
          <p className="mb-4 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.32em] text-emerald-400/95">
            <Radar size={14} className="text-emerald-400" aria-hidden />
            {p.eyebrow}
          </p>
          <h2
            id="home-app-pitch-heading"
            className="text-3xl font-light leading-tight tracking-tight text-[var(--eos-text)] sm:text-4xl md:text-5xl"
          >
            {p.headline}
            <br />
            <span className="font-semibold text-emerald-500">{p.headlineAccent}</span>
          </h2>
        </motion.div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 md:gap-6">
          <motion.article
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, ease, delay: 0.08 }}
            className="group rounded-[2rem] border border-emerald-500/20 bg-[var(--eos-bg-elevated)]/80 p-8 shadow-[0_24px_60px_rgba(0,0,0,0.12)] backdrop-blur-sm transition-colors hover:border-emerald-500/35"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
              <Radar size={22} aria-hidden />
            </div>
            <h3 className="text-lg font-bold text-[var(--eos-text)]">{p.radarTitle}</h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--eos-muted)] sm:text-[15px]">{p.radarBody}</p>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, ease, delay: 0.16 }}
            className="group rounded-[2rem] border border-white/10 bg-[var(--eos-bg-elevated)]/80 p-8 shadow-[0_24px_60px_rgba(0,0,0,0.12)] backdrop-blur-sm transition-colors hover:border-amber-500/25"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
              <Home size={22} aria-hidden />
            </div>
            <h3 className="text-lg font-bold text-[var(--eos-text)]">{p.sellerTitle}</h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--eos-muted)] sm:text-[15px]">{p.sellerBody}</p>
          </motion.article>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.7, ease, delay: 0.22 }}
          className="mx-auto mt-12 max-w-2xl text-center text-base font-light leading-relaxed text-[var(--eos-muted)] sm:text-lg"
        >
          {p.closing}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.7, ease, delay: 0.3 }}
          className="mt-12 flex flex-col items-center gap-5"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[var(--eos-subtle)]">
            {p.downloadLabel}
          </p>
          <AppStoreBadgeLink androidComingSoon androidSoonLabel={p.androidSoon} label={dict.footer.appStore} />
        </motion.div>
      </div>
    </section>
  );
}
