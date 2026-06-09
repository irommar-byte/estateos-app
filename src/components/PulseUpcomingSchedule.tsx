"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, ChevronLeft, ChevronRight, DoorOpen, MapPin, Presentation } from "lucide-react";
import {
  eventCountdownState,
  splitCountdown,
  type UpcomingScheduleEvent,
} from "@/lib/crm/upcomingScheduleShared";

const ROTATE_MS = 9_000;
const FETCH_MS = 60_000;

function kindIcon(kind: UpcomingScheduleEvent["kind"]) {
  if (kind === "presentation") return Presentation;
  return DoorOpen;
}

function kindAccent(kind: UpcomingScheduleEvent["kind"]) {
  if (kind === "presentation") return "text-purple-400";
  if (kind === "open_house_host") return "text-emerald-400";
  return "text-sky-400";
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-[44px] flex-col items-center">
      <div className="flex h-10 w-full min-w-[44px] items-center justify-center rounded-xl border border-white/10 bg-black/60 px-1 shadow-[inset_0_2px_8px_rgba(0,0,0,0.9)]">
        <span className="text-lg font-black tabular-nums tracking-tight text-white/95">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="mt-1 text-[7px] font-black uppercase tracking-[0.18em] text-white/30">{label}</span>
    </div>
  );
}

export default function PulseUpcomingSchedule({ locale }: { locale: string }) {
  const isPl = locale !== "en";
  const [events, setEvents] = useState<UpcomingScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const labels = useMemo(
    () => ({
      section: isPl ? "Twój harmonogram" : "Your schedule",
      empty: isPl ? "Brak zaplanowanych wydarzeń" : "No scheduled events",
      emptyHint: isPl ? "Prezentacje i dni otwarte pojawią się tutaj." : "Presentations and open houses will appear here.",
      live: isPl ? "Trwa teraz" : "Live now",
      pending: isPl ? "Oczekuje" : "Pending",
      days: isPl ? "Dni" : "Days",
      hours: isPl ? "Godz" : "Hrs",
      minutes: isPl ? "Min" : "Min",
      seconds: isPl ? "Sek" : "Sec",
      starts: isPl ? "Start" : "Starts",
    }),
    [isPl]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/pro-widget/schedule", { cache: "no-store", credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.events)) {
        setEvents(data.events);
        setIndex(0);
      }
    } catch {
      /* keep last stable state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load(), FETCH_MS);
    return () => window.clearInterval(poll);
  }, [load]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const visibleEvents = useMemo(
    () =>
      events.filter((ev) => {
        const state = eventCountdownState(ev, now);
        return state !== "ended";
      }),
    [events, now]
  );

  useEffect(() => {
    if (visibleEvents.length < 2) return;
    const t = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % visibleEvents.length);
    }, ROTATE_MS);
    return () => window.clearInterval(t);
  }, [visibleEvents.length]);

  useEffect(() => {
    if (index >= visibleEvents.length) setIndex(0);
  }, [index, visibleEvents.length]);

  const active = visibleEvents[index] ?? null;
  const Icon = active ? kindIcon(active.kind) : CalendarClock;
  const accent = active ? kindAccent(active.kind) : "text-white/40";

  const countdown = useMemo(() => {
    if (!active) return null;
    const state = eventCountdownState(active, now);
    if (state === "live") return { state, parts: null as null };
    const target = new Date(active.startsAt).getTime();
    return { state, parts: splitCountdown(Math.max(0, target - now)) };
  }, [active, now]);

  const shift = (delta: number) => {
    if (visibleEvents.length < 2) return;
    setIndex((prev) => (prev + delta + visibleEvents.length) % visibleEvents.length);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock size={14} className="text-white/35" />
          <p className="text-[8px] font-black uppercase tracking-[0.22em] text-white/40">{labels.section}</p>
        </div>
        {visibleEvents.length > 1 ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shift(-1)}
              className="rounded-full p-1 text-white/30 transition hover:bg-white/5 hover:text-white/70"
              aria-label={isPl ? "Poprzednie wydarzenie" : "Previous event"}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="min-w-[28px] text-center text-[8px] font-black tabular-nums text-white/35">
              {index + 1}/{visibleEvents.length}
            </span>
            <button
              type="button"
              onClick={() => shift(1)}
              className="rounded-full p-1 text-white/30 transition hover:bg-white/5 hover:text-white/70"
              aria-label={isPl ? "Następne wydarzenie" : "Next event"}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        ) : null}
      </div>

      <div className="relative min-h-[168px] flex-1 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#060606] p-4 shadow-[inset_0_4px_24px_rgba(0,0,0,0.85)]">
        {loading && visibleEvents.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-emerald-500/80" />
          </div>
        ) : !active ? (
          <div className="flex h-full flex-col items-center justify-center px-2 text-center">
            <CalendarClock size={22} className="mb-3 text-white/15" />
            <p className="text-[11px] font-bold text-white/45">{labels.empty}</p>
            <p className="mt-1 max-w-[220px] text-[9px] leading-relaxed text-white/25">{labels.emptyHint}</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="flex h-full flex-col"
            >
              <div className="mb-3 flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/50">
                  <Icon size={15} className={accent} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-[9px] font-black uppercase tracking-[0.16em] ${accent}`}>{active.title}</p>
                    {active.status === "pending" ? (
                      <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[7px] font-black uppercase tracking-wider text-amber-400/90">
                        {labels.pending}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-[12px] font-bold text-white/85">{active.subtitle}</p>
                  {active.location ? (
                    <p className="mt-1 flex items-center gap-1 truncate text-[9px] text-white/35">
                      <MapPin size={10} className="shrink-0" />
                      {active.location}
                    </p>
                  ) : null}
                </div>
              </div>

              {countdown?.state === "live" ? (
                <div className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 py-3">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-400">
                    {labels.live}
                  </span>
                </div>
              ) : countdown?.parts ? (
                <div className="mt-auto">
                  <p className="mb-2 text-center text-[8px] font-black uppercase tracking-[0.2em] text-white/25">
                    {labels.starts}{" "}
                    {new Date(active.startsAt).toLocaleString(isPl ? "pl-PL" : "en-GB", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <div className="flex items-start justify-center gap-2">
                    <CountdownUnit value={countdown.parts.days} label={labels.days} />
                    <CountdownUnit value={countdown.parts.hours} label={labels.hours} />
                    <CountdownUnit value={countdown.parts.minutes} label={labels.minutes} />
                    <CountdownUnit value={countdown.parts.seconds} label={labels.seconds} />
                  </div>
                </div>
              ) : null}

              {active.href ? (
                <Link
                  href={active.href}
                  className="mt-3 block text-center text-[8px] font-black uppercase tracking-[0.18em] text-white/30 transition hover:text-emerald-400/80"
                >
                  {isPl ? "Szczegóły →" : "Details →"}
                </Link>
              ) : null}
            </motion.div>
          </AnimatePresence>
        )}

        {visibleEvents.length > 1 ? (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {visibleEvents.map((ev, i) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-1 rounded-full transition-all ${
                  i === index ? "w-4 bg-emerald-500/80" : "w-1 bg-white/15 hover:bg-white/30"
                }`}
                aria-label={`${isPl ? "Wydarzenie" : "Event"} ${i + 1}`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
