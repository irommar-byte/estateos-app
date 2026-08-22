'use client';

import { useCallback, useState } from 'react';

type ChecklistItem = {
  id: number;
  title: string;
  status: string;
  dueAt: string | null;
  priority: string;
  metadata?: { stageKey?: string; catalogId?: string } | null;
};

function fmtWhen(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
  } catch {
    return '—';
  }
}

export function DeskChecklistPanel({
  caseId,
  items,
  onUpdated,
}: {
  caseId: number;
  items: ChecklistItem[];
  onUpdated: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState<number | null>(null);

  const toggle = useCallback(
    async (taskId: number, done: boolean) => {
      setBusy(taskId);
      try {
        const res = await fetch(`/api/desk/cases/${caseId}/checklist`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId, done }),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || 'Błąd');
        }
        await onUpdated();
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Błąd');
      } finally {
        setBusy(null);
      }
    },
    [caseId, onUpdated],
  );

  if (!items.length) {
    return (
      <p className="eos-desk-muted" style={{ fontSize: '0.88rem' }}>
        Checklisty pojawią się automatycznie po zmianie etapu sprawy.
      </p>
    );
  }

  const open = items.filter((i) => i.status === 'OPEN');
  const done = items.filter((i) => i.status === 'DONE');
  const overdue = open.filter((i) => i.dueAt && new Date(i.dueAt) < new Date());

  return (
    <div>
      {overdue.length > 0 ? (
        <p className="eos-desk-chip eos-desk-chip-risk" style={{ marginBottom: '0.65rem' }}>
          {overdue.length} przeterminowanych pozycji
        </p>
      ) : null}
      <ul className="eos-desk-checklist">
        {open.map((item) => (
          <li key={item.id} className={item.dueAt && new Date(item.dueAt) < new Date() ? 'overdue' : ''}>
            <label>
              <input
                type="checkbox"
                disabled={busy === item.id}
                onChange={() => void toggle(item.id, true)}
              />
              <span>{item.title}</span>
            </label>
            <span className="eos-desk-muted">{fmtWhen(item.dueAt)}</span>
          </li>
        ))}
        {done.map((item) => (
          <li key={item.id} className="done">
            <label>
              <input
                type="checkbox"
                checked
                disabled={busy === item.id}
                onChange={() => void toggle(item.id, false)}
              />
              <span>{item.title}</span>
            </label>
            <span className="eos-desk-muted">✓</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
