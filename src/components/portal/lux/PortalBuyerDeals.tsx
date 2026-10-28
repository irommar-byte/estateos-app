"use client";

import { Check } from "lucide-react";

export type PortalBuyerDeal = {
  offerId: number;
  title: string;
  address: string;
  imageUrl: string | null;
  phases: Array<{ id: string; label: string; done: boolean; current: boolean; skipped: boolean }>;
  status: string;
  dates: Array<{ label: string; at: string; done: boolean }>;
  yourOffer: { amount: number; status: "open" | "accepted" | "rejected" | "countered" | "withdrawn" } | null;
  agreedPrice: number | null;
  reservedUntil: string | null;
};

const pln = (value: number) => `${Math.round(value).toLocaleString("pl-PL")} zł`;
const when = (iso: string) =>
  new Date(iso).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "long" });

const OFFER_STATUS: Record<NonNullable<PortalBuyerDeal["yourOffer"]>["status"], string> = {
  open: "czeka na odpowiedź sprzedającego",
  accepted: "przyjęta",
  rejected: "odrzucona",
  countered: "sprzedający zaproponował inną kwotę",
  withdrawn: "wycofana",
};

/** Ścieżka kupującego przy każdej nieruchomości: etapy, terminy, propozycja ceny. */
export default function PortalBuyerDeals({ deals }: { deals: PortalBuyerDeal[] }) {
  return (
    <div className="space-y-4">
      {deals.map((deal) => (
        <article key={deal.offerId} className="rounded-2xl border border-[var(--lux-line)] bg-[var(--lux-card)] p-4">
          <div className="flex gap-3">
            {deal.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={deal.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-[var(--lux-ink)]">{deal.title}</p>
              {deal.address ? <p className="truncate text-[13px] text-[var(--lux-ink-3)]">{deal.address}</p> : null}
              <p className="mt-1 text-[13px] font-semibold text-[var(--lux-good)]">{deal.status}</p>
            </div>
          </div>

          <ol className="mt-4 flex items-start">
            {deal.phases.map((phase, index) => (
              <li key={phase.id} className="flex flex-1 flex-col items-center text-center">
                <div className="flex w-full items-center">
                  <span className={`h-[2px] flex-1 ${index === 0 ? "opacity-0" : deal.phases[index - 1].done ? "bg-[var(--lux-good)]" : "bg-[var(--lux-line)]"}`} />
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                      phase.done
                        ? "border-[var(--lux-good)] bg-[var(--lux-good)] text-white"
                        : phase.current
                          ? "border-[var(--lux-warn)] bg-[var(--lux-warn)]"
                          : "border-[var(--lux-line)] bg-[var(--lux-card)]"
                    }`}
                  >
                    {phase.done ? <Check size={13} strokeWidth={3} /> : null}
                  </span>
                  <span className={`h-[2px] flex-1 ${index === deal.phases.length - 1 ? "opacity-0" : phase.done ? "bg-[var(--lux-good)]" : "bg-[var(--lux-line)]"}`} />
                </div>
                <span className={`mt-1.5 text-[11px] ${phase.current ? "font-semibold text-[var(--lux-ink)]" : "text-[var(--lux-ink-3)]"}`}>
                  {phase.label}
                  {phase.skipped ? <span className="block text-[10px]">pominięte</span> : null}
                </span>
              </li>
            ))}
          </ol>

          {deal.yourOffer || deal.agreedPrice || deal.reservedUntil ? (
            <div className="mt-4 space-y-1 rounded-xl bg-[var(--lux-well)] p-3 text-[13px] text-[var(--lux-ink-2)]">
              {deal.agreedPrice ? (
                <p>
                  Uzgodniona cena: <b className="text-[var(--lux-ink)]">{pln(deal.agreedPrice)}</b>
                </p>
              ) : deal.yourOffer ? (
                <p>
                  Twoja propozycja: <b className="text-[var(--lux-ink)]">{pln(deal.yourOffer.amount)}</b> — {OFFER_STATUS[deal.yourOffer.status]}
                </p>
              ) : null}
              {deal.reservedUntil ? <p>Zarezerwowane dla Ciebie do {day(deal.reservedUntil)}</p> : null}
            </div>
          ) : null}

          {deal.dates.length ? (
            <ul className="mt-3 divide-y divide-[var(--lux-line)]">
              {deal.dates.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                  <span className="text-[var(--lux-ink-3)]">{item.label}</span>
                  <span className={item.done ? "font-semibold text-[var(--lux-good)]" : "font-semibold text-[var(--lux-ink)]"}>
                    {item.done ? "✓ " : ""}
                    {when(item.at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ))}
    </div>
  );
}
