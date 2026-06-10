"use client";

import { useMemo } from "react";
import { TrendingDown } from "lucide-react";
import { computePriceDiscountPercent } from "@/lib/offerPriceHistoryShared";
import { plnFromListingAmount } from "@/lib/money/convert";
import type { ListingCurrency } from "@/lib/money/types";

type Props = {
  listPricePln: number;
  draftPriceRaw: string;
  priceCurrency?: ListingCurrency;
  exchangeRate?: number;
};

function parseDraftPrice(raw: string): number {
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function PriceReductionPreview({
  listPricePln,
  draftPriceRaw,
  priceCurrency = "PLN",
  exchangeRate = 4.25,
}: Props) {
  const draftListing = parseDraftPrice(draftPriceRaw);
  const draftPln = useMemo(
    () => plnFromListingAmount(draftListing, priceCurrency, exchangeRate),
    [draftListing, priceCurrency, exchangeRate],
  );
  const discountPercent = useMemo(
    () => (draftPln > 0 && listPricePln > 0 ? computePriceDiscountPercent(listPricePln, draftPln) : null),
    [draftPln, listPricePln],
  );

  if (discountPercent == null || discountPercent <= 0) return null;

  const listLabel =
    priceCurrency === "EUR"
      ? `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(Math.round(listPricePln / exchangeRate))} EUR`
      : `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(Math.round(listPricePln))} PLN`;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-emerald-500/10 via-black/40 to-black/60 p-5 shadow-[0_20px_50px_rgba(16,185,129,0.12)]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
          <TrendingDown size={18} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-400/90">Podgląd obniżki</p>
          <p className="mt-1 text-sm text-zinc-300">
            Nowa cena będzie niższa o{" "}
            <span className="font-black text-emerald-400">{discountPercent}%</span> względem ceny wystawienia (
            {listLabel}
            {priceCurrency === "EUR" ? (
              <span className="text-zinc-500">
                {" "}
                · ok. {new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(Math.round(listPricePln))} PLN
              </span>
            ) : null}
            ).
          </p>
          <p className="mt-2 text-[11px] text-zinc-500">
            Po zapisie oferta trafi do filtra „Przecenione” w galerii, a na stronie ogłoszenia pojawi się przekreślona cena
            startowa.
          </p>
        </div>
      </div>
    </div>
  );
}
