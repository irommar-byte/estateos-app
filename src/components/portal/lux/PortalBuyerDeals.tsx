"use client";

import { useState } from "react";
import { Check, Clock } from "lucide-react";
import { usePortalLocale } from "@/components/portal/PortalLocale";
import { portalConfirm, portalToast } from "@/lib/portalUi";
import { portalAction } from "./portalApi";

export type PortalBuyerDeal = {
  dealId: number;
  pendingOffer: { id: string; amount: number; deadline: string; answered: boolean } | null;
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

const OFFER_STATUS: Record<NonNullable<PortalBuyerDeal["yourOffer"]>["status"], string> = {
  open: "czeka na odpowiedź sprzedającego",
  accepted: "przyjęta",
  rejected: "odrzucona",
  countered: "sprzedający zaproponował inną kwotę",
  withdrawn: "wycofana",
};

/** Ścieżka kupującego przy każdej nieruchomości: etapy, terminy, propozycja ceny. */
function hoursLeft(deadline: string): number {
  return Math.max(0, Math.round((new Date(deadline).getTime() - Date.now()) / 3_600_000));
}

/** Kontroferta sprzedającego: przyjmij / zaproponuj swoją kwotę / zrezygnuj — trafia do agenta. */
function PendingOffer({ deal, token, onChanged }: { deal: PortalBuyerDeal; token: string; onChanged: () => void }) {
  const { t, dateLocale } = usePortalLocale();
  const [counter, setCounter] = useState("");
  const [busy, setBusy] = useState(false);
  const offer = deal.pendingOffer!;
  const pln = (value: number) => `${Math.round(value).toLocaleString(dateLocale)} zł`;
  const respond = async (kind: "accept" | "counter" | "reject") => {
    if (kind === "counter" && !(Number(counter.replace(/\D/g, "")) > 0)) {
      portalToast.error(t("Wpisz swoją kwotę"));
      return;
    }
    if (kind === "reject" && !(await portalConfirm({ title: t("Zrezygnować z tej nieruchomości?"), body: t("Agent dostanie Twoją decyzję."), confirmLabel: t("Rezygnuję"), destructive: true }))) return;
    setBusy(true);
    try {
      await portalAction(token, "respond_deal_offer", { dealId: deal.dealId, offerId: offer.id, kind, amount: kind === "counter" ? Number(counter.replace(/\D/g, "")) : null });
      portalToast.success(t("Odpowiedź wysłana"), t("Agent przekaże ją sprzedającemu."));
      onChanged();
    } catch (e) {
      portalToast.error(t("Nie udało się wysłać odpowiedzi"), e);
    } finally {
      setBusy(false);
    }
  };
  if (offer.answered) {
    return <p className="mt-4 rounded-xl bg-[var(--lux-well)] p-3 text-[13px] text-[var(--lux-ink-2)]">{t("Twoja odpowiedź jest u agenta.")}</p>;
  }
  return (
    <div className="mt-4 rounded-xl border border-[var(--lux-warn)] bg-[var(--lux-well)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] text-[var(--lux-ink-2)]">
          {t("Sprzedający proponuje")} <b className="text-[var(--lux-ink)]">{pln(offer.amount)}</b>
        </p>
        <span className="flex items-center gap-1 text-[12px] font-semibold text-[var(--lux-warn)]">
          <Clock size={13} /> {t("{hours} h na odpowiedź", { hours: String(hoursLeft(offer.deadline)) })}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => respond("accept")} className="rounded-full bg-[var(--lux-ink)] px-4 py-2 text-[13px] font-semibold text-[var(--lux-card)] disabled:opacity-50">
          {t("Przyjmuję")}
        </button>
        <input
          value={counter}
          onChange={(e) => setCounter(e.target.value)}
          inputMode="numeric"
          placeholder={t("Twoja kwota")}
          className="w-32 rounded-full border border-[var(--lux-line)] bg-[var(--lux-card)] px-3 py-2 text-[13px] text-[var(--lux-ink)]"
        />
        <button disabled={busy} onClick={() => respond("counter")} className="rounded-full border border-[var(--lux-ink)] px-4 py-2 text-[13px] font-semibold text-[var(--lux-ink)] disabled:opacity-50">
          {t("Proponuję")}
        </button>
        <button disabled={busy} onClick={() => respond("reject")} className="px-2 py-2 text-[13px] text-[var(--lux-ink-3)] underline disabled:opacity-50">
          {t("Rezygnuję")}
        </button>
      </div>
    </div>
  );
}

export default function PortalBuyerDeals({ deals, token, onChanged }: { deals: PortalBuyerDeal[]; token: string; onChanged: () => void }) {
  const { t, dateLocale } = usePortalLocale();
  const pln = (value: number) => `${Math.round(value).toLocaleString(dateLocale)} zł`;
  const when = (iso: string) =>
    new Date(iso).toLocaleString(dateLocale, { timeZone: "Europe/Warsaw", weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const day = (iso: string) => new Date(iso).toLocaleDateString(dateLocale, { timeZone: "Europe/Warsaw", day: "numeric", month: "long" });
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
              <p className="mt-1 text-[13px] font-semibold text-[var(--lux-good)]">{t(deal.status)}</p>
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
                  {t(phase.label)}
                  {phase.skipped ? <span className="block text-[10px]">{t("pominięte")}</span> : null}
                </span>
              </li>
            ))}
          </ol>

          {deal.pendingOffer && !deal.agreedPrice ? <PendingOffer deal={deal} token={token} onChanged={onChanged} /> : null}

          {deal.yourOffer || deal.agreedPrice || deal.reservedUntil ? (
            <div className="mt-4 space-y-1 rounded-xl bg-[var(--lux-well)] p-3 text-[13px] text-[var(--lux-ink-2)]">
              {deal.agreedPrice ? (
                <p>
                  {t("Uzgodniona cena")}: <b className="text-[var(--lux-ink)]">{pln(deal.agreedPrice)}</b>
                </p>
              ) : deal.yourOffer ? (
                <p>
                  {t("Twoja propozycja")}: <b className="text-[var(--lux-ink)]">{pln(deal.yourOffer.amount)}</b> — {t(OFFER_STATUS[deal.yourOffer.status])}
                </p>
              ) : null}
              {deal.reservedUntil ? <p>{t("Zarezerwowane dla Ciebie do {date}", { date: day(deal.reservedUntil) })}</p> : null}
            </div>
          ) : null}

          {deal.dates.length ? (
            <ul className="mt-3 divide-y divide-[var(--lux-line)]">
              {deal.dates.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                  <span className="text-[var(--lux-ink-3)]">{t(item.label)}</span>
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
