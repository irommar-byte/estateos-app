'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import type { UpcomingScheduleEvent } from '@/lib/crm/upcomingScheduleShared';

type Note = { date: string; text: string };

const WEEKDAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function warsawKey(v: string): string {
  return new Date(v).toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
}
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y.getTime()) / 86_400_000 + 1) / 7);
}

/** Zegar analogowy w stylu zegarka mechanicznego — płynna wskazówka sekundowa, złote indeksy, okienko daty. */
function DeskWatch() {
  const h = useRef<SVGGElement>(null);
  const m = useRef<SVGGElement>(null);
  const s = useRef<SVGGElement>(null);
  const [day, setDay] = useState(() => new Date().getDate());
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const n = new Date();
      const sec = n.getSeconds() + n.getMilliseconds() / 1000;
      const min = n.getMinutes() + sec / 60;
      const hr = (n.getHours() % 12) + min / 60;
      h.current?.setAttribute('transform', `rotate(${hr * 30} 100 100)`);
      m.current?.setAttribute('transform', `rotate(${min * 6} 100 100)`);
      s.current?.setAttribute('transform', `rotate(${sec * 6} 100 100)`);
      if (n.getDate() !== day) setDay(n.getDate());
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [day]);

  return (
    <svg viewBox="0 0 200 200" className="crmx-watch" aria-hidden>
      <defs>
        <radialGradient id="crmxDial" cx="50%" cy="38%" r="70%">
          <stop offset="0%" stopColor="var(--x-dial-hi)" />
          <stop offset="100%" stopColor="var(--x-dial-lo)" />
        </radialGradient>
        <linearGradient id="crmxBezel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e9dcc2" />
          <stop offset="45%" stopColor="#b8955c" />
          <stop offset="100%" stopColor="#7d5f2e" />
        </linearGradient>
        <linearGradient id="crmxHand" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f3e7cf" />
          <stop offset="100%" stopColor="#a8844c" />
        </linearGradient>
        <filter id="crmxShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.2" floodOpacity="0.35" />
        </filter>
      </defs>
      <circle cx="100" cy="100" r="98" fill="url(#crmxBezel)" />
      <circle cx="100" cy="100" r="91" fill="url(#crmxDial)" />
      <circle cx="100" cy="100" r="91" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="0.8" />
      {Array.from({ length: 60 }, (_, i) => {
        const major = i % 5 === 0;
        return (
          <line
            key={i}
            x1="100"
            y1={major ? 15 : 16}
            x2="100"
            y2={major ? 29 : 20}
            stroke={major ? 'var(--x-gold)' : 'var(--x-tick)'}
            strokeWidth={major ? (i % 15 === 0 ? 3.2 : 2.2) : 0.8}
            strokeLinecap="round"
            transform={`rotate(${i * 6} 100 100)`}
          />
        );
      })}
      <text x="100" y="62" textAnchor="middle" className="crmx-watch__brand">ESTATEOS</text>
      <text x="100" y="140" textAnchor="middle" className="crmx-watch__sub">AUTOMATIC</text>
      <rect x="137" y="92" width="22" height="16" rx="2.5" fill="var(--x-dial-lo)" stroke="var(--x-gold)" strokeWidth="0.8" />
      <text x="148" y="104" textAnchor="middle" className="crmx-watch__date">{day}</text>
      <g ref={h} filter="url(#crmxShadow)">
        <path d="M97 104 L98.4 52 Q100 47 101.6 52 L103 104 Z" fill="url(#crmxHand)" />
      </g>
      <g ref={m} filter="url(#crmxShadow)">
        <path d="M98.2 106 L99.1 30 Q100 26 100.9 30 L101.8 106 Z" fill="url(#crmxHand)" />
      </g>
      <g ref={s} filter="url(#crmxShadow)">
        <line x1="100" y1="118" x2="100" y2="24" stroke="#c0392b" strokeWidth="1" strokeLinecap="round" />
        <circle cx="100" cy="118" r="3" fill="#c0392b" />
      </g>
      <circle cx="100" cy="100" r="4.2" fill="#e9dcc2" stroke="#7d5f2e" strokeWidth="0.8" />
    </svg>
  );
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Wspólny stan biurka: miesiąc, wybrany dzień, notatki i spotkania. */
export function useDesk() {
  const now = useNow();
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState(() => iso(new Date()));
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [events, setEvents] = useState<UpcomingScheduleEvent[]>([]);

  const view = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);
  const y = view.getFullYear();
  const mo = view.getMonth();

  useEffect(() => {
    const key = `${y}-${String(mo + 1).padStart(2, '0')}`;
    fetch(`/api/user/notes?month=${key}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setNotes(Array.isArray(rows) ? rows : []))
      .catch(() => null);
  }, [y, mo]);

  useEffect(() => {
    fetch('/api/pro-widget/schedule', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => Array.isArray(d?.events) && setEvents(d.events))
      .catch(() => null);
  }, []);

  useEffect(() => {
    setText(notes.find((n) => n.date === selected)?.text || '');
    setSaved('idle');
  }, [selected, notes]);

  const save = useCallback(async () => {
    const current = notes.find((n) => n.date === selected)?.text || '';
    if (current === text) return;
    setSaved('saving');
    try {
      const res = await fetch('/api/user/notes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selected, text }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNotes((prev) => {
        const rest = prev.filter((n) => n.date !== selected);
        return data.deleted ? rest : [...rest, data.note];
      });
      setSaved('saved');
    } catch {
      setSaved('idle');
    }
  }, [notes, selected, text]);

  return { now, monthOffset, setMonthOffset, selected, setSelected, notes, text, setText, saved, setSaved, save, events, view, y, mo };
}
type Desk = ReturnType<typeof useDesk>;

export function DeskClock({ desk }: { desk: Desk }) {
  const { now } = desk;
  return (
    <div className="crmx-desk__clock">
      <div className="crmx-desk__head w-full">
        <p className="crmx-desk__month">Czas</p>
        <span className="crmx-desk__hint">Warszawa · tydzień {isoWeek(now)}</span>
      </div>
      <DeskWatch />
      <div className="min-w-0">
        <p className="crmx-desk__time">
          {now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
          <span>{String(now.getSeconds()).padStart(2, '0')}</span>
        </p>
        <p className="crmx-desk__day">{now.toLocaleDateString('pl-PL', { weekday: 'long' })}</p>
        <p className="crmx-desk__date">{now.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
    </div>
  );
}

export function DeskCalendar({ desk }: { desk: Desk }) {
  const { now, monthOffset, setMonthOffset, selected, setSelected, notes, events, view, y, mo } = desk;
  const firstDay = (new Date(y, mo, 1).getDay() + 6) % 7;
  const daysIn = new Date(y, mo + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = i - firstDay + 1;
    return d > 0 && d <= daysIn ? d : null;
  });
  const todayKey = iso(now);
  const eventDays = new Set(events.map((e) => warsawKey(e.startsAt)));
  const noteDays = new Set(notes.filter((n) => n.text?.trim()).map((n) => n.date));
  return (
    <div className="crmx-desk__cal">
      <div className="crmx-desk__head">
        <p className="crmx-desk__month">{view.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}</p>
        <div className="flex gap-1">
          <button type="button" className="crmx-btn crmx-btn--sm crmx-btn--icon" onClick={() => setMonthOffset((v) => v - 1)} aria-label="Poprzedni miesiąc"><ChevronLeft size={14} /></button>
          {monthOffset !== 0 ? (
            <button type="button" className="crmx-btn crmx-btn--sm" onClick={() => { setMonthOffset(0); setSelected(iso(new Date())); }}>Dziś</button>
          ) : null}
          <button type="button" className="crmx-btn crmx-btn--sm crmx-btn--icon" onClick={() => setMonthOffset((v) => v + 1)} aria-label="Następny miesiąc"><ChevronRight size={14} /></button>
        </div>
      </div>
      <div className="crmx-desk__grid">
        {WEEKDAYS.map((w) => <span key={w} className="crmx-desk__wd">{w}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const key = `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const cls = ['crmx-desk__d', key === todayKey ? 'is-today' : '', key === selected ? 'is-sel' : ''].join(' ');
          return (
            <button key={i} type="button" className={cls} onClick={() => setSelected(key)}>
              {d}
              <span className="crmx-desk__marks">
                {eventDays.has(key) ? <i className="ev" /> : null}
                {noteDays.has(key) ? <i className="nt" /> : null}
              </span>
            </button>
          );
        })}
      </div>
      <p className="crmx-desk__legend"><i className="ev" /> spotkanie <i className="nt" /> notatka</p>
    </div>
  );
}

export function DeskNotes({ desk }: { desk: Desk }) {
  const { now, selected, text, setText, saved, setSaved, save, events } = desk;
  const todayKey = iso(now);
  const selDate = new Date(`${selected}T12:00:00`);
  const dayEvents = events.filter((e) => warsawKey(e.startsAt) === selected).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return (
    <div className="crmx-desk__note">
      <p className="crmx-desk__month">
        {selected === todayKey ? 'Dziś' : selDate.toLocaleDateString('pl-PL', { weekday: 'long' })}
        <span>{selDate.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}</span>
      </p>
      {dayEvents.length ? (
        <ul className="crmx-desk__events">
          {dayEvents.map((e) => (
            <li key={e.id}>
              <b>{new Date(e.startsAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</b>
              <span>{e.title}{e.location ? ` · ${e.location}` : ''}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="crmx-desk__free">Bez spotkań tego dnia.</p>
      )}
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setSaved('idle'); }}
        onBlur={() => void save()}
        placeholder="Notatka na ten dzień — telefon, ustalenia, przypomnienie…"
        className="crmx-desk__textarea"
        rows={6}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11.5px] crmx-muted">
          {saved === 'saving' ? 'Zapisuję…' : saved === 'saved' ? <><Check size={12} className="inline" /> Zapisano</> : 'Zapisuje się samo po kliknięciu obok'}
        </span>
        <button type="button" className="crmx-btn crmx-btn--sm crmx-btn--primary" onClick={() => void save()}>Zapisz</button>
      </div>
    </div>
  );
}
