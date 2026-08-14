'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Sparkles, Target, UserPlus, ArrowRight } from 'lucide-react';
import { eosBtn } from '@/components/ui/eosButtonStyles';

type DayItem = {
  id: string;
  kind: string;
  title: string;
  subtitle?: string | null;
  startsAt?: string | null;
  href?: string | null;
};

type DayBrief = {
  greeting: string;
  dateLabel: string;
  items: DayItem[];
  newMatches: number;
  acquisitionToday: number;
};

type Props = {
  personName: string;
  onAddClient?: () => void;
  onOpenClients?: () => void;
  onOpenPlanning?: () => void;
};

export default function CrmDayBrief({ personName, onAddClient, onOpenClients, onOpenPlanning }: Props) {
  const [data, setData] = useState<DayBrief | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/crm/day-brief', { cache: 'no-store', credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json?.success) setData(json.brief as DayBrief);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = personName.trim().split(/\s+/)[0] || 'Agent';
  const dateLabel =
    data?.dateLabel ||
    new Date().toLocaleDateString('pl-PL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  const items = data?.items?.slice(0, 4) || [];
  const newMatches = data?.newMatches || 0;

  return (
    <section className="mb-5 rounded-[1.75rem] border border-[var(--eos-border)] bg-gradient-to-br from-emerald-500/[0.08] via-[var(--eos-card)] to-[var(--eos-card)] p-4 sm:mb-6 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">Dziś w CRM</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-[var(--eos-text)] sm:text-2xl">
            Dzień dobry, {firstName}
          </h2>
          <p className="mt-1 flex items-center gap-2 text-sm capitalize text-[var(--eos-muted)]">
            <CalendarDays size={14} className="text-emerald-500" />
            {dateLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onAddClient ? (
            <button type="button" onClick={onAddClient} className={eosBtn('home', { size: 'sm' })}>
              <UserPlus size={14} />
              Dodaj klienta
            </button>
          ) : null}
          {onOpenPlanning ? (
            <button type="button" onClick={onOpenPlanning} className={eosBtn('secondary', { size: 'sm' })}>
              Planowanie
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <button
          type="button"
          onClick={onOpenClients}
          className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-3.5 text-left transition hover:border-emerald-500/35"
        >
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
            <Target size={12} className="text-emerald-500" /> Nowe dopasowania
          </p>
          <p className="mt-2 text-2xl font-black text-[var(--eos-text)]">{newMatches}</p>
          <p className="mt-1 text-xs text-[var(--eos-muted)]">Oferty spełniające kryteria kupujących</p>
        </button>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--eos-border)] bg-[var(--eos-input)]/40 p-3.5 sm:col-span-1 lg:col-span-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--eos-muted)]">
              <Sparkles size={14} className="text-emerald-500" />
              Brak zaplanowanych spraw na dziś — dobry moment na follow-up klientów.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              href={item.href || '/moje-konto/crm?tab=planowanie'}
              className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-3.5 transition hover:border-emerald-500/35"
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                {item.kind === 'acquisition' ? 'Pozyskanie' : item.kind === 'presentation' ? 'Prezentacja' : 'Termin'}
              </p>
              <p className="mt-1 line-clamp-1 text-sm font-black text-[var(--eos-text)]">{item.title}</p>
              {item.subtitle ? (
                <p className="mt-0.5 line-clamp-1 text-xs text-[var(--eos-muted)]">{item.subtitle}</p>
              ) : null}
              {item.startsAt ? (
                <p className="mt-2 flex items-center gap-1 text-[11px] font-bold text-[var(--eos-subtle)]">
                  {new Date(item.startsAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                  <ArrowRight size={12} />
                </p>
              ) : null}
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
