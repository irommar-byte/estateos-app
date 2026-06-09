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
        setError(data?.message || "Nie udało się opublikować.");
        return;
      }
      setSuccess(copy.openHouseSuccess);
      setTab("list");
      await loadEvents();
      onChanged?.();
    } catch {
      setError("Błąd połączenia.");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelEvent = async (eventId: number) => {
    if (!window.confirm("Anulować ten dzień otwarty?")) return;
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
        setError(data?.message || "Nie udało się anulować.");
        return;
      }
      await loadEvents();
      onChanged?.();
    } catch {
      setError("Błąd połączenia.");
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
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
            className="relative my-auto w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0a0a] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                  <DoorOpen size={20} />
                </div>
                <h3 className="text-lg font-black text-white">{copy.openHouseModalTitle}</h3>
              </div>
              <button type="button" onClick={onClose} className="rounded-full bg-white/5 p-2 text-white/50">
                <X size={18} />
              </button>
            </div>

            <div className="flex gap-2 border-b border-white/5 px-6 py-3">
              {(["create", "list"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest ${
                    tab === key ? "bg-amber-500/20 text-amber-300" : "text-white/40"
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
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/40">
                        {copy.openHousePickOffer}
                      </p>
                      <div className="space-y-2">
                        {activeOffers.map((offer) => (
                          <button
                            key={offer.id}
                            type="button"
                            onClick={() => setOfferId(offer.id)}
                            className={`w-full rounded-xl border px-4 py-3 text-left ${
                              offerId === offer.id
                                ? "border-amber-500/50 bg-amber-500/10"
                                : "border-white/10 bg-white/[0.02]"
                            }`}
                          >
                            <p className="text-sm font-semibold text-white">{offer.title}</p>
                            <p className="text-xs text-white/45">
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
                          className={`rounded-xl border px-2 py-2 text-[10px] font-bold leading-snug ${
                            visitMode === mode
                              ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                              : "border-white/10 text-white/50"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-white/40">
                          {copy.slotDay}
                        </span>
                        <input
                          type="date"
                          value={day}
                          onChange={(e) => setDay(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-white/40">
                          {copy.slotCapacity}
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={visitMode === "FLEX" ? 50 : 5}
                          value={capacity}
                          onChange={(e) => setCapacity(Number(e.target.value) || 1)}
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-white/40">
                          {copy.slotFrom}
                        </span>
                        <select
                          value={startHour}
                          onChange={(e) => setStartHour(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                        >
                          {hours.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-white/40">
                          {copy.slotTo}
                        </span>
                        <select
                          value={endHour}
                          onChange={(e) => setEndHour(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
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
                      placeholder="Tytuł (opcjonalnie)"
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white"
                    />
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder="Informacje dla gości (opcjonalnie)"
                      className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white"
                    />

                    <button
                      type="button"
                      disabled={submitting || !offerId}
                      onClick={() => void publish()}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-4 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
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
                          <p className="mt-1 text-xs text-white/45">
                            {event.status} · {event.totalSpotsLeft} wolnych miejsc
                          </p>
                        </div>
                        <Link
                          href={`/oferta/${event.offerId}`}
                          className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-400"
                        >
                          {copy.openHouseViewOffer} <ExternalLink size={12} />
                        </Link>
                      </div>
                      {event.status === "PUBLISHED" ? (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => void cancelEvent(event.id)}
                          className="mt-3 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-red-400"
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
