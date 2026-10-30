'use client';

import { useMemo, useState } from 'react';
import { Clock, Search } from 'lucide-react';
import { buyerName, STAGE_SHORT, useAgentDeals, type ProDeal } from './CrmPulpit';
import { pln, relative } from './format';

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
}: {
  onOpenClient: (clientId: number) => void;
  onOpenOffer: (offerId: number) => void;
}) {
  const deals = useAgentDeals();
  const [query, setQuery] = useState('');
  const [mine, setMine] = useState(false);
  const [closed, setClosed] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (deals || []).filter((d) => {
      if (mine && d.turn.side !== 'agent') return false;
      if (!q) return true;
      return `${buyerName(d)} ${d.offer.title} ${d.offer.address} ${d.seller?.name || ''}`.toLowerCase().includes(q);
    });
  }, [deals, query, mine]);

  const live = filtered.filter((d) => d.status === 'ACTIVE' || d.status === 'PAUSED');
  const done = filtered.filter((d) => d.status === 'WON' || d.status === 'LOST');
  const myMoves = (deals || []).filter((d) => d.status === 'ACTIVE' && d.turn.side === 'agent').length;

  const open = (d: ProDeal) => {
    if (d.buyer.kind === 'client') return onOpenClient(d.buyer.clientId);
    if (d.seller) return onOpenClient(d.seller.clientId);
    onOpenOffer(d.offerId);
  };

  const card = (d: ProDeal) => {
    const dl = d.turn.side ? deadlineLabel(d.turn.deadline) : null;
    return (
      <button key={d.id} type="button" className="crmx-deal" onClick={() => open(d)}>
        <div className="flex items-center gap-2.5">
          {d.offer.imageUrl ? <img src={d.offer.imageUrl} alt="" className="crmx-thumb" style={{ width: 38, height: 38, borderRadius: 9 }} /> : <span className="crmx-thumb" style={{ width: 38, height: 38 }} />}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">{buyerName(d)}</p>
            <p className="truncate text-[11.5px] crmx-muted">{d.offer.title}</p>
          </div>
        </div>
        <p className="mt-2 text-[12px] leading-snug" style={{ color: 'var(--x-ink-2)' }}>{d.nextAction}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span className="crmx-chip">{STAGE_SHORT[d.stage] || d.stage}</span>
          {d.source === 'dealroom' ? <span className="crmx-chip crmx-chip--info">Dealroom</span> : null}
          {d.turn.side === 'agent' ? <span className="crmx-chip crmx-chip--gold">Twój ruch</span> : null}
          {dl ? <span className="crmx-chip crmx-chip--warn"><Clock size={11} /> {dl}</span> : null}
        </div>
        <p className="mt-2 text-[11px] crmx-muted crmx-num">{pln(d.offer.price)} · {relative(d.updatedAt)}</p>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="crmx-input" style={{ flex: '1 1 240px', maxWidth: 380 }}>
          <Search />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj: kupujący, oferta, sprzedający" />
        </label>
        <div className="crmx-seg">
          <button type="button" aria-pressed={!mine} onClick={() => setMine(false)}>Wszystkie</button>
          <button type="button" aria-pressed={mine} onClick={() => setMine(true)}>Mój ruch <small>{myMoves}</small></button>
        </div>
        <div className="crmx-seg ml-auto">
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
        <div className="crmx-board">
          {COLUMNS.map((col) => {
            const items = live.filter((d) => col.stages.includes(d.stage));
            return (
              <section key={col.id} className="crmx-col">
                <header className="crmx-col__head">
                  <span className="crmx-col__title">{col.label}</span>
                  <span className="crmx-rail__count">{items.length}</span>
                </header>
                <div className="crmx-col__body">
                  {items.length ? items.map(card) : <p className="px-2 py-6 text-center text-[12px] crmx-muted">—</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
