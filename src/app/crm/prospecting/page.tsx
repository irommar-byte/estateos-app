'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDeskInspector } from '@/components/desk/DeskShell';
import { DeskTruncate } from '@/components/desk/DeskText';
import { DESK_UI } from '@/lib/desk/labels';
import { PROSPECTING_BOARD_STAGES, SELL_STAGE_LABELS } from '@/lib/desk/types';

type DeskCaseRow = {
  id: number;
  title: string | null;
  pipelineStage: string;
  health: string;
  temperature: string;
  nextAction: string | null;
  nextActionAt: string | null;
  lastContactedAt?: string | null;
  source: string | null;
  client: { firstName: string; lastName: string; phone: string | null };
};

function fmtDue(iso?: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
}

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  source: 'otodom',
  sourceUrl: '',
  address: '',
  propertyType: 'FLAT',
  price: '',
  area: '',
  rooms: '',
  note: '',
};

export default function ProspectingPage() {
  const { refreshKey, bumpRefresh, setCaseId, caseId } = useDeskInspector();
  const [cases, setCases] = useState<DeskCaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/desk/cases?board=prospecting', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Błąd ładowania');
      setCases(json.cases || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const byStage = useMemo(() => {
    const map: Record<string, DeskCaseRow[]> = {};
    for (const stage of PROSPECTING_BOARD_STAGES) map[stage] = [];
    for (const row of cases) {
      if (!map[row.pipelineStage]) map[row.pipelineStage] = [];
      map[row.pipelineStage].push(row);
    }
    return map;
  }, [cases]);

  async function createProspect(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch('/api/desk/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone || null,
          email: form.email || null,
          source: form.source,
          sourceUrl: form.sourceUrl || null,
          address: form.address || null,
          propertyType: form.propertyType,
          price: form.price ? Number(form.price.replace(/\s/g, '')) : null,
          note: [
            form.note,
            form.area ? `Metraż: ${form.area}` : null,
            form.rooms ? `Pokoje: ${form.rooms}` : null,
          ]
            .filter(Boolean)
            .join('\n'),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Nie utworzono prospectu');
      if (json.case?.propertySnapshot?.draft) {
        setPreview('Draft z URL został dołączony do sprawy (bez tworzenia oferty).');
      }
      setForm(emptyForm);
      setFormOpen(false);
      bumpRefresh();
      if (json.case?.id) setCaseId(json.case.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="eos-desk-kicker">{DESK_UI.prospectingKicker}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 className="eos-desk-h1">Pipeline pozysku</h1>
        <button type="button" className="eos-desk-btn eos-desk-btn-primary" onClick={() => setFormOpen(true)}>
          + {DESK_UI.newProspect}
        </button>
      </div>
      <p className="eos-desk-muted" style={{ marginTop: '0.5rem' }}>
        Otodom / OLX / telefon / polecenie → kontakt → spotkanie → umowa. Bez duplikatów osoby.
      </p>

      {error ? (
        <div className="eos-desk-card" style={{ marginTop: '1rem', color: 'var(--desk-danger)' }}>
          {error}
        </div>
      ) : null}
      {preview ? (
        <div className="eos-desk-card" style={{ marginTop: '1rem' }}>
          {preview}
        </div>
      ) : null}

      {formOpen ? (
        <form className="eos-desk-card" style={{ marginTop: '1rem' }} onSubmit={createProspect}>
          <p className="eos-desk-kicker">{DESK_UI.newProspect}</p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))',
              gap: '0.65rem',
              marginTop: '0.75rem',
            }}
          >
            <input
              className="eos-desk-input"
              required
              placeholder="Imię i nazwisko"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              className="eos-desk-input"
              placeholder="+48…"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <input
              className="eos-desk-input"
              placeholder="E-mail"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <select
              className="eos-desk-select"
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
            >
              <option value="otodom">Otodom</option>
              <option value="olx">OLX</option>
              <option value="facebook">Facebook</option>
              <option value="referral">Polecenie</option>
              <option value="concierge">Concierge</option>
              <option value="phone">Telefon</option>
              <option value="manual">Ręcznie</option>
            </select>
            <input
              className="eos-desk-input"
              placeholder="URL oferty (Otodom / OLX) — draft bez Offer"
              value={form.sourceUrl}
              onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
              style={{ gridColumn: '1 / -1' }}
            />
            <input
              className="eos-desk-input"
              placeholder="Adres"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
            <select
              className="eos-desk-select"
              value={form.propertyType}
              onChange={(e) => setForm((f) => ({ ...f, propertyType: e.target.value }))}
            >
              <option value="FLAT">Mieszkanie</option>
              <option value="HOUSE">Dom</option>
              <option value="PLOT">Działka</option>
              <option value="COMMERCIAL">Komercja</option>
            </select>
            <input
              className="eos-desk-input"
              placeholder="Cena"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            />
            <input
              className="eos-desk-input"
              placeholder="m²"
              value={form.area}
              onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
            />
            <input
              className="eos-desk-input"
              placeholder="Pokoje"
              value={form.rooms}
              onChange={(e) => setForm((f) => ({ ...f, rooms: e.target.value }))}
            />
            <textarea
              className="eos-desk-textarea"
              placeholder="Notatka / next action"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              style={{ gridColumn: '1 / -1' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem' }}>
            <button type="submit" className="eos-desk-btn eos-desk-btn-primary" disabled={saving}>
              {saving ? 'Tworzę…' : 'Utwórz sprawę'}
            </button>
            <button type="button" className="eos-desk-btn" onClick={() => setFormOpen(false)}>
              Anuluj
            </button>
          </div>
        </form>
      ) : null}

      {loading ? <p className="eos-desk-muted" style={{ marginTop: '1.25rem' }}>Ładuję pipeline…</p> : null}

      <div className="eos-desk-kanban" style={{ marginTop: '1.25rem' }}>
        {PROSPECTING_BOARD_STAGES.map((stage) => (
          <div key={stage} className="eos-desk-kanban-col">
            <h3>
              <span>{SELL_STAGE_LABELS[stage]}</span>
              <span className="eos-desk-kanban-count">{byStage[stage]?.length || 0}</span>
            </h3>
            {(byStage[stage] || []).map((row) => {
              const due = fmtDue(row.nextActionAt);
              const overdue = row.nextActionAt && new Date(row.nextActionAt).getTime() < Date.now();
              return (
              <button
                key={row.id}
                type="button"
                className="eos-desk-case-card"
                data-active={caseId === row.id}
                onClick={() => setCaseId(row.id)}
              >
                <DeskTruncate className="eos-desk-case-card__name" lines={2}>
                  {row.client.firstName} {row.client.lastName}
                </DeskTruncate>
                <DeskTruncate className="eos-desk-case-card__action" lines={2}>
                  {row.nextAction || '—'}
                </DeskTruncate>
                <div className="eos-desk-case-card__meta">
                  <span className={row.temperature === 'HOT' ? 'eos-desk-chip eos-desk-chip-hot' : 'eos-desk-chip'}>
                    {row.temperature}
                  </span>
                  <span className={row.health === 'AT_RISK' ? 'eos-desk-chip eos-desk-chip-risk' : row.health === 'ATTENTION' ? 'eos-desk-chip eos-desk-chip-attention' : 'eos-desk-chip'}>
                    {row.health}
                  </span>
                  {due ? (
                    <span className={`eos-desk-case-card__due${overdue ? ' eos-desk-case-card__due--overdue' : ''}`}>
                      {due}
                    </span>
                  ) : null}
                </div>
              </button>
            );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
