'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { initials, timeHM } from './format';

type Agent = { userId: number; name: string; role: string };
type Ev = { id: number; at: string; userId: number; kind: string; title: string; body: string | null; refType: string | null; refId: number | null; source: 'log' | 'client' };

function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Wpis serwera o 20:00 ze streszczeniem dnia agenta (widzi go tylko kierownik). */
const DAY_SUMMARY = 'DAY_SUMMARY';

/** Dziennik zespołu: co który agent danego dnia zrobił — z godziną i minutą. */
export default function CrmTeamLog({ onOpenClient, onOpenOffer }: { onOpenClient: (clientId: number) => void; onOpenOffer: (offerId: number) => void }) {
  const [day, setDay] = useState(() => new Date());
  const [data, setData] = useState<{ isManager: boolean; agents: Agent[]; events: Ev[] } | null>(null);
  const [agent, setAgent] = useState<number | 'all'>('all');

  useEffect(() => {
    let alive = true;
    setData(null);
    fetch(`/api/crm/team-log?day=${isoDay(day)}`, { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => alive && setData(j?.success ? j : { isManager: false, agents: [], events: [] }))
      .catch(() => alive && setData({ isManager: false, agents: [], events: [] }));
    return () => {
      alive = false;
    };
  }, [day]);

  const shift = (n: number) => setDay((d) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  });
  const isToday = isoDay(day) === isoDay(new Date());

  const summaries = useMemo(() => {
    const map = new Map<number, Ev>();
    for (const e of data?.events || []) if (e.kind === DAY_SUMMARY) map.set(e.userId, e);
    return map;
  }, [data]);

  const perAgent = useMemo(() => {
    const map = new Map<number, Ev[]>();
    for (const e of data?.events || []) if (e.kind !== DAY_SUMMARY) map.set(e.userId, [...(map.get(e.userId) || []), e]);
    return map;
  }, [data]);

  const agents = (data?.agents || []).slice().sort((a, b) => (perAgent.get(b.userId)?.length || 0) - (perAgent.get(a.userId)?.length || 0));
  const shown = agent === 'all' ? agents : agents.filter((a) => a.userId === agent);

  return (
    <div className="space-y-4">
      <div className="crmx-funnel__bar">
        <div className="crmx-seg">
          <button type="button" onClick={() => shift(-1)} aria-label="Poprzedni dzień"><ChevronLeft size={15} /></button>
          <button type="button" aria-pressed>
            {day.toLocaleDateString('pl-PL', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
          </button>
          <button type="button" onClick={() => shift(1)} disabled={isToday} aria-label="Następny dzień"><ChevronRight size={15} /></button>
        </div>
        {!isToday ? <button type="button" className="crmx-btn" onClick={() => setDay(new Date())}>Dziś</button> : null}
        {data?.isManager && agents.length > 1 ? (
          <div className="crmx-seg crmx-funnel__end" style={{ overflowX: 'auto', maxWidth: '100%' }}>
            <button type="button" aria-pressed={agent === 'all'} onClick={() => setAgent('all')}>Wszyscy <small>{data.events.filter((e) => e.kind !== DAY_SUMMARY).length}</small></button>
            {agents.map((a) => (
              <button key={a.userId} type="button" aria-pressed={agent === a.userId} onClick={() => setAgent(a.userId)}>
                {a.name.split(' ')[0]} <small>{perAgent.get(a.userId)?.length || 0}</small>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!data ? (
        <div className="crmx-card crmx-empty">Ładowanie dziennika…</div>
      ) : (
        <div className="crmx-teamlog">
          {shown.map((a) => {
            const list = perAgent.get(a.userId) || [];
            const summary = summaries.get(a.userId) || null;
            const first = list[list.length - 1];
            const last = list[0];
            return (
              <section key={a.userId} className="crmx-card crmx-teamlog__agent">
                <header className="crmx-teamlog__head">
                  <span className="crmx-teamlog__avatar">{initials(a.name)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="crmx-teamlog__name">{a.name}{a.role === 'ADMIN' ? <span className="crmx-chip crmx-chip--gold">Kierownik</span> : null}</p>
                    <p className="crmx-teamlog__meta">
                      {list.length ? `${list.length} akcji · od ${timeHM(first.at)} do ${timeHM(last.at)}` : 'Brak akcji tego dnia'}
                    </p>
                  </div>
                </header>
                {summary ? (
                  <div className="crmx-teamlog__summary">
                    <p className="crmx-eyebrow">Podsumowanie dnia · {timeHM(summary.at)}</p>
                    <p>{summary.body}</p>
                  </div>
                ) : null}
                {list.length ? (
                  <ol className="crmx-teamlog__list">
                    {list.map((e) => (
                      <li key={`${e.source}-${e.id}`}>
                        <span className="crmx-teamlog__time crmx-num">{timeHM(e.at)}</span>
                        <span className="crmx-teamlog__dot" />
                        <span className="min-w-0">
                          <span className="block text-[13px] font-semibold">{e.title}</span>
                          {e.body ? (
                            (e.refType === 'client' || e.refType === 'offer') && e.refId ? (
                              <button
                                type="button"
                                className="crmx-teamlog__ref"
                                onClick={() => (e.refType === 'offer' ? onOpenOffer(Number(e.refId)) : onOpenClient(Number(e.refId)))}
                                title={e.body}
                              >
                                {e.body}
                              </button>
                            ) : (
                              <span className="crmx-teamlog__body crmx-muted">{e.body}</span>
                            )
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </section>
            );
          })}
          {shown.length === 0 ? <div className="crmx-card crmx-empty">Brak danych dla tego dnia.</div> : null}
        </div>
      )}
    </div>
  );
}
