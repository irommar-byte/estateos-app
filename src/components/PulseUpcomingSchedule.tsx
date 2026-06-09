"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, ChevronLeft, ChevronRight, DoorOpen, MapPin, Presentation } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { CrmExtendedDictionary } from "@/i18n/crmExtendedDictionary";
import {
  eventCountdownState,
  splitCountdown,
  type UpcomingScheduleEvent,
} from "@/lib/crm/upcomingScheduleShared";

const ROTATE_MS = 9_000;
const FETCH_MS = 60_000;

function localeTag(locale: Locale): string {
  if (locale === "pl") return "pl-PL";
  if (locale === "uk") return "uk-UA";
  return "en-GB";
}

function kindIcon(kind: UpcomingScheduleEvent["kind"]) {
  if (kind === "presentation") return Presentation;
  return DoorOpen;
}

function kindAccent(kind: UpcomingScheduleEvent["kind"]) {
  if (kind === "presentation") return "text-purple-500 dark:text-purple-400";
  if (kind === "open_house_host") return "text-emerald-600 dark:text-emerald-400";
  return "text-sky-600 dark:text-sky-400";
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-[44px] flex-col items-center">
      <div className="eos-pro-countdown-unit flex h-10 w-full min-w-[44px] items-center justify-center rounded-xl px-1">
        <span className="text-lg font-black tabular-nums tracking-tight text-[var(--eos-text)]">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="eos-pro-subtle mt-1 text-[7px] font-black uppercase tracking-[0.18em]">{label}</span>
    </div>
  );
}

type Props = {
  locale: Locale;
  copy: CrmExtendedDictionary["pulseSchedule"];
};

export default function PulseUpcomingSchedule({ locale, copy }: Props) {
  const [events, setEvents] = useState<UpcomingScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const dateTag = localeTag(locale);

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
  const accent = active ? kindAccent(active.kind) : "eos-pro-subtle";

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
          <CalendarClock size={14} className="eos-pro-subtle" />
          <p className="eos-pro-muted text-[8px] font-black uppercase tracking-[0.22em]">{copy.section}</p>
        </div>
        {visibleEvents.length > 1 ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shift(-1)}
              className="eos-pro-subtle rounded-full p-1 transition hover:bg-[var(--eos-input)] hover:text-[var(--eos-text)]"
              aria-label={copy.prevEvent}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="eos-pro-subtle min-w-[28px] text-center text-[8px] font-black tabular-nums">
              {index + 1}/{visibleEvents.length}
            </span>
            <button
              type="button"
              onClick={() => shift(1)}
              className="eos-pro-subtle rounded-full p-1 transition hover:bg-[var(--eos-input)] hover:text-[var(--eos-text)]"
              aria-label={copy.nextEvent}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        ) : null}
      </div>

      <div className="eos-pro-schedule-box relative min-h-[168px] flex-1 overflow-hidden rounded-2xl p-4">
        {loading && visibleEvents.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--eos-border)] border-t-emerald-500/80" />
          </div>
        ) : !active ? (
          <div className="flex h-full flex-col items-center justify-center px-2 text-center">
            <CalendarClock size={22} className="eos-pro-subtle mb-3 opacity-60" />
            <p className="eos-pro-muted text-[11px] font-bold">{copy.empty}</p>
            <p className="eos-pro-subtle mt-1 max-w-[220px] text-[9px] leading-relaxed">{copy.emptyHint}</p>
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
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]">
                  <Icon size={15} className={accent} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-[9px] font-black uppercase tracking-[0.16em] ${accent}`}>{active.title}</p>
                    {active.status === "pending" ? (
                      <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[7px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400/90">
                        {copy.pending}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-[12px] font-bold text-[var(--eos-text)]">{active.subtitle}</p>
                  {active.location ? (
                    <p className="eos-pro-subtle mt-1 flex items-center gap-1 truncate text-[9px]">
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
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
                    {copy.live}
                  </span>
                </div>
              ) : countdown?.parts ? (
                <div className="mt-auto">
                  <p className="eos-pro-subtle mb-2 text-center text-[8px] font-black uppercase tracking-[0.2em]">
                    {copy.starts}{" "}
                    {new Date(active.startsAt).toLocaleString(dateTag, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <div className="flex items-start justify-center gap-2">
                    <CountdownUnit value={countdown.parts.days} label={copy.days} />
                    <CountdownUnit value={countdown.parts.hours} label={copy.hours} />
                    <CountdownUnit value={countdown.parts.minutes} label={copy.minutes} />
                    <CountdownUnit value={countdown.parts.seconds} label={copy.seconds} />
                  </div>
                </div>
              ) : null}

              {active.href ? (
                <Link
                  href={active.href}
                  className="eos-pro-subtle mt-3 block text-center text-[8px] font-black uppercase tracking-[0.18em] transition hover:text-emerald-600 dark:hover:text-emerald-400/80"
                >
                  {copy.detailsLink}
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
                  i === index ? "w-4 bg-emerald-500/80" : "w-1 bg-[var(--eos-border)] hover:bg-[var(--eos-muted)]"
                }`}
                aria-label={`${copy.eventLabel} ${i + 1}`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
