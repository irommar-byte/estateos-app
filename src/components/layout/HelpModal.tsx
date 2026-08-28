"use client";

import Link from "next/link";
import {
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
import EosModal from "@/components/ui/EosModal";

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

  return (
    <EosModal
      open={isOpen}
      onClose={onClose}
      variant="centered"
      maxWidth="max-w-5xl"
      hideHeader
      hideBodyPadding
      bodyClassName="flex min-h-0 flex-col overflow-hidden"
    >
      <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-white/5 blur-[100px]" />

      <header className="relative shrink-0 border-b border-[var(--eos-border)] px-6 py-6 sm:px-10 sm:py-8">
        <div className="flex items-start gap-4 pr-10">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
            <BookOpen size={26} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-500/80">EstateOS™</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--eos-text)] sm:text-3xl">{help.modalTitle}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--eos-muted)]">{help.modalSubtitle}</p>
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav className="shrink-0 border-b border-[var(--eos-border)] bg-[var(--eos-surface)] px-4 py-4 lg:w-56 lg:border-b-0 lg:border-r lg:py-6">
          <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-subtle)]">{help.tocLabel}</p>
          <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {help.sections.map((section, i) => {
              const Icon = ICONS[section.icon];
              return (
                <li key={section.id} className="shrink-0 lg:shrink">
                  <a
                    href={`#help-${section.id}`}
                    className="flex items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--eos-muted)] transition-colors hover:border-[var(--eos-border)] hover:bg-[var(--eos-input)] hover:text-[var(--eos-text)] lg:text-[10px]"
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
                  className="scroll-mt-6 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-5 sm:p-7"
                >
                  <div className="mb-4 flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.12)]">
                      <Icon size={22} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[var(--eos-text)] sm:text-xl">{section.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">{section.summary}</p>
                    </div>
                  </div>

                  <ul className="ml-1 space-y-2.5 border-l border-emerald-500/20 pl-5">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="relative text-sm leading-relaxed text-[var(--eos-text)]">
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
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--eos-text)] transition-colors hover:border-[var(--eos-accent)]/40 hover:text-[var(--eos-accent)]"
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
    </EosModal>
  );
}
