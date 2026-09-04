"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, CalendarPlus, CheckCircle2, Clock3, MapPin } from "lucide-react";
import ClientPortalScheduleActions from "@/components/portal/ClientPortalScheduleActions";
import { formatMeetingWhenPl } from "@/lib/datetime/warsaw";
import { buildCalendarIcs, downloadIcsFile, googleCalendarUrl, outlookCalendarUrl } from "@/lib/crm/calendarLinks";
import { eventCountdownState, splitCountdown } from "@/lib/crm/upcomingScheduleShared";

export type PortalPresentationOffer = {
  id: number;
  title: string;
  price?: number | string | null;
  city?: string | null;
  district?: string | null;
  street?: string | null;
  area?: number | null;
  rooms?: number | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
};

export type PortalPresentationSlot = {
  startsAt: string;
  location: string | null;
  notes: string | null;
  status: "confirmed" | "pending";
  proposedBy: "agent" | "client";
  reason: string | null;
  previousStartsAt: string | null;
  offer?: PortalPresentationOffer | null;
};

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-[52px] flex-col items-center">
      <div className="eos-pro-countdown-unit flex h-12 w-full items-center justify-center rounded-xl px-1">
        <span className="text-xl font-black tabular-nums tracking-tight text-[var(--eos-text)]">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="mt-1 text-[8px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">{label}</span>
    </div>
  );
}

export default function ClientPortalPresentationHero({
  token,
  clientType,
  slot,
  agentName,
  onDone,
}: {
  token: string;
  clientType: "BUYER" | "SELLER";
  slot: PortalPresentationSlot;
  agentName: string;
  onDone: () => Promise<void> | void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [expanded, setExpanded] = useState(false);
  const confirmed = slot.status === "confirmed";
  const offer = slot.offer || null;
  const photos = (offer?.imageUrls?.length ? offer.imageUrls : offer?.imageUrl ? [offer.imageUrl] : []).filter(Boolean);
  const location =
    slot.location ||
    [offer?.street, offer?.district, offer?.city].filter(Boolean).join(", ") ||
    null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const startsAt = useMemo(() => new Date(slot.startsAt), [slot.startsAt]);
  const countdown = useMemo(() => {
    const state = eventCountdownState({ startsAt: slot.startsAt, endsAt: null }, now);
    return { state, parts: splitCountdown(Math.max(0, startsAt.getTime() - now)) };
  }, [now, slot.startsAt, startsAt]);

  const calendarTitle =
    clientType === "SELLER" ? "Pokaz mieszkania kupującemu" : "Prezentacja nieruchomości";
  const calendarDescription = [offer?.title, agentName, "EstateOS"].filter(Boolean).join(" · ");

  const addToDevice = () => {
    downloadIcsFile(
      "prezentacja.ics",
      buildCalendarIcs({
        title: `${calendarTitle}${offer?.title ? ` · ${offer.title}` : ""}`,
        startsAt,
        location,
        description: calendarDescription,
        uid: `portal-presentation-${token}@estateos.pl`,
      }),
    );
  };

  return (
    <section
      className={`rounded-[1.75rem] border p-5 sm:p-6 ${
        confirmed
          ? "border-emerald-400/55 bg-gradient-to-br from-emerald-500/14 via-[var(--eos-card)] to-[var(--eos-card)] shadow-[0_18px_50px_rgba(16,185,129,0.18)]"
          : "border-amber-400/55 bg-gradient-to-br from-amber-400/16 via-[var(--eos-card)] to-[var(--eos-card)] shadow-[0_18px_50px_rgba(245,158,11,0.16)]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
            confirmed ? "bg-emerald-500 text-black" : "bg-amber-500 text-black"
          }`}
        >
          {confirmed ? <CheckCircle2 className="size-3.5" /> : <Clock3 className="size-3.5" />}
          {confirmed ? "Prezentacja potwierdzona" : "Prezentacja przyszła"}
        </span>
        <span className="text-[11px] font-semibold text-[var(--eos-muted)]">
          {confirmed ? "Termin jest przypieczętowany" : "Potwierdź albo zaproponuj inną godzinę"}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <p className="eos-portal-label eos-portal-label--ok">
            {clientType === "SELLER" ? "Pokaz mieszkania kupującemu" : "Twoja prezentacja"}
          </p>
          <h2 className="mt-1 text-2xl font-black leading-tight text-[var(--eos-text)] sm:text-3xl">
            {formatMeetingWhenPl(slot.startsAt)}
          </h2>
          {location ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-[var(--eos-muted)]">
              <MapPin className="size-4 shrink-0" />
              {location}
            </p>
          ) : null}
          {clientType === "SELLER" ? (
            <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">
              To oglądanie z kupującym — nie spotkanie z agentem. Potwierdzenie idzie też do drugiej strony.
            </p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">
              {confirmed
                ? "Nic więcej nie musisz teraz robić. Termin jest u Ciebie, u agenta w CRM i w e-mailu z plikiem kalendarza."
                : "To Twój następny krok. Najpierw potwierdź ten termin albo zaproponuj inną godzinę."}
            </p>
          )}
        </div>

        {confirmed ? (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/8 px-4 py-3">
            {countdown.state === "live" ? (
              <p className="text-center text-sm font-black uppercase tracking-[0.14em] text-emerald-700">Trwa teraz</p>
            ) : countdown.state === "ended" ? (
              <p className="text-center text-sm font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">
                Termin minął
              </p>
            ) : (
              <div className="flex items-end justify-center gap-2">
                {countdown.parts.days > 0 ? <CountdownUnit value={countdown.parts.days} label="Dni" /> : null}
                <CountdownUnit value={countdown.parts.hours} label="Godz" />
                <CountdownUnit value={countdown.parts.minutes} label="Min" />
                <CountdownUnit value={countdown.parts.seconds} label="Sek" />
              </div>
            )}
          </div>
        ) : null}
      </div>

      {offer ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg)]/70 p-3 text-left"
        >
          {photos[0] ? (
            <img src={photos[0]} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
          ) : (
            <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-700">
              <CalendarCheck2 className="size-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-[var(--eos-text)]">{offer.title}</p>
            <p className="mt-0.5 text-[11px] text-[var(--eos-muted)]">
              #{offer.id}
              {offer.city ? ` · ${offer.city}` : ""}
              {offer.area ? ` · ${offer.area} m²` : ""}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              {expanded ? "Zwiń podgląd" : "Rozwiń podgląd oferty"}
            </p>
          </div>
        </button>
      ) : null}

      {expanded && photos.length > 1 ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {photos.slice(1, 4).map((url) => (
            <img key={url} src={url} alt="" className="h-20 w-full rounded-xl object-cover" />
          ))}
        </div>
      ) : null}

      {slot.status === "pending" && slot.reason ? (
        <p className="mt-3 text-sm text-amber-700">Prośba o zmianę: {slot.reason}</p>
      ) : null}

      {confirmed ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <a
            href={googleCalendarUrl({
              title: calendarTitle,
              startsAt,
              location,
              description: calendarDescription,
            })}
            target="_blank"
            rel="noreferrer"
            className="eos-engraved-cta eos-engraved-cta--home inline-flex items-center gap-2"
          >
            <CalendarPlus className="size-4" />
            Google Calendar
          </a>
          <a
            href={outlookCalendarUrl({
              title: calendarTitle,
              startsAt,
              location,
              description: calendarDescription,
            })}
            target="_blank"
            rel="noreferrer"
            className="eos-engraved-cta inline-flex items-center gap-2"
          >
            Outlook
          </a>
          <button type="button" onClick={addToDevice} className="eos-engraved-cta inline-flex items-center gap-2">
            Apple / .ics
          </button>
          <a href={`/api/crm/client-portal/${token}/calendar?kind=presentation`} className="eos-engraved-cta">
            Pobierz do kalendarza
          </a>
        </div>
      ) : null}

      <ClientPortalScheduleActions token={token} kind="presentation" slot={slot} onDone={onDone} />
    </section>
  );
}
