"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Gavel, Loader2, TrendingUp } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { AuctionEventRecord } from "@/lib/auctionTypes";
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

function formatMoney(amount: number, currency: string, locale: Locale) {
  const tag = locale === "pl" ? "pl-PL" : locale === "uk" ? "uk-UA" : "en-GB";
  return `${Math.round(amount).toLocaleString(tag)} ${currency}`;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function AuctionBidModal({
  isOpen,
  eventId,
  currentUser,
  locale,
  onClose,
  onRequireAuth,
}: Props) {
  const t = getOfferPageCopy(locale);
  const auc = t.auction;
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [event, setEvent] = useState<AuctionEventRecord | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!eventId) {
      setEvent(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/auction/events/${eventId}`, { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data?.event) {
        setEvent(null);
        return;
      }
      const ev = data.event as AuctionEventRecord;
      setEvent(ev);
      setBidAmount(String(Math.round(ev.nextMinBid || ev.startPrice)));
    } catch {
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (isOpen) {
      setSuccess(false);
      setError("");
      void load();
    }
  }, [isOpen, load]);

  useEffect(() => {
    if (!isOpen || !event) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [isOpen, event]);

  const timeRemainingMs = useMemo(() => {
    if (!event) return 0;
    void tick;
    const end = new Date(event.effectiveEndsAt).getTime();
    return Math.max(0, end - Date.now());
  }, [event, tick]);

  const isLive = event?.status === "LIVE";
  const isScheduled = event?.status === "SCHEDULED";
  const isClosed = event && !["LIVE", "SCHEDULED"].includes(event.status);
  const canBid = Boolean(event && (isLive || isScheduled) && timeRemainingMs > 0 && !event.isHost);

  const quickBids = useMemo(() => {
    if (!event) return [];
    const base = event.nextMinBid || event.startPrice;
    const inc = event.minIncrement || Math.max(1000, Math.round(base * 0.01));
    return [base, base + inc, base + inc * 2, base + inc * 5];
  }, [event]);

  const submitBid = async () => {
    if (!currentUser?.id) {
      onRequireAuth();
      return;
    }
    if (!eventId || !event) return;
    const amount = Number(String(bidAmount).replace(/\s/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(auc.bidTooLow);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/auction/events/${eventId}/bids`, {
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
      setEvent(data.event as AuctionEventRecord);
      setSuccess(true);
    } catch {
      setError(auc.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  const body = loading ? (
    <div className="flex justify-center py-16">
      <Loader2 className="animate-spin eos-violet-accent" size={32} />
    </div>
  ) : !event ? (
    <div className="py-10 text-center">
      <p className="text-[17px] font-semibold text-[var(--eos-text)]">{auc.loadError}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--eos-muted)]">{auc.loadErrorHint}</p>
    </div>
  ) : success ? (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-3 py-10 text-center"
    >
      <CheckCircle2 size={48} className="text-emerald-500" />
      <p className="text-[17px] font-semibold text-[var(--eos-text)]">{auc.bidSuccess}</p>
      <p className="text-[13px] leading-relaxed text-[var(--eos-muted)]">{auc.bidSuccessHint}</p>
      {event.isLeading ? (
        <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-[12px] font-semibold text-emerald-600">
          {auc.leadingBadge}
        </span>
      ) : null}
    </motion.div>
  ) : isClosed ? (
    <div className="py-10 text-center">
      <p className="text-[17px] font-semibold text-[var(--eos-text)]">{auc.endedTitle}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--eos-muted)]">{auc.endedHint}</p>
    </div>
  ) : (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="eos-stat-card">
          <p className="eos-stat-card-label">{auc.currentPrice}</p>
          <p className="eos-stat-card-value eos-violet-accent-strong">
            {formatMoney(event.currentPrice || event.startPrice, event.currency, locale)}
          </p>
        </div>
        <div className="eos-stat-card">
          <p className="eos-stat-card-label">{auc.timeLeft}</p>
          <p className="eos-stat-card-value font-mono tabular-nums">{formatCountdown(timeRemainingMs)}</p>
        </div>
      </div>

      {isScheduled && !isLive ? (
        <p className="rounded-xl border border-violet-500/20 bg-violet-500/8 px-4 py-3 text-[13px] leading-relaxed text-[var(--eos-text)]">
          {auc.scheduledHint}
        </p>
      ) : null}

      {event.isLeading ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-[13px] font-semibold text-emerald-600">
          <TrendingUp size={16} />
          {auc.leadingBadge}
        </div>
      ) : event.bidCount > 0 && !event.isHost ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-[13px] font-semibold text-amber-600">
          {auc.outbidBadge}
        </div>
      ) : null}

      {canBid ? (
        <>
          <div>
            <label className="eos-field-label">{auc.yourBid}</label>
            <input
              type="number"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3.5 text-[22px] font-semibold tabular-nums text-[var(--eos-text)] outline-none transition-colors focus:border-violet-500/45"
            />
            <p className="mt-2 text-[12px] text-[var(--eos-muted)]">
              {auc.nextMinBid}: {formatMoney(event.nextMinBid, event.currency, locale)}
            </p>
          </div>

          <div>
            <p className="eos-field-label">{auc.quickBid}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {quickBids.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setBidAmount(String(Math.round(q)))}
                  className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-[13px] font-semibold tabular-nums eos-violet-accent transition-colors hover:border-violet-500/35 hover:bg-violet-500/8"
                >
                  {formatMoney(q, event.currency, locale)}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="text-[13px] font-medium text-red-500">{error}</p> : null}

          <button
            type="button"
            disabled={submitting}
            onClick={() => void submitBid()}
            className="eos-primary-cta bg-violet-600 hover:bg-violet-500"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Gavel size={18} />}
            {auc.bidCta}
          </button>
        </>
      ) : event.isHost ? (
        <p className="text-[13px] text-[var(--eos-muted)]">{auc.hostCannotBid}</p>
      ) : null}

      {event.recentBids.length > 0 ? (
        <div>
          <p className="eos-field-label">{auc.recentBids}</p>
          <ul className="space-y-2">
            {event.recentBids.slice(0, 6).map((b) => (
              <li
                key={b.id}
                className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-[13px] ${
                  b.isMine
                    ? "border-emerald-500/25 bg-emerald-500/8"
                    : "border-[var(--eos-border)] bg-[var(--eos-input)]"
                }`}
              >
                <span className="font-medium text-[var(--eos-text)]">{b.bidderLabel}</span>
                <span className="font-semibold tabular-nums eos-violet-accent-strong">
                  {formatMoney(b.amount, b.currency, locale)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );

  return (
    <EosModal
      open={isOpen}
      onClose={onClose}
      title={auc.modalTitle}
      subtitle={auc.modalSubtitle}
      icon={<Gavel size={20} />}
      iconWrapClassName="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-500/25 bg-violet-500/10 text-violet-500 shadow-[0_8px_24px_rgba(139,92,246,0.14)]"
      maxWidth="max-w-lg"
    >
      {body}
    </EosModal>
  );
}
