"use client";

import { Loader2, MessageCircle, Phone, Calendar } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { dispatchContactUnreadRefresh } from "@/lib/contactServiceWeb";
import { formatCarPrice } from "@/lib/carsPresentation";
import { useLocale } from "@/contexts/LocaleContext";
import { getCarsDictionary } from "@/i18n/carsDictionary";


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
  const { locale } = useLocale();
  const d = getCarsDictionary(locale);
  const viewingOptions = [d.inquiryViewingAsap, d.inquiryViewingThisWeek, d.inquiryViewingNextWeek, d.inquiryViewingQuestionOnly];
  const router = useRouter();
  const [viewingPreference, setViewingPreference] = useState<string>(viewingOptions[0]);
  const [phone, setPhone] = useState("");
  const defaultMessage = d.inquiryDefaultMessage(carTitle);
  const [message, setMessage] = useState(defaultMessage);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

    const selfId = Number(currentUserId);
  const isOwner = Number.isFinite(selfId) && sellerUserId != null && selfId === sellerUserId;

  const summary = useMemo(
    () => `${make} ${model} · ${year} · ${city} · ${formatCarPrice(pricePln)}`,
    [make, model, year, city, pricePln],
  );

  if (isOwner) return null;

  if (!sellerUserId) {
    return (
      <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-5 text-sm text-[var(--eos-muted)]">
        {d.inquiryNoSeller}
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
        body: JSON.stringify({ message, viewingPreference: viewingPreference || viewingOptions[0], phone }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : d.inquiryError);
      }
      dispatchContactUnreadRefresh();
      setSuccess(true);
      const threadId = Number(data?.threadId);
      const peerUserId = Number(data?.peerUserId);
      if (Number.isFinite(threadId) && threadId > 0) {
        setTimeout(() => {
          router.push(
            `/moje-konto/wiadomosci?thread=${threadId}&peer=${peerUserId}`,
          );
        }, 900);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : d.inquiryError);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-5">
        <p className="text-sm font-semibold text-sky-200">{d.inquirySuccessTitle}</p>
        <p className="mt-2 text-sm text-[var(--eos-muted)]">
          {d.inquirySuccessBody}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-sky-400/25 bg-[var(--eos-surface)] p-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-300">{d.inquiryTitle}</p>
        <p className="mt-2 text-sm text-[var(--eos-muted)]">{summary}</p>
      </div>

      <label className="grid gap-1.5 text-sm">
        <span className="flex items-center gap-2 text-[var(--eos-muted)]">
          <Calendar className="size-4 text-sky-400" aria-hidden />
          {d.inquiryViewingSchedule}
        </span>
        <select
          value={viewingPreference}
          onChange={(e) => setViewingPreference(e.target.value)}
          className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3 py-2.5 outline-none focus:border-sky-400/50"
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
          <Phone className="size-4 text-sky-400" aria-hidden />
          {d.inquiryPhoneLabel}
        </span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+48 ..."
          className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3 py-2.5 outline-none focus:border-sky-400/50"
        />
      </label>

      <label className="grid gap-1.5 text-sm">
        <span className="flex items-center gap-2 text-[var(--eos-muted)]">
          <MessageCircle className="size-4 text-sky-400" aria-hidden />
          {d.inquiryYourMessage}
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          required
          minLength={8}
          className="resize-y rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3 py-2.5 outline-none focus:border-sky-400/50"
        />
      </label>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/15 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-sky-200 transition hover:bg-sky-500/25 disabled:opacity-60"
      >
        {submitting ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
        {submitting ? d.inquirySubmitting : d.inquirySubmit}
      </button>

      <p className="text-[11px] leading-relaxed text-[var(--eos-muted)]">
        {d.inquiryFooter.split("EstateOS Contact")[0]}
        <Link href="/moje-konto/wiadomosci" className="text-sky-300 underline">
          EstateOS Contact
        </Link>
        {d.inquiryFooter.includes("Home") ? d.inquiryFooter.split("EstateOS Contact").slice(1).join("EstateOS Contact") : ""}
      </p>
    </form>
  );
}
