"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, DoorOpen, ExternalLink, Loader2, X } from "lucide-react";
import Link from "next/link";
import type { CrmExtendedDictionary } from "@/i18n/crmExtendedDictionary";
import type { OpenHouseEventRecord, OpenHouseVisitMode } from "@/lib/openHouseTypes";

type OfferRow = { id: number; title: string; city?: string; district?: string };

type Props = {
  isOpen: boolean;
  copy: CrmExtendedDictionary["proTools"];
  activeOffers: OfferRow[];
  onClose: () => void;
  onChanged?: () => void;
};

function defaultDayIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function formatOfferLocation(offer: OfferRow): string {
  const parts = [offer.city, offer.district].filter(Boolean);
  return parts.length ? parts.join(" · ") : "";
}

export default function ProOpenHouseManageModal({
  isOpen,
  copy,
  activeOffers,
  onClose,
  onChanged,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"create" | "list">("create");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [events, setEvents] = useState<OpenHouseEventRecord[]>([]);
  const [offerId, setOfferId] = useState<number | null>(null);
  const [visitMode, setVisitMode] = useState<OpenHouseVisitMode>("SLOT_60");
  const [day, setDay] = useState(defaultDayIso);
  const [startHour, setStartHour] = useState("10:00");
  const [endHour, setEndHour] = useState("14:00");
  const [capacity, setCapacity] = useState(8);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const openSessionRef = useRef(0);

  useEffect(() => setMounted(true), []);

  const hours = useMemo(() => {
    const list: string[] = [];
    for (let h = 8; h <= 20; h += 1) {
      list.push(`${String(h).padStart(2, "0")}:00`);
      if (h !== 20) list.push(`${String(h).padStart(2, "0")}:30`);
    }
    return list;
  }, []);

  const selectedOffer = useMemo(
    () => activeOffers.find((o) => o.id === offerId) ?? null,
    [activeOffers, offerId],
  );

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/open-house/events?scope=host", { cache: "no-store", credentials: "include" });
      const data = await res.json();
      setEvents(Array.isArray(data?.events) ? data.events : []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Inicjalizacja tylko przy otwarciu modala — NIE przy każdym odświeżeniu listy ogłoszeń z CRM (polling).
  useEffect(() => {
    if (!isOpen) return;
    openSessionRef.current += 1;
    const session = openSessionRef.current;
    setTab("create");
    setError("");
    setSuccess("");
    setDay(defaultDayIso());
    setStartHour("10:00");
    setEndHour("14:00");
    setCapacity(8);
    setTitle("");
    setDescription("");
    setVisitMode("SLOT_60");
    setOfferId(activeOffers[0]?.id ?? null);
    void loadEvents();
    return () => {
      if (session === openSessionRef.current) openSessionRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tylko przy otwarciu
  }, [isOpen]);

  // Gdy lista ogłoszeń się zmieni, zachowaj wybór użytkownika jeśli nadal istnieje.
  useEffect(() => {
    if (!isOpen) return;
    setOfferId((prev) => {
      if (prev && activeOffers.some((o) => o.id === prev)) return prev;
      return activeOffers[0]?.id ?? null;
    });
  }, [isOpen, activeOffers]);

  useEffect(() => {
    if (!isOpen || tab !== "list") return;
    void loadEvents();
  }, [isOpen, tab, loadEvents]);

  const buildSlotPayload = () => {
    const [sh, sm] = startHour.split(":").map(Number);
    const [eh, em] = endHour.split(":").map(Number);
    const startsAt = new Date(`${day}T00:00:00`);
    startsAt.setHours(sh, sm || 0, 0, 0);
    const endsAt = new Date(`${day}T00:00:00`);
    endsAt.setHours(eh, em || 0, 0, 0);
    return [
      {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        capacity: visitMode === "FLEX" ? capacity : 1,
      },
    ];
  };

  const publish = async () => {
    if (!offerId) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/open-house/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId,
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          visitMode,
          slots: buildSlotPayload(),
          publish: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.event) {
        setError(data?.message || copy.openHousePublishError);
        return;
      }
      setSuccess(copy.openHouseSuccess);
      setTab("list");
      bodyScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      await loadEvents();
      onChanged?.();
    } catch {
      setError(copy.openHousePublishError);
    } finally {
      setSubmitting(false);
    }
  };

  const cancelEvent = async (eventId: number) => {
    if (!window.confirm(copy.openHouseCancelConfirm)) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/open-house/events/${eventId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || copy.openHouseCancelError);
        return;
      }
      await loadEvents();
      onChanged?.();
    } catch {
      setError(copy.openHouseCancelError);
    } finally {
      setSubmitting(false);
    }
  };

  const switchTab = (next: "create" | "list") => {
    setTab(next);
    bodyScrollRef.current?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };

  if (!mounted) return null;

  const modal = (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 eos-z-modal flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="eos-modal-backdrop absolute inset-0"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
            className="eos-modal-surface eos-modal-shell eos-themed-modal relative flex max-h-[min(90vh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-[2rem] border"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--eos-border)] px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 dark:text-amber-400">
                  <DoorOpen size={20} />
                </div>
                <h3 className="text-[17px] font-semibold tracking-tight text-[var(--eos-text)]">{copy.openHouseModalTitle}</h3>
              </div>
              <button type="button" onClick={onClose} className="eos-pro-muted rounded-full bg-[var(--eos-input)] p-2 transition hover:bg-[var(--eos-border)]">
                <X size={18} />
              </button>
            </div>

            <div className="flex shrink-0 gap-2 border-b border-[var(--eos-border)] px-6 py-3">
              {(["create", "list"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => switchTab(key)}
                  className={`eos-tab-pill ${
                    tab === key ? "bg-amber-500/15 eos-amber-accent" : "text-[var(--eos-muted)]"
                  }`}
                >
                  {key === "create" ? copy.openHouseCreateTab : copy.openHouseListTab}
                </button>
              ))}
            </div>

            <div ref={bodyScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
              {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
              {success ? <p className="mb-3 text-sm text-emerald-400">{success}</p> : null}

              {tab === "create" ? (
                activeOffers.length ? (
                  <div className="space-y-5">
                    <section>
                      <p className="eos-field-label mb-1">{copy.openHousePickOffer}</p>
                      <p className="mb-3 text-xs text-[var(--eos-muted)]">
                        Kliknij ogłoszenie — zaznaczenie zostaje przy odświeżeniu listy.
                      </p>
                      <div className="max-h-[220px] space-y-2 overflow-y-auto overscroll-contain rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]/40 p-2">
                        {activeOffers.map((offer) => {
                          const picked = offerId === offer.id;
                          return (
                            <button
                              key={offer.id}
                              type="button"
                              onClick={() => setOfferId(offer.id)}
                              className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
                                picked
                                  ? "border-amber-500/60 bg-amber-500/12 shadow-sm"
                                  : "border-transparent bg-[var(--eos-input)] hover:border-[var(--eos-border)]"
                              }`}
                            >
                              <span
                                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                                  picked ? "border-amber-500 bg-amber-500 text-black" : "border-[var(--eos-border)]"
                                }`}
                              >
                                {picked ? <Check size={12} strokeWidth={3} /> : null}
                              </span>
                              <span className="min-w-0 flex-1">
                                <p className="text-sm font-semibold leading-snug text-[var(--eos-text)]">{offer.title}</p>
                                <p className="eos-pro-muted mt-0.5 text-xs">
                                  #{offer.id}
                                  {formatOfferLocation(offer) ? ` · ${formatOfferLocation(offer)}` : ""}
                                </p>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    {selectedOffer ? (
                      <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          Wybrane ogłoszenie
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[var(--eos-text)]">{selectedOffer.title}</p>
                      </div>
                    ) : null}

                    <section>
                      <p className="eos-field-label mb-2">Tryb wizyt</p>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            ["FLEX", copy.visitModeFlex],
                            ["SLOT_30", copy.visitMode30],
                            ["SLOT_60", copy.visitMode60],
                          ] as const
                        ).map(([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setVisitMode(mode)}
                            className={`rounded-xl border px-2 py-2.5 text-[12px] font-semibold leading-snug ${
                              visitMode === mode
                                ? "border-amber-500/50 bg-amber-500/10 eos-amber-accent"
                                : "border-[var(--eos-border)] text-[var(--eos-muted)]"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </section>

                    <section>
                      <p className="eos-field-label mb-2">Termin</p>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className="eos-field-label">{copy.slotDay}</span>
                          <input
                            type="date"
                            value={day}
                            onChange={(e) => setDay(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2 text-sm text-[var(--eos-text)]"
                          />
                        </label>
                        <label className="block">
                          <span className="eos-field-label">{copy.slotCapacity}</span>
                          <input
                            type="number"
                            min={1}
                            max={visitMode === "FLEX" ? 50 : 5}
                            value={capacity}
                            onChange={(e) => setCapacity(Number(e.target.value) || 1)}
                            className="mt-1 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2 text-sm text-[var(--eos-text)]"
                          />
                        </label>
                        <label className="block">
                          <span className="eos-field-label">{copy.slotFrom}</span>
                          <select
                            value={startHour}
                            onChange={(e) => setStartHour(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2 text-sm text-[var(--eos-text)]"
                          >
                            {hours.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="eos-field-label">{copy.slotTo}</span>
                          <select
                            value={endHour}
                            onChange={(e) => setEndHour(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2 text-sm text-[var(--eos-text)]"
                          >
                            {hours.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </section>

                    <section className="space-y-2">
                      <p className="eos-field-label">Dla gości (opcjonalnie)</p>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={copy.openHouseOptionalTitle}
                        className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-sm text-[var(--eos-text)]"
                      />
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                        placeholder={copy.openHouseOptionalDescription}
                        className="w-full resize-none rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-sm text-[var(--eos-text)]"
                      />
                    </section>

                    <button
                      type="button"
                      disabled={submitting || !offerId}
                      onClick={() => void publish()}
                      className="eos-primary-cta w-full bg-amber-500 hover:bg-amber-400"
                    >
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                      {copy.openHousePublish}
                    </button>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-[var(--eos-muted)]">{copy.openHouseNoOffers}</p>
                )
              ) : loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                </div>
              ) : events.length ? (
                <div className="space-y-3">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]/50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[var(--eos-text)]">{event.title}</p>
                          <p className="mt-1 text-xs text-[var(--eos-muted)]">
                            {event.status} · {event.totalSpotsLeft} {copy.openHouseSpotsLeft}
                          </p>
                        </div>
                        <Link
                          href={`/oferta/${event.offerId}`}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold eos-amber-accent"
                        >
                          {copy.openHouseViewOffer} <ExternalLink size={12} />
                        </Link>
                      </div>
                      {event.status === "PUBLISHED" ? (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => void cancelEvent(event.id)}
                          className="mt-3 text-[13px] font-medium text-red-500 hover:text-red-600"
                        >
                          {copy.openHouseCancel}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-[var(--eos-muted)]">{copy.openHouseEmpty}</p>
              )}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
