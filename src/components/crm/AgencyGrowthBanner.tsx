'use client';

import Link from 'next/link';
import { ArrowRight, Sparkles, TrendingUp, AlertTriangle, Zap } from 'lucide-react';
import type { PartnerGrowthInsight } from '@/lib/partnerGrowth';

const SEVERITY_STYLES = {
  info: {
    border: 'border-[#a8844c]/25',
    bg: 'from-[#a8844c]/[0.08] to-[var(--eos-card)]',
    icon: Sparkles,
    iconClass: 'text-[#a8844c]',
    cta: 'bg-[#a8844c] text-black hover:bg-[#c9a86a]',
    sig: '',
  },
  warning: {
    border: 'border-amber-500/30',
    bg: 'from-amber-500/[0.08] to-[var(--eos-card)]',
    icon: TrendingUp,
    iconClass: 'text-amber-500',
    cta: 'bg-amber-500 text-black hover:bg-amber-400',
    sig: 'eos-sig-glow eos-sig--warn',
  },
  urgent: {
    border: 'border-red-500/30',
    bg: 'from-red-500/[0.08] to-[var(--eos-card)]',
    icon: AlertTriangle,
    iconClass: 'text-red-500',
    cta: 'bg-red-500 text-white hover:bg-red-400',
    sig: 'eos-sig-glow eos-sig--bad',
  },
} as const;

export default function AgencyGrowthBanner({
  insight,
  compact = false,
}: {
  insight: PartnerGrowthInsight;
  compact?: boolean;
}) {
  const style = SEVERITY_STYLES[insight.severity];
  const Icon = style.icon;

  if (compact) {
    return (
      <Link
        href={insight.ctaHref}
        className={`mb-4 flex items-center gap-3 rounded-2xl border ${style.border} ${style.sig} bg-gradient-to-r ${style.bg} p-4 transition hover:opacity-95`}
      >
        <Icon size={18} className={`shrink-0 ${style.iconClass}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[var(--eos-text)]">{insight.title}</p>
          <p className="text-xs text-[var(--eos-muted)] line-clamp-2">{insight.body}</p>
        </div>
        <ArrowRight size={16} className="shrink-0 text-[var(--eos-muted)]" />
      </Link>
    );
  }

  return (
    <section
      className={`overflow-hidden rounded-3xl border ${style.border} ${style.sig} bg-gradient-to-br ${style.bg}`}
    >
      <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <Icon size={16} className={style.iconClass} />
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--eos-muted)]">
              Wskazówka dla biura
            </span>
          </div>
          <h2 className="text-xl font-black text-[var(--eos-text)] md:text-2xl">{insight.title}</h2>
          <p className="eos-muted-copy mt-2 text-sm leading-relaxed">{insight.body}</p>
          {insight.savingsPln && insight.savingsPln > 0 ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#a8844c]/20 bg-[#a8844c]/10 px-3 py-1 text-[11px] font-bold text-[#7a5a26] dark:text-[#c9a86a]">
              <Zap size={12} />
              Oszczędność ~{insight.savingsPln} zł/mies.
              {insight.savingsPercent ? ` (−${insight.savingsPercent}% vs detal)` : null}
            </p>
          ) : null}
        </div>
        <Link
          href={insight.ctaHref}
          className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-black uppercase tracking-widest shadow-lg transition ${style.cta}`}
        >
          {insight.ctaLabel}
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
