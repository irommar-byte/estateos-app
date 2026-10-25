"use client";

import { useEffect, useMemo, useState } from "react";
import LuxSheet from "./LuxSheet";
import { portalAction } from "./portalApi";

type Slot = { startsAt: string; label: string; day: string };
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
      .catch((e) => setError(e instanceof Error ? e.message : "Błąd"));
  }, [open, token, initialOfferId, offers]);

  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots || []) {
      const list = map.get(slot.day) || [];
      list.push(slot);
      map.set(slot.day, list);
    }
    return [...map.entries()].slice(0, 7);
  }, [slots]);

  const submit = async () => {
    if (!picked || !offerId) return;
    setBusy(true);
    setError("");
    try {
      const json = await portalAction<{ booking: { label: string } }>(token, "request_booking", {
        offerId,
        startsAt: picked,
        note,
      });
      setDone(json.booking.label);
      onBooked();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd");
    } finally {
      setBusy(false);
    }
  };

  return (
    <LuxSheet open={open} onClose={onClose} kicker="Oglądanie" title="Wybierz termin">
      {done ? (
        <div className="rounded-2xl bg-black p-5 text-[#F6F3EE]">
          <p className="lux-serif text-[21px]">Termin wysłany</p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#BDB6AA]">
            {done}. {agentName} potwierdzi go najszybciej, jak to możliwe — dostaniesz powiadomienie.
          </p>
          <button type="button" className="lux-btn lux-btn--primary mt-4 w-full" onClick={onClose}>
            Gotowe
          </button>
        </div>
      ) : !enabled ? (
        <p className="text-[14px] leading-relaxed text-[var(--lux-ink-2)]">
          Terminy oglądań ustala {agentName}. Napisz w rozmowie, kiedy Ci pasuje — odezwie się z propozycją.
        </p>
      ) : (
        <>
          {offers.length > 1 ? (
            <div>
              <label htmlFor="booking-offer" className="text-[13px] font-bold">
                Którą ofertę chcesz obejrzeć?
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
            <p className="text-[14px] text-[var(--lux-ink-2)]">Najpierw zaznacz „Chcę obejrzeć” przy ofercie, która Cię interesuje.</p>
          )}

          <p className="mt-4 text-[13px] text-[var(--lux-ink-2)]">Wolne godziny {agentName} w najbliższych dniach:</p>
          {slots == null && !error ? <p className="mt-3 text-[14px]">Sprawdzam kalendarz…</p> : null}
          {slots && !slots.length ? (
            <p className="mt-3 text-[14px]">Brak wolnych terminów w najbliższych dniach — napisz w rozmowie.</p>
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
                      {slot.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <label htmlFor="booking-note" className="mt-5 block text-[13px] font-bold">
            Uwagi (opcjonalnie)
          </label>
          <textarea
            id="booking-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="np. przyjdę z partnerem"
            className="mt-2 w-full rounded-2xl border border-[var(--lux-line)] bg-[var(--lux-card)] p-3 text-[15px]"
          />
          {error ? <p className="mt-2 text-[13px] text-[var(--lux-danger)]">{error}</p> : null}
          <button
            type="button"
            className="lux-btn lux-btn--primary mt-4 w-full"
            disabled={!picked || !offerId || busy}
            onClick={() => void submit()}
          >
            {busy ? "Wysyłam…" : "Poproś o ten termin"}
          </button>
          <p className="mt-2 text-center text-[12px] text-[var(--lux-ink-2)]">Termin stanie się pewny, gdy agent go potwierdzi.</p>
        </>
      )}
    </LuxSheet>
  );
}
