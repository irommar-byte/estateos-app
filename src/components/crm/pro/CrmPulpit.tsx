'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  Inbox,
  MessageSquareText,
  PhoneCall,
  Sparkles,
} from 'lucide-react';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { dayLabel, daysSince, initials, pln, relative, timeHM } from './format';
import type { CrmProTab } from './CrmProRail';
import { DeskCalendar, DeskClock, DeskNotes, useDesk } from './CrmDesk';
import CrmMarketPulse from './CrmMarketPulse';

type TodayPayload = {
  counts: Record<string, number>;
  schedule: Array<{ id: string; kind: string; title: string; subtitle: string; location: string; startsAt: string; clientId: number | null; offerId: number | null }>;
  replies: Array<{ id: string; kind: string; clientId: number; clientName: string; title: string; body: string; createdAt: string }>;
  approvals: Array<{ approvalId: number; clientId: number; clientName: string; offer: { id: number; title: string; price: number | null; imageUrl: string } | null; score: number | null }>;
  outbox: Array<{ id: number; clientId: number; clientName: string; categoryLabel: string; subject: string | null }>;
  stale: Array<{ clientId: number; clientName: string; type: 'BUYER' | 'SELLER'; phone: string | null; days: number }>;
  ownerCalls: Array<{ approvalId: number; clientName: string; offer: { title: string } | null }>;
};

export type ProDeal = {
  id: number;
  offerId: number;
  status: 'ACTIVE' | 'PAUSED' | 'LOST' | 'WON';
  stage: string;
  source: string;
  sourceLabel: string;
  offer: { id: number; title: string; address: string; price: number | null; imageUrl: string | null };
  seller: { clientId: number; name: string } | null;
  buyer:
    | { kind: 'client'; clientId: number; name: string; phone: string | null; email: string | null }
    | { kind: 'external'; agency: string | null; name: string | null; phone: string | null; email: string | null };
  turn: { side: string | null; label: string; deadline: string | null };
  nextAction: string;
  presentation: { startsAt: string; status: string } | null;
  updatedAt: string;
};

export function buyerName(deal: ProDeal): string {
  if (deal.buyer.kind === 'client') return deal.buyer.name;
  return deal.buyer.name || deal.buyer.agency || 'Kupujący';
}

export function useAgentDeals() {
  const [deals, setDeals] = useState<ProDeal[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/crm/offer-buyers?scope=all', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => alive && setDeals(Array.isArray(d?.deals) ? d.deals : []))
      .catch(() => alive && setDeals([]));
    return () => {
      alive = false;
    };
  }, []);
  return deals;
}

function useToday() {
  const [today, setToday] = useState<TodayPayload | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/crm/today', { credentials: 'include', cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => alive && d?.today && setToday(d.today))
        .catch(() => null);
    void load();
    const t = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);
  return today;
}

const STAGE_SHORT: Record<string, string> = {
  interested: 'Zainteresowany',
  scheduling: 'Ustalanie terminu',
  scheduled: 'Prezentacja umówiona',
  live: 'Prezentacja trwa',
  viewed: 'Po prezentacji',
  feedback: 'Opinia',
  negotiation: 'Negocjacje',
  reserved: 'Rezerwacja',
  preliminary: 'Umowa przedwstępna',
  deed: 'Akt notarialny',
  closed: 'Zakończona',
  lost: 'Zamknięta',
};
export { STAGE_SHORT };

/** Pulpit agenta — wszystko, co dziś wymaga ruchu, połączone z klientami, ofertami i transakcjami. */
export default function CrmPulpit({
  offers,
  clientsCount,
  onNavigate,
  onOpenClient,
  onOpenOffer,
}: {
  offers: any[];
  clientsCount: { buyers: number; sellers: number } | null;
  onNavigate: (tab: CrmProTab) => void;
  onOpenClient: (clientId: number) => void;
  onOpenOffer: (offerId: number) => void;
}) {
  const today = useToday();
  const deals = useAgentDeals();
  const desk = useDesk();
  const [fetchedClients, setFetchedClients] = useState<{ buyers: number; sellers: number } | null>(null);
  useEffect(() => {
    if (clientsCount) return;
    fetch('/api/crm/clients', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => {
        const list: Array<{ type?: string }> = Array.isArray(d?.clients) ? d.clients : [];
        setFetchedClients({
          buyers: list.filter((c) => String(c.type) === 'BUYER').length,
          sellers: list.filter((c) => String(c.type) === 'SELLER').length,
        });
      })
      .catch(() => null);
  }, [clientsCount]);
  const clients = clientsCount || fetchedClients;

  const activeOffers = useMemo(() => offers.filter((o) => String(o.status) === 'ACTIVE'), [offers]);
  const pendingOffers = useMemo(() => offers.filter((o) => String(o.status) === 'PENDING'), [offers]);
  const liveDeals = useMemo(() => (deals || []).filter((d) => d.status === 'ACTIVE'), [deals]);
  const hotDeals = useMemo(
    () => liveDeals.filter((d) => ['negotiation', 'reserved', 'preliminary', 'deed'].includes(d.stage)),
    [liveDeals],
  );

  const upcoming = useMemo(
    () =>
      (today?.schedule || [])
        .filter((s) => new Date(s.startsAt).getTime() > Date.now() - 60 * 60 * 1000)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .slice(0, 6),
    [today],
  );

  /** Oferty wymagające uwagi: bez zdjęć, bez rzutu, długo bez zmiany ceny, bez kupujących. */
  const attention = useMemo(() => {
    const rows: Array<{ offer: any; reason: string; tone: 'warn' | 'bad' | 'info' }> = [];
    for (const o of activeOffers) {
      const imgs = String(o.images || '').trim();
      const days = daysSince(o.createdAt) ?? 0;
      if (!imgs || imgs === '[]') rows.push({ offer: o, reason: 'Brak zdjęć', tone: 'bad' });
      else if (days > 45 && !(o.buyersInProcess > 0)) rows.push({ offer: o, reason: `${days} dni bez kupującego w procesie`, tone: 'warn' });
      else if (!o.floorPlanUrl && !o.floorPlan3dUrl && String(o.propertyType) === 'FLAT') rows.push({ offer: o, reason: 'Brak rzutu mieszkania', tone: 'info' });
    }
    for (const o of pendingOffers) rows.unshift({ offer: o, reason: 'Czeka na akceptację biura', tone: 'info' });
    return rows.slice(0, 6);
  }, [activeOffers, pendingOffers]);

  const tasks = useMemo(() => {
    if (!today) return [];
    const list: Array<{ key: string; icon: typeof Inbox; title: string; sub: string; onClick: () => void; tone?: string }> = [];
    for (const r of today.replies.slice(0, 5)) {
      list.push({ key: `r${r.id}`, icon: MessageSquareText, title: `${r.clientName} · ${r.title}`, sub: r.body, onClick: () => onOpenClient(r.clientId), tone: 'gold' });
    }
    for (const o of today.outbox.slice(0, 4)) {
      list.push({ key: `o${o.id}`, icon: Inbox, title: `Do zatwierdzenia: ${o.categoryLabel}`, sub: `${o.clientName}${o.subject ? ` · ${o.subject}` : ''}`, onClick: () => onOpenClient(o.clientId) });
    }
    for (const a of today.approvals.slice(0, 4)) {
      list.push({
        key: `a${a.approvalId}`,
        icon: Sparkles,
        title: `Propozycja asystenta dla ${a.clientName}`,
        sub: a.offer ? `${a.offer.title}${a.score ? ` · ${a.score}%` : ''}` : 'Oferta do wysłania',
        onClick: () => onOpenClient(a.clientId),
      });
    }
    for (const c of today.ownerCalls.slice(0, 3)) {
      list.push({ key: `c${c.approvalId}`, icon: PhoneCall, title: `Zadzwoń do właściciela`, sub: `${c.offer?.title || ''} · dla ${c.clientName}`, onClick: () => onNavigate('klienci') });
    }
    for (const s of today.stale.slice(0, 4)) {
      list.push({
        key: `s${s.clientId}`,
        icon: AlertCircle,
        title: `${s.clientName} — ${s.days} dni bez kontaktu`,
        sub: s.type === 'SELLER' ? 'Sprzedający' : 'Kupujący',
        onClick: () => onOpenClient(s.clientId),
      });
    }
    return list;
  }, [today, onOpenClient, onNavigate]);

  const kpis: Array<{ label: string; value: string | number; hint: string; tab: CrmProTab; accent?: boolean }> = [
    { label: 'Do zrobienia', value: today ? today.counts.total ?? tasks.length : '—', hint: 'odpowiedzi, akcepty, telefony', tab: 'pulpit', accent: true },
    { label: 'Spotkania', value: today ? today.schedule.length : '—', hint: 'najbliższe 7 dni', tab: 'planowanie' },
    { label: 'Klienci', value: clients ? clients.buyers + clients.sellers : '—', hint: clients ? `${clients.buyers} kupujących · ${clients.sellers} sprzedających` : 'aktywni', tab: 'klienci' },
    { label: 'Ogłoszenia', value: activeOffers.length, hint: pendingOffers.length ? `${pendingOffers.length} czeka na akceptację` : 'aktywne na rynku', tab: 'my_offers' },
    { label: 'Kupujący w procesie', value: deals ? liveDeals.length : '—', hint: 'prezentacje i negocjacje', tab: 'transakcje' },
    { label: 'Negocjacje', value: deals ? hotDeals.length : '—', hint: 'blisko transakcji', tab: 'transakcje' },
  ];

  return (
    <div className="space-y-5">
      <section className="crmx-desk crmx-desk--band">
        <DeskClock desk={desk} />
        <CrmMarketPulse />
        <DeskCalendar desk={desk} />
      </section>

      <div className="crmx-row2">
        <section className="crmx-card crmx-desk--notes">
          <DeskNotes desk={desk} />
        </section>
        <section className="crmx-card">
          <header className="crmx-card__head">
            <h3 className="crmx-card__title"><CheckCircle2 /> Czeka na Twój ruch</h3>
            <button type="button" className="crmx-link" onClick={() => onNavigate('klienci')}>Wszyscy klienci →</button>
          </header>
          <div className="crmx-list">
            {!today ? (
              <p className="crmx-empty">Ładowanie…</p>
            ) : tasks.length === 0 ? (
              <p className="crmx-empty">Wszystko zrobione. Nic nie czeka na odpowiedź.</p>
            ) : (
              tasks.slice(0, 9).map((t) => (
                <button key={t.key} type="button" className="crmx-row" onClick={t.onClick}>
                  <span className="crmx-avatar" aria-hidden><t.icon size={15} /></span>
                  <span className="crmx-row__main">
                    <span className="crmx-row__title block">{t.title}</span>
                    <span className="crmx-row__sub block">{t.sub}</span>
                  </span>
                  <span className="crmx-muted text-sm">›</span>
                </button>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="crmx-kpis">
        {kpis.map((k) => (
          <button key={k.label} type="button" className={`crmx-kpi ${k.accent ? 'crmx-kpi--accent' : ''}`} onClick={() => onNavigate(k.tab)}>
            <p className="crmx-kpi__label">{k.label}</p>
            <p className="crmx-kpi__value">{k.value}</p>
            <p className="crmx-kpi__hint">{k.hint}</p>
          </button>
        ))}
      </div>

      <div className="crmx-grid-3">
        <section className="crmx-card">
          <header className="crmx-card__head">
            <h3 className="crmx-card__title"><ArrowLeftRight /> Transakcje w toku</h3>
            <button type="button" className="crmx-link" onClick={() => onNavigate('transakcje')}>Lejek →</button>
          </header>
          <div className="crmx-list">
            {!deals ? (
              <p className="crmx-empty">Ładowanie…</p>
            ) : liveDeals.length === 0 ? (
              <p className="crmx-empty">Brak kupujących w procesie.</p>
            ) : (
              liveDeals.slice(0, 6).map((d) => (
                <button key={d.id} type="button" className="crmx-row" onClick={() => onNavigate('transakcje')}>
                  {d.offer.imageUrl ? <img src={d.offer.imageUrl} alt="" className="crmx-thumb" /> : <span className="crmx-thumb" />}
                  <span className="crmx-row__main">
                    <span className="crmx-row__title block">{buyerName(d)} · {d.offer.title}</span>
                    <span className="crmx-row__sub block">{d.nextAction}</span>
                  </span>
                  <span className={`crmx-chip ${['negotiation', 'reserved', 'preliminary', 'deed'].includes(d.stage) ? 'crmx-chip--gold' : ''}`}>
                    {STAGE_SHORT[d.stage] || d.stage}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
        <section className="crmx-card">
          <header className="crmx-card__head">
            <h3 className="crmx-card__title"><CalendarClock /> Najbliższe spotkania</h3>
            <button type="button" className="crmx-link" onClick={() => onNavigate('planowanie')}>Kalendarz →</button>
          </header>
          <div className="crmx-list">
            {!today ? (
              <p className="crmx-empty">Ładowanie…</p>
            ) : upcoming.length === 0 ? (
              <p className="crmx-empty">Brak zaplanowanych spotkań.</p>
            ) : (
              upcoming.map((s) => (
                <button key={s.id} type="button" className="crmx-row" onClick={() => (s.clientId ? onOpenClient(s.clientId) : onNavigate('planowanie'))}>
                  <span className="text-center" style={{ minWidth: 52 }}>
                    <span className="block text-[10.5px] font-bold uppercase tracking-[0.1em] crmx-muted">{dayLabel(s.startsAt)}</span>
                    <span className="crmx-time block">{timeHM(s.startsAt)}</span>
                  </span>
                  <span className="crmx-row__main">
                    <span className="crmx-row__title block">{s.title}</span>
                    <span className="crmx-row__sub block">{[s.subtitle, s.location].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
        <section className="crmx-card">
          <header className="crmx-card__head">
            <h3 className="crmx-card__title"><Building2 /> Ogłoszenia do dopracowania</h3>
            <button type="button" className="crmx-link" onClick={() => onNavigate('my_offers')}>Wszystkie →</button>
          </header>
          <div className="crmx-list">
            {attention.length === 0 ? (
              <p className="crmx-empty">Wszystkie ogłoszenia są kompletne.</p>
            ) : (
              attention.map(({ offer, reason, tone }) => {
                const img = resolveOfferPrimaryImage(offer);
                return (
                  <button key={`${offer.id}-${reason}`} type="button" className="crmx-row" onClick={() => onOpenOffer(Number(offer.id))}>
                    {img ? <img src={img} alt="" className="crmx-thumb" /> : <span className="crmx-thumb" />}
                    <span className="crmx-row__main">
                      <span className="crmx-row__title block">{offer.title}</span>
                      <span className="crmx-row__sub block">{[offer.district, offer.city].filter(Boolean).join(', ')} · {pln(offer.price, offer.priceCurrency)} · dodane {relative(offer.createdAt)}</span>
                    </span>
                    <span className={`crmx-chip crmx-chip--${tone}`}>{reason}</span>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export { initials };
