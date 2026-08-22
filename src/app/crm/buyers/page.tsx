'use client';

import { useEffect, useState } from 'react';
import { useDeskInspector } from '@/components/desk/DeskShell';
import { BUY_PIPELINE } from '@/lib/desk/types';
import { DESK_UI } from '@/lib/desk/labels';

type DeskCaseRow = {
  id: number;
  pipelineStage: string;
  health: string;
  temperature: string;
  nextAction: string | null;
  client: {
    id: number;
    firstName: string;
    lastName: string;
    phone: string | null;
    buyerPreference?: {
      maxPrice?: number | null;
      city?: string | null;
      minArea?: number | null;
    } | null;
  };
};

export default function DeskBuyersPage() {
  const { setCaseId, caseId, refreshKey } = useDeskInspector();
  const [cases, setCases] = useState<DeskCaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetch('/api/desk/cases?kind=BUY', { cache: 'no-store' });
      const json = await res.json();
      if (!cancelled && res.ok) setCases(json.cases || []);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const byStage = BUY_PIPELINE.reduce(
    (acc, stage) => {
      acc[stage] = cases.filter((c) => c.pipelineStage === stage);
      return acc;
    },
    {} as Record<string, DeskCaseRow[]>,
  );

  return (
    <div>
      <p className="eos-desk-kicker">{DESK_UI.buyersKicker}</p>
      <h1 className="eos-desk-h1">Kupujący</h1>
      <p className="eos-desk-muted" style={{ marginTop: '0.5rem' }}>
        Zapytanie → kwalifikacja → dopasowanie → prezentacja → oferta → transakcja. Jedna osoba, osobna sprawa kupna.
      </p>

      {loading ? <p className="eos-desk-muted">Ładuję…</p> : null}

      <div className="eos-desk-kanban" style={{ marginTop: '1.25rem' }}>
        {BUY_PIPELINE.filter((s) => s !== 'LOST' || (byStage.LOST || []).length).map((stage) => (
          <div key={stage} className="eos-desk-kanban-col">
            <h3>
              {stage} · {(byStage[stage] || []).length}
            </h3>
            {(byStage[stage] || []).map((row) => (
              <button
                key={row.id}
                type="button"
                className="eos-desk-case-card"
                data-active={caseId === row.id}
                onClick={() => setCaseId(row.id)}
                style={{ width: '100%', textAlign: 'left' }}
              >
                <div style={{ fontWeight: 700 }}>
                  {row.client.firstName} {row.client.lastName}
                </div>
                <div className="eos-desk-muted" style={{ fontSize: '0.78rem' }}>
                  {row.nextAction || '—'}
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
