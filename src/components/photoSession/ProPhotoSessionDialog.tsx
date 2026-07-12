'use client';

import { useMemo, useState } from 'react';
import { buildHours, buildNextDays, createPhotoSession, formatDateTime } from '@/lib/photoSessionWeb';

type DraftContext = {
  propertyLabel?: string;
  propertyType?: string;
  transactionType?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
  draft?: DraftContext;
};

export default function ProPhotoSessionDialog({ open, onClose, onSubmitted, draft }: Props) {
  const dates = useMemo(() => buildNextDays(), []);
  const hours = useMemo(() => buildHours(), []);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const resetAndClose = () => {
    setStep(1);
    setSelectedDate(null);
    setSelectedHour(null);
    setNote('');
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (!selectedDate || !selectedHour || loading) return;
    setLoading(true);
    setError(null);
    try {
      const [hh, mm] = selectedHour.split(':');
      const dt = new Date(selectedDate);
      dt.setHours(Number(hh), Number(mm), 0, 0);
      await createPhotoSession({
        proposedAt: dt.toISOString(),
        note: note.trim() || undefined,
        propertyLabel: draft?.propertyLabel,
        propertyType: draft?.propertyType,
        transactionType: draft?.transactionType,
      });
      onSubmitted?.();
      resetAndClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wysłać propozycji.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">EstateOS Studio</p>
            <h2 className="mt-1 text-2xl font-black">Profesjonalna sesja zdjęciowa</h2>
          </div>
          <button type="button" onClick={resetAndClose} className="rounded-full border border-[var(--eos-border)] px-3 py-1 text-sm">
            ✕
          </button>
        </div>

        {draft?.propertyLabel ? (
          <p className="mb-4 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 text-sm text-[var(--eos-muted)]">
            {draft.propertyLabel}
          </p>
        ) : null}

        {step === 1 ? (
          <div>
            <p className="mb-3 text-sm font-bold">Wybierz dzień</p>
            <div className="flex flex-wrap gap-2">
              {dates.map((d) => {
                const active = selectedDate?.toDateString() === d.toDateString();
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    onClick={() => setSelectedDate(d)}
                    className={`rounded-xl border px-3 py-2 text-sm font-bold ${
                      active ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200' : 'border-[var(--eos-border)]'
                    }`}
                  >
                    {d.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={!selectedDate}
              onClick={() => setStep(2)}
              className="mt-4 w-full rounded-full bg-emerald-500 py-3 text-xs font-black uppercase tracking-wider text-black disabled:opacity-40"
            >
              Dalej
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <p className="mb-3 text-sm font-bold">Wybierz godzinę</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {hours.map((h) => {
                const active = selectedHour === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setSelectedHour(h)}
                    className={`rounded-xl border py-2 text-sm font-bold ${
                      active ? 'border-emerald-400 bg-emerald-500/20' : 'border-[var(--eos-border)]'
                    }`}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setStep(1)} className="flex-1 rounded-full border border-[var(--eos-border)] py-3 text-xs font-black uppercase">
                Wstecz
              </button>
              <button
                type="button"
                disabled={!selectedHour}
                onClick={() => setStep(3)}
                className="flex-1 rounded-full bg-emerald-500 py-3 text-xs font-black uppercase text-black disabled:opacity-40"
              >
                Dalej
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 && selectedDate && selectedHour ? (
          <div>
            <p className="text-sm text-[var(--eos-muted)]">
              Termin:{' '}
              <strong className="text-[var(--eos-text)]">
                {(() => {
                  const [hh, mm] = selectedHour.split(':');
                  const dt = new Date(selectedDate);
                  dt.setHours(Number(hh), Number(mm), 0, 0);
                  return formatDateTime(dt.toISOString());
                })()}
              </strong>
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Uwagi do sesji (opcjonalnie)"
              className="mt-3 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 text-sm"
              rows={3}
            />
            {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setStep(2)} className="flex-1 rounded-full border border-[var(--eos-border)] py-3 text-xs font-black uppercase">
                Wstecz
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void submit()}
                className="flex-1 rounded-full bg-emerald-500 py-3 text-xs font-black uppercase text-black disabled:opacity-60"
              >
                {loading ? 'Wysyłanie…' : 'Wyślij propozycję'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
