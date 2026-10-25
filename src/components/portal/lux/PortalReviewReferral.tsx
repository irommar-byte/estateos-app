"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { portalAction } from "./portalApi";

export function PortalReview({
  token,
  agentFirst,
  review,
  reviewLink,
  onChanged,
}: {
  token: string;
  agentFirst: string;
  review?: { rating: number } | null;
  reviewLink?: string;
  onChanged: () => void;
}) {
  const [rating, setRating] = useState(review?.rating || 0);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(Boolean(review));
  const [busy, setBusy] = useState(false);
  return (
    <section className="lux-card p-5">
      <p className="lux-kicker">Twoja opinia</p>
      <h2 className="lux-serif mt-1.5 text-[22px] font-medium">{sent ? "Dziękujemy za ocenę" : `Jak oceniasz współpracę z ${agentFirst}?`}</h2>
      <div className="mt-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" disabled={sent} onClick={() => setRating(n)} aria-label={`${n} na 5`}>
            <Star className={`size-8 ${n <= rating ? "fill-[#D8A93B] text-[#D8A93B]" : "text-[var(--lux-ink-3)]"}`} />
          </button>
        ))}
      </div>
      {!sent ? (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Kilka słów (opcjonalnie)"
            className="mt-3 min-h-[72px] w-full rounded-2xl border border-[var(--lux-line)] bg-[var(--lux-card)] p-3 text-[15px] outline-none"
          />
          <button
            type="button"
            disabled={!rating || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await portalAction(token, "submit_review", { rating, comment });
                setSent(true);
                onChanged();
              } finally {
                setBusy(false);
              }
            }}
            className="lux-btn lux-btn--ink mt-3 w-full disabled:opacity-50"
          >
            Wyślij ocenę
          </button>
        </>
      ) : rating >= 4 && reviewLink ? (
        <a href={reviewLink} target="_blank" rel="noreferrer" className="lux-btn lux-btn--ghost mt-4 w-full">
          Zostaw też opinię w Google
        </a>
      ) : null}
    </section>
  );
}

export function PortalReferral({ token, agentFirst }: { token: string; agentFirst: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [need, setNeed] = useState<"BUYER" | "SELLER" | "RENT">("BUYER");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const field = "mt-2 h-12 w-full rounded-2xl border border-[var(--lux-line)] bg-[var(--lux-card)] px-3 text-[15px] outline-none";
  return (
    <section className="lux-card p-5">
      <p className="lux-kicker">Polecenie</p>
      <h2 className="lux-serif mt-1.5 text-[22px] font-medium">Znasz kogoś, kto kupuje albo sprzedaje?</h2>
      <p className="mt-1 text-[14px] text-[var(--lux-ink-2)]">
        {sent ? `Dziękujemy! ${agentFirst} odezwie się do tej osoby.` : `Podaj kontakt — ${agentFirst} zadzwoni i powie, że to od Ciebie.`}
      </p>
      {!open ? (
        <button type="button" onClick={() => { setOpen(true); setSent(false); }} className="lux-btn lux-btn--ghost mt-3 w-full">
          {sent ? "Poleć kolejną osobę" : "Poleć znajomego"}
        </button>
      ) : (
        <div className="mt-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Imię" className={field} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon" inputMode="tel" className={field} />
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ["BUYER", "Kupuje"],
                ["SELLER", "Sprzedaje"],
                ["RENT", "Wynajem"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setNeed(id)} className={`lux-chip ${need === id ? "lux-chip--on" : ""}`}>
                {label}
              </button>
            ))}
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Coś, co warto wiedzieć (opcjonalnie)" className={field} />
          {error ? <p className="mt-2 text-[13px] font-semibold text-[var(--lux-danger)]">{error}</p> : null}
          <button
            type="button"
            disabled={!name.trim() || !phone.trim() || busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await portalAction(token, "send_referral", { name, phone, need, note });
                setSent(true);
                setOpen(false);
                setName("");
                setPhone("");
                setNote("");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Błąd");
              } finally {
                setBusy(false);
              }
            }}
            className="lux-btn lux-btn--ink mt-3 w-full disabled:opacity-50"
          >
            Wyślij polecenie
          </button>
        </div>
      )}
    </section>
  );
}
