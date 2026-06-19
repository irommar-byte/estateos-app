"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, DoorOpen, Loader2 } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { OpenHouseEventRecord, OpenHouseSlotRecord, OpenHouseVisitMode } from "@/lib/openHouseTypes";
import { getOfferPageCopy } from "@/content/offerPageCopy";
import EosModal from "@/components/ui/EosModal";

type Props = {
  isOpen: boolean;
  eventId: number | null;
  currentUser: { id?: number; email?: string } | null;
  locale: Locale;
  onClose: () => void;
  onRequireAuth: () => void;
};

function isSlotUnavailableForGuest(
  slot: OpenHouseSlotRecord,
  visitMode: OpenHouseVisitMode,
): boolean {
  if (slot.myReservation) return false;
  if (slot.isFull) return true;
  if (visitMode !== "FLEX" && slot.reservedCount > 0) return true;
  return false;
}

function isSlotMarkedTaken(slot: OpenHouseSlotRecord, visitMode: OpenHouseVisitMode): boolean {
  return slot.isFull || (visitMode !== "FLEX" && slot.reservedCount > 0);
}

function formatSlot(
  slot: OpenHouseSlotRecord,
  visitMode: OpenHouseVisitMode,
  locale: Locale,
): string {
  const fmt = locale === "pl" ? "pl-PL" : "en-GB";
  const start = new Date(slot.startsAt);
  const end = new Date(slot.endsAt);
  const durationMs = end.getTime() - start.getTime();
  if (visitMode !== "FLEX" && durationMs <= 65 * 60 * 1000) {
    const day = start.toLocaleDateString(fmt, { weekday: "short", day: "numeric", month: "short" });
    const t1 = start.toLocaleTimeString(fmt, { hour: "2-digit", minute: "2-digit" });
    const t2 = end.toLocaleTimeString(fmt, { hour: "2-digit", minute: "2-digit" });
    return `${day} · ${t1} – ${t2}`;
  }
  return `${start.toLocaleString(fmt, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })} – ${end.toLocaleTimeString(fmt, { hour: "2-digit", minute: "2-digit" })}`;
}

function formatSlotChip(slot: OpenHouseSlotRecord, locale: Locale): string {
  return new Date(slot.startsAt).toLocaleTimeString(locale === "pl" ? "pl-PL" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OpenHouseReserveModal({
  isOpen,
  eventId,
  currentUser,
  locale,
  onClose,
  onRequireAuth,
}: Props) {
  const t = getOfferPageCopy(locale);
  const oh = t.openHouse;
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [event, setEvent] = useState<OpenHouseEventRecord | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [guestCount, setGuestCount] = useState(1);
  const [note, setNote] = useState("");
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    if (!eventId) {
      setEvent(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/open-house/events/${eventId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.event) {
        setEvent(null);
        return;
      }
      const ev = data.event as OpenHouseEventRecord;
      setEvent(ev);
      const booked = ev.slots.find((s) => s.myReservation);
      if (booked) setSelectedSlotId(booked.id);
      else if (ev.visitMode === "FLEX" && ev.slots.length === 1) setSelectedSlotId(ev.slots[0].id);
      else setSelectedSlotId(null);
    } catch {
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (isOpen) {
      setSuccess(false);
      void load();
    }
  }, [isOpen, load]);

  const selectedSlot = useMemo(() => {
    if (!event || !selectedSlotId) return null;
    return event.slots.find((s) => s.id === selectedSlotId) ?? null;
  }, [event, selectedSlotId]);

  const maxGuests = Math.min(5, selectedSlot?.capacity ?? 5);
  const guestOptions = useMemo(
    () => Array.from({ length: maxGuests }, (_, i) => i + 1),
    [maxGuests],
  );

  useEffect(() => {
    if (guestCount > maxGuests) setGuestCount(maxGuests);
  }, [maxGuests, guestCount]);

  const reserve = async () => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    if (!selectedSlotId) {
      alert(oh.pickSlotRequired);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/open-house/slots/${selectedSlotId}/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestCount, note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data?.event) {
        alert(data?.message || oh.errorGeneric);
        return;
      }
      setEvent(data.event);
      setSuccess(true);
    } catch {
      alert(oh.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  const cancelMyReservation = async (reservationId: number) => {
    if (!currentUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/open-house/reservations/${reservationId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data?.event) {
        alert(data?.message || oh.errorGeneric);
        return;
      }
      setEvent(data.event);
      setSuccess(false);
    } catch {
      alert(oh.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  const isTimedBooking = event?.visitMode !== "FLEX";
  const upcomingSlots =
    event?.slots.filter((s) => new Date(s.endsAt).getTime() > Date.now()) ?? [];
  const myReservation = selectedSlot?.myReservation;

  const body = loading ? (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
    </div>
  ) : !event ? (
    <div className="py-12 text-center">
      <p className="text-[17px] font-semibold text-[var(--eos-text)]">{oh.loadError}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--eos-muted)]">{oh.loadErrorHint}</p>
    </div>
  ) : success ? (
    <div className="flex flex-col items-center py-10 text-center">
      <CheckCircle2 className="mb-5 h-16 w-16 text-emerald-500" />
      <p className="text-[17px] font-semibold text-[var(--eos-text)]">{oh.reserveSuccess}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--eos-muted)]">{oh.reserveSuccessHint}</p>
      <button
        type="button"
        onClick={onClose}
        className="eos-primary-cta mt-8 max-w-xs bg-[var(--eos-text)] text-[var(--eos-bg)]"
      >
        {oh.close}
      </button>
    </div>
  ) : (
    <div className="space-y-5">
      <div className="eos-stat-card">
        <p className="text-[15px] font-semibold text-[var(--eos-text)]">{event.title}</p>
        <p className="mt-1 text-[13px] text-[var(--eos-muted)]">
          {event.offer.city} · {event.offer.district}
        </p>
        {event.description ? (
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--eos-muted)]">{event.description}</p>
        ) : null}
      </div>

      <div>
        <p className="eos-field-label">
          {isTimedBooking ? oh.pickHourSection : oh.slotsSection}
        </p>
        {isTimedBooking ? (
          <p className="mb-3 text-[12px] leading-relaxed text-[var(--eos-muted)]">{oh.pickHourHint}</p>
        ) : event.visitMode === "FLEX" && event.slots.length === 1 ? (
          <p className="mb-3 text-[12px] leading-relaxed text-[var(--eos-muted)]">{oh.flexWindowHint}</p>
        ) : null}

                    {isTimedBooking ? (
                      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                        {upcomingSlots.map((slot) => {
                          const selected = slot.id === selectedSlotId;
                          const booked = Boolean(slot.myReservation);
                          const taken = isSlotUnavailableForGuest(slot, event.visitMode);
                          const markedTaken = isSlotMarkedTaken(slot, event.visitMode);
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              disabled={taken}
                              onClick={() => setSelectedSlotId(slot.id)}
                              className={`min-w-[5.5rem] shrink-0 rounded-xl border px-3 py-3 text-left transition ${
                                selected
                                  ? "border-amber-500/50 bg-amber-500/12"
                                  : markedTaken
                                    ? "border-[var(--eos-border)] bg-[var(--eos-input)] opacity-60"
                                    : "border-[var(--eos-border)] bg-[var(--eos-input)] hover:border-amber-500/30"
                              }`}
                            >
                              <p className="text-[14px] font-semibold text-[var(--eos-text)]">{formatSlotChip(slot, locale)}</p>
                              <p className="mt-1 text-[11px] text-[var(--eos-muted)]">
                                {booked
                                  ? oh.reservedCta
                                  : markedTaken
                                    ? oh.slotTaken
                                    : oh.spotsLeft(slot.spotsLeft)}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {event.slots.map((slot) => {
                          const selected = slot.id === selectedSlotId;
                          const booked = Boolean(slot.myReservation);
                          const taken = isSlotUnavailableForGuest(slot, event.visitMode);
                          const markedTaken = isSlotMarkedTaken(slot, event.visitMode);
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              disabled={taken}
                              onClick={() => setSelectedSlotId(slot.id)}
                              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                                selected
                                  ? "border-amber-500/50 bg-amber-500/10"
                                  : markedTaken
                                    ? "border-[var(--eos-border)] bg-[var(--eos-input)] opacity-60"
                                    : "border-[var(--eos-border)] bg-[var(--eos-input)] hover:border-amber-500/30"
                              }`}
                            >
                              <div>
                                <p className="text-[14px] font-semibold text-[var(--eos-text)]">
                                  {formatSlot(slot, event.visitMode, locale)}
                                </p>
                                <p className="mt-0.5 text-[12px] text-[var(--eos-muted)]">
                                  {booked
                                    ? oh.reservedCta
                                    : markedTaken
                                      ? oh.slotTaken
                                      : oh.spotsLeft(slot.spotsLeft)}
                                </p>
                              </div>
                              {booked ? (
                                <span className="text-[12px] font-semibold text-emerald-600">
                                  {oh.reservedCta}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

      {selectedSlot && !myReservation ? (
        <div className="space-y-4 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]/50 p-4">
          <div>
            <label className="eos-field-label">{oh.guestCount}</label>
            <div className="flex flex-wrap gap-2">
              {guestOptions.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setGuestCount(n)}
                  className={`rounded-xl border px-4 py-2 text-[14px] font-semibold ${
                    guestCount === n
                      ? "border-amber-500/50 bg-amber-500/12 text-amber-600"
                      : "border-[var(--eos-border)] text-[var(--eos-text)]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="eos-field-label">{oh.note}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-[14px] text-[var(--eos-text)] outline-none focus:border-amber-500/45"
              placeholder={oh.notePlaceholder}
            />
          </div>
        </div>
      ) : null}

      {myReservation ? (
        <button
          type="button"
          disabled={submitting}
          onClick={() => void cancelMyReservation(myReservation.id)}
          className="w-full rounded-2xl border border-[var(--eos-border)] py-3.5 text-[15px] font-semibold text-[var(--eos-muted)] transition hover:bg-[var(--eos-input)]"
        >
          {oh.cancelReservation}
        </button>
      ) : (
        <button
          type="button"
          disabled={submitting || !selectedSlotId}
          onClick={() => void reserve()}
          className="eos-primary-cta bg-amber-500 hover:bg-amber-400"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {oh.reserveCta}
        </button>
      )}

      {!currentUser ? (
        <p className="text-center text-[12px] text-[var(--eos-muted)]">{oh.loginRequired}</p>
      ) : null}
    </div>
  );

  return (
    <EosModal
      open={isOpen}
      onClose={onClose}
      title={oh.modalTitle}
      subtitle={oh.modalSubtitle}
      icon={<DoorOpen size={20} />}
      iconWrapClassName="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10 text-amber-500 shadow-[0_8px_24px_rgba(245,158,11,0.14)]"
      maxWidth="max-w-lg"
    >
      {body}
    </EosModal>
  );
}
