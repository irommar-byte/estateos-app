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
    <section className="relative overflow-hidden border-t border-white/10 bg-black py-20 sm:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.06),transparent_50%)]"
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-400">
            {dict.highlights.eyebrow}
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {dict.highlights.title}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-zinc-400">{dict.highlights.body}</p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.1 } },
          }}
          className="mt-14 grid gap-6 md:grid-cols-3"
        >
          {items.map((item) => (
            <motion.article
              key={item.title}
              variants={{
                hidden: { opacity: 0, y: 24 },
                show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
              }}
              className="group relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-zinc-900/50 p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] backdrop-blur-3xl transition-all hover:bg-zinc-800/50"
            >
              <div
                aria-hidden
                className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl opacity-50 transition-opacity group-hover:opacity-100"
              />
              <item.icon className="size-8 text-emerald-400" aria-hidden />
              <h3 className="mt-6 text-xl font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.body}</p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
