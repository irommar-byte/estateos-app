"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { DoorOpen, ExternalLink, Loader2, X } from "lucide-react";
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

  useEffect(() => setMounted(true), []);

  const hours = useMemo(() => {
    const list: string[] = [];
    for (let h = 8; h <= 20; h += 1) {
      list.push(`${String(h).padStart(2, "0")}:00`);
      if (h !== 20) list.push(`${String(h).padStart(2, "0")}:30`);
    }
    return list;
  }, []);

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

  useEffect(() => {
    if (!isOpen) return;
    setTab("create");
    setError("");
    setSuccess("");
    const first = activeOffers[0]?.id ?? null;
    setOfferId(first);
    void loadEvents();
  }, [isOpen, activeOffers, loadEvents]);

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

  if (!mounted) return null;

  const modal = (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-[999998] flex items-start justify-center overflow-y-auto p-4 pb-10 pt-10 sm:pt-16">
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
            className="eos-modal-surface eos-modal-shell eos-themed-modal relative my-auto w-full max-w-xl overflow-hidden rounded-[2rem] border"
          >
            <div className="flex items-center justify-between border-b border-[var(--eos-border)] px-6 py-5">
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

            <div className="flex gap-2 border-b border-[var(--eos-border)] px-6 py-3">
              {(["create", "list"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`eos-tab-pill ${
                    tab === key ? "bg-amber-500/15 eos-amber-accent" : "text-[var(--eos-muted)]"
                  }`}
                >
                  {key === "create" ? copy.openHouseCreateTab : copy.openHouseListTab}
                </button>
              ))}
            </div>

            <div className="space-y-4 p-6">
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              {success ? <p className="text-sm text-emerald-400">{success}</p> : null}

              {tab === "create" ? (
                activeOffers.length ? (
                  <>
                    <div>
                      <p className="eos-field-label">{copy.openHousePickOffer}</p>
                      <div className="space-y-2">
                        {activeOffers.map((offer) => (
                          <button
                            key={offer.id}
                            type="button"
                            onClick={() => setOfferId(offer.id)}
                            className={`w-full rounded-xl border px-4 py-3 text-left ${
                              offerId === offer.id
                                ? "border-amber-500/50 bg-amber-500/10"
                                : "border-[var(--eos-border)] bg-[var(--eos-input)]"
                            }`}
                          >
                            <p className="text-sm font-semibold text-[var(--eos-text)]">{offer.title}</p>
                            <p className="eos-pro-muted text-xs">
                              #{offer.id} · {offer.city} · {offer.district}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

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

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="eos-field-label">{copy.slotDay}</span>
                        <input
                          type="date"
                          value={day}
                          onChange={(e) => setDay(e.target.value)}
                          className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2 text-sm text-[var(--eos-text)]"
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
                          className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2 text-sm text-[var(--eos-text)]"
                        />
                      </label>
                      <label className="block">
                        <span className="eos-field-label">{copy.slotFrom}</span>
                        <select
                          value={startHour}
                          onChange={(e) => setStartHour(e.target.value)}
                          className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2 text-sm text-[var(--eos-text)]"
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
                          className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2 text-sm text-[var(--eos-text)]"
                        >
                          {hours.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

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

                    <button
                      type="button"
                      disabled={submitting || !offerId}
                      onClick={() => void publish()}
                      className="eos-primary-cta bg-amber-500 hover:bg-amber-400"
                    >
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                      {copy.openHousePublish}
                    </button>
                  </>
                ) : (
                  <p className="py-8 text-center text-sm text-white/45">{copy.openHouseNoOffers}</p>
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
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{event.title}</p>
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
                <p className="py-8 text-center text-sm text-white/45">{copy.openHouseEmpty}</p>
              )}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
