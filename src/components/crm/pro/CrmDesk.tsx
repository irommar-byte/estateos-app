'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, Search, StickyNote, X } from 'lucide-react';
import type { UpcomingScheduleEvent } from '@/lib/crm/upcomingScheduleShared';
import { createPortal } from 'react-dom';
import { useNotePeek } from './NotePeek';
import { holidayName, isWeekend } from './holidays';

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

/**
 * Zegarek jak prawdziwy: koperta z polerowanego złota (wielowarstwowe gradienty i odblaski), radełkowana luneta,
 * koronka, tarcza z promienistym szlifem, nakładane fazowane indeksy, fazowane wskazówki z cieniem, wypukłe szkło.
 */
function DeskWatch() {
  const uid = useId().replace(/:/g, '');
  const id = (n: string) => `${n}-${uid}`;
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
      h.current?.setAttribute('transform', `rotate(${hr * 30} 120 120)`);
      m.current?.setAttribute('transform', `rotate(${min * 6} 120 120)`);
      s.current?.setAttribute('transform', `rotate(${sec * 6} 120 120)`);
      if (n.getDate() !== day) setDay(n.getDate());
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [day]);

  // fazowany indeks: jasna i ciemna połowa
  const baton = (deg: number, double = false) => {
    const w = double ? 3.2 : 4.2;
    const xs = double ? [-4.2, 4.2] : [0];
    return (
      <g key={deg} transform={`rotate(${deg} 120 120)`} filter={`url(#${id('idx')})`}>
        {xs.map((dx) => (
          <g key={dx}>
            <rect x={120 + dx - w / 2} y={29} width={w / 2} height={17} rx={0.6} fill={`url(#${id('goldL')})`} />
            <rect x={120 + dx} y={29} width={w / 2} height={17} rx={0.6} fill={`url(#${id('goldD')})`} />
          </g>
        ))}
      </g>
    );
  };

  return (
    <svg viewBox="0 0 240 240" className="crmx-watch" aria-hidden>
      <defs>
        {/* złoto koperty */}
        <linearGradient id={id('case')} x1="0.15" y1="0.05" x2="0.85" y2="0.95">
          <stop offset="0" stopColor="#fff4d6" />
          <stop offset="0.18" stopColor="#e9c98a" />
          <stop offset="0.42" stopColor="#b8893f" />
          <stop offset="0.58" stopColor="#f3dca4" />
          <stop offset="0.78" stopColor="#9c6f2c" />
          <stop offset="1" stopColor="#5e3f14" />
        </linearGradient>
        <linearGradient id={id('caseSheen')} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.52" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id('bevelIn')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a3c12" />
          <stop offset="0.5" stopColor="#c9a25e" />
          <stop offset="1" stopColor="#fff1cf" />
        </linearGradient>
        <radialGradient id={id('dial')} cx="0.42" cy="0.36" r="0.75">
          <stop offset="0" stopColor="var(--x-dial-hi)" />
          <stop offset="1" stopColor="var(--x-dial-lo)" />
        </radialGradient>
        <radialGradient id={id('dialShade')} cx="0.5" cy="0.62" r="0.55">
          <stop offset="0.78" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </radialGradient>
        <linearGradient id={id('goldL')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6dc" />
          <stop offset="1" stopColor="#d9b46c" />
        </linearGradient>
        <linearGradient id={id('goldD')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c99a4e" />
          <stop offset="1" stopColor="#7c5520" />
        </linearGradient>
        <linearGradient id={id('crown')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1cf" />
          <stop offset="0.5" stopColor="#b8893f" />
          <stop offset="1" stopColor="#5e3f14" />
        </linearGradient>
        <radialGradient id={id('cap')} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.5" stopColor="#d6ad62" />
          <stop offset="1" stopColor="#6b4a18" />
        </radialGradient>
        <linearGradient id={id('glass')} x1="0.2" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id={id('drop')} x="-30%" y="-30%" width="160%" height="170%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="7" />
          <feOffset dy="9" />
          <feComponentTransfer><feFuncA type="linear" slope="0.42" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={id('idx')} x="-50%" y="-20%" width="200%" height="150%">
          <feDropShadow dx="0.8" dy="1.4" stdDeviation="0.7" floodColor="#2a1a05" floodOpacity="0.45" />
        </filter>
        <filter id={id('hand')} x="-50%" y="-20%" width="200%" height="140%">
          <feDropShadow dx="1.6" dy="2.6" stdDeviation="1.6" floodColor="#1a1003" floodOpacity="0.4" />
        </filter>
        <clipPath id={id('dialClip')}><circle cx="120" cy="120" r="94" /></clipPath>
      </defs>

      <g filter={`url(#${id('drop')})`}>
        {/* koronka */}
        <g>
          <rect x="226" y="108" width="12" height="24" rx="3" fill={`url(#${id('crown')})`} />
          {Array.from({ length: 7 }, (_, i) => (
            <line key={i} x1="227.5" x2="236.5" y1={111 + i * 3} y2={111 + i * 3} stroke="#4a300c" strokeOpacity="0.45" strokeWidth="0.8" />
          ))}
          <rect x="220" y="112" width="8" height="16" rx="2" fill={`url(#${id('crown')})`} />
        </g>
        {/* koperta */}
        <circle cx="120" cy="120" r="114" fill={`url(#${id('case')})`} />
        <circle cx="120" cy="120" r="114" fill={`url(#${id('caseSheen')})`} />
        <circle cx="120" cy="120" r="113.2" fill="none" stroke="#fff3d2" strokeOpacity="0.7" strokeWidth="0.8" />
        {/* radełkowana luneta */}
        {Array.from({ length: 120 }, (_, i) => (
          <line key={i} x1="120" y1="8.5" x2="120" y2="14.5" stroke={i % 2 ? '#3d2808' : '#fff4d6'} strokeOpacity={i % 2 ? 0.28 : 0.35} strokeWidth="1.1" transform={`rotate(${i * 3} 120 120)`} />
        ))}
        {/* wpuszczony stopień do tarczy */}
        <circle cx="120" cy="120" r="102" fill="none" stroke={`url(#${id('bevelIn')})`} strokeWidth="9" />
        <circle cx="120" cy="120" r="97.5" fill="#3a2608" />
      </g>

      {/* tarcza */}
      <circle cx="120" cy="120" r="96.5" fill={`url(#${id('dial')})`} />
      <g clipPath={`url(#${id('dialClip')})`} opacity="0.55">
        {Array.from({ length: 180 }, (_, i) => (
          <line key={i} x1="120" y1="120" x2="120" y2="20" stroke={i % 2 ? '#ffffff' : '#000000'} strokeOpacity={i % 2 ? 0.07 : 0.035} strokeWidth="1.8" transform={`rotate(${i * 2} 120 120)`} />
        ))}
      </g>
      <circle cx="120" cy="120" r="96.5" fill={`url(#${id('dialShade')})`} />

      {/* podziałka minutowa */}
      {Array.from({ length: 60 }, (_, i) =>
        i % 5 ? (
          <line key={i} x1="120" y1="25" x2="120" y2="28.5" stroke="var(--x-tick)" strokeWidth="0.9" transform={`rotate(${i * 6} 120 120)`} />
        ) : null,
      )}
      {/* nakładane indeksy */}
      {Array.from({ length: 12 }, (_, i) => baton(i * 30, i === 0))}

      <text x="120" y="78" textAnchor="middle" className="crmx-watch__brand">ESTATEOS</text>
      <text x="120" y="88" textAnchor="middle" className="crmx-watch__sub">WARSZAWA · AUTOMATIC</text>
      <text x="120" y="168" textAnchor="middle" className="crmx-watch__sub">CHRONOMETER</text>

      {/* okienko daty z ramką */}
      <rect x="160" y="111" width="23" height="18" rx="2.4" fill={`url(#${id('goldD')})`} />
      <rect x="161.2" y="112.2" width="20.6" height="15.6" rx="1.8" fill="#fffdf7" />
      <rect x="161.2" y="112.2" width="20.6" height="4" rx="1.8" fill="#000" fillOpacity="0.08" />
      <text x="171.5" y="124.4" textAnchor="middle" className="crmx-watch__date">{day}</text>

      {/* wskazówka godzinowa — fazowana */}
      <g ref={h} filter={`url(#${id('hand')})`}>
        <path d="M120 64 L114.6 124 L120 131 Z" fill={`url(#${id('goldL')})`} />
        <path d="M120 64 L125.4 124 L120 131 Z" fill={`url(#${id('goldD')})`} />
      </g>
      {/* wskazówka minutowa */}
      <g ref={m} filter={`url(#${id('hand')})`}>
        <path d="M120 30 L116 124 L120 132 Z" fill={`url(#${id('goldL')})`} />
        <path d="M120 30 L124 124 L120 132 Z" fill={`url(#${id('goldD')})`} />
      </g>
      {/* sekundnik z przeciwwagą */}
      <g ref={s} filter={`url(#${id('hand')})`}>
        <line x1="120" y1="146" x2="120" y2="26" stroke="#8a1c1c" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="120" cy="140" r="3.6" fill="#8a1c1c" />
      </g>
      <circle cx="120" cy="120" r="6.2" fill={`url(#${id('cap')})`} />
      <circle cx="120" cy="120" r="2" fill="#5e3f14" />

      {/* wypukłe szkło szafirowe */}
      <path d="M44 96 A80 80 0 0 1 160 42 A96 96 0 0 0 44 96 Z" fill={`url(#${id('glass')})`} opacity="0.9" />
      <circle cx="120" cy="120" r="96.5" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.8" />
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

  /** Zapis notatki na dowolny dzień (szybka notatka z kalendarza). */
  const saveNote = useCallback(async (date: string, value: string) => {
    const res = await fetch('/api/user/notes', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, text: value }),
    });
    if (!res.ok) throw new Error('save');
    const data = await res.json();
    setNotes((prev) => {
      const rest = prev.filter((n) => n.date !== date);
      return data.deleted ? rest : [...rest, data.note];
    });
  }, []);

  return { now, monthOffset, setMonthOffset, selected, setSelected, notes, text, setText, saved, setSaved, save, saveNote, events, view, y, mo };
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
  const peek = useNotePeek();
  const [quick, setQuick] = useState<{ date: string; x: number; y: number; below: boolean } | null>(null);
  return (
    <div className="crmx-desk__cal">
      {quick ? null : peek.layer}
      {quick ? (
        <QuickNote
          date={quick.date}
          x={quick.x}
          y={quick.y}
          below={quick.below}
          initial={notes.find((n) => n.date === quick.date)?.text || ''}
          onSave={(v) => desk.saveNote(quick.date, v)}
          onClose={() => setQuick(null)}
        />
      ) : null}
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
          const dt = new Date(y, mo, d);
          const hol = holidayName(dt);
          const cls = ['crmx-desk__d', isWeekend(dt) || hol ? 'is-off' : '', hol ? 'is-holiday' : '', key === todayKey ? 'is-today' : '', key === selected ? 'is-sel' : ''].join(' ');
          return (
            <button key={i} type="button" className={cls} onClick={() => setSelected(key)}
              onDoubleClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const below = r.top < 260;
                setSelected(key);
                setQuick({ date: key, x: r.left + r.width / 2, y: below ? r.bottom + 10 : r.top - 10, below });
              }}
              {...peek.bind(key, quick ? null : notes.find((n) => n.date === key)?.text, quick ? null : hol)}>
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

/** Szybka notatka: podwójne kliknięcie w dzień → pole do wpisania; Enter zapisuje, Shift+Enter nowa linia, Esc zamyka. */
function QuickNote({
  date,
  x,
  y,
  below,
  initial,
  onSave,
  onClose,
}: {
  date: string;
  x: number;
  y: number;
  below: boolean;
  initial: string;
  onSave: (value: string) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.setSelectionRange(initial.length, initial.length);
  }, [initial]);
  const commit = async () => {
    if (value.trim() === initial.trim()) return onClose();
    setBusy(true);
    try {
      await onSave(value);
      onClose();
    } catch {
      setBusy(false);
    }
  };
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="crmx">
      <div className="crmx-quick-scrim" onMouseDown={() => void commit()} />
      <div className="crmx-peek crmx-quick" style={{ left: x, top: y }} data-below={below ? '1' : undefined}>
        <p className="crmx-peek__head">
          <StickyNote size={13} />
          {new Date(`${date}T12:00:00`).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <textarea
          ref={ref}
          value={value}
          rows={4}
          disabled={busy}
          placeholder="Szybka notatka…"
          className="crmx-quick__input"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void commit();
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] crmx-muted">Enter — zapisz · Esc — anuluj</span>
          <button type="button" className="crmx-btn crmx-btn--sm crmx-btn--primary" disabled={busy} onClick={() => void commit()}>
            {busy ? 'Zapisuję…' : 'Zapisz'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
}

/** Wyszukiwarka notatek: szuka we wszystkich notatkach (bez polskich znaków), podświetla trafienie, klik przenosi do dnia. */
export function DeskNoteSearch({ desk }: { desk: Desk }) {
  const [all, setAll] = useState<Note[]>([]);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    fetch('/api/user/notes', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => Array.isArray(rows) && setAll(rows))
      .catch(() => null);
  }, []);
  // zmiany zapisane w kalendarzu od razu trafiają do wyszukiwarki
  useEffect(() => {
    setAll((prev) => {
      const map = new Map(prev.map((n) => [n.date, n]));
      const month = `${desk.y}-${String(desk.mo + 1).padStart(2, '0')}`;
      for (const k of [...map.keys()]) if (k.startsWith(month) && !desk.notes.some((n) => n.date === k)) map.delete(k);
      for (const n of desk.notes) map.set(n.date, n);
      return [...map.values()];
    });
  }, [desk.notes, desk.y, desk.mo]);

  const query = fold(q.trim());
  const today = iso(new Date());
  const results = useMemo(() => {
    const withText = all.filter((n) => n.text?.trim());
    if (!query) {
      const upcoming = withText.filter((n) => n.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
      const recent = withText.filter((n) => n.date < today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
      return [...upcoming, ...recent];
    }
    const words = query.split(/\s+/).filter(Boolean);
    return withText
      .map((n) => {
        const hay = fold(n.text);
        if (!words.every((w) => hay.includes(w))) return null;
        const at = hay.indexOf(words[0]);
        return { n, at };
      })
      .filter(Boolean)
      .sort((a, b) => b!.n.date.localeCompare(a!.n.date))
      .slice(0, 8)
      .map((r) => ({ ...r!.n, _at: r!.at }) as Note & { _at: number });
  }, [all, query, today]);

  useEffect(() => setActive(0), [query]);

  const open = (n: Note) => {
    const [yy, mm] = n.date.split('-').map(Number);
    const now = new Date();
    desk.setMonthOffset((yy - now.getFullYear()) * 12 + (mm - 1 - now.getMonth()));
    desk.setSelected(n.date);
  };

  const snippet = (n: Note & { _at?: number }) => {
    const text = n.text.replace(/\s+/g, ' ').trim();
    if (!query) return <>{text.slice(0, 90)}{text.length > 90 ? '…' : ''}</>;
    const word = query.split(/\s+/)[0];
    const at = n._at ?? 0;
    const start = Math.max(0, at - 28);
    const pre = (start > 0 ? '…' : '') + text.slice(start, at);
    const hit = text.slice(at, at + word.length);
    const post = text.slice(at + word.length, at + word.length + 60);
    return <>{pre}<mark>{hit}</mark>{post}{at + word.length + 60 < text.length ? '…' : ''}</>;
  };

  return (
    <div className="crmx-nsearch">
      <div className="crmx-desk__head">
        <p className="crmx-desk__month"><Search size={15} style={{ color: 'var(--x-gold)' }} /> Notatki</p>
        <span className="crmx-desk__hint">{all.filter((n) => n.text?.trim()).length} zapisanych</span>
      </div>
      <label className="crmx-input crmx-nsearch__input">
        <Search />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Szukaj w notatkach — słowo, nazwisko, ulica…"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
            if (e.key === 'Enter' && results[active]) open(results[active]);
            if (e.key === 'Escape') setQ('');
          }}
        />
        {q ? <button type="button" className="crmx-nsearch__clear" onClick={() => setQ('')} aria-label="Wyczyść"><X size={13} /></button> : null}
      </label>
      <p className="crmx-nsearch__label">{query ? (results.length ? `Znalezione · ${results.length}` : 'Nic nie znaleziono') : 'Nadchodzące i ostatnie'}</p>
      <ul className="crmx-nsearch__list">
        {results.map((n, i) => {
          const d = new Date(`${n.date}T12:00:00`);
          const future = n.date >= today;
          return (
            <li key={n.date}>
              <button
                type="button"
                className={`crmx-nsearch__item ${i === active ? 'is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => open(n)}
              >
                <span className={`crmx-nsearch__date ${future ? 'is-future' : ''}`}>
                  <b>{d.getDate()}</b>
                  <small>{d.toLocaleDateString('pl-PL', { month: 'short' }).replace('.', '')}</small>
                </span>
                <span className="crmx-nsearch__text">
                  <span className="crmx-nsearch__when">{n.date === today ? 'Dziś' : d.toLocaleDateString('pl-PL', { weekday: 'long', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })}</span>
                  <span className="crmx-nsearch__snip">{snippet(n as Note & { _at?: number })}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
