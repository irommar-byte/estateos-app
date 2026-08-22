'use client';

import { useMemo, useState } from 'react';
import type { WebRadarFilters } from '@/lib/radarCalibrationWeb';
import { defaultWebRadarFilters } from '@/lib/radarCalibrationWeb';
import {
  buyerPrefToQualificationForm,
  type BuyerQualificationExtended,
} from '@/lib/desk/buyerQualification';

const PROPERTY_TYPES = [
  { value: 'FLAT', label: 'Mieszkanie' },
  { value: 'HOUSE', label: 'Dom' },
  { value: 'PLOT', label: 'Działka' },
  { value: 'COMMERCIAL', label: 'Lokal użytkowy' },
];

type Props = {
  caseId: number;
  clientId: number;
  buyerPreference: Record<string, unknown> | null;
  qualification: BuyerQualificationExtended | null;
  onSaved: () => void | Promise<void>;
};

export function BuyerQualifyForm({ caseId, clientId: _clientId, buyerPreference, qualification, onSaved }: Props) {
  void _clientId;
  const initial = useMemo(
    () =>
      buyerPrefToQualificationForm(
        buyerPreference as Parameters<typeof buyerPrefToQualificationForm>[0],
        qualification,
      ),
    [buyerPreference, qualification],
  );

  const [filters, setFilters] = useState<WebRadarFilters>(
    initial.buyerFilters || defaultWebRadarFilters(),
  );
  const [minPrice, setMinPrice] = useState(String(initial.minPrice ?? ''));
  const [maxPrice, setMaxPrice] = useState(String(initial.maxPrice ?? filters.maxPrice ?? ''));
  const [minArea, setMinArea] = useState(String(filters.minArea || ''));
  const [maxArea, setMaxArea] = useState(String(initial.maxArea ?? ''));
  const [rooms, setRooms] = useState(String(initial.rooms ?? ''));
  const [financing, setFinancing] = useState<'cash' | 'credit' | 'mixed'>(initial.financing || 'credit');
  const [downPayment, setDownPayment] = useState(String(initial.downPayment ?? ''));
  const [districtsText, setDistrictsText] = useState((filters.selectedDistricts || []).join(', '));
  const [marketType, setMarketType] = useState<'primary' | 'secondary' | 'both'>(initial.marketType || 'both');
  const [purchaseTimeline, setPurchaseTimeline] = useState(initial.purchaseTimeline || '');
  const [purchaseGoal, setPurchaseGoal] = useState(initial.purchaseGoal || '');
  const [mustHave, setMustHave] = useState(initial.mustHave || '');
  const [niceToHave, setNiceToHave] = useState(initial.niceToHave || '');
  const [exclusions, setExclusions] = useState(initial.exclusions || '');
  const [notes, setNotes] = useState(initial.qualificationNotes || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const patchFilter = (patch: Partial<WebRadarFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
  };

  return (
    <div className="eos-desk-qualify-form">
      <p className="eos-desk-kicker">Kwalifikacja kupującego</p>
      <p className="eos-desk-muted" style={{ fontSize: '0.85rem', marginBottom: '0.65rem' }}>
        INQUIRY → QUALIFIED → MATCHING · zapis do AgencyClientBuyerPreference
      </p>

      <div className="eos-desk-form-grid">
        <label>
          <span className="eos-desk-command-label">Budżet min (PLN)</span>
          <input className="eos-desk-input" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
        </label>
        <label>
          <span className="eos-desk-command-label">Budżet max (PLN)</span>
          <input className="eos-desk-input" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
        </label>
        <label>
          <span className="eos-desk-command-label">Finansowanie</span>
          <select
            className="eos-desk-select"
            value={financing}
            onChange={(e) => setFinancing(e.target.value as typeof financing)}
          >
            <option value="credit">Kredyt</option>
            <option value="cash">Gotówka</option>
            <option value="mixed">Mieszane</option>
          </select>
        </label>
        <label>
          <span className="eos-desk-command-label">Wkład własny (PLN)</span>
          <input className="eos-desk-input" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} />
        </label>
        <label>
          <span className="eos-desk-command-label">Miasto</span>
          <input
            className="eos-desk-input"
            value={filters.city}
            onChange={(e) => patchFilter({ city: e.target.value })}
          />
        </label>
        <label>
          <span className="eos-desk-command-label">Dzielnice (po przecinku)</span>
          <input className="eos-desk-input" value={districtsText} onChange={(e) => setDistrictsText(e.target.value)} />
        </label>
        <label>
          <span className="eos-desk-command-label">Typ nieruchomości</span>
          <select
            className="eos-desk-select"
            value={filters.propertyType}
            onChange={(e) => patchFilter({ propertyType: e.target.value })}
          >
            {PROPERTY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="eos-desk-command-label">Metraż min (m²)</span>
          <input className="eos-desk-input" value={minArea} onChange={(e) => setMinArea(e.target.value)} />
        </label>
        <label>
          <span className="eos-desk-command-label">Metraż max (m²)</span>
          <input className="eos-desk-input" value={maxArea} onChange={(e) => setMaxArea(e.target.value)} />
        </label>
        <label>
          <span className="eos-desk-command-label">Pokoje</span>
          <input className="eos-desk-input" value={rooms} onChange={(e) => setRooms(e.target.value)} />
        </label>
        <label>
          <span className="eos-desk-command-label">Rynek</span>
          <select
            className="eos-desk-select"
            value={marketType}
            onChange={(e) => setMarketType(e.target.value as typeof marketType)}
          >
            <option value="primary">Pierwotny</option>
            <option value="secondary">Wtórny</option>
            <option value="both">Oba</option>
          </select>
        </label>
        <label>
          <span className="eos-desk-command-label">Termin zakupu</span>
          <input
            className="eos-desk-input"
            placeholder="np. 3 miesiące"
            value={purchaseTimeline}
            onChange={(e) => setPurchaseTimeline(e.target.value)}
          />
        </label>
      </div>

      <label style={{ display: 'block', marginTop: '0.5rem' }}>
        <span className="eos-desk-command-label">Cel zakupu</span>
        <input className="eos-desk-input" value={purchaseGoal} onChange={(e) => setPurchaseGoal(e.target.value)} />
      </label>
      <label style={{ display: 'block', marginTop: '0.45rem' }}>
        <span className="eos-desk-command-label">Must-have</span>
        <textarea className="eos-desk-textarea" rows={2} value={mustHave} onChange={(e) => setMustHave(e.target.value)} />
      </label>
      <label style={{ display: 'block', marginTop: '0.45rem' }}>
        <span className="eos-desk-command-label">Nice-to-have</span>
        <textarea className="eos-desk-textarea" rows={2} value={niceToHave} onChange={(e) => setNiceToHave(e.target.value)} />
      </label>
      <label style={{ display: 'block', marginTop: '0.45rem' }}>
        <span className="eos-desk-command-label">Wykluczenia</span>
        <textarea className="eos-desk-textarea" rows={2} value={exclusions} onChange={(e) => setExclusions(e.target.value)} />
      </label>
      <label style={{ display: 'block', marginTop: '0.45rem' }}>
        <span className="eos-desk-command-label">Notatki</span>
        <textarea className="eos-desk-textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      {error ? <p style={{ color: 'var(--desk-danger)', marginTop: '0.5rem' }}>{error}</p> : null}
      {success ? <p style={{ color: 'var(--desk-ok)', marginTop: '0.5rem' }}>Zapisano · matching uruchomiony</p> : null}

      <button
        type="button"
        className="eos-desk-btn eos-desk-btn-primary"
        style={{ marginTop: '0.65rem' }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          setSuccess(false);
          try {
            const selectedDistricts = districtsText
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            const payload = {
              minPrice: minPrice ? Number(minPrice) : null,
              maxPrice: maxPrice ? Number(maxPrice) : null,
              financing,
              downPayment: downPayment ? Number(downPayment) : null,
              maxArea: maxArea ? Number(maxArea) : null,
              rooms: rooms ? Number(rooms) : null,
              marketType,
              purchaseTimeline: purchaseTimeline || null,
              purchaseGoal: purchaseGoal || null,
              mustHave: mustHave || null,
              niceToHave: niceToHave || null,
              exclusions: exclusions || null,
              qualificationNotes: notes || null,
              notes,
              buyerFilters: {
                ...filters,
                maxPrice: maxPrice ? Number(maxPrice) : 0,
                minArea: minArea ? Number(minArea) : 0,
                selectedDistricts,
              },
            };
            const res = await fetch(`/api/desk/cases/${caseId}/qualify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Nie zapisano');
            setSuccess(true);
            await onSaved();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Błąd');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Zapisuję…' : 'Zapisz kwalifikację → MATCHING'}
      </button>
    </div>
  );
}
