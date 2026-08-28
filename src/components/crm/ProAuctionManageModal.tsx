"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ExternalLink, Gavel, Info, Loader2, X } from "lucide-react";
import Link from "next/link";
import type { CrmExtendedDictionary } from "@/i18n/crmExtendedDictionary";
import {
  datetimeLocalToIso,
  defaultAuctionEndLocal,
  defaultAuctionStartLocal,
} from "@/lib/datetimeLocal";
import type { AuctionEventRecord } from "@/lib/auctionTypes";

type OfferRow = { id: number; title: string; city?: string; district?: string; price?: number };

type Props = {
  isOpen: boolean;
  copy: CrmExtendedDictionary["proTools"];
  activeOffers: OfferRow[];
  onClose: () => void;
  onChanged?: () => void;
};

const MIN_DURATION_MS = 60 * 60 * 1000;
const MAX_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

function formatMoney(n: number, currency: string) {
  return `${Math.round(n).toLocaleString("pl-PL")} ${currency}`;
}

function statusLabel(status: string, copy: CrmExtendedDictionary["proTools"]) {
  switch (status) {
    case "LIVE":
      return copy.auctionStatusLive;
    case "SCHEDULED":
      return copy.auctionStatusScheduled;
    case "ENDED":
    case "SETTLED":
      return copy.auctionStatusEnded;
    case "CANCELLED":
      return copy.auctionStatusCancelled;
    default:
      return status;
  }
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--eos-muted)]">{children}</p>;
}

export default function ProAuctionManageModal({
  isOpen,
  copy,
  activeOffers,
  onClose,
  onChanged,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"create" | "list" | "guide">("create");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [publishedOfferId, setPublishedOfferId] = useState<number | null>(null);
  const [events, setEvents] = useState<AuctionEventRecord[]>([]);
  const [offerId, setOfferId] = useState<number | null>(null);
  const [startPrice, setStartPrice] = useState("");
  const [reservePrice, setReservePrice] = useState("");
  const [minIncrement, setMinIncrement] = useState("");
  const [startsAt, setStartsAt] = useState(defaultAuctionStartLocal);
  const [endsAt, setEndsAt] = useState(defaultAuctionEndLocal);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const selectedOffer = useMemo(
    () => activeOffers.find((o) => o.id === offerId) ?? null,
    [activeOffers, offerId]
  );

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auction/events?scope=host", { cache: "no-store", credentials: "include" });
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
    setPublishedOfferId(null);
    const first = activeOffers[0] ?? null;
    setOfferId(first?.id ?? null);
    if (first?.price) setStartPrice(String(Math.round(first.price)));
    setStartsAt(defaultAuctionStartLocal());
    setEndsAt(defaultAuctionEndLocal());
    void loadEvents();
  }, [isOpen, activeOffers, loadEvents]);

  useEffect(() => {
    if (selectedOffer?.price && !startPrice) {
      setStartPrice(String(Math.round(selectedOffer.price)));
    }
  }, [selectedOffer, startPrice]);

  useEffect(() => {
    if (!error && !success) return;
    alertRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [error, success]);

  const validateForm = (): string | null => {
    if (!offerId) return copy.auctionNoOffers;
    const price = Number(startPrice);
    if (!Number.isFinite(price) || price <= 0) return copy.auctionPublishError;
    if (reservePrice) {
      const reserve = Number(reservePrice);
      if (!Number.isFinite(reserve) || reserve < price) {
        return copy.auctionGuideReserve;
      }
    }
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return copy.auctionPublishError;
    }
    if (start.getTime() <= Date.now()) {
      return copy.auctionValidationStartPast;
    }
    const duration = end.getTime() - start.getTime();
    if (duration < MIN_DURATION_MS || duration > MAX_DURATION_MS) {
      return copy.auctionValidationDuration;
    }
    return null;
  };

  const publish = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setSuccess("");
      return;
    }
    if (!offerId) return;

    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/auction/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId,
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          startPrice: Number(startPrice),
          reservePrice: reservePrice ? Number(reservePrice) : undefined,
          minIncrement: minIncrement ? Number(minIncrement) : undefined,
          startsAt: datetimeLocalToIso(startsAt),
          endsAt: datetimeLocalToIso(endsAt),
          publish: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.event) {
        setError(data?.message || copy.auctionPublishError);
        return;
      }
      setPublishedOfferId(offerId);
      setSuccess(copy.auctionPublishSuccessBody);
      setTab("list");
      await loadEvents();
      onChanged?.();
    } catch {
      setError(copy.auctionPublishError);
    } finally {
      setSubmitting(false);
    }
  };

  const cancelEvent = async (eventId: number) => {
    if (!window.confirm(copy.auctionCancelConfirm)) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/auction/events/${eventId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || copy.auctionCancelError);
        return;
      }
      await loadEvents();
      onChanged?.();
    } catch {
      setError(copy.auctionCancelError);
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted) return null;

  const modal = (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 eos-z-modal flex items-start justify-center overflow-y-auto p-4 pb-10 pt-10 sm:pt-16">
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
                <motion.div
                  animate={{ rotate: [0, -8, 8, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400"
                >
                  <Gavel size={20} />
                </motion.div>
                <h3 className="text-[17px] font-semibold tracking-tight text-[var(--eos-text)]">{copy.auctionModalTitle}</h3>
              </div>
              <button type="button" onClick={onClose} className="eos-pro-muted rounded-full bg-[var(--eos-input)] p-2 transition hover:bg-[var(--eos-border)]">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-[var(--eos-border)] px-6 py-3">
              {(["create", "list", "guide"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`eos-tab-pill ${
                    tab === key ? "bg-violet-500/15 eos-violet-accent-strong" : "text-[var(--eos-muted)]"
                  }`}
                >
                  {key === "create" ? copy.auctionCreateTab : key === "list" ? copy.auctionListTab : copy.auctionGuideTab}
                </button>
              ))}
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
              <div ref={alertRef} className="space-y-3">
                {error ? (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
                ) : null}
                {success ? (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-400" />
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-emerald-300">{copy.auctionPublishSuccessTitle}</p>
                        <p className="text-sm text-emerald-400/90">{success}</p>
                        {publishedOfferId ? (
                          <Link
                            href={`/oferta/${publishedOfferId}`}
                            className="inline-flex items-center gap-1 text-[13px] font-semibold text-emerald-300 underline-offset-2 hover:underline"
                          >
                            {copy.auctionViewPublishedOffer}
                            <ExternalLink size={12} />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {tab === "guide" ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
                    <div className="flex items-start gap-3">
                      <Info size={18} className="mt-0.5 shrink-0 text-violet-400" />
                      <div className="space-y-3 text-sm leading-relaxed text-[var(--eos-text)]/90">
                        <p className="font-semibold">{copy.auctionGuideLead}</p>
                        <ul className="list-disc space-y-2 pl-5 eos-pro-muted">
                          <li>{copy.auctionGuideStartPrice}</li>
                          <li>{copy.auctionGuideReserve}</li>
                          <li>{copy.auctionGuideIncrement}</li>
                          <li>{copy.auctionGuideAntiSnipe}</li>
                          <li>{copy.auctionGuideWinner}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]/50 p-4 text-sm leading-relaxed text-[var(--eos-text)]/90">
                    <p><span className="font-semibold text-[var(--eos-text)]">1.</span> {copy.auctionGuideWhere}</p>
                    <p><span className="font-semibold text-[var(--eos-text)]">2.</span> {copy.auctionGuideWho}</p>
                    <p><span className="font-semibold text-[var(--eos-text)]">3.</span> {copy.auctionGuideFlow}</p>
                    <p><span className="font-semibold text-[var(--eos-text)]">4.</span> {copy.auctionGuideNotifications}</p>
                  </div>
                </div>
              ) : null}

              {tab === "create" ? (
                activeOffers.length ? (
                  <>
                    <p className="rounded-2xl border border-violet-500/15 bg-violet-500/5 px-4 py-3 text-[13px] leading-relaxed text-[var(--eos-text)]/90">
                      {copy.auctionCreateIntro}
                    </p>

                    <div>
                      <p className="eos-field-label">{copy.auctionPickOffer}</p>
                      <FieldHint>{copy.auctionPickOfferHint}</FieldHint>
                      <div className="mt-2 space-y-2">
                        {activeOffers.map((offer) => (
                          <button
                            key={offer.id}
                            type="button"
                            onClick={() => {
                              setOfferId(offer.id);
                              if (offer.price) setStartPrice(String(Math.round(offer.price)));
                            }}
                            className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                              offerId === offer.id
                                ? "border-violet-500/50 bg-violet-500/10"
                                : "border-[var(--eos-border)] bg-[var(--eos-input)] hover:border-violet-500/25"
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

                    <div className="grid grid-cols-2 gap-4">
                      <label className="block">
                        <span className="eos-field-label">{copy.auctionStartPrice}</span>
                        <FieldHint>{copy.auctionStartPriceHint}</FieldHint>
                        <input
                          type="number"
                          min={1}
                          value={startPrice}
                          onChange={(e) => setStartPrice(e.target.value)}
                          className="mt-2 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
                        />
                      </label>
                      <label className="block">
                        <span className="eos-field-label">{copy.auctionReservePrice}</span>
                        <FieldHint>{copy.auctionReservePriceHint}</FieldHint>
                        <input
                          type="number"
                          min={0}
                          placeholder={copy.auctionOptional}
                          value={reservePrice}
                          onChange={(e) => setReservePrice(e.target.value)}
                          className="mt-2 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
                        />
                      </label>
                      <label className="col-span-2 block">
                        <span className="eos-field-label">{copy.auctionMinIncrement}</span>
                        <FieldHint>{copy.auctionMinIncrementHint}</FieldHint>
                        <input
                          type="number"
                          min={0}
                          placeholder={copy.auctionAutoIncrement}
                          value={minIncrement}
                          onChange={(e) => setMinIncrement(e.target.value)}
                          className="mt-2 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
                        />
                      </label>
                      <label className="block">
                        <span className="eos-field-label">{copy.auctionStartsAt}</span>
                        <FieldHint>{copy.auctionStartsAtHint}</FieldHint>
                        <input
                          type="datetime-local"
                          value={startsAt}
                          onChange={(e) => setStartsAt(e.target.value)}
                          className="mt-2 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
                        />
                      </label>
                      <label className="block">
                        <span className="eos-field-label">{copy.auctionEndsAt}</span>
                        <FieldHint>{copy.auctionEndsAtHint}</FieldHint>
                        <input
                          type="datetime-local"
                          value={endsAt}
                          onChange={(e) => setEndsAt(e.target.value)}
                          className="mt-2 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="eos-field-label">{copy.auctionOptionalTitle}</span>
                      <FieldHint>{copy.auctionOptionalTitleHint}</FieldHint>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
                      />
                    </label>
                    <label className="block">
                      <span className="eos-field-label">{copy.auctionOptionalDescription}</span>
                      <FieldHint>{copy.auctionOptionalDescriptionHint}</FieldHint>
                      <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)]"
                      />
                    </label>

                    <button
                      type="button"
                      disabled={submitting || !offerId || !startPrice}
                      onClick={() => void publish()}
                      className="eos-primary-cta flex w-full items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50"
                    >
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : <Gavel size={16} />}
                      {copy.auctionPublish}
                    </button>
                  </>
                ) : (
                  <p className="eos-pro-muted text-sm">{copy.auctionNoOffers}</p>
                )
              ) : null}

              {tab === "list" ? (
                loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin text-violet-400" />
                  </div>
                ) : events.length ? (
                  <div className="space-y-3">
                    {events.map((ev) => (
                      <div key={ev.id} className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[var(--eos-text)]">{ev.title}</p>
                            <p className="eos-pro-muted mt-1 text-xs">
                              {statusLabel(ev.status, copy)} · {formatMoney(ev.currentPrice || ev.startPrice, ev.currency)} · {ev.bidCount} {copy.auctionBidsCount}
                            </p>
                          </div>
                          <Link
                            href={`/oferta/${ev.offerId}`}
                            className="inline-flex items-center gap-1 text-[12px] font-semibold eos-violet-accent"
                          >
                            {copy.auctionViewOffer}
                            <ExternalLink size={12} />
                          </Link>
                        </div>
                        {["SCHEDULED", "LIVE", "DRAFT"].includes(ev.status) && ev.bidCount === 0 ? (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => void cancelEvent(ev.id)}
                            className="mt-3 text-xs font-semibold text-red-400"
                          >
                            {copy.auctionCancel}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="eos-pro-muted text-sm">{copy.auctionEmpty}</p>
                )
              ) : null}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
