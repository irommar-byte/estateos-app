'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  type PlanningAppointment,
  appointmentsOnDay,
  buildMonthGrid,
  enrichAppointmentForUi,
  isSameCalendarDay,
} from '@/lib/crm/planningCalendar';
import { DeskNotes, useDesk } from './CrmDesk';
import { useNotePeek } from './NotePeek';
import { holidayName, isWeekend } from './holidays';

const WEEKDAYS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'];
type Contact = { id?: number; name?: string; email?: string; phone?: string; image?: string };
type Enriched = ReturnType<typeof enrichAppointmentForUi>;

function kindOf(a: Enriched): { label: string; cls: string } {
  const type = String(a.type || '').toUpperCase();
  const status = String(a.status || '').toUpperCase();
  if (type === 'ACQUISITION') return { label: 'Pozyskanie', cls: 'info' };
  if (a.needsMyResponse) return { label: 'Do akceptacji', cls: 'bad' };
  if (a.waitingOnOther) return { label: 'Twoja propozycja', cls: 'warn' };
  if (status === 'ACCEPTED') return { label: 'Potwierdzone', cls: 'good' };
  if (status === 'COMPLETED') return { label: 'Odbyte', cls: '' };
  return { label: 'Termin', cls: 'gold' };
}
function hm(d: string | Date) {
  return new Date(d).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}
function key(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Planowanie: duży kalendarz miesiąca z terminami + agenda + notatka dnia (te same notatki co na Pulpicie). */
export default function CrmPlanner({
  appointments,
  contacts,
  currentUserId,
  onManage,
}: {
  appointments: PlanningAppointment[];
  contacts: Contact[];
  currentUserId: number;
  onManage: (app: PlanningAppointment) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [y, setY] = useState(today.getFullYear());
  const [m, setM] = useState(today.getMonth());
  const [sel, setSel] = useState<Date>(today);
  const desk = useDesk();
  const peek = useNotePeek();

  const grid = useMemo(() => buildMonthGrid(y, m), [y, m]);
  const enrich = (a: PlanningAppointment) => enrichAppointmentForUi(a, currentUserId, contacts);
  const shift = (d: number) => {
    const n = new Date(y, m + d, 1);
    setY(n.getFullYear());
    setM(n.getMonth());
  };
  const pick = (d: Date) => {
    setSel(d);
    desk.setSelected(key(d));
  };

  const upcoming = useMemo(
    () =>
      appointments
        .filter((a) => new Date(a.proposedDate).getTime() >= Date.now() - 2 * 3600_000)
        .sort((a, b) => new Date(a.proposedDate).getTime() - new Date(b.proposedDate).getTime())
        .slice(0, 12)
        .map(enrich),
    [appointments], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const dayApps = appointmentsOnDay(appointments, sel).map(enrich);

  return (
    <div className="crmx-planner">
      {peek.layer}
      <section className="crmx-card crmx-planner__month">
        <header className="crmx-planner__bar">
          <div className="flex items-center gap-1.5">
            <button type="button" className="crmx-btn crmx-btn--sm crmx-btn--icon" onClick={() => shift(-1)} aria-label="Poprzedni miesiąc"><ChevronLeft size={15} /></button>
            <button type="button" className="crmx-btn crmx-btn--sm crmx-btn--icon" onClick={() => shift(1)} aria-label="Następny miesiąc"><ChevronRight size={15} /></button>
            <h3 className="crmx-planner__title">{new Date(y, m, 1).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="crmx-chip crmx-chip--bad"><span className="crmx-dot" />Do akceptacji</span>
            <span className="crmx-chip crmx-chip--warn"><span className="crmx-dot" />Twoja propozycja</span>
            <span className="crmx-chip crmx-chip--good"><span className="crmx-dot" />Potwierdzone</span>
            <span className="crmx-chip crmx-chip--info"><span className="crmx-dot" />Pozyskanie</span>
            <button type="button" className="crmx-btn crmx-btn--sm" onClick={() => { setY(today.getFullYear()); setM(today.getMonth()); pick(today); }}>Dziś</button>
          </div>
        </header>
        <div className="crmx-planner__grid">
          {WEEKDAYS.map((w) => <div key={w} className="crmx-planner__wd">{w}</div>)}
          {grid.map((d) => {
            const inMonth = d.getMonth() === m;
            const apps = appointmentsOnDay(appointments, d).map(enrich);
            const isToday = isSameCalendarDay(d, today);
            const isSel = isSameCalendarDay(d, sel);
            const hasNote = desk.notes.some((n) => n.date === key(d) && n.text?.trim());
            const hol = holidayName(d);
            const off = isWeekend(d) || !!hol;
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => pick(d)}
                {...peek.bind(key(d), desk.notes.find((n) => n.date === key(d))?.text)}
                title={hol || undefined}
                className={`crmx-planner__day ${off ? 'is-off' : ''} ${inMonth ? '' : 'is-out'} ${isToday ? 'is-today' : ''} ${isSel ? 'is-sel' : ''}`}
              >
                <span className="crmx-planner__num">
                  {d.getDate()}
                  {hasNote ? <i className="crmx-planner__note" title="Notatka" /> : null}
                </span>
                {hol ? <span className="crmx-planner__hol">{hol}</span> : null}
                <span className="crmx-planner__items">
                  {apps.slice(0, 2).map((a) => {
                    const k = kindOf(a);
                    return (
                      <span key={`${a.source}-${a.id}`} className={`crmx-planner__ev crmx-planner__ev--${k.cls || 'plain'}`}>
                        <b>{hm(a.proposedDate)}</b> {a.counterpartyDisplay?.name || a.offerTitle}
                      </span>
                    );
                  })}
                  {apps.length > 2 ? <span className="crmx-planner__more">+{apps.length - 2} więcej</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="crmx-card">
          <header className="crmx-card__head">
            <h3 className="crmx-card__title">
              {isSameCalendarDay(sel, today) ? 'Dziś' : sel.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
            <span className="text-[12px] crmx-muted">{dayApps.length ? `${dayApps.length} ${dayApps.length === 1 ? 'termin' : 'terminy'}` : 'wolne'}</span>
          </header>
          <div className="crmx-list">
            {dayApps.length === 0 ? (
              <p className="crmx-empty">Brak terminów tego dnia.</p>
            ) : (
              dayApps.map((a) => {
                const k = kindOf(a);
                return (
                  <button key={`${a.source}-${a.id}`} type="button" className="crmx-row" onClick={() => onManage(a)}>
                    <span className="crmx-time">{hm(a.proposedDate)}</span>
                    <span className="crmx-row__main">
                      <span className="crmx-row__title block">{a.offerTitle}</span>
                      <span className="crmx-row__sub block">{[a.counterpartyDisplay?.name, a.offerAddress].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className={`crmx-chip ${k.cls ? `crmx-chip--${k.cls}` : ''}`}>{k.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="crmx-card crmx-desk--notes">
          <DeskNotes desk={desk} />
        </section>

        <section className="crmx-card">
          <header className="crmx-card__head">
            <h3 className="crmx-card__title">Najbliższe terminy</h3>
          </header>
          <div className="crmx-list">
            {upcoming.length === 0 ? (
              <p className="crmx-empty">Nic nie jest zaplanowane.</p>
            ) : (
              upcoming.map((a) => {
                const k = kindOf(a);
                const d = new Date(a.proposedDate);
                return (
                  <button key={`${a.source}-${a.id}`} type="button" className="crmx-row" onClick={() => { pick(d); onManage(a); }}>
                    <span className="text-center" style={{ minWidth: 48 }}>
                      <span className="block text-[10.5px] font-bold uppercase tracking-[0.08em] crmx-muted">{d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}</span>
                      <span className="crmx-time block">{hm(d)}</span>
                    </span>
                    <span className="crmx-row__main">
                      <span className="crmx-row__title block">{a.offerTitle}</span>
                      <span className="crmx-row__sub block">{a.counterpartyDisplay?.name || a.offerAddress}</span>
                    </span>
                    <span className={`crmx-dot`} style={{ color: `var(--x-${k.cls || 'gold'})` }} />
                  </button>
                );
              })
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
