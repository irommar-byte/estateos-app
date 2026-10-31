'use client';

import { useMemo, useState } from 'react';
import { Clock, Search } from 'lucide-react';
import { buyerName, STAGE_SHORT, useAgentDeals, type ProDeal } from './CrmPulpit';
import { pln, relative } from './format';
import CrmDealSheet from './CrmDealSheet';
import { SmartAgentDock } from './CrmSmartAgent';

const COLUMNS: Array<{ id: string; label: string; stages: string[] }> = [
  { id: 'lead', label: 'Zainteresowani', stages: ['interested', 'scheduling'] },
  { id: 'show', label: 'Prezentacje', stages: ['scheduled', 'live'] },
  { id: 'after', label: 'Po prezentacji', stages: ['viewed', 'feedback'] },
  { id: 'nego', label: 'Negocjacje', stages: ['negotiation'] },
  { id: 'close', label: 'Rezerwacja i umowy', stages: ['reserved', 'preliminary', 'deed'] },
];

function deadlineLabel(iso: string | null): string | null {
  if (!iso) return null;
  const h = Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000);
  if (h < 0) return 'termin minął';
  if (h < 24) return `${h} h na odpowiedź`;
  return `${Math.round(h / 24)} dni na odpowiedź`;
}

/** Lejek transakcji: każdy kupujący przy każdej ofercie, od zainteresowania po akt — w jednym widoku. */
export default function CrmDealsPro({
  onOpenClient,
  onOpenOffer,
  offers,
  onOpenSmart,
}: {
  onOpenClient: (clientId: number) => void;
  onOpenOffer: (offerId: number) => void;
  offers?: any[];
  onOpenSmart?: () => void;
}) {
  const deals = useAgentDeals();
  const [query, setQuery] = useState('');
  const [mine, setMine] = useState(false);
  const [closed, setClosed] = useState(false);
  const [origin, setOrigin] = useState<'all' | 'radar' | 'other'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (deals || []).filter((d) => {
      if (mine && d.turn.side !== 'agent') return false;
      if (origin === 'radar' && d.source !== 'radar') return false;
      if (origin === 'other' && d.source === 'radar') return false;
      if (!q) return true;
      return `${buyerName(d)} ${d.offer.title} ${d.offer.address} ${d.seller?.name || ''}`.toLowerCase().includes(q);
    });
  }, [deals, query, mine, origin]);

  const live = filtered.filter((d) => d.status === 'ACTIVE' || d.status === 'PAUSED');
  const done = filtered.filter((d) => d.status === 'WON' || d.status === 'LOST');
  const myMoves = (deals || []).filter((d) => d.status === 'ACTIVE' && d.turn.side === 'agent').length;

  const [openId, setOpenId] = useState<number | null>(null);
  const openDeal = (deals || []).find((d) => d.id === openId) || null;
  const open = (d: ProDeal) => setOpenId(d.id);

  const [mobileCol, setMobileCol] = useState(COLUMNS[0].id);

  const card = (d: ProDeal) => {
    const dl = d.turn.side ? deadlineLabel(d.turn.deadline) : null;
    const early = d.stage === 'interested' || d.stage === 'scheduling';
    const flags = [
      d.guide?.intent === 'unclear' ? <span key="u" className="crmx-chip crmx-chip--warn">Do wyjaśnienia</span> : null,
      d.source === 'radar' ? <span key="s" className="crmx-deal__src">Agent poszukiwań</span> : d.source === 'dealroom' ? <span key="s" className="crmx-deal__src">Dealroom</span> : null,
      dl ? <span key="d" className="crmx-chip crmx-chip--warn"><Clock size={11} /> {dl}</span> : null,
    ].filter(Boolean);
    return (
      <button key={d.id} type="button" className="crmx-deal" data-mine={d.turn.side === 'agent' || undefined} onClick={() => open(d)}>
        <div className="crmx-deal__top">
          {d.offer.imageUrl ? <img src={d.offer.imageUrl} alt="" className="crmx-deal__img" /> : <span className="crmx-deal__img" />}
          <div className="min-w-0 flex-1">
            <p className="crmx-deal__name">{buyerName(d)}</p>
            <p className="crmx-deal__offer">{d.offer.title}</p>
          </div>
        </div>
        <p className="crmx-deal__next">{d.guide?.headline || d.nextAction}</p>
        {early && d.entry ? <p className="crmx-deal__why" title={d.entry.reason}>{d.entry.reason}</p> : null}
        <div className="crmx-deal__foot">
          <span className="crmx-num">{pln(d.offer.price)}</span>
          <span className="crmx-muted">{relative(d.updatedAt)}</span>
        </div>
        {flags.length ? <div className="crmx-deal__flags">{flags}</div> : null}
      </button>
    );
  };

  return (
    <div className="crmx-funnel space-y-4">
      <CrmDealSheet
        deal={openDeal}
        deals={deals || []}
        offers={offers}
        onClose={() => setOpenId(null)}
        onOpenClient={(id) => {
          setOpenId(null);
          onOpenClient(id);
        }}
        onOpenOffer={(id) => {
          setOpenId(null);
          onOpenOffer(id);
        }}
      />
      <div className="crmx-funnel__bar">
        <label className="crmx-input crmx-funnel__search">
          <Search />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj: kupujący, oferta, właściciel" />
        </label>
        <div className="crmx-seg">
          <button type="button" aria-pressed={!mine} onClick={() => setMine(false)}>Wszystkie</button>
          <button type="button" aria-pressed={mine} onClick={() => setMine(true)}>Mój ruch <small>{myMoves}</small></button>
        </div>
        <div className="crmx-seg" title="Agent poszukiwań = kupujący, którzy zareagowali na oferty wysłane automatycznie.">
          <button type="button" aria-pressed={origin === 'all'} onClick={() => setOrigin('all')}>Wszyscy</button>
          <button type="button" aria-pressed={origin === 'radar'} onClick={() => setOrigin('radar')}>
            Agent poszukiwań <small>{(deals || []).filter((d) => d.source === 'radar' && (d.status === 'ACTIVE' || d.status === 'PAUSED')).length}</small>
          </button>
          <button type="button" aria-pressed={origin === 'other'} onClick={() => setOrigin('other')}>Pozyskani</button>
        </div>
        <div className="crmx-seg crmx-funnel__end">
          <button type="button" aria-pressed={!closed} onClick={() => setClosed(false)}>W toku <small>{live.length}</small></button>
          <button type="button" aria-pressed={closed} onClick={() => setClosed(true)}>Zakończone <small>{done.length}</small></button>
        </div>
      </div>

      {!deals ? (
        <div className="crmx-card crmx-empty">Ładowanie lejka…</div>
      ) : closed ? (
        <div className="crmx-card">
          <div className="crmx-list">
            {done.length === 0 ? (
              <p className="crmx-empty">Brak zakończonych transakcji w ostatnich 90 dniach.</p>
            ) : (
              done.map((d) => (
                <button key={d.id} type="button" className="crmx-row" onClick={() => open(d)}>
                  {d.offer.imageUrl ? <img src={d.offer.imageUrl} alt="" className="crmx-thumb" /> : <span className="crmx-thumb" />}
                  <span className="crmx-row__main">
                    <span className="crmx-row__title block">{buyerName(d)} · {d.offer.title}</span>
                    <span className="crmx-row__sub block">{d.offer.address}</span>
                  </span>
                  <span className={`crmx-chip ${d.status === 'WON' ? 'crmx-chip--good' : ''}`}>{d.status === 'WON' ? 'Sprzedana' : 'Zamknięta'}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="crmx-stagetabs" role="tablist">
            {COLUMNS.map((col) => {
              const n = live.filter((d) => col.stages.includes(d.stage)).length;
              return (
                <button key={col.id} type="button" role="tab" aria-selected={mobileCol === col.id} onClick={() => setMobileCol(col.id)}>
                  {col.label} <small>{n}</small>
                </button>
              );
            })}
          </div>
          <div className="crmx-board crmx-board--smart">
            <SmartAgentDock onOpen={() => onOpenSmart?.()} />
            {COLUMNS.map((col, i) => {
              const items = live.filter((d) => col.stages.includes(d.stage));
              const value = items.reduce((sum, d) => sum + (Number(d.offer.price) || 0), 0);
              const mineCount = items.filter((d) => d.turn.side === 'agent').length;
              return (
                <section key={col.id} className="crmx-col" data-step={i + 1} data-active={mobileCol === col.id || undefined}>
                  <header className="crmx-col__head">
                    <div className="min-w-0">
                      <span className="crmx-col__title">{col.label}</span>
                      <span className="crmx-col__meta crmx-num">{value > 0 ? pln(value) : '—'}{mineCount ? ` · ${mineCount} Twój ruch` : ''}</span>
                    </div>
                    <span className="crmx-col__count">{items.length}</span>
                  </header>
                  <div className="crmx-col__body">
                    {items.length ? items.map(card) : <p className="crmx-col__empty">Brak</p>}
                  </div>
                </section>
              );
            })}
          </div>
          <p className="crmx-funnel__legend"><span className="crmx-funnel__bar-ico" /> złoty pasek przy karcie = Twój ruch</p>
        </>
      )}
    </div>
  );
}
