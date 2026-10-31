'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Building2, CalendarX, Info, Mail, MessageCircle, Phone, Search, UserRound } from 'lucide-react';
import type { ArchivedClientView } from '@/lib/crm/clientArchive';
import { initials, stamp } from './format';

type Deal = ArchivedClientView['deals'][number];

const STATE: Record<Deal['state'], { label: string; tone: string }> = {
  paused: { label: 'Wstrzymana', tone: 'warn' },
  active: { label: 'Nadal w lejku', tone: 'warn' },
  closed: { label: 'Zamknięta', tone: 'bad' },
  finished: { label: 'Zakończona', tone: '' },
};

/** Starsze archiwizacje zapisywały zawsze ten sam tekst — nie powtarzamy go na każdej karcie. */
const LEGACY_NOTE = 'Spotkania i planowania zostały wyczyszczone';

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

function Row({ href, icon, title, sub, chip, tone }: { href: string; icon: React.ReactNode; title: string; sub: string; chip: string; tone: string }) {
  return (
    <a href={href} className="crmx-archive__row">
      <span className="crmx-archive__ico">{icon}</span>
      <span className="crmx-archive__text">
        <span className="crmx-archive__title">{title}</span>
        <span className="crmx-archive__sub">{sub}</span>
      </span>
      <span className={`crmx-chip ${tone ? `crmx-chip--${tone}` : ''}`}>{chip}</span>
      <ArrowUpRight size={15} className="crmx-archive__go" />
    </a>
  );
}

function dealRow(d: Deal) {
  const st = STATE[d.state];
  // Sprzedający: transakcję opisuje kupujący (ogłoszenie jest wyżej). Kupujący: nieruchomość, którą oglądał.
  return d.side === 'seller' ? (
    <Row key={d.id} href={funnelHref(d.id)} icon={<UserRound size={15} />} title={d.counterpart} sub={`Kupujący · etap: ${d.stageLabel}`} chip={st.label} tone={st.tone} />
  ) : (
    <Row key={d.id} href={funnelHref(d.id)} icon={<Building2 size={15} />} title={d.offerTitle} sub={`Właściciel: ${d.counterpart} · etap: ${d.stageLabel}`} chip={st.label} tone={st.tone} />
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
      <div className="crmx-archive__bar">
        <label className="crmx-input" style={{ flex: '1 1 240px' }}>
          <Search />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj w archiwum: imię, e-mail, telefon" />
        </label>
        <p className="crmx-archive__info">
          <Info size={14} /> Panel klienta i dopasowania są wyłączone. Klienta przywraca administrator biura — wstrzymane transakcje wrócą wtedy do lejka.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="crmx-card crmx-empty" style={{ padding: '44px 20px' }}>
          {rows.length ? 'Nikogo takiego w archiwum.' : 'Archiwum jest puste.'}
        </div>
      ) : (
        list.map((c) => {
          const paused = c.deals.filter((d) => d.state === 'paused');
          const live = c.deals.filter((d) => d.state === 'active');
          const ended = c.deals.filter((d) => d.state === 'closed' || d.state === 'finished');
          const offerLive = c.offer && (c.offer.status === 'ACTIVE' || c.offer.status === 'PENDING');
          const note = c.note && !c.note.startsWith(LEGACY_NOTE) ? c.note : null;
          const empty = !c.offer && !c.deals.length;
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
                <div className="crmx-archive__stage">
                  <span>Etap przy archiwizacji</span>
                  <b>{c.stageLabel}</b>
                </div>
              </header>

              {note ? <p className="crmx-archive__note">{note}</p> : null}

              {empty ? (
                <p className="crmx-archive__empty">Bez ogłoszenia i transakcji — po kliencie nic nie zostało w toku.</p>
              ) : (
                <div className="crmx-archive__body">
                  {paused.length ? (
                    <section>
                      <p className="crmx-archive__label">Wstrzymane · {paused.length}</p>
                      {paused.map(dealRow)}
                    </section>
                  ) : null}
                  {c.offer || live.length ? (
                    <section>
                      <p className="crmx-archive__label">Zostało po kliencie</p>
                      {c.offer ? (
                        <Row
                          href={`/oferta/${c.offer.id}`}
                          icon={<Building2 size={15} />}
                          title={c.offer.title}
                          sub={`Ogłoszenie #${c.offer.id}${c.offer.withdrawn ? ' · wycofane przy archiwizacji' : offerLive ? ' · nadal opublikowane' : ''}`}
                          chip={c.offer.statusLabel}
                          tone={offerLive ? 'good' : c.offer.withdrawn || c.offer.status === 'ARCHIVED' || c.offer.status === 'REJECTED' ? 'bad' : ''}
                        />
                      ) : null}
                      {live.map(dealRow)}
                    </section>
                  ) : null}
                  {ended.length ? (
                    <section>
                      <p className="crmx-archive__label">Zakończone · {ended.length}</p>
                      {ended.map(dealRow)}
                    </section>
                  ) : null}
                </div>
              )}

              <footer className="crmx-archive__foot">
                {c.meetingsCleared ? (
                  <span className="crmx-archive__meta"><CalendarX size={13} /> Odwołane spotkania: {c.meetingsCleared}</span>
                ) : null}
                <span className="flex-1" />
                {c.phone ? <a href={`tel:${c.phone}`} className="crmx-btn crmx-btn--sm"><Phone size={13} /> {c.phone}</a> : null}
                {c.email ? <a href={`mailto:${c.email}`} className="crmx-btn crmx-btn--sm"><Mail size={13} /> E-mail</a> : null}
                {c.linkedUserId ? (
                  <a href={`/moje-konto/crm?tab=wiadomosci&peer=${c.linkedUserId}`} className="crmx-btn crmx-btn--sm"><MessageCircle size={13} /> Rozmowa</a>
                ) : null}
              </footer>
            </article>
          );
        })
      )}
    </div>
  );
}
