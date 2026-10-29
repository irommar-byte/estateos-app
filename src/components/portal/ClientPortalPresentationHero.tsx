"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, CalendarPlus, CheckCircle2, Clock3, MapPin } from "lucide-react";
import ClientPortalScheduleActions from "@/components/portal/ClientPortalScheduleActions";
import { usePortalLocale } from "@/components/portal/PortalLocale";
import { buildCalendarIcs, downloadIcsFile, googleCalendarUrl } from "@/lib/crm/calendarLinks";
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
  proposedSlots?: string[];
  heldAt?: string | null;
  showingKind?: string | null;
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
  const { t, dateLocale } = usePortalLocale();
  const [now, setNow] = useState(() => Date.now());
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

  const calendarTitle = clientType === "SELLER" ? t("Pokaz mieszkania kupującemu") : t("Prezentacja nieruchomości");
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
          ? "border-[var(--lux-good)]/40 bg-[var(--lux-card)] shadow-[var(--lux-shadow)]"
          : "border-[var(--lux-gold-line)] bg-[var(--lux-card)] shadow-[var(--lux-shadow)]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
            confirmed ? "bg-emerald-500 text-black" : "bg-amber-500 text-black"
          }`}
        >
          {confirmed ? <CheckCircle2 className="size-3.5" /> : <Clock3 className="size-3.5" />}
          {slot.heldAt ? t("Prezentacja odbyta") : confirmed ? t("Prezentacja potwierdzona") : t("Prezentacja do potwierdzenia")}
        </span>
        <span className="text-[11px] font-semibold text-[var(--eos-muted)]">
          {slot.heldAt || confirmed
            ? null
            : slot.showingKind === "other_agent" || slot.showingKind === "external_import"
                ? t("Wybierz godzinę — agent ustali ją z biurem wystawiającym")
                : t("Potwierdź albo zaproponuj inną godzinę")}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <p className="eos-portal-label eos-portal-label--ok">
            {clientType === "SELLER" ? t("Pokaz mieszkania kupującemu") : t("Twoja prezentacja")}
          </p>
          <h2 className="mt-1 text-2xl font-black leading-tight text-[var(--eos-text)] sm:text-3xl">
            {startsAt.toLocaleString(dateLocale, {
              timeZone: "Europe/Warsaw",
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </h2>
          {location ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-[var(--eos-muted)]">
              <MapPin className="size-4 shrink-0" />
              {location}
            </p>
          ) : null}
          {clientType === "SELLER" ? (
            <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">
              {t("To oglądanie z kupującym — potwierdzenie trafia też do drugiej strony.")}
            </p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">
              {confirmed
                ? t("Nic więcej nie musisz robić — termin masz też w e-mailu z plikiem kalendarza.")
                : t("Potwierdź termin albo zaproponuj inną godzinę.")}
            </p>
          )}
        </div>

        {confirmed ? (
          <div className="rounded-2xl border border-[var(--lux-line)] bg-[var(--lux-well)] px-4 py-3">
            {countdown.state === "live" ? (
              <p className="text-center text-sm font-black uppercase tracking-[0.14em] text-[var(--lux-good)]">{t("Trwa teraz")}</p>
            ) : countdown.state === "ended" ? (
              <p className="text-center text-sm font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">
                {t("Termin minął")}
              </p>
            ) : (
              <div className="flex items-end justify-center gap-2">
                {countdown.parts.days > 0 ? <CountdownUnit value={countdown.parts.days} label={t("Dni")} /> : null}
                <CountdownUnit value={countdown.parts.hours} label={t("Godz")} />
                <CountdownUnit value={countdown.parts.minutes} label={t("Min")} />
                <CountdownUnit value={countdown.parts.seconds} label={t("Sek")} />
              </div>
            )}
          </div>
        ) : null}
      </div>

      {offer ? (
        <a
          href={`/oferta/${offer.id}`}
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg)]/70 p-3 text-left transition hover:border-[var(--lux-gold-line)]"
        >
          {photos[0] ? (
            <img src={photos[0]} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
          ) : (
            <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-[var(--lux-well)] text-[var(--lux-gold-ink)]">
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
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[var(--lux-accent)]">
              {t("Otwórz ofertę")}
            </p>
          </div>
        </a>
      ) : null}

      {slot.status === "pending" && slot.reason ? (
        <p className="mt-3 text-sm text-[var(--lux-warn)]">{t("Prośba o zmianę:")} {slot.reason}</p>
      ) : null}

      {confirmed ? (
        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={addToDevice}
            className="eos-engraved-cta eos-engraved-cta--home inline-flex w-full items-center justify-center gap-2"
          >
            <CalendarPlus className="size-4" />
            {t("Dodaj do kalendarza")}
          </button>
          <p className="text-center text-[11px] text-[var(--eos-muted)]">
            {t("Apple, Outlook")} ·{" "}
            <a
              href={googleCalendarUrl({
                title: calendarTitle,
                startsAt,
                location,
                description: calendarDescription,
              })}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[var(--lux-accent)] underline-offset-2 hover:underline"
            >
              Google Calendar
            </a>
          </p>
        </div>
      ) : null}

      <ClientPortalScheduleActions token={token} kind="presentation" slot={slot} onDone={onDone} />
    </section>
  );
}
