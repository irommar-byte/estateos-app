'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import OpenContactThreadButton from '@/components/contact/OpenContactThreadButton';
import {
  PHOTO_SESSION_CONTRACTOR_NAME,
  PHOTO_SESSION_CONTRACTOR_USER_ID,
} from '@/constants/photoSession';
import PhotoSessionCountdown from '@/components/photoSession/PhotoSessionCountdown';
import ProPhotoSessionDialog from '@/components/photoSession/ProPhotoSessionDialog';
import {
  fetchMyPhotoSessions,
  formatDateTime,
  paymentLabel,
  respondPhotoSession,
  type PhotoSessionRequestItem,
} from '@/lib/photoSessionWeb';

function HistoryBlock({ item }: { item: PhotoSessionRequestItem }) {
  const events = item.events || [];
  if (!events.length) return null;
  return (
    <details className="mt-3 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2">
      <summary className="cursor-pointer text-[11px] font-black uppercase tracking-[0.12em] text-[var(--eos-muted)]">
        Historia negocjacji
      </summary>
      <div className="mt-2 space-y-2">
        {events.map((ev) => (
          <div key={ev.id} className="rounded-lg border border-[var(--eos-border)] p-2 text-xs">
            <p className="font-bold text-[var(--eos-text)]">{ev.action}</p>
            {ev.proposedAt ? <p className="text-[var(--eos-muted)]">{formatDateTime(ev.proposedAt)}</p> : null}
            {ev.note ? <p className="text-[var(--eos-muted)]">{ev.note}</p> : null}
          </div>
        ))}
      </div>
    </details>
  );
}

function SessionCard({
  item,
  onUpdated,
}: {
  item: PhotoSessionRequestItem;
  onUpdated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [counterDate, setCounterDate] = useState('');
  const [counterHour, setCounterHour] = useState('10:00');
  const [note, setNote] = useState('');
  const [showCounter, setShowCounter] = useState(false);
  const needsUser = item.status === 'PENDING' && item.waitingOn === 'USER';
  const canContactContractor = item.status === 'PENDING' || item.status === 'ACCEPTED';

  const run = async (action: 'accept' | 'decline' | 'counter') => {
    if (busy) return;
    setBusy(true);
    try {
      if (action === 'counter') {
        if (!counterDate || !counterHour) {
          alert('Wybierz dzień i godzinę.');
          return;
        }
        const [hh, mm] = counterHour.split(':');
        const dt = new Date(counterDate);
        dt.setHours(Number(hh), Number(mm), 0, 0);
        await respondPhotoSession(item.id, {
          action: 'counter',
          proposedAt: dt.toISOString(),
          note: note.trim() || undefined,
        });
      } else {
        await respondPhotoSession(item.id, { action });
      }
      setShowCounter(false);
      onUpdated();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Operacja nie powiodła się.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-400">EstateOS Studio</p>
          <h3 className="mt-1 text-lg font-semibold">{item.propertyLabel || 'Nieruchomość w kreatorze'}</h3>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
            item.status === 'ACCEPTED'
              ? 'bg-emerald-500/15 text-emerald-300'
              : item.status === 'PENDING'
                ? 'bg-amber-500/15 text-amber-300'
                : 'bg-zinc-500/15 text-zinc-400'
          }`}
        >
          {item.status === 'ACCEPTED'
            ? 'Umówiono'
            : item.status === 'PENDING'
              ? needsUser
                ? 'Wymaga odpowiedzi'
                : 'Czeka na EstateOS'
              : item.status}
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400/80">
          {item.status === 'ACCEPTED' ? 'Umówiony termin' : 'Aktualna propozycja'}
        </p>
        <p className="mt-1 text-base font-bold">{formatDateTime(item.proposedAt)}</p>
        <p className="mt-1 text-xs text-[var(--eos-muted)]">{item.paymentLabel || paymentLabel(item.isProFree)}</p>
      </div>

      {item.status === 'ACCEPTED' ? (
        <PhotoSessionCountdown presentationIso={item.proposedAt} />
      ) : null}

      <HistoryBlock item={item} />

      {needsUser ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-[var(--eos-muted)]">
            EstateOS zaproponował inny termin — zaakceptuj, odrzuć lub wyślij kontrofertę.
          </p>
          {showCounter ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="date"
                value={counterDate}
                onChange={(e) => setCounterDate(e.target.value)}
                className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 text-sm"
              />
              <input
                type="time"
                value={counterHour}
                onChange={(e) => setCounterHour(e.target.value)}
                className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 text-sm"
              />
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Uwaga (opcjonalnie)"
                className="sm:col-span-2 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 text-sm"
                rows={2}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void run('counter')}
                className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-black disabled:opacity-60"
              >
                Wyślij kontrofertę
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void run('decline')}
                className="rounded-full border border-red-400/35 px-4 py-2 text-xs font-black uppercase tracking-wider text-red-300"
              >
                Odrzuć
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowCounter(true)}
                className="rounded-full border border-sky-400/35 px-4 py-2 text-xs font-black uppercase tracking-wider text-sky-300"
              >
                Inny termin
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run('accept')}
                className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-black"
              >
                Akceptuj
              </button>
            </div>
          )}
        </div>
      ) : null}

      {canContactContractor ? (
        <div className="mt-4">
          <OpenContactThreadButton
            peerUserId={PHOTO_SESSION_CONTRACTOR_USER_ID}
            peerName={PHOTO_SESSION_CONTRACTOR_NAME}
            label="Kontakt z wykonawcą (Wiadomości)"
            returnTo="/moje-konto/sesje-zdjeciowe"
            className="inline-flex rounded-full border border-[var(--eos-border)] px-4 py-2 text-xs font-black uppercase tracking-wider text-sky-300 disabled:opacity-60"
          />
        </div>
      ) : null}
    </article>
  );
}

type DraftContext = {
  propertyLabel?: string;
  propertyType?: string;
  transactionType?: string;
};

export default function UserPhotoSessionsPanel({ draft }: { draft?: DraftContext }) {
  const [items, setItems] = useState<PhotoSessionRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchMyPhotoSessions());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd ładowania.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = useMemo(() => items.filter((x) => x.status === 'PENDING'), [items]);
  const confirmed = useMemo(() => items.filter((x) => x.status === 'ACCEPTED'), [items]);
  const closed = useMemo(
    () => items.filter((x) => x.status === 'REJECTED' || x.status === 'CANCELLED'),
    [items],
  );

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className="flex w-full items-center gap-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-left transition hover:border-emerald-400/50"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-2xl">📷</span>
        <span className="flex-1">
          <span className="block text-lg font-black text-[var(--eos-text)]">Zamów sesję zdjęciową</span>
          <span className="mt-1 block text-sm text-[var(--eos-muted)]">EstateOS Studio — negocjacja terminu online</span>
        </span>
        <span className="text-emerald-300">→</span>
      </button>

      <ProPhotoSessionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        draft={draft}
        onSubmitted={() => {
          setDialogOpen(false);
          void load();
        }}
      />

      {loading ? (
        <p className="text-xs uppercase tracking-widest text-[var(--eos-muted)]">Ładowanie…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 text-center">
          <p className="text-sm text-[var(--eos-muted)]">Brak rezerwacji sesji. Zamów profesjonalną sesję powyżej.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {confirmed.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-emerald-400">Umówione</h2>
              {confirmed.map((item) => (
                <SessionCard key={item.id} item={item} onUpdated={load} />
              ))}
            </section>
          ) : null}
          {pending.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[var(--eos-muted)]">Aktywne</h2>
              {pending.map((item) => (
                <SessionCard key={item.id} item={item} onUpdated={load} />
              ))}
            </section>
          ) : null}
          {closed.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[var(--eos-muted)]">Historia</h2>
              {closed.map((item) => (
                <SessionCard key={item.id} item={item} onUpdated={load} />
              ))}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
