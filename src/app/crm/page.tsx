'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useDeskInspector } from '@/components/desk/DeskShell';
import { DESK_UI } from '@/lib/desk/labels';

type TodayPayload = {
  timeline: Array<{
    id: string;
    kind: string;
    title: string;
    subtitle?: string | null;
    startsAt?: string | null;
    href?: string | null;
    caseId?: number | null;
  }>;
  whatMattersMost: Array<{
    id: number;
    title: string | null;
    pipelineStage: string;
    health: string;
    temperature: string;
    nextAction: string | null;
    client: { firstName: string; lastName: string };
  }>;
  openTasks: Array<{
    id: number;
    title: string;
    dueAt: string | null;
    caseId: number | null;
    case?: { title: string | null } | null;
  }>;
  nextBestAction: {
    id: number;
    title: string;
    dueAt: string | null;
    caseId: number | null;
    caseTitle: string | null;
  } | null;
  alerts: Array<{ level: string; text: string }>;
};

function formatTime(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export default function DeskTodayPage() {
  const { refreshKey, setCaseId } = useDeskInspector();
  const [data, setData] = useState<TodayPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/desk/today', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Nie udało się wczytać dnia');
        if (!cancelled) setData(json.today);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Błąd');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <div>
      <p className="eos-desk-kicker">{DESK_UI.todayKicker}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 className="eos-desk-h1">{DESK_UI.todayTitle}</h1>
        <Link href="/crm/prospecting" className="eos-desk-btn eos-desk-btn-primary">
          + {DESK_UI.newProspect}
        </Link>
      </div>
      <p className="eos-desk-muted" style={{ marginTop: '0.5rem', maxWidth: '38rem' }}>
        Co mam dziś zrobić, co jest pilne, do kogo zadzwonić, gdzie jechać.
      </p>

      {loading ? <p className="eos-desk-muted" style={{ marginTop: '1.5rem' }}>Ładuję dzień…</p> : null}
      {error ? (
        <div className="eos-desk-card" style={{ marginTop: '1.5rem', color: 'var(--desk-danger)' }}>
          {error}
        </div>
      ) : null}

      {data ? (
        <div className="eos-desk-today-grid">
          <section className="eos-desk-card">
            <p className="eos-desk-kicker">Oś dnia</p>
            {data.timeline.length === 0 ? (
              <p className="eos-desk-muted">Brak zaplanowanych wydarzeń na dziś — sprawdź zadania po prawej.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: '0.75rem 0 0', padding: 0 }}>
                {data.timeline.map((item) => (
                  <li
                    key={item.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '3.5rem 1fr',
                      gap: '0.75rem',
                      padding: '0.55rem 0',
                      borderTop: '1px solid var(--desk-line)',
                    }}
                  >
                    <strong>{formatTime(item.startsAt)}</strong>
                    <button
                      type="button"
                      className="eos-desk-btn"
                      style={{ textAlign: 'left', borderRadius: '0.65rem' }}
                      onClick={() => {
                        if (item.caseId) setCaseId(item.caseId);
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{item.title}</div>
                      {item.subtitle ? (
                        <div className="eos-desk-muted" style={{ fontSize: '0.85rem' }}>
                          {item.subtitle}
                        </div>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="eos-desk-card">
            <p className="eos-desk-kicker">What matters most</p>
            {data.nextBestAction ? (
              <button
                type="button"
                className="eos-desk-btn"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  marginBottom: '0.9rem',
                  padding: '0.75rem',
                  background: 'var(--desk-brass-soft)',
                  borderRadius: '0.75rem',
                }}
                onClick={() => data.nextBestAction?.caseId && setCaseId(data.nextBestAction.caseId)}
              >
                <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em' }}>NEXT</div>
                <div style={{ fontWeight: 700, marginTop: '0.2rem' }}>{data.nextBestAction.title}</div>
                {data.nextBestAction.caseTitle ? (
                  <div className="eos-desk-muted" style={{ fontSize: '0.85rem' }}>
                    {data.nextBestAction.caseTitle}
                  </div>
                ) : null}
              </button>
            ) : null}

            {data.alerts?.map((a, i) => (
              <div key={`${a.text}-${i}`} className="eos-desk-muted" style={{ fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                {a.level === 'danger' ? '🔴' : '🟠'} {a.text}
              </div>
            ))}

            {data.whatMattersMost.length === 0 ? (
              <p className="eos-desk-muted" style={{ marginTop: '0.75rem' }}>
                Brak spraw AT_RISK / HOT. Pipeline jest spokojny.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', margin: '0.75rem 0 0', padding: 0 }}>
                {data.whatMattersMost.map((c) => (
                  <li key={c.id} style={{ borderTop: '1px solid var(--desk-line)', padding: '0.55rem 0' }}>
                    <button
                      type="button"
                      className="eos-desk-btn"
                      style={{ width: '100%', textAlign: 'left', borderRadius: '0.75rem' }}
                      onClick={() => setCaseId(c.id)}
                    >
                      <div style={{ fontWeight: 700 }}>
                        {c.client.firstName} {c.client.lastName}
                      </div>
                      <div className="eos-desk-muted" style={{ fontSize: '0.85rem' }}>
                        {c.nextAction || c.pipelineStage} · {c.health}/{c.temperature}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {data.openTasks.length ? (
              <div style={{ marginTop: '1rem' }}>
                <p className="eos-desk-kicker">Zadania</p>
                {data.openTasks.slice(0, 8).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="eos-desk-btn"
                    style={{ width: '100%', textAlign: 'left', marginTop: '0.35rem' }}
                    onClick={() => t.caseId && setCaseId(t.caseId)}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
