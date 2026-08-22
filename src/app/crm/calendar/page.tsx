'use client';

import { useEffect, useState } from 'react';
import { useDeskInspector } from '@/components/desk/DeskShell';
import { DESK_UI } from '@/lib/desk/labels';

type CalItem = {
  id: string;
  kind: string;
  title: string;
  subtitle?: string | null;
  startsAt?: string | null;
  caseId?: number | null;
};

function fmt(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pl-PL', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function DeskCalendarPage() {
  const { setCaseId } = useDeskInspector();
  const [items, setItems] = useState<CalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/desk/today', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Błąd');
        if (!cancelled) setItems(json.today?.timeline || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Błąd');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <p className="eos-desk-kicker">{DESK_UI.calendarKicker}</p>
      <h1 className="eos-desk-h1">Kalendarz operacyjny</h1>
      <p className="eos-desk-muted" style={{ marginTop: '0.5rem', maxWidth: '36rem' }}>
        Prezentacje, pozyskania, Open House, aukcje, sesje i telefony — klik otwiera sprawę w inspectorze.
      </p>

      {loading ? <p className="eos-desk-muted" style={{ marginTop: '1rem' }}>Ładuję…</p> : null}
      {error ? (
        <div className="eos-desk-card" style={{ marginTop: '1rem', color: 'var(--desk-danger)' }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: '0.5rem', marginTop: '1.25rem' }}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="eos-desk-case-card"
            style={{ width: '100%', textAlign: 'left' }}
            onClick={() => item.caseId && setCaseId(item.caseId)}
          >
            <div className="eos-desk-muted" style={{ fontSize: '0.75rem' }}>
              {fmt(item.startsAt)} · {item.kind}
            </div>
            <div style={{ fontWeight: 700 }}>{item.title}</div>
            {item.subtitle ? (
              <div className="eos-desk-muted" style={{ fontSize: '0.85rem' }}>
                {item.subtitle}
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
              {item.caseId ? <span className="eos-desk-chip">{DESK_UI.openCase}</span> : null}
              <span className="eos-desk-chip">{DESK_UI.debriefInInspector}</span>
            </div>
          </button>
        ))}
        {!loading && items.length === 0 ? (
          <p className="eos-desk-muted">Brak wydarzeń na dziś.</p>
        ) : null}
      </div>
    </div>
  );
}
