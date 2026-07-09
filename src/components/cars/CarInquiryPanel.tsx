"use client";

import { Loader2, MessageCircle, Phone, Calendar } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { dispatchContactUnreadRefresh } from "@/lib/contactServiceWeb";
import { formatCarPrice } from "@/lib/carsPresentation";

const VIEWING_OPTIONS = [
  "Jak najszybciej",
  "W tym tygodniu",
  "W przyszłym tygodniu",
  "Tylko pytanie — bez oględzin",
] as const;

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
  const [viewingPreference, setViewingPreference] = useState<string>(VIEWING_OPTIONS[0]);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(
    `Dzień dobry, jestem zainteresowany/a ogłoszeniem „${carTitle}”. Proszę o informację o dostępności i możliwości oględzin.`,
  );
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
        Zapytania będą dostępne po przypisaniu sprzedającego do tego ogłoszenia.
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
        throw new Error(typeof data?.error === "string" ? data.error : "Nie udało się wysłać zapytania.");
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
      setError(submitError instanceof Error ? submitError.message : "Nie udało się wysłać zapytania.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-5">
        <p className="text-sm font-semibold text-sky-200">Zapytanie wysłane</p>
        <p className="mt-2 text-sm text-[var(--eos-muted)]">
          Sprzedający otrzyma wiadomość w EstateOS Contact. Za chwilę przekierujemy Cię do czatu.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-sky-400/25 bg-[var(--eos-surface)] p-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-300">Zapytaj o auto</p>
        <p className="mt-2 text-sm text-[var(--eos-muted)]">{summary}</p>
      </div>

      <label className="grid gap-1.5 text-sm">
        <span className="flex items-center gap-2 text-[var(--eos-muted)]">
          <Calendar className="size-4 text-sky-400" aria-hidden />
          Termin oględzin
        </span>
        <select
          value={viewingPreference}
          onChange={(e) => setViewingPreference(e.target.value)}
          className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-3 py-2.5 outline-none focus:border-sky-400/50"
        >
          {VIEWING_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm">
        <span className="flex items-center gap-2 text-[var(--eos-muted)]">
          <Phone className="size-4 text-sky-400" aria-hidden />
          Telefon (opcjonalnie)
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
          Twoja wiadomość
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
        {submitting ? "Wysyłanie..." : "Wyślij zapytanie"}
      </button>

      <p className="text-[11px] leading-relaxed text-[var(--eos-muted)]">
        Wysyłając zapytanie, kontaktujesz się ze sprzedającym przez{" "}
        <Link href="/moje-konto/wiadomosci" className="text-sky-300 underline">
          EstateOS Contact
        </Link>
        . Jedno konto — Home i Car.
      </p>
    </form>
  );
}
