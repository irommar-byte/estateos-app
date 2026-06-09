"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, DoorOpen, Loader2, X } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { OpenHouseEventRecord, OpenHouseSlotRecord, OpenHouseVisitMode } from "@/lib/openHouseTypes";
import { getOfferPageCopy } from "@/content/offerPageCopy";

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
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [event, setEvent] = useState<OpenHouseEventRecord | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [guestCount, setGuestCount] = useState(1);
  const [note, setNote] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => setMounted(true), []);

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

  if (!mounted) return null;

  const isTimedBooking = event?.visitMode !== "FLEX";
  const upcomingSlots =
    event?.slots.filter((s) => new Date(s.endsAt).getTime() > Date.now()) ?? [];
  const myReservation = selectedSlot?.myReservation;

  const modalContent = (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-[999999] flex items-start justify-center overflow-y-auto p-4 pb-10 pt-10 sm:pt-16">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            onClick={(e) => e.stopPropagation()}
            className="relative my-auto flex max-h-[90vh] w-full max-w-lg shrink-0 flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0a0a] shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/5 bg-[#050505] px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                  <DoorOpen size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-white">{oh.modalTitle}</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{oh.modalSubtitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white/50 transition hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-5">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
                </div>
              ) : !event ? (
                <div className="py-12 text-center">
                  <p className="text-lg font-bold text-white">{oh.loadError}</p>
                  <p className="mt-2 text-sm text-white/45">{oh.loadErrorHint}</p>
                </div>
              ) : success ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <CheckCircle2 className="mb-5 h-16 w-16 text-emerald-500" />
                  <p className="text-2xl font-black text-white">{oh.reserveSuccess}</p>
                  <p className="mt-2 text-sm text-white/45">{oh.reserveSuccessHint}</p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-8 rounded-2xl bg-white px-6 py-3 text-xs font-black uppercase tracking-widest text-black"
                  >
                    {oh.close}
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-base font-semibold text-white">{event.title}</p>
                    <p className="mt-1 text-sm text-white/50">
                      {event.offer.city} · {event.offer.district}
                    </p>
                    {event.description ? (
                      <p className="mt-3 text-sm leading-relaxed text-white/55">{event.description}</p>
                    ) : null}
                  </div>

                  <div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/40">
                      {isTimedBooking ? oh.pickHourSection : oh.slotsSection}
                    </p>
                    {isTimedBooking ? (
                      <p className="mb-3 text-xs leading-relaxed text-white/45">{oh.pickHourHint}</p>
                    ) : event.visitMode === "FLEX" && event.slots.length === 1 ? (
                      <p className="mb-3 text-xs leading-relaxed text-white/45">{oh.flexWindowHint}</p>
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
                                  ? "border-amber-500 bg-amber-500/15"
                                  : markedTaken
                                    ? "border-white/10 bg-white/[0.03] opacity-70"
                                    : "border-white/10 bg-white/[0.03] hover:border-white/20"
                              }`}
                            >
                              <p className="text-sm font-black text-white">{formatSlotChip(slot, locale)}</p>
                              <p className="mt-1 text-[11px] text-white/45">
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
                                  ? "border-amber-500 bg-amber-500/10"
                                  : markedTaken
                                    ? "border-white/10 bg-white/[0.03] opacity-75"
                                    : "border-white/10 bg-white/[0.03] hover:border-white/20"
                              }`}
                            >
                              <div>
                                <p className="text-sm font-semibold text-white">
                                  {formatSlot(slot, event.visitMode, locale)}
                                </p>
                                <p className="mt-0.5 text-xs text-white/45">
                                  {booked
                                    ? oh.reservedCta
                                    : markedTaken
                                      ? oh.slotTaken
                                      : oh.spotsLeft(slot.spotsLeft)}
                                </p>
                              </div>
                              {booked ? (
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
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
                    <div className="space-y-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                      <div>
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-white/40">
                          {oh.guestCount}
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {guestOptions.map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setGuestCount(n)}
                              className={`rounded-xl border px-4 py-2 text-sm font-bold ${
                                guestCount === n
                                  ? "border-amber-500 bg-amber-500/15 text-amber-300"
                                  : "border-white/10 text-white/80"
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-white/40">
                          {oh.note}
                        </label>
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          rows={3}
                          className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-amber-500/50"
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
                      className="w-full rounded-2xl border border-white/10 py-4 text-xs font-black uppercase tracking-widest text-white/70"
                    >
                      {oh.cancelReservation}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={submitting || !selectedSlotId}
                      onClick={() => void reserve()}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-4 text-xs font-black uppercase tracking-widest text-white shadow-[0_0_30px_rgba(245,158,11,0.25)] transition hover:bg-amber-400 disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {oh.reserveCta}
                    </button>
                  )}

                  {!currentUser ? (
                    <p className="text-center text-xs text-white/40">{oh.loginRequired}</p>
                  ) : null}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
