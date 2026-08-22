'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useDeskInspector } from '@/components/desk/DeskShell';
import {
  DESK_UI,
  labelDeskStage,
  labelHealth,
  labelTemperature,
} from '@/lib/desk/labels';

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
    kind: string;
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

  const alertCount = data?.alerts?.length ?? 0;
  const taskCount = data?.openTasks?.length ?? 0;
  const eventCount = data?.timeline?.length ?? 0;

  return (
    <div className="eos-desk-page">
      <header className="eos-desk-page-header">
        <div className="eos-desk-page-header__main">
          <p className="eos-desk-kicker">{DESK_UI.todayKicker}</p>
          <div className="eos-desk-page-header__row">
            <h1 className="eos-desk-h1">{DESK_UI.todayTitle}</h1>
            <Link href="/crm/prospecting" className="eos-desk-btn eos-desk-btn-primary">
              + {DESK_UI.newProspect}
            </Link>
          </div>
          <p className="eos-desk-muted eos-desk-page-subtitle">{DESK_UI.todaySubtitle}</p>
        </div>
      </header>

      {data ? (
        <div className="eos-desk-stats-strip" aria-label="Podsumowanie dnia">
          <div className="eos-desk-stat">
            <span>Wydarzenia</span>
            <strong>{eventCount}</strong>
          </div>
          <div className="eos-desk-stat">
            <span>Zadania</span>
            <strong>{taskCount}</strong>
          </div>
          <div className="eos-desk-stat">
            <span>Alerty</span>
            <strong>{alertCount}</strong>
          </div>
        </div>
      ) : null}

      {loading ? <p className="eos-desk-muted eos-desk-page-loading">{DESK_UI.loading}</p> : null}
      {error ? (
        <div className="eos-desk-card eos-desk-page-error">{error}</div>
      ) : null}

      {data ? (
        <div className="eos-desk-today-grid">
          <section className="eos-desk-card eos-desk-today-card">
            <p className="eos-desk-kicker">{DESK_UI.timelineAxis}</p>
            {data.timeline.length === 0 ? (
              <p className="eos-desk-muted eos-desk-empty-copy">{DESK_UI.emptyTimeline}</p>
            ) : (
              <ul className="eos-desk-timeline">
                {data.timeline.map((item) => (
                  <li key={item.id} className="eos-desk-timeline__row">
                    <strong className="eos-desk-timeline__time">{formatTime(item.startsAt)}</strong>
                    <button
                      type="button"
                      className="eos-desk-btn eos-desk-timeline__btn"
                      onClick={() => {
                        if (item.caseId) setCaseId(item.caseId);
                      }}
                    >
                      <div className="eos-desk-timeline__title">{item.title}</div>
                      {item.subtitle ? (
                        <div className="eos-desk-muted eos-desk-timeline__sub">{item.subtitle}</div>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="eos-desk-card eos-desk-today-card">
            <p className="eos-desk-kicker">{DESK_UI.whatMattersMost}</p>

            {data.nextBestAction ? (
              <button
                type="button"
                className="eos-desk-btn eos-desk-nba-hero"
                onClick={() => data.nextBestAction?.caseId && setCaseId(data.nextBestAction.caseId)}
              >
                <div className="eos-desk-nba-hero__label">{DESK_UI.nextNow}</div>
                <div className="eos-desk-nba-hero__title">{data.nextBestAction.title}</div>
                {data.nextBestAction.caseTitle ? (
                  <div className="eos-desk-muted eos-desk-nba-hero__sub">{data.nextBestAction.caseTitle}</div>
                ) : null}
              </button>
            ) : null}

            {data.alerts?.length ? (
              <ul className="eos-desk-alerts">
                {data.alerts.map((a, i) => (
                  <li key={`${a.text}-${i}`} className={`eos-desk-alert eos-desk-alert--${a.level}`}>
                    {a.text}
                  </li>
                ))}
              </ul>
            ) : null}

            {data.whatMattersMost.length === 0 ? (
              <p className="eos-desk-muted eos-desk-empty-copy">{DESK_UI.emptyPipelineCalm}</p>
            ) : (
              <ul className="eos-desk-priority-list">
                {data.whatMattersMost.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="eos-desk-btn eos-desk-priority-row"
                      onClick={() => setCaseId(c.id)}
                    >
                      <div className="eos-desk-priority-row__name">
                        {c.client.firstName} {c.client.lastName}
                      </div>
                      <div className="eos-desk-priority-row__meta">
                        <span>{c.nextAction || labelDeskStage(c.kind, c.pipelineStage)}</span>
                        <span className="eos-desk-priority-row__chips">
                          <span className={c.temperature === 'HOT' ? 'eos-desk-chip eos-desk-chip-hot' : 'eos-desk-chip'}>
                            {labelTemperature(c.temperature)}
                          </span>
                          <span
                            className={
                              c.health === 'AT_RISK'
                                ? 'eos-desk-chip eos-desk-chip-risk'
                                : c.health === 'ATTENTION'
                                  ? 'eos-desk-chip eos-desk-chip-attention'
                                  : 'eos-desk-chip eos-desk-chip-ok'
                            }
                          >
                            {labelHealth(c.health)}
                          </span>
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {data.openTasks.length ? (
              <div className="eos-desk-today-tasks">
                <p className="eos-desk-kicker">{DESK_UI.tasksSection}</p>
                {data.openTasks.slice(0, 8).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="eos-desk-btn eos-desk-task-row"
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
