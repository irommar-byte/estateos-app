"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Gavel, Loader2, Timer } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { AuctionEventRecord } from "@/lib/auctionTypes";
import { getOfferPageCopy } from "@/content/offerPageCopy";

type Props = {
  event: AuctionEventRecord;
  locale: Locale;
  index: number;
  currentUserId?: number | null;
  onRequireAuth: () => void;
  onEventUpdated?: (event: AuctionEventRecord) => void;
};

function formatMoney(amount: number, currency: string, locale: Locale) {
  const tag = locale === "pl" ? "pl-PL" : locale === "uk" ? "uk-UA" : "en-GB";
  return `${Math.round(amount).toLocaleString(tag)} ${currency}`;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return d > 0 ? `${d}d ${time}` : time;
}

function formatStartDate(iso: string, locale: Locale) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const tag = locale === "pl" ? "pl-PL" : locale === "uk" ? "uk-UA" : "en-GB";
  return date.toLocaleString(tag, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CatalogAuctionCard({
  event,
  locale,
  index,
  currentUserId,
  onRequireAuth,
  onEventUpdated,
}: Props) {
  const auc = getOfferPageCopy(locale).auction;
  const [eventState, setEventState] = useState(event);
  const [bidAmount, setBidAmount] = useState(String(Math.round(event.nextMinBid || event.startPrice)));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setEventState(event);
    setBidAmount(String(Math.round(event.nextMinBid || event.startPrice)));
    setSuccess(false);
    setError("");
  }, [event]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const timeRemainingMs = useMemo(() => {
    void tick;
    const end = new Date(eventState.effectiveEndsAt).getTime();
    return Math.max(0, end - Date.now());
  }, [eventState.effectiveEndsAt, tick]);

  const isLive = eventState.status === "LIVE";
  const isScheduled = eventState.status === "SCHEDULED";
  const canBid = (isLive || isScheduled) && timeRemainingMs > 0 && !eventState.isHost;

  const offer = eventState.offer;
  const imageUrl = offer.imageUrl;
  const title = eventState.title?.trim() || offer.title?.trim() || `#${offer.id}`;
  const location = [offer.district, offer.city].filter(Boolean).join(" · ");

  const submitBid = async () => {
    if (!currentUserId) {
      onRequireAuth();
      return;
    }
    if (eventState.isHost) {
      setError(auc.hostCannotBid);
      return;
    }
    const amount = Number(String(bidAmount).replace(/\s/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(auc.bidTooLow);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/auction/events/${eventState.id}/bids`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        const code = data?.code || "";
        if (code === "HOST_CANNOT_BID") setError(auc.hostCannotBid);
        else if (code === "AUCTION_CLOSED") setError(auc.auctionClosed);
        else if (code === "BID_TOO_LOW") setError(auc.bidTooLow);
        else setError(data?.message || auc.errorGeneric);
        return;
      }
      const updated = data.event as AuctionEventRecord;
      setEventState(updated);
      setBidAmount(String(Math.round(updated.nextMinBid || updated.startPrice)));
      setSuccess(true);
      onEventUpdated?.(updated);
    } catch {
      setError(auc.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ delay: Math.min(index * 0.05, 0.35), duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden rounded-2xl border border-violet-500/25 bg-[var(--eos-card)] md:rounded-[1.75rem]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--eos-input)]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            unoptimized
            priority={index < 2}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-[var(--eos-bg)]" aria-hidden />
        )}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-600/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">
            <Gavel size={12} />
            {auc.bannerTitle}
          </span>
          {isLive ? (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              {auc.liveBadge}
            </span>
          ) : null}
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-[11px] font-bold tabular-nums text-white backdrop-blur-md">
            <Timer size={13} />
            {auc.timeLeft}: {formatCountdown(timeRemainingMs)}
          </span>
        </div>
      </div>

      <div className="space-y-4 p-4 md:p-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--eos-text)] line-clamp-2">{title}</h2>
          {location ? (
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--eos-muted)]">{location}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/60 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--eos-muted)]">{auc.currentPrice}</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--eos-text)]">
              {formatMoney(eventState.currentPrice || eventState.startPrice, eventState.currency, locale)}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/60 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--eos-muted)]">{auc.nextMinBid}</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums eos-violet-accent">
              {formatMoney(eventState.nextMinBid || eventState.startPrice, eventState.currency, locale)}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/60 px-3 py-2.5 col-span-2 sm:col-span-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--eos-muted)]">{auc.recentBids}</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--eos-text)]">{eventState.bidCount}</p>
          </div>
        </div>

        {isScheduled && !isLive ? (
          <p className="rounded-xl border border-violet-500/20 bg-violet-500/8 px-3 py-2 text-[12px] leading-relaxed text-[var(--eos-muted)]">
            {auc.bannerSubtitleScheduled(formatStartDate(eventState.startsAt, locale))}
          </p>
        ) : null}

        {eventState.description ? (
          <p className="text-[13px] leading-relaxed text-[var(--eos-muted)] line-clamp-3">{eventState.description}</p>
        ) : null}

        {eventState.isHost ? (
          <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-600 dark:text-amber-300">
            {auc.hostCannotBid}
          </p>
        ) : null}

        {success ? (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
            <div>
              <p className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-300">{auc.bidSuccess}</p>
              <p className="text-[12px] text-[var(--eos-muted)]">{auc.bidSuccessHint}</p>
            </div>
          </div>
        ) : canBid ? (
          <div className="space-y-2">
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--eos-muted)]">{auc.yourBid}</span>
              <input
                type="number"
                min={eventState.nextMinBid || eventState.startPrice}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm font-semibold tabular-nums text-[var(--eos-text)]"
              />
            </label>
            {error ? <p className="text-[12px] text-red-400">{error}</p> : null}
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submitBid()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Gavel size={14} />}
              {currentUserId ? auc.bidCta : auc.loginRequired}
            </button>
          </div>
        ) : null}

        <Link
          href={`/oferta/${eventState.offerId}`}
          className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-subtle)] transition hover:text-violet-500"
        >
          {auc.bannerCta}
          <ArrowRight size={12} />
        </Link>
      </div>
    </motion.article>
  );
}
