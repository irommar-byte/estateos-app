"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Map,
  Store,
  User,
  Radar,
  Heart,
  PlusCircle,
  Handshake,
  Shield,
  Smartphone,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { getPlatformHelp, type HelpSection } from "@/content/platformHelp";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const ICONS: Record<HelpSection["icon"], LucideIcon> = {
  map: Map,
  store: Store,
  user: User,
  radar: Radar,
  heart: Heart,
  plus: PlusCircle,
  deal: Handshake,
  shield: Shield,
  phone: Smartphone,
};

export default function HelpModal({ isOpen, onClose }: Props) {
  const { locale } = useLocale();
  const help = getPlatformHelp(locale);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999999] flex items-start justify-center overflow-y-auto bg-black/85 p-3 backdrop-blur-3xl sm:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.98, y: 12 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.98, y: 12 }}
          onClick={(e) => e.stopPropagation()}
          className="relative my-4 flex w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#080808] shadow-[0_30px_100px_rgba(0,0,0,0.85)] sm:my-8 sm:max-h-[92vh]"
        >
          <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-[120px]" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-white/5 blur-[100px]" />

          <header className="relative shrink-0 border-b border-white/5 px-6 py-6 sm:px-10 sm:py-8">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-white sm:right-6 sm:top-6"
              aria-label="Close"
            >
              <X size={22} />
            </button>
            <div className="flex items-start gap-4 pr-10">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
                <BookOpen size={26} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-500/80">EstateOS™</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">{help.modalTitle}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/45">{help.modalSubtitle}</p>
              </div>
            </div>
          </header>

          <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
            <nav className="shrink-0 border-b border-white/5 bg-[#050505]/80 px-4 py-4 lg:w-56 lg:border-b-0 lg:border-r lg:py-6">
              <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">{help.tocLabel}</p>
              <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
                {help.sections.map((section, i) => {
                  const Icon = ICONS[section.icon];
                  return (
                    <li key={section.id} className="shrink-0 lg:shrink">
                      <a
                        href={`#help-${section.id}`}
                        className="flex items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-white/45 transition-colors hover:border-white/10 hover:bg-white/5 hover:text-white lg:text-[10px]"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                          <Icon size={12} />
                        </span>
                        <span className="max-w-[140px] truncate lg:max-w-none lg:whitespace-normal">
                          {i + 1}. {section.title.split("—")[0].trim().split("–")[0].trim()}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
              <div className="space-y-10">
                {help.sections.map((section) => {
                  const Icon = ICONS[section.icon];
                  return (
                    <article
                      key={section.id}
                      id={`help-${section.id}`}
                      className="scroll-mt-6 rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.04] to-transparent p-5 sm:p-7"
                    >
                      <div className="mb-4 flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.12)]">
                          <Icon size={22} />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white sm:text-xl">{section.title}</h3>
                          <p className="mt-2 text-sm leading-relaxed text-white/50">{section.summary}</p>
                        </div>
                      </div>

                      <ul className="ml-1 space-y-2.5 border-l border-emerald-500/20 pl-5">
                        {section.bullets.map((bullet) => (
                          <li key={bullet} className="relative text-sm leading-relaxed text-white/65">
                            <span className="absolute -left-5 top-2 h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
                            {bullet}
                          </li>
                        ))}
                      </ul>

                      {section.links && section.links.length > 0 && (
                        <div className="mt-5 flex flex-wrap gap-2">
                          {section.links.map((link) => (
                            <Link
                              key={link.href}
                              href={link.href}
                              onClick={onClose}
                              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white/70 transition-colors hover:border-emerald-500/40 hover:text-emerald-300"
                            >
                              {link.label}
                              <ChevronRight size={12} />
                            </Link>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
