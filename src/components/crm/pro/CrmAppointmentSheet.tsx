'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CalendarClock, Check, MapPin, User, X } from 'lucide-react';
import { enrichAppointmentForUi, type PlanningAppointment } from '@/lib/crm/planningCalendar';

type Contact = { id?: number; name?: string; email?: string; phone?: string; image?: string };

async function respond(body: Record<string, unknown>) {
  const res = await fetch('/api/appointments/respond', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok;
}

/** Zarządzanie terminem (prezentacja / spotkanie z Dealroomu): potwierdź, zaproponuj inny termin, odwołaj. */
export default function CrmAppointmentSheet({
  app,
  contacts,
  myId,
  onClose,
  onChanged,
}: {
  app: PlanningAppointment;
  contacts: Contact[];
  myId: number;
  onClose: () => void;
  onChanged: (next: PlanningAppointment | null) => void;
}) {
  const e = enrichAppointmentForUi(app, myId, contacts);
  const status = String(app.status || '').toUpperCase();
  const accepted = status === 'ACCEPTED';
  const pending = status === 'PENDING';
  const [mode, setMode] = useState<'view' | 'day' | 'time' | 'send'>('view');
  const [day, setDay] = useState<Date | null>(null);
  const [time, setTime] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const k = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const days = useMemo(
    () => Array.from({ length: 28 }, (_, i) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i + 1); return d; }),
    [],
  );
  const hours = useMemo(() => {
    const out: string[] = [];
    for (let h = 8; h <= 20; h++) { out.push(`${String(h).padStart(2, '0')}:00`); if (h < 20) out.push(`${String(h).padStart(2, '0')}:30`); }
    return out;
  }, []);

  const run = async (fn: () => Promise<boolean>, after: () => void) => {
    setBusy(true);
    setErr('');
    try {
      if (await fn()) after();
      else setErr('Nie udało się zapisać. Spróbuj ponownie.');
    } catch {
      setErr('Brak połączenia z serwerem.');
    } finally {
      setBusy(false);
    }
  };

  const when = new Date(app.proposedDate);
  const cp = e.counterpartyDisplay;
  const statusChip = String(app.type || '').toUpperCase() === 'ACQUISITION'
    ? <span className="crmx-chip crmx-chip--info">Pozyskanie</span>
    : accepted ? <span className="crmx-chip crmx-chip--good"><Check size={11} /> Potwierdzony</span>
    : e.needsMyResponse ? <span className="crmx-chip crmx-chip--bad">Czeka na Twoją decyzję</span>
    : e.waitingOnOther ? <span className="crmx-chip crmx-chip--warn">Czeka na drugą stronę</span>
    : <span className="crmx-chip">{status.toLowerCase()}</span>;

  const node = (
    <div className="crmx">
      <motion.div className="crmx-drawer-scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.aside className="crmx crmx-drawer" style={{ width: 'min(480px, 100vw)' }} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--x-line)' }}>
          <div className="flex items-center gap-2">
            {mode !== 'view' ? (
              <button type="button" className="crmx-btn crmx-btn--sm crmx-btn--icon" onClick={() => setMode(mode === 'send' ? 'time' : mode === 'time' ? 'day' : 'view')} aria-label="Wstecz"><ArrowLeft size={15} /></button>
            ) : null}
            <p className="crmx-kicker">{mode === 'view' ? 'Termin' : mode === 'day' ? 'Nowy termin · dzień' : mode === 'time' ? 'Nowy termin · godzina' : 'Nowy termin · wyślij'}</p>
          </div>
          <button type="button" className="crmx-btn crmx-btn--sm crmx-btn--icon" onClick={onClose} aria-label="Zamknij"><X size={15} /></button>
        </div>

        <div className="space-y-5 p-6">
          {mode === 'view' ? (
            <>
              <div>
                {statusChip}
                <h2 className="crmx-display crmx-h2 mt-3">{when.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
                <p className="crmx-display mt-1" style={{ fontSize: 34, color: 'var(--x-gold-ink)' }}>{when.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <div className="crmx-card">
                <div className="crmx-list">
                  <div className="crmx-row">
                    {e.offerImageUrl ? <img src={e.offerImageUrl} alt="" className="crmx-thumb" /> : <span className="crmx-avatar"><MapPin size={15} /></span>}
                    <span className="crmx-row__main">
                      <span className="crmx-row__title block">{e.offerTitle}</span>
                      <span className="crmx-row__sub block">{accepted || e.offerAddress ? e.offerAddress || '—' : 'Adres po potwierdzeniu'}{e.offer?.apartmentNumber ? ` · lok. ${e.offer.apartmentNumber}` : ''}</span>
                    </span>
                  </div>
                  <div className="crmx-row">
                    <span className="crmx-avatar"><User size={15} /></span>
                    <span className="crmx-row__main">
                      <span className="crmx-row__title block">{cp?.name || (cp?.email ? String(cp.email).split('@')[0] : 'Druga strona')}</span>
                      <span className="crmx-row__sub block">{[cp?.email, (cp as { phone?: string } | null)?.phone].filter(Boolean).join(' · ') || (e.needsMyResponse ? 'Proponuje ten termin' : 'Uczestnik')}</span>
                    </span>
                  </div>
                </div>
              </div>
              {app.message ? <p className="crmx-sub rounded-xl p-3" style={{ background: 'var(--x-surface-2)' }}>„{app.message}”</p> : null}

              {pending && e.needsMyResponse ? (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={busy} className="crmx-btn crmx-btn--primary" onClick={() => run(() => respond({ id: app.id, status: 'ACCEPTED' }), () => onChanged({ ...app, status: 'ACCEPTED' }))}>
                    <Check /> Potwierdź
                  </button>
                  <button type="button" disabled={busy} className="crmx-btn" onClick={() => setMode('day')}><CalendarClock /> Inny termin</button>
                </div>
              ) : e.waitingOnOther ? (
                <div className="space-y-2">
                  <p className="crmx-sub">Wysłałeś propozycję — czekamy na odpowiedź drugiej strony.</p>
                  <button type="button" className="crmx-btn w-full" onClick={() => setMode('day')}><CalendarClock /> Zmień propozycję</button>
                </div>
              ) : accepted ? (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="crmx-btn" onClick={() => setMode('day')}><CalendarClock /> Przełóż</button>
                  <button
                    type="button"
                    disabled={busy}
                    className="crmx-btn"
                    style={{ color: 'var(--x-bad)' }}
                    onClick={() => {
                      if (!window.confirm('Odwołać ten termin? Druga strona dostanie powiadomienie.')) return;
                      void run(() => respond({ id: app.id, status: 'DECLINED', message: 'Prezentacja odwołana przez CRM.' }), () => onChanged(null));
                    }}
                  >
                    Odwołaj
                  </button>
                </div>
              ) : (
                <p className="crmx-sub">Ten termin nie wymaga teraz żadnej akcji.</p>
              )}
            </>
          ) : mode === 'day' ? (
            <div className="grid grid-cols-4 gap-2">
              {days.map((d) => (
                <button key={d.toISOString()} type="button" className={`crmx-slot ${day && d.toDateString() === day.toDateString() ? 'is-on' : ''}`} onClick={() => { setDay(d); setMode('time'); }}>
                  <span>{d.toLocaleDateString('pl-PL', { weekday: 'short' }).replace('.', '')}</span>
                  <b>{d.getDate()}</b>
                  <span>{d.toLocaleDateString('pl-PL', { month: 'short' }).replace('.', '')}</span>
                </button>
              ))}
            </div>
          ) : mode === 'time' ? (
            <div className="grid grid-cols-4 gap-2">
              {hours.map((h) => (
                <button key={h} type="button" className={`crmx-slot crmx-slot--time ${time === h ? 'is-on' : ''}`} onClick={() => { setTime(h); setMode('send'); }}>
                  <b>{h}</b>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="crmx-card crmx-card--pad text-center">
                <p className="crmx-kpi__label">Proponowany termin</p>
                <p className="crmx-display mt-2" style={{ fontSize: 24 }}>
                  {day?.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })} · {time}
                </p>
              </div>
              <button
                type="button"
                disabled={busy || !day || !time}
                className="crmx-btn crmx-btn--primary w-full"
                onClick={() => {
                  if (!day) return;
                  const d = new Date(day);
                  const [h, m] = time.split(':').map(Number);
                  d.setHours(h, m, 0, 0);
                  const iso = d.toISOString();
                  void run(() => respond({ id: app.id, status: 'COUNTER', proposedDate: iso }), () => { onChanged({ ...app, status: 'PENDING', proposedDate: iso }); setMode('view'); });
                }}
              >
                {busy ? 'Wysyłam…' : 'Wyślij propozycję'}
              </button>
            </div>
          )}
          {err ? <p className="text-[12.5px]" style={{ color: 'var(--x-bad)' }}>{err}</p> : null}
        </div>
      </motion.aside>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(node, document.body) : null;
}
