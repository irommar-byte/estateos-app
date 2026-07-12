'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import OpenContactThreadButton from '@/components/contact/OpenContactThreadButton';
import PhotoSessionCountdown from '@/components/photoSession/PhotoSessionCountdown';
import {
  adminPhotoSessionAction,
  fetchAdminPhotoSessions,
  formatDateTime,
  paymentLabel,
  buildHours,
  buildNextDays,
  type PhotoSessionRequestItem,
} from '@/lib/photoSessionWeb';

function AdminSessionCard({ item, onUpdated }: { item: PhotoSessionRequestItem; onUpdated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [showCounter, setShowCounter] = useState(false);
  const [counterDate, setCounterDate] = useState('');
  const [counterHour, setCounterHour] = useState('10:00');
  const [adminNote, setAdminNote] = useState('');
  const dates = useMemo(() => buildNextDays(), []);
  const hours = useMemo(() => buildHours(), []);
  const canAct = item.status === 'PENDING' && item.waitingOn === 'ADMIN';

  const run = async (action: 'accept' | 'reject' | 'counter') => {
    if (busy) return;
    setBusy(true);
    try {
      if (action === 'counter') {
        if (!counterDate || !counterHour) {
          alert('Wybierz termin kontroferty.');
          return;
        }
        const [hh, mm] = counterHour.split(':');
        const dt = new Date(counterDate);
        dt.setHours(Number(hh), Number(mm), 0, 0);
        await adminPhotoSessionAction(item.id, {
          action: 'counter',
          proposedAt: dt.toISOString(),
          adminNote: adminNote.trim() || undefined,
        });
      } else {
        await adminPhotoSessionAction(item.id, { action, adminNote: adminNote.trim() || undefined });
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
    <article className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-black">{item.requesterName || `Użytkownik #${item.userId}`}</h3>
          <p className="text-sm text-gray-500">{item.propertyLabel || 'Nieruchomość w kreatorze'}</p>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[10px] font-black uppercase text-emerald-300">
          {item.status === 'ACCEPTED' ? 'Potwierdzono' : item.status}
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400/80">Termin</p>
        <p className="mt-1 font-bold text-white">{formatDateTime(item.proposedAt)}</p>
        <p className="mt-1 text-xs text-gray-500">{item.paymentLabel || paymentLabel(item.isProFree)}</p>
      </div>

      {item.status === 'ACCEPTED' ? <PhotoSessionCountdown presentationIso={item.proposedAt} /> : null}

      {(item.requesterPhone || item.requesterEmail) && (
        <p className="mt-2 text-xs text-gray-500">
          {[item.requesterPhone, item.requesterEmail].filter(Boolean).join(' · ')}
        </p>
      )}

      <details className="mt-3 rounded-xl border border-white/10 px-3 py-2">
        <summary className="cursor-pointer text-[11px] font-black uppercase tracking-wider text-gray-500">
          Historia negocjacji
        </summary>
        <div className="mt-2 space-y-2">
          {(item.events || []).map((ev) => (
            <div key={ev.id} className="rounded-lg border border-white/10 p-2 text-xs text-gray-400">
              <p className="font-bold text-white">{ev.action}</p>
              {ev.proposedAt ? <p>{formatDateTime(ev.proposedAt)}</p> : null}
              {ev.note ? <p>{ev.note}</p> : null}
            </div>
          ))}
        </div>
      </details>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/centrala/uzytkownicy?highlight=${item.userId}`}
          className="rounded-full border border-sky-400/35 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-sky-300"
        >
          Profil zleceniodawcy
        </Link>
        <OpenContactThreadButton
          peerUserId={item.userId}
          peerName={item.requesterName || undefined}
          label="Kontakt z klientem"
          returnTo="/centrala/sesje-zdjeciowe"
          className="rounded-full border border-emerald-400/35 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-300 disabled:opacity-60"
        />
      </div>

      {canAct ? (
        <div className="mt-4 space-y-3">
          {showCounter ? (
            <>
              <div className="flex flex-wrap gap-2">
                {dates.slice(0, 14).map((d) => (
                  <button
                    key={d.toISOString()}
                    type="button"
                    onClick={() => setCounterDate(d.toISOString().slice(0, 10))}
                    className={`rounded-lg border px-2 py-1 text-xs ${
                      counterDate === d.toISOString().slice(0, 10) ? 'border-emerald-400 bg-emerald-500/20' : 'border-white/10'
                    }`}
                  >
                    {d.getDate()}.{d.getMonth() + 1}
                  </button>
                ))}
              </div>
              <select
                value={counterHour}
                onChange={(e) => setCounterHour(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm"
              >
                {hours.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Uwaga do kontroferty"
                className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm"
                rows={2}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void run('counter')}
                className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-black uppercase text-black"
              >
                Wyślij kontrofertę
              </button>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => void run('reject')} className="rounded-full border border-red-400/35 px-4 py-2 text-xs font-black uppercase text-red-300">
                Odrzuć
              </button>
              <button type="button" disabled={busy} onClick={() => setShowCounter(true)} className="rounded-full border border-sky-400/35 px-4 py-2 text-xs font-black uppercase text-sky-300">
                Kontroferta
              </button>
              <button type="button" disabled={busy} onClick={() => void run('accept')} className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-black uppercase text-black">
                Akceptuj
              </button>
            </div>
          )}
        </div>
      ) : item.status === 'PENDING' ? (
        <p className="mt-3 text-xs text-amber-400">Czekamy na odpowiedź klienta.</p>
      ) : null}
    </article>
  );
}

export default function AdminPhotoSessionsPanel() {
  const [items, setItems] = useState<PhotoSessionRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchAdminPhotoSessions('ALL'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd ładowania.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = items.filter((x) => x.status === 'PENDING');
  const confirmed = items.filter((x) => x.status === 'ACCEPTED');
  const closed = items.filter((x) => x.status === 'REJECTED' || x.status === 'CANCELLED');

  return (
    <div className="space-y-8">
      {loading ? (
        <p className="text-xs uppercase tracking-widest text-gray-500">Ładowanie kolejki…</p>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500">Brak rezerwacji sesji.</p>
      ) : (
        <>
          {confirmed.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-emerald-400">Umówione</h2>
              {confirmed.map((item) => (
                <AdminSessionCard key={item.id} item={item} onUpdated={load} />
              ))}
            </section>
          ) : null}
          {pending.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-gray-500">Do negocjacji</h2>
              {pending.map((item) => (
                <AdminSessionCard key={item.id} item={item} onUpdated={load} />
              ))}
            </section>
          ) : null}
          {closed.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-gray-500">Zamknięte</h2>
              {closed.map((item) => (
                <AdminSessionCard key={item.id} item={item} onUpdated={load} />
              ))}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
