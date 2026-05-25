"use client";

import { motion } from "framer-motion";
import { Fingerprint, Radar, ShieldCheck } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";

export default function SignatureHighlights() {
  const { dict } = useLocale();

  const items = [
    { icon: Radar, title: dict.homePremium.trustRadarTitle, body: dict.homePremium.trustRadarDesc },
    { icon: Fingerprint, title: dict.homePremium.trustSecurityTitle, body: dict.homePremium.trustSecurityDesc },
    { icon: ShieldCheck, title: dict.homePremium.trustLegalTitle, body: dict.homePremium.trustLegalDesc },
  ] as const;

  return (
    <section className="premium-home-surface relative overflow-hidden border-t border-white/[0.06] bg-black py-16 sm:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.08),transparent_55%)]"
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.32em] text-emerald-400/90">
            {dict.highlights.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--eos-text)] sm:text-4xl">
            {dict.highlights.title}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[var(--eos-muted)] sm:text-base">{dict.highlights.body}</p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.1 } },
          }}
          className="mt-12 grid gap-6 md:grid-cols-3"
        >
          {items.map((item) => (
            <motion.article
              key={item.title}
              variants={{
                hidden: { opacity: 0, y: 24 },
                show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
              }}
              className="eos-card group relative overflow-hidden rounded-3xl p-6"
            >
              <div
                aria-hidden
                className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl transition-opacity group-hover:opacity-100 opacity-60"
              />
              <item.icon className="size-7 text-emerald-400" aria-hidden />
              <h3 className="mt-4 text-lg font-semibold text-[var(--eos-text)]">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">{item.body}</p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
