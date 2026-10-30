'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, HandCoins, Newspaper, TrendingUp, UserPlus, Zap } from 'lucide-react';
import PricePulseWidget from '@/components/market/PricePulseWidget';
import { demandLabelForLevel, type PulseEvent, type PulseHeadline } from '@/types/marketPulse';

const ICONS = { UserPlus, HandCoins, CheckCircle2, Zap, TrendingUp } as const;

/** Puls rynku na biurku: średnia cena za m², popyt, puls cen z aktów, wiadomości i zdarzenia na żywo. */
export default function CrmMarketPulse() {
  const [avg, setAvg] = useState<number | null>(null);
  const [demand, setDemand] = useState<string | null>(null);
  const [headlines, setHeadlines] = useState<PulseHeadline[]>([]);
  const [events, setEvents] = useState<PulseEvent[]>([]);
  const [idx, setIdx] = useState(0);
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/pro-widget/pulse?locale=pl', { cache: 'no-store' });
      const data = await res.json();
      if (!data?.success) return;
      if (typeof data.metrics?.avgPricePerSqm === 'number') setAvg(data.metrics.avgPricePerSqm);
      if (data.metrics?.demandLevel) setDemand(demandLabelForLevel(data.metrics.demandLevel, 'pl'));
      if (Array.isArray(data.headlines)) setHeadlines(data.headlines);
      if (Array.isArray(data.events)) setEvents(data.events);
      setLive(true);
    } catch {
      setLive(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(load, 60_000);
    return () => window.clearInterval(t);
  }, [load]);
  useEffect(() => {
    if (headlines.length < 2) return;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % headlines.length), 7000);
    return () => window.clearInterval(t);
  }, [headlines.length]);

  const h = headlines[idx % Math.max(1, headlines.length)];

  return (
    <div className="crmx-pulse">
      <div className="crmx-desk__head">
        <p className="crmx-desk__month"><Activity size={15} style={{ color: 'var(--x-gold)' }} /> Puls rynku</p>
        <span className={`crmx-chip ${live ? 'crmx-chip--good' : ''}`}><span className="crmx-dot crmx-live" />{live ? 'Na żywo' : 'Łączenie…'}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="crmx-pulse__metric">
          <span>Średnio za m²</span>
          <b>{avg ? `${Math.round(avg).toLocaleString('pl-PL')} zł` : '—'}</b>
        </div>
        <div className="crmx-pulse__metric">
          <span>Popyt</span>
          <b>{demand || '—'}</b>
        </div>
      </div>
      <div className="crmx-pulse__widget mt-3">
        <PricePulseWidget locale="pl" variant="crm" />
      </div>
      {h ? (
        <div className="crmx-pulse__news mt-3">
          <Newspaper size={14} />
          <p key={h.id}><b>{h.source}</b> {h.title}</p>
        </div>
      ) : null}
      {events.length ? (
        <ul className="mt-2 space-y-1.5">
          {events.slice(0, 3).map((e) => {
            const Icon = ICONS[e.icon] || Zap;
            return (
              <li key={e.id} className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--x-ink-2)' }}>
                <Icon size={13} style={{ color: 'var(--x-gold)' }} />
                <span className="truncate">{e.text}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
