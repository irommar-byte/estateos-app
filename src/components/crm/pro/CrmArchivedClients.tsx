'use client';

import { useEffect, useMemo, useState } from 'react';
import { Archive, ArrowUpRight, Building2, CalendarX, KeyRound, Mail, MessageCircle, PauseCircle, Phone, Search, Target, XCircle } from 'lucide-react';
import type { ArchivedClientView } from '@/lib/crm/clientArchive';
import { initials, stamp } from './format';

type Deal = ArchivedClientView['deals'][number];

const STATE: Record<Deal['state'], { label: string; tone: string }> = {
  paused: { label: 'Wstrzymana', tone: 'warn' },
  closed: { label: 'Zamknięta przy archiwizacji', tone: '' },
  active: { label: 'Nadal w lejku', tone: 'good' },
  finished: { label: 'Zakończona wcześniej', tone: '' },
};

const funnelHref = (dealId: number) => `/moje-konto/crm?tab=transakcje&funnelDeal=${dealId}`;

export function useArchivedClients(reloadKey: number) {
  const [rows, setRows] = useState<ArchivedClientView[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/crm/clients?archived=1', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => alive && setRows(Array.isArray(d?.clients) ? d.clients : []))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [reloadKey]);
  return rows;
}

function DealLine({ deal }: { deal: Deal }) {
  const st = STATE[deal.state];
  return (
    <a href={funnelHref(deal.id)} className="crmx-archive__deal">
      <span className="min-w-0 flex-1">
        <span className="crmx-archive__deal-title">{deal.offerTitle}</span>
        <span className="crmx-archive__deal-sub">
          {deal.side === 'buyer' ? 'Kupował od' : 'Kupujący'}: {deal.counterpart} · etap: {deal.stageLabel}
        </span>
      </span>
      <span className={`crmx-chip ${st.tone ? `crmx-chip--${st.tone}` : ''}`}>
        {deal.state === 'paused' ? <PauseCircle size={11} /> : deal.state === 'closed' ? <XCircle size={11} /> : null}
        {st.label}
      </span>
      <ArrowUpRight size={14} className="crmx-archive__go" />
    </a>
  );
}

/** Archiwum klientów: na jakim etapie był klient, co po nim zostało, a co wstrzymano — z odnośnikami do wszystkiego. */
export default function CrmArchivedClients({ rows }: { rows: ArchivedClientView[] | null }) {
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows || []).filter((c) => !q || `${c.name} ${c.email || ''} ${c.phone || ''}`.toLowerCase().includes(q));
  }, [rows, query]);

  if (!rows) return <div className="crmx-card crmx-empty">Wczytuję archiwum…</div>;

  return (
    <div className="space-y-3">
      <label className="crmx-input">
        <Search />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj w archiwum: imię, e-mail, telefon" />
      </label>
      {list.length === 0 ? (
        <div className="crmx-card crmx-empty" style={{ padding: '44px 20px' }}>
          {rows.length ? 'Nikogo takiego w archiwum.' : 'Archiwum jest puste.'}
        </div>
      ) : (
        list.map((c) => {
          const paused = c.deals.filter((d) => d.state === 'paused');
          const closed = c.deals.filter((d) => d.state === 'closed');
          const remaining = c.deals.filter((d) => d.state === 'active' || d.state === 'finished');
          const offerLive = c.offer && (c.offer.status === 'ACTIVE' || c.offer.status === 'PENDING');
          return (
            <article key={c.clientId} className="crmx-card crmx-archive">
              <header className="crmx-archive__head">
                <span className={`crmx-client__avatar ${c.type === 'SELLER' ? 'is-seller' : ''}`}>{initials(c.name)}</span>
                <div className="min-w-0 flex-1">
                  <p className="crmx-client__name">{c.name}</p>
                  <p className="crmx-client__role">
                    {c.type === 'SELLER' ? 'Sprzedający' : 'Kupujący'} · w archiwum od {c.archivedAt ? stamp(c.archivedAt) : '—'}
                  </p>
                </div>
                <span className="crmx-chip crmx-chip--gold"><Archive size={11} /> {c.stageLabel}</span>
              </header>

              {c.note ? <p className="crmx-archive__note">{c.note}</p> : null}

              <div className="crmx-archive__grid">
                <section>
                  <p className="crmx-eyebrow"><PauseCircle size={12} /> Wstrzymane · wrócą po przywróceniu</p>
                  {paused.length ? paused.map((d) => <DealLine key={d.id} deal={d} />) : <p className="crmx-archive__none">Nic nie zostało wstrzymane.</p>}
                </section>
                <section>
                  <p className="crmx-eyebrow"><KeyRound size={12} /> Co po nim zostało</p>
                  {c.offer ? (
                    <a href={`/oferta/${c.offer.id}`} className="crmx-archive__deal">
                      <span className="min-w-0 flex-1">
                        <span className="crmx-archive__deal-title"><Building2 size={12} /> {c.offer.title}</span>
                        <span className="crmx-archive__deal-sub">
                          Ogłoszenie #{c.offer.id} · {c.offer.withdrawn ? 'wycofane przy archiwizacji' : offerLive ? 'zostało na rynku' : c.offer.statusLabel.toLowerCase()}
                        </span>
                      </span>
                      <span className={`crmx-chip ${offerLive ? 'crmx-chip--good' : ''}`}>{c.offer.statusLabel}</span>
                      <ArrowUpRight size={14} className="crmx-archive__go" />
                    </a>
                  ) : null}
                  {remaining.map((d) => <DealLine key={d.id} deal={d} />)}
                  {closed.map((d) => <DealLine key={d.id} deal={d} />)}
                  {!c.offer && !remaining.length && !closed.length ? <p className="crmx-archive__none">Brak ogłoszeń i transakcji.</p> : null}
                  {c.meetingsCleared ? (
                    <p className="crmx-archive__none"><CalendarX size={12} /> Odwołane zaplanowane spotkania: {c.meetingsCleared}</p>
                  ) : null}
                </section>
              </div>

              <footer className="crmx-archive__foot">
                {c.phone ? <a href={`tel:${c.phone}`} className="crmx-btn crmx-btn--sm"><Phone size={13} /> {c.phone}</a> : null}
                {c.email ? <a href={`mailto:${c.email}`} className="crmx-btn crmx-btn--sm"><Mail size={13} /> E-mail</a> : null}
                {c.linkedUserId ? (
                  <a href={`/moje-konto/crm?tab=wiadomosci&peer=${c.linkedUserId}`} className="crmx-btn crmx-btn--sm"><MessageCircle size={13} /> Rozmowa</a>
                ) : null}
                <span className="crmx-archive__hint"><Target size={12} /> Panel klienta i dopasowania są wyłączone. Przywrócić może administrator biura.</span>
              </footer>
            </article>
          );
        })
      )}
    </div>
  );
}
