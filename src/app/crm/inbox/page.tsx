'use client';

import { useEffect, useState } from 'react';
import { useDeskInspector } from '@/components/desk/DeskShell';
import { DESK_UI } from '@/lib/desk/labels';
import { DESK_TEMPLATES } from '@/lib/desk/templates';

type TaskRow = {
  id: number;
  title: string;
  dueAt: string | null;
  priority: string;
  caseId: number | null;
  client: { firstName: string; lastName: string; phone: string | null } | null;
};

export default function DeskInboxPage() {
  const { setCaseId, bumpRefresh } = useDeskInspector();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/desk/tasks?status=OPEN', { cache: 'no-store' });
      const json = await res.json();
      if (!cancelled && res.ok) setTasks(json.tasks || []);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <p className="eos-desk-kicker">{DESK_UI.inboxKicker}</p>
      <h1 className="eos-desk-h1">Skrzynka pracy</h1>
      <p className="eos-desk-muted" style={{ marginTop: '0.5rem' }}>
        Otwarte zadania z workflow + szybkie szablony. Pełna taśma komunikacji jest w inspektorze sprawy
        (oś czasu).
      </p>

      {loading ? <p className="eos-desk-muted">Ładuję…</p> : null}

      <div style={{ display: 'grid', gap: '0.45rem', marginTop: '1rem' }}>
        {tasks.map((t) => (
          <div key={t.id} className="eos-desk-case-card">
            <button
              type="button"
              className="eos-desk-btn"
              style={{ width: '100%', textAlign: 'left' }}
              onClick={() => t.caseId && setCaseId(t.caseId)}
            >
              <div style={{ fontWeight: 700 }}>{t.title}</div>
              <div className="eos-desk-muted" style={{ fontSize: '0.82rem' }}>
                {t.client ? `${t.client.firstName} ${t.client.lastName}` : '—'} · {t.priority}
                {t.client?.phone ? (
                  <>
                    {' '}
                    · <a href={`tel:${t.client.phone}`}>Call</a>
                  </>
                ) : null}
              </div>
            </button>
            <button
              type="button"
              className="eos-desk-btn"
              style={{ marginTop: '0.35rem' }}
              onClick={async () => {
                await fetch('/api/desk/tasks', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: t.id, status: 'DONE' }),
                });
                setTasks((prev) => prev.filter((x) => x.id !== t.id));
                bumpRefresh();
              }}
            >
              Done
            </button>
          </div>
        ))}
        {!loading && tasks.length === 0 ? (
          <p className="eos-desk-muted">Brak otwartych zadań.</p>
        ) : null}
      </div>

      <div className="eos-desk-card" style={{ marginTop: '1.25rem' }}>
        <p className="eos-desk-kicker">Szablony</p>
        {DESK_TEMPLATES.slice(0, 6).map((t) => (
          <details key={t.id} style={{ borderTop: '1px solid var(--desk-line)', padding: '0.4rem 0' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{t.label}</summary>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'var(--desk-font-ui)',
                fontSize: '0.82rem',
                margin: '0.4rem 0 0',
              }}
            >
              {t.body}
            </pre>
          </details>
        ))}
      </div>
    </div>
  );
}
