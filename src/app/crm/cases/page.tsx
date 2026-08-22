'use client';

import { useEffect, useState } from 'react';
import { useDeskInspector } from '@/components/desk/DeskShell';
import { DeskTruncate } from '@/components/desk/DeskText';
import { DESK_UI, labelDeskKind, labelDeskStage } from '@/lib/desk/labels';

type DeskCaseRow = {
  id: number;
  title: string | null;
  kind: string;
  pipelineStage: string;
  health: string;
  temperature: string;
  nextAction: string | null;
  client: { firstName: string; lastName: string; phone: string | null };
};

export default function DeskCasesPage() {
  const { refreshKey, setCaseId, caseId } = useDeskInspector();
  const [cases, setCases] = useState<DeskCaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<'ALL' | 'SELL' | 'BUY'>('ALL');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const qs = kind === 'ALL' ? '' : `?kind=${kind}`;
        const res = await fetch(`/api/desk/cases${qs}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Błąd');
        if (!cancelled) setCases(json.cases || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Błąd');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, kind]);

  return (
    <div>
      <p className="eos-desk-kicker">{DESK_UI.casesKicker}</p>
      <h1 className="eos-desk-h1">Sprawy</h1>
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem' }}>
        {(['ALL', 'SELL', 'BUY'] as const).map((k) => (
          <button
            key={k}
            type="button"
            className="eos-desk-btn"
            style={{ background: kind === k ? 'var(--desk-brass-soft)' : undefined }}
            onClick={() => setKind(k)}
          >
            {k}
          </button>
        ))}
      </div>

      {loading ? <p className="eos-desk-muted" style={{ marginTop: '1rem' }}>Ładuję…</p> : null}
      {error ? (
        <div className="eos-desk-card" style={{ marginTop: '1rem', color: 'var(--desk-danger)' }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: '0.55rem', marginTop: '1.25rem' }}>
        {cases.map((row) => (
          <button
            key={row.id}
            type="button"
            className="eos-desk-case-card"
            data-active={caseId === row.id}
            onClick={() => setCaseId(row.id)}
            style={{ width: '100%', textAlign: 'left' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', minWidth: 0 }}>
              <DeskTruncate lines={1} className="eos-desk-case-name">
                {row.client.firstName} {row.client.lastName}
              </DeskTruncate>
              <span className="eos-desk-chip" style={{ flexShrink: 0 }}>
                {labelDeskKind(row.kind)} · {labelDeskStage(row.kind, row.pipelineStage)}
              </span>
            </div>
            <div className="eos-desk-muted" style={{ marginTop: '0.35rem', fontSize: '0.88rem' }}>
              {row.nextAction || row.title || '—'} · {row.health}/{row.temperature}
            </div>
          </button>
        ))}
        {!loading && cases.length === 0 ? (
          <p className="eos-desk-muted">Brak spraw. Zacznij od + {DESK_UI.newProspect}.</p>
        ) : null}
      </div>
    </div>
  );
}
