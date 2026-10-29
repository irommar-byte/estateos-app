"use client";

import { useEffect, useMemo, useState } from "react";
import LuxSheet from "./LuxSheet";
import { portalAction } from "./portalApi";
import { usePortalLocale } from "@/components/portal/PortalLocale";

type Slot = { startsAt: string };
export type BookingOffer = { offerId: number; title: string };

/** Samodzielne umawianie: klient wybiera wolny termin agenta, agent go zatwierdza. */
export default function PortalBookingSheet({
  open,
  onClose,
  token,
  offers,
  initialOfferId,
  agentName,
  onBooked,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  offers: BookingOffer[];
  initialOfferId?: number | null;
  agentName: string;
  onBooked: () => void;
}) {
  const { t, dateLocale } = usePortalLocale();
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [offerId, setOfferId] = useState<number>(initialOfferId || offers[0]?.offerId || 0);
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDone(null);
    setError("");
    setPicked(null);
    setOfferId(initialOfferId || offers[0]?.offerId || 0);
    setSlots(null);
    portalAction<{ enabled: boolean; slots: Slot[] }>(token, "list_free_slots")
      .then((json) => {
        setEnabled(json.enabled !== false);
        setSlots(json.slots || []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : t("Błąd")));
  }, [open, token, initialOfferId, offers, t]);

  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots || []) {
      const day = new Date(slot.startsAt).toLocaleDateString(dateLocale, {
        timeZone: "Europe/Warsaw",
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      const list = map.get(day) || [];
      list.push(slot);
      map.set(day, list);
    }
    return [...map.entries()].slice(0, 7);
  }, [slots, dateLocale]);
  const timeLabel = (iso: string) =>
    new Date(iso).toLocaleTimeString(dateLocale, { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit" });

  const submit = async () => {
    if (!picked || !offerId) return;
    setBusy(true);
    setError("");
    try {
      await portalAction(token, "request_booking", { offerId, startsAt: picked, note });
      setDone(
        new Date(picked).toLocaleString(dateLocale, {
          timeZone: "Europe/Warsaw",
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      onBooked();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Błąd"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <LuxSheet open={open} onClose={onClose} kicker={t("Oglądanie")} title={t("Wybierz termin")}>
      {done ? (
        <div className="rounded-2xl bg-black p-5 text-[#F6F3EE]">
          <p className="lux-serif text-[21px]">{t("Termin wysłany")}</p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#BDB6AA]">
            {done}. {t("{agent} potwierdzi go najszybciej, jak to możliwe — dostaniesz powiadomienie.", { agent: agentName })}
          </p>
          <button type="button" className="lux-btn lux-btn--primary mt-4 w-full" onClick={onClose}>
            {t("Gotowe")}
          </button>
        </div>
      ) : !enabled ? (
        <p className="text-[14px] leading-relaxed text-[var(--lux-ink-2)]">
          {t("Terminy oglądań ustala {agent}. Napisz w rozmowie, kiedy Ci pasuje — odezwie się z propozycją.", { agent: agentName })}
        </p>
      ) : (
        <>
          {offers.length > 1 ? (
            <div>
              <label htmlFor="booking-offer" className="text-[13px] font-bold">
                {t("Którą ofertę chcesz obejrzeć?")}
              </label>
              <select
                id="booking-offer"
                value={offerId}
                onChange={(e) => setOfferId(Number(e.target.value))}
                className="mt-2 h-12 w-full rounded-2xl border border-[var(--lux-line)] bg-[var(--lux-card)] px-3 text-[15px]"
              >
                {offers.map((o) => (
                  <option key={o.offerId} value={o.offerId}>
                    {o.title}
                  </option>
                ))}
              </select>
            </div>
          ) : offers[0] ? (
            <p className="text-[14px] font-semibold">{offers[0].title}</p>
          ) : (
            <p className="text-[14px] text-[var(--lux-ink-2)]">{t("Najpierw zaznacz „Chcę oglądać” przy ofercie, która Cię interesuje.")}</p>
          )}

          <p className="mt-4 text-[13px] text-[var(--lux-ink-2)]">{t("Wolne godziny w najbliższych dniach:")}</p>
          {slots == null && !error ? <p className="mt-3 text-[14px]">{t("Sprawdzam kalendarz…")}</p> : null}
          {slots && !slots.length ? (
            <p className="mt-3 text-[14px]">{t("Brak wolnych terminów w najbliższych dniach — napisz w rozmowie.")}</p>
          ) : null}
          <div className="mt-3 space-y-4">
            {byDay.map(([day, list]) => (
              <div key={day}>
                <p className="text-[13px] font-bold capitalize">{day}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {list.map((slot) => (
                    <button
                      key={slot.startsAt}
                      type="button"
                      onClick={() => setPicked(slot.startsAt)}
                      className={`lux-chip min-w-[72px] justify-center ${picked === slot.startsAt ? "lux-chip--on" : ""}`}
                      aria-pressed={picked === slot.startsAt}
                    >
                      {timeLabel(slot.startsAt)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <label htmlFor="booking-note" className="mt-5 block text-[13px] font-bold">
            {t("Uwagi (opcjonalnie)")}
          </label>
          <textarea
            id="booking-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={t("np. przyjdę z partnerem")}
            className="mt-2 w-full rounded-2xl border border-[var(--lux-line)] bg-[var(--lux-card)] p-3 text-[15px]"
          />
          {error ? <p className="mt-2 text-[13px] text-[var(--lux-danger)]">{error}</p> : null}
          <button
            type="button"
            className="lux-btn lux-btn--primary mt-4 w-full"
            disabled={!picked || !offerId || busy}
            onClick={() => void submit()}
          >
            {busy ? t("Wysyłam…") : t("Poproś o ten termin")}
          </button>
          <p className="mt-2 text-center text-[12px] text-[var(--lux-ink-2)]">{t("Termin stanie się pewny, gdy agent go potwierdzi.")}</p>
        </>
      )}
    </LuxSheet>
  );
}
