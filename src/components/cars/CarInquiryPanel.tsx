"use client";

import { Loader2, MessageCircle, Phone, Calendar } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { dispatchContactUnreadRefresh } from "@/lib/contactServiceWeb";
import { formatCarPrice } from "@/lib/carsPresentation";
import { useLocale } from "@/contexts/LocaleContext";
import { carAlertErrorClass, carAlertInfoClass } from "@/components/cars/carFormStyles";
import { fmtCars } from "@/i18n/carsDictionary";

type CarInquiryPanelProps = {
  carId: number;
  carTitle: string;
  make: string;
  model: string;
  year: number;
  pricePln: number;
  city: string;
  sellerUserId: number | null;
  currentUserId?: number | null;
};

export default function CarInquiryPanel({
  carId,
  carTitle,
  make,
  model,
  year,
  pricePln,
  city,
  sellerUserId,
  currentUserId,
}: CarInquiryPanelProps) {
  const router = useRouter();
  const { dict, locale } = useLocale();
  const i = dict.cars.inquiry;

  const viewingOptions = useMemo(
    () => [i.viewingAsap, i.viewingWeek, i.viewingNextWeek, i.viewingQuestionOnly],
    [i],
  );

  const [viewingPreference, setViewingPreference] = useState<string>(viewingOptions[0]);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(() => fmtCars(i.defaultMessage, { title: carTitle }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const selfId = Number(currentUserId);
  const isOwner = Number.isFinite(selfId) && sellerUserId != null && selfId === sellerUserId;

  const summary = useMemo(
    () => `${make} ${model} · ${year} · ${city} · ${formatCarPrice(pricePln, locale)}`,
    [make, model, year, city, pricePln, locale],
  );

  if (isOwner) return null;

  if (!sellerUserId) {
    return (
      <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-5 text-sm text-[var(--eos-muted)]">
        {i.noSeller}
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!currentUserId) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/cars/${carId}/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message, viewingPreference, phone }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : i.submitFailed);
      }
      dispatchContactUnreadRefresh();
      setSuccess(true);
      const threadId = Number(data?.threadId);
      const peerUserId = Number(data?.peerUserId);
      if (Number.isFinite(threadId) && threadId > 0) {
        setTimeout(() => {
          router.push(`/moje-konto/wiadomosci?thread=${threadId}&peer=${peerUserId}`);
        }, 900);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : i.submitFailed);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className={carAlertInfoClass}>
        <p className="text-sm font-semibold">{i.successTitle}</p>
        <p className="mt-2 text-sm opacity-90">{i.successBody}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-sky-400/25 bg-[var(--eos-surface)] p-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-600 dark:text-sky-300">{i.title}</p>
        <p className="mt-2 text-sm text-[var(--eos-muted)]">{summary}</p>
      </div>

      <label className="grid gap-1.5 text-sm">
        <span className="flex items-center gap-2 text-[var(--eos-muted)]">
          <Calendar className="size-4 text-sky-500 dark:text-sky-400" aria-hidden />
          {i.viewingLabel}
        </span>
        <select
          value={viewingPreference}
          onChange={(e) => setViewingPreference(e.target.value)}
          className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3 py-2.5 text-[var(--eos-text)] outline-none focus:border-sky-400/50"
        >
          {viewingOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm">
        <span className="flex items-center gap-2 text-[var(--eos-muted)]">
          <Phone className="size-4 text-sky-500 dark:text-sky-400" aria-hidden />
          {i.phoneLabel} ({i.phoneOptional})
        </span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+48 ..."
          className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3 py-2.5 text-[var(--eos-text)] outline-none focus:border-sky-400/50"
        />
      </label>

      <label className="grid gap-1.5 text-sm">
        <span className="flex items-center gap-2 text-[var(--eos-muted)]">
          <MessageCircle className="size-4 text-sky-500 dark:text-sky-400" aria-hidden />
          {i.messageLabel}
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          required
          minLength={8}
          placeholder={i.messagePlaceholder}
          className="resize-y rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3 py-2.5 text-[var(--eos-text)] outline-none focus:border-sky-400/50"
        />
      </label>

      {error ? <p className={carAlertErrorClass}>{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/15 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-sky-800 transition hover:bg-sky-500/25 disabled:opacity-60 dark:text-sky-200"
      >
        {submitting ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
        {submitting ? i.submitting : i.submit}
      </button>

      <p className="text-[11px] leading-relaxed text-[var(--eos-muted)]">{i.footerNote}</p>
    </form>
  );
}
