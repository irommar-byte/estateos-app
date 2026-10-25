"use client";

import { portalConfirm, portalToast } from "@/lib/portalUi";
import { useMemo, useState } from "react";
import LuxSheet from "./LuxSheet";
import { formatPln, portalAction } from "./portalApi";

export type SellerBuyerOfferView = {
  id: number;
  buyerLabel: string;
  amount: number;
  financing: string;
  deposit: number | null;
  deedWeeks: number | null;
  handoverDays: number | null;
  note: string | null;
  recommendation: string | null;
  recommendationKind: string | null;
  status: string;
  clientResponse: string | null;
  clientComment: string | null;
  counterAmount: number | null;
  respondBy: string | null;
};

export type SellerFinanceView = {
  mortgageBalance: number | null;
  purchaseYear: number | null;
  purchasePrice: number | null;
  commissionPct: number | null;
  commissionVat: boolean;
  otherCosts: number | null;
};

export type SellerPortalV2 = {
  stats: { views: number; matches: number; showings: number; buyerOffers: number } | null;
  buyerOffers: SellerBuyerOfferView[];
  showingFeedback: { showings: number; items: Array<{ tag: string; count: number; negative: boolean }> } | null;
  competition: {
    ownPpsm: number | null;
    ownDays: number;
    similarCount: number;
    similarPpsm: number | null;
    similarDays: number | null;
    transactionPpsm: number | null;
    transactionCount: number;
  } | null;
  finance: SellerFinanceView;
  netAtListPrice: { net: number } | null;
};

const FINANCING: Record<string, string> = { cash: "Gotówka", mortgage: "Kredyt", mixed: "Gotówka + kredyt" };

export function SellerStatsTiles({ stats }: { stats: SellerPortalV2["stats"] }) {
  if (!stats) return null;
  const tiles: Array<[string, number, boolean]> = [
    ["wyświetleń", stats.views, false],
    ["dopasowań", stats.matches, false],
    ["oglądań", stats.showings, false],
    ["oferty", stats.buyerOffers, true],
  ];
  return (
    <div className="mt-3 grid grid-cols-4 gap-1.5">
      {tiles.map(([label, value, gold]) => (
        <div key={label} className={`rounded-[14px] px-1.5 py-2.5 text-center ${gold && value ? "bg-[#D8C3A0] text-black" : "bg-white/[0.07]"}`}>
          <p className="text-[19px] font-extrabold">{value.toLocaleString("pl-PL")}</p>
          <p className={`mt-0.5 text-[10px] ${gold && value ? "font-bold" : "text-[#BDB6AA]"}`}>{label}</p>
        </div>
      ))}
    </div>
  );
}

function BuyerOfferCard({
  offer,
  listPrice,
  token,
  agentFirst,
  onChanged,
}: {
  offer: SellerBuyerOfferView;
  listPrice: number;
  token: string;
  agentFirst: string;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<"counter" | null>(null);
  const [counter, setCounter] = useState(String(offer.amount));
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const diffPct = listPrice > 0 ? ((offer.amount - listPrice) / listPrice) * 100 : null;
  const open = offer.status === "OPEN";

  const respond = async (response: "accept" | "counter" | "reject") => {
    if (
      response === "reject" &&
      !(await portalConfirm({
        title: "Odrzucić tę ofertę?",
        body: `Kupujący (${offer.buyerLabel}) dostanie odpowiedź od agenta. Tej decyzji nie da się cofnąć w panelu.`,
        confirmLabel: "Odrzuć ofertę",
        destructive: true,
      }))
    )
      return;
    setBusy(true);
    try {
      await portalAction(token, "respond_buyer_offer", {
        buyerOfferId: offer.id,
        response,
        counterAmount: response === "counter" ? Number(counter.replace(/\s/g, "")) : null,
        comment,
      });
      portalToast.success(
        response === "accept" ? "Oferta przyjęta" : response === "counter" ? "Kontroferta wysłana" : "Oferta odrzucona",
        "Agent dostał Twoją decyzję i odezwie się z dalszymi krokami.",
      );
      onChanged();
    } catch (e) {
      portalToast.error("Nie udało się wysłać decyzji", e);
    } finally {
      setBusy(false);
    }
  };

  const facts: Array<[string, string]> = [
    ["Finansowanie", FINANCING[offer.financing] || offer.financing],
    ["Zadatek", offer.deposit ? formatPln(offer.deposit) : "—"],
    ["Akt do", offer.deedWeeks ? `ok. ${offer.deedWeeks} tyg.` : "—"],
    ["Wydanie mieszkania", offer.handoverDays ? `${offer.handoverDays} dni po akcie` : "—"],
  ];

  return (
    <article className={`lux-card overflow-hidden ${open ? "shadow-[0_18px_40px_rgba(21,23,26,0.08)]" : "opacity-90"}`}>
      <div className="flex items-start justify-between p-4 pb-0">
        <div>
          <p className="lux-kicker !text-[10px]">{offer.buyerLabel}</p>
          <p className="lux-serif mt-1.5 text-[28px]">{formatPln(offer.amount)}</p>
          {diffPct != null ? (
            <p className="text-[13px] text-[#5B574F]">
              {diffPct >= 0 ? "+" : "−"}
              {Math.abs(diffPct).toFixed(1).replace(".", ",")}% od ceny w ogłoszeniu
            </p>
          ) : null}
        </div>
        {!open ? (
          <span className="rounded-full bg-black px-2.5 py-1 text-[11px] font-bold text-[#D8C3A0]">
            {offer.status === "ACCEPTED" ? "Przyjęta" : offer.status === "COUNTERED" ? `Kontroferta ${formatPln(offer.counterAmount)}` : offer.status === "REJECTED" ? "Odrzucona" : "Zamknięta"}
          </span>
        ) : offer.respondBy ? (
          <span className="rounded-full bg-[#D8C3A0] px-2.5 py-1 text-[11px] font-extrabold text-black">
            do {new Date(offer.respondBy).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}
          </span>
        ) : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-px bg-[#F1ECE3]">
        {facts.map(([label, value]) => (
          <div key={label} className="bg-white px-4 py-3">
            <p className="text-[11px] text-[#5B574F]">{label}</p>
            <p className="mt-0.5 text-[14px] font-bold">{value}</p>
          </div>
        ))}
      </div>
      <div className="p-4">
        {offer.recommendation ? (
          <p className="text-[13px] leading-relaxed text-[#2E2C28]">
            <b>{agentFirst}:</b> {offer.recommendation}
          </p>
        ) : null}
        {offer.clientComment && !open ? <p className="mt-2 text-[12px] text-[#5B574F]">Twój komentarz: „{offer.clientComment}”</p> : null}
        {open ? (
          <>
            {mode === "counter" ? (
              <div className="mt-3 space-y-2">
                <label htmlFor={`counter-${offer.id}`} className="text-[12px] font-bold">
                  Twoja kwota
                </label>
                <input
                  id={`counter-${offer.id}`}
                  inputMode="numeric"
                  value={counter}
                  onChange={(e) => setCounter(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-[#E6E0D6] bg-white px-3 text-[16px] font-semibold"
                />
              </div>
            ) : null}
            <label htmlFor={`comment-${offer.id}`} className="sr-only">
              Komentarz
            </label>
            <textarea
              id={`comment-${offer.id}`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder={`Komentarz dla ${agentFirst} (opcjonalnie)`}
              className="mt-3 w-full rounded-2xl border border-[#E6E0D6] bg-white p-3 text-[14px]"
            />
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              <button type="button" disabled={busy} onClick={() => void respond("accept")} className="min-h-[46px] rounded-xl bg-[var(--lux-accent)] text-[12px] font-bold text-[#F6F3EE]">
                Przyjmuję
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => (mode === "counter" ? void respond("counter") : setMode("counter"))}
                className="min-h-[46px] rounded-xl bg-black text-[12px] font-bold text-[#D8C3A0]"
              >
                {mode === "counter" ? "Wyślij kwotę" : "Kontroferta"}
              </button>
              <button type="button" disabled={busy} onClick={() => void respond("reject")} className="min-h-[46px] rounded-xl border border-[#E6E0D6] bg-white text-[12px] font-semibold">
                Odrzucam
              </button>
            </div>
          </>
        ) : null}
      </div>
    </article>
  );
}

export function SellerBuyerOffers({
  seller,
  listPrice,
  token,
  agentFirst,
  onChanged,
}: {
  seller: SellerPortalV2;
  listPrice: number;
  token: string;
  agentFirst: string;
  onChanged: () => void;
}) {
  if (!seller.buyerOffers.length) return null;
  const open = seller.buyerOffers.filter((o) => o.status === "OPEN");
  return (
    <section id="portal-buyer-offers" className="scroll-mt-24 space-y-3">
      <p className="lux-kicker">Oferty kupujących</p>
      <h2 className="lux-serif text-[24px] font-medium leading-tight">
        {open.length ? `${open.length === 1 ? "Oferta" : `${open.length} oferty`} na stole` : "Historia ofert"}
      </h2>
      {seller.buyerOffers.map((offer) => (
        <BuyerOfferCard key={offer.id} offer={offer} listPrice={listPrice} token={token} agentFirst={agentFirst} onChanged={onChanged} />
      ))}
    </section>
  );
}

export function SellerShowingFeedback({ seller, agentRecommendation, agentFirst }: { seller: SellerPortalV2; agentRecommendation?: string | null; agentFirst: string }) {
  const fb = seller.showingFeedback;
  if (!fb || !fb.items.length) return null;
  const max = Math.max(...fb.items.map((i) => i.count));
  return (
    <section className="lux-card p-4">
      <p className="lux-serif text-[19px] font-medium">Co mówią kupujący</p>
      <p className="mt-0.5 text-[12px] text-[#5B574F]">
        {fb.showings} {fb.showings === 1 ? "oglądanie" : fb.showings < 5 ? "oglądania" : "oglądań"} · uwagi anonimowe
      </p>
      <div className="mt-3.5 space-y-2.5">
        {fb.items.map((item) => (
          <div key={item.tag} className="flex items-center gap-2.5">
            <span className="w-[120px] text-[12px] font-semibold">{item.tag}</span>
            <div className="h-2 flex-1 rounded-full bg-[#F1ECE3]">
              <div className="h-2 rounded-full" style={{ width: `${(item.count / max) * 100}%`, background: item.negative ? "#B07A3A" : "var(--lux-accent)" }} />
            </div>
            <span className="w-6 text-right text-[12px] font-bold">{item.count}</span>
          </div>
        ))}
      </div>
      {agentRecommendation ? (
        <div className="mt-3.5 rounded-[14px] bg-[#F6F3EE] p-3">
          <p className="text-[12px] font-extrabold text-[#7A5F33]">Rekomendacja {agentFirst}</p>
          <p className="mt-1 text-[13px] leading-relaxed">{agentRecommendation}</p>
        </div>
      ) : null}
    </section>
  );
}

export function SellerCompetition({ seller }: { seller: SellerPortalV2 }) {
  const c = seller.competition;
  if (!c || (!c.similarCount && !c.transactionPpsm)) return null;
  const rows: Array<[string, string, boolean]> = [
    ["Twoje mieszkanie", `${c.ownPpsm ? `${c.ownPpsm.toLocaleString("pl-PL")} zł/m²` : "—"} · ${c.ownDays} dni`, true],
  ];
  if (c.similarCount)
    rows.push([`Podobne oferty (${c.similarCount})`, `${c.similarPpsm ? `${c.similarPpsm.toLocaleString("pl-PL")} zł/m²` : "—"}${c.similarDays != null ? ` · ${c.similarDays} dni` : ""}`, false]);
  if (c.transactionPpsm) rows.push(["Transakcje u notariuszy", `${c.transactionPpsm.toLocaleString("pl-PL")} zł/m²`, false]);
  const better = c.ownPpsm && c.similarPpsm ? c.ownPpsm <= c.similarPpsm : null;
  return (
    <section>
      <p className="lux-kicker">Rynek wokół Twojego mieszkania</p>
      <h2 className="lux-serif mt-1.5 text-[24px] font-medium">Konkurencja w okolicy</h2>
      <div className="lux-card mt-3 px-4">
        {rows.map(([label, value, own], i) => (
          <div key={label} className={`flex justify-between gap-3 py-3 text-[13px] ${i ? "border-t border-[#F1ECE3]" : ""}`}>
            <span className={own ? "font-bold" : "text-[#45423C]"}>{label}</span>
            <span className={own ? "font-extrabold text-[var(--lux-accent)]" : "font-semibold"}>{value}</span>
          </div>
        ))}
      </div>
      {better != null ? (
        <p className="mt-2 px-1 text-[12px] text-[#5B574F]">
          {better ? "Twoja cena za metr jest konkurencyjna wobec podobnych ofert." : "Podobne oferty są tańsze za metr — warto o tym porozmawiać z agentem."}
        </p>
      ) : null}
    </section>
  );
}

/** „Ile zostanie na rękę” — z możliwością podania kredytu i roku zakupu. */
export function SellerNetSheet({
  open,
  onClose,
  seller,
  defaultPrice,
  token,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  seller: SellerPortalV2;
  defaultPrice: number;
  token: string;
  onSaved: () => void;
}) {
  const offersPrices = seller.buyerOffers.filter((o) => o.status === "OPEN").map((o) => o.amount);
  const [price, setPrice] = useState(offersPrices[0] || defaultPrice);
  const [mortgage, setMortgage] = useState(seller.finance.mortgageBalance ?? 0);
  const [year, setYear] = useState(seller.finance.purchaseYear ?? 0);
  const [purchase, setPurchase] = useState(seller.finance.purchasePrice ?? 0);
  const [saving, setSaving] = useState(false);

  const calc = useMemo(() => {
    const pct = seller.finance.commissionPct ?? 0;
    const commissionNet = Math.round((price * pct) / 100);
    const commission = seller.finance.commissionVat ? Math.round(commissionNet * 1.23) : commissionNet;
    const other = seller.finance.otherCosts ?? 300;
    let tax = 0;
    let taxNote = "Podaj rok zakupu, żeby sprawdzić podatek.";
    if (year > 1900) {
      const free = year + 6;
      if (new Date().getFullYear() >= free) taxNote = "Podatek 0 zł — minęło 5 lat od końca roku zakupu.";
      else if (purchase > 0) {
        tax = Math.round(Math.max(0, price - purchase - commission - other) * 0.19);
        taxNote = `19% od dochodu (sprzedaż przed ${free} r.). Ulga mieszkaniowa może go obniżyć do zera.`;
      } else taxNote = `Sprzedaż przed ${free} r. — podaj cenę zakupu.`;
    }
    return { pct, commission, other, tax, taxNote, net: price - mortgage - commission - tax - other };
  }, [price, mortgage, year, purchase, seller.finance]);

  const save = async () => {
    setSaving(true);
    try {
      await portalAction(token, "save_seller_finance", { finance: { mortgageBalance: mortgage, purchaseYear: year || null, purchasePrice: purchase || null } });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const num = (v: string) => Number(v.replace(/\s/g, "").replace(",", ".")) || 0;
  const field = (id: string, label: string, value: number, set: (n: number) => void, suffix: string) => (
    <label htmlFor={id} className="block">
      <span className="text-[12px] font-bold text-[#45423C]">{label}</span>
      <span className="mt-1 flex h-12 items-center rounded-2xl border border-[#E6E0D6] bg-white px-3">
        <input id={id} inputMode="numeric" value={value ? String(value) : ""} onChange={(e) => set(num(e.target.value))} className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold outline-none" />
        <span className="text-[13px] text-[#5B574F]">{suffix}</span>
      </span>
    </label>
  );

  return (
    <LuxSheet open={open} onClose={onClose} kicker="Narzędzie" title="Ile zostanie na rękę">
      {offersPrices.length ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {[defaultPrice, ...offersPrices].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((v) => (
            <button key={v} type="button" onClick={() => setPrice(v)} className={`lux-chip ${price === v ? "lux-chip--on" : ""}`}>
              {v === defaultPrice ? "Cena z ogłoszenia" : `Oferta ${formatPln(v)}`}
            </button>
          ))}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">{field("net-price", "Cena sprzedaży", price, setPrice, "zł")}</div>
        <div className="col-span-2">{field("net-mortgage", "Kredyt do spłaty", mortgage, setMortgage, "zł")}</div>
        {field("net-year", "Rok zakupu", year, setYear, "")}
        {field("net-purchase", "Cena zakupu", purchase, setPurchase, "zł")}
      </div>
      <div className="mt-4 rounded-[22px] bg-black p-5 text-[#F6F3EE]">
        {[
          ["Cena sprzedaży", price],
          ["Spłata kredytu", -mortgage],
          [`Wynagrodzenie biura (${calc.pct}%${seller.finance.commissionVat ? " + VAT" : ""})`, -calc.commission],
          ["Podatek od sprzedaży", -calc.tax],
          ["Zaświadczenia i opłaty", -calc.other],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex justify-between py-1.5 text-[14px]">
            <span className="text-[#BDB6AA]">{label}</span>
            <span className="font-bold">{Number(value) < 0 ? `−${formatPln(-Number(value))}` : formatPln(Number(value))}</span>
          </div>
        ))}
        <div className="my-3 h-px bg-[#D8C3A0]/30" />
        <div className="flex items-baseline justify-between">
          <span className="text-[14px] font-bold text-[#D8C3A0]">Na rękę</span>
          <span className="lux-serif text-[30px]">{formatPln(calc.net)}</span>
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-[#5B574F]">{calc.taxNote} Wyliczenie orientacyjne — przed aktem potwierdzi je notariusz.</p>
      <button type="button" className="lux-btn lux-btn--ghost mt-3 w-full" disabled={saving} onClick={() => void save()}>
        {saving ? "Zapisuję…" : "Zapamiętaj moje dane"}
      </button>
    </LuxSheet>
  );
}
