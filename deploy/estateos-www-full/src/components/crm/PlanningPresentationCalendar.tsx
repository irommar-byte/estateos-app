'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  X,
  Building2,
  User,
  ExternalLink,
} from 'lucide-react';
import {
  type PlanningAppointment,
  appointmentsOnDay,
  buildMonthGrid,
  dayIndicators,
  enrichAppointmentForUi,
  isSameCalendarDay,
} from '@/lib/crm/planningCalendar';

const WEEKDAYS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'];

type Props = {
  appointments: PlanningAppointment[];
  contacts: Array<{ id?: number; name?: string; email?: string; phone?: string; image?: string }>;
  currentUserId: number;
  onManage: (app: PlanningAppointment) => void;
  onViewProfile?: (user: { id?: number; name?: string; email?: string }) => void;
};

export default function PlanningPresentationCalendar({
  appointments,
  contacts,
  currentUserId,
  onManage,
  onViewProfile,
}: Props) {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthLabel = useMemo(
    () =>
      new Date(viewYear, viewMonth, 1).toLocaleDateString('pl-PL', {
        month: 'long',
        year: 'numeric',
      }),
    [viewYear, viewMonth]
  );

  const gridDays = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const shiftYear = (delta: number) => setViewYear((y) => y + delta);

  const selectedDayApps = useMemo(() => {
    if (!selectedDate) return [];
    return appointmentsOnDay(appointments, selectedDate).map((a) =>
      enrichAppointmentForUi(a, currentUserId, contacts)
    );
  }, [appointments, contacts, currentUserId, selectedDate]);

  return (
    <>
      <div className="bg-[var(--eos-card)] border border-[var(--eos-border)] rounded-[2rem] p-5 md:p-7 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6 border-b border-[var(--eos-border)] pb-5">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-[var(--eos-text)] tracking-tighter flex items-center gap-2.5">
              <Calendar className="text-emerald-500 w-6 h-6" /> Kalendarz Prezentacji
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--eos-subtle)] mt-1">
              Podgląd rezerwacji i negocjacji
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_10px_rgba(250,204,21,0.7)]" />
              <span className="text-[9px] uppercase tracking-widest font-black text-[var(--eos-muted)]">
                Do akceptacji
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
              <span className="text-[9px] uppercase tracking-widest font-black text-[var(--eos-subtle)]">
                Twoja propozycja
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]" />
              <span className="text-[9px] uppercase tracking-widest font-black text-[var(--eos-muted)]">
                Zatwierdzone
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.6)]" />
              <span className="text-[9px] uppercase tracking-widest font-black text-[var(--eos-muted)]">
                Pozyskanie
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shiftYear(-1)}
              className="p-2 rounded-xl bg-[var(--eos-input)] border border-[var(--eos-border)] text-[var(--eos-muted)] hover:text-[var(--eos-text)] hover:border-[var(--eos-border)] transition-colors text-[10px] font-black uppercase tracking-widest"
              aria-label="Poprzedni rok"
            >
              «
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="p-2 rounded-xl bg-[var(--eos-input)] border border-[var(--eos-border)] text-[var(--eos-muted)] hover:text-[var(--eos-text)] hover:border-[var(--eos-border)] transition-colors"
              aria-label="Poprzedni miesiąc"
            >
              <ChevronLeft size={18} />
            </button>
          </div>

          <div className="text-center min-w-[160px]">
            <p className="text-sm md:text-base font-black text-[var(--eos-text)] capitalize tracking-tight">{monthLabel}</p>
            <button
              type="button"
              onClick={() => {
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
              }}
              className="mt-1 text-[9px] font-black uppercase tracking-widest text-emerald-500/90 hover:text-emerald-400"
            >
              Dziś
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="p-2 rounded-xl bg-[var(--eos-input)] border border-[var(--eos-border)] text-[var(--eos-muted)] hover:text-[var(--eos-text)] hover:border-[var(--eos-border)] transition-colors"
              aria-label="Następny miesiąc"
            >
              <ChevronRight size={18} />
            </button>
            <button
              type="button"
              onClick={() => shiftYear(1)}
              className="p-2 rounded-xl bg-[var(--eos-input)] border border-[var(--eos-border)] text-[var(--eos-muted)] hover:text-[var(--eos-text)] hover:border-[var(--eos-border)] transition-colors text-[10px] font-black uppercase tracking-widest"
              aria-label="Następny rok"
            >
              »
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((wd) => (
            <div
              key={wd}
              className="text-center text-[9px] font-black uppercase tracking-widest text-[var(--eos-subtle)] py-1"
            >
              {wd}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {gridDays.map((d) => {
            const inMonth = d.getMonth() === viewMonth;
            const isToday = isSameCalendarDay(d, today);
            const dayApps = appointmentsOnDay(appointments, d);
            const { hasAccepted, hasPendingNegotiation, hasWaitingMine, hasAcquisition } = dayIndicators(
              dayApps,
              currentUserId
            );

            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => setSelectedDate(d)}
                className={`relative min-h-[52px] sm:min-h-[58px] rounded-xl p-1.5 flex flex-col items-center justify-between border transition-all duration-200 hover:scale-[1.04] active:scale-[0.98] ${
                  isToday
                    ? 'border-emerald-500/50 bg-emerald-500/[0.08] shadow-[0_0_20px_rgba(16,185,129,0.12)]'
                    : inMonth
                      ? 'border-white/8 bg-[var(--eos-input)] hover:border-[var(--eos-border)]'
                      : 'border-[var(--eos-border)] bg-[var(--eos-input)] opacity-45'
                }`}
              >
                <span
                  className={`text-[11px] sm:text-sm font-black leading-none ${
                    isToday ? 'text-emerald-400' : inMonth ? 'text-[var(--eos-text)]' : 'text-[var(--eos-subtle)]'
                  }`}
                >
                  {d.getDate()}
                </span>
                <div className="flex gap-1 items-center justify-center min-h-[10px]">
                  {hasPendingNegotiation && (
                    <span
                      className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.75)]"
                      title="Termin do akceptacji"
                    />
                  )}
                  {hasWaitingMine && !hasPendingNegotiation && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-amber-500/90"
                      title="Oczekiwanie na kontrahenta"
                    />
                  )}
                  {hasAccepted && (
                    <span
                      className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.55)]"
                      title="Zatwierdzony termin"
                    />
                  )}
                  {hasAcquisition && (
                    <span
                      className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.55)]"
                      title="Spotkanie pozyskania"
                    />
                  )}
                  {!hasAccepted && !hasPendingNegotiation && !hasWaitingMine && !hasAcquisition && inMonth && (
                    <span className="w-1 h-1 rounded-full bg-[var(--eos-input)]" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-5 text-center text-[var(--eos-subtle)] text-[11px] leading-relaxed border-t border-[var(--eos-border)] pt-4">
          Kliknij dzień, aby zobaczyć prezentacje i negocjacje terminu. Żółta lampka mruga, gdy czeka Twoja
          akceptacja.
        </p>
      </div>

      <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6"
            onClick={() => setSelectedDate(null)}
          >
            <div className="eos-modal-backdrop absolute inset-0" />
            <motion.div
              initial={{ scale: 0.96, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="eos-themed-modal relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[var(--eos-shadow-strong)]"
            >
              <div className="p-5 md:p-7 border-b border-[var(--eos-border)] flex justify-between items-start gap-4 bg-gradient-to-r from-emerald-500/10 to-transparent">
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-[var(--eos-text)] tracking-tighter">Plan Dnia</h3>
                  <p className="text-emerald-500 font-bold uppercase tracking-widest text-[10px] mt-1">
                    {selectedDate.toLocaleDateString('pl-PL', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="p-2.5 bg-[var(--eos-input)] hover:bg-red-500/90 hover:text-[var(--eos-text)] rounded-full transition-colors text-[var(--eos-muted)] shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 md:p-7 max-h-[62vh] overflow-y-auto custom-scrollbar space-y-3">
                {selectedDayApps.length === 0 ? (
                  <p className="text-center py-12 text-[var(--eos-subtle)] font-bold uppercase tracking-widest text-xs">
                    Brak spotkań i negocjacji na ten dzień.
                  </p>
                ) : (
                  selectedDayApps.map((app) => {
                    const cp = app.counterpartyDisplay;
                    const cpName =
                      cp?.name ||
                      (cp?.email ? String(cp.email).split('@')[0] : null) ||
                      'Kontrahent';
                    const time = new Date(app.proposedDate).toLocaleTimeString('pl-PL', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={app.id}
                        className="bg-[var(--eos-input)] border border-[var(--eos-border)] rounded-2xl p-4 flex flex-col gap-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Clock size={14} className="text-emerald-500 shrink-0" />
                          <span className="font-black text-lg text-[var(--eos-text)]">{time}</span>
                          {app.needsMyResponse && (
                            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[8px] font-black uppercase tracking-widest rounded-full border border-yellow-500/35 animate-pulse">
                              Do akceptacji
                            </span>
                          )}
                          {app.waitingOnOther && (
                            <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-[8px] font-black uppercase tracking-widest rounded-full border border-amber-500/30">
                              Czekasz na odpowiedź
                            </span>
                          )}
                          {String(app.status).toUpperCase() === 'ACCEPTED' && app.type !== 'ACQUISITION' && (
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase tracking-widest rounded-full border border-emerald-500/30">
                              Zatwierdzone
                            </span>
                          )}
                          {String(app.type || '').toUpperCase() === 'ACQUISITION' && (
                            <span className="px-2 py-0.5 bg-sky-500/20 text-sky-300 text-[8px] font-black uppercase tracking-widest rounded-full border border-sky-500/30">
                              Pozyskanie
                            </span>
                          )}
                        </div>

                        <div className="flex gap-3 items-start">
                          {app.offerImageUrl ? (
                            <img
                              src={app.offerImageUrl}
                              alt=""
                              className="w-14 h-14 rounded-xl object-cover border border-[var(--eos-border)] shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-[var(--eos-input)] border border-[var(--eos-border)] flex items-center justify-center shrink-0">
                              <Building2 size={20} className="text-[var(--eos-subtle)]" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[var(--eos-text)] leading-snug truncate">
                              {app.offerTitle}
                            </p>
                            <p className="text-[11px] text-[var(--eos-subtle)] mt-0.5 line-clamp-2">
                              {app.offerAddress || 'Adres po akceptacji terminu'}
                            </p>
                            {app.offerId ? (
                              <Link
                                href={`/oferta/${app.offerId}`}
                                target="_blank"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 mt-2 text-[10px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400"
                              >
                                Oferta #{app.offerId} <ExternalLink size={10} />
                              </Link>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-1 border-t border-[var(--eos-border)]">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                              <User size={14} className="text-emerald-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] text-[var(--eos-subtle)] uppercase tracking-widest font-black">
                              {app.needsMyResponse ? 'Propozycja od' : app.type === 'ACQUISITION' ? 'Klient' : 'Kontrahent'}
                              </p>
                              <p className="text-xs font-bold text-[var(--eos-text)] truncate">{cpName}</p>
                              {cp?.email ? (
                                <p className="text-[10px] text-[var(--eos-subtle)] truncate">{cp.email}</p>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            {cp?.id && onViewProfile && app.type !== 'ACQUISITION' ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onViewProfile({
                                    id: cp.id,
                                    name: cpName,
                                    email: cp.email || undefined,
                                  });
                                }}
                                className="text-[9px] font-black uppercase tracking-widest text-yellow-500 hover:text-yellow-400"
                              >
                                Profil
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onManage(app);
                                setSelectedDate(null);
                              }}
                              className="px-4 py-2.5 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest shadow-[0_8px_20px_rgba(16,185,129,0.35)] hover:brightness-110 transition-all"
                            >
                              {app.type === 'ACQUISITION' ? 'Klient' : 'Zarządzaj'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
