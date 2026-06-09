"use client";

import { useEffect, useState } from "react";
import { TrendingDown } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { numberFormatLocale } from "@/i18n/config";
import PriceHistoryChart from "@/components/offer/PriceHistoryChart";
import { buildChartSeriesFromHistory, type OfferPriceHistoryRow } from "@/lib/offerPriceHistory";

type Props = {
  offerId: number;
  enabled: boolean;
};

export default function OfferPriceHistoryProSection({ offerId, enabled }: Props) {
  const { locale } = useLocale();
  const [rows, setRows] = useState<OfferPriceHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !Number.isFinite(offerId)) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/offers/${offerId}/price-history`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && Array.isArray(json?.history)) setRows(json.history);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, offerId]);

  if (!enabled || loading || rows.length < 2) return null;

  const dateTag = numberFormatLocale(locale) === "pl-PL" ? "pl-PL" : numberFormatLocale(locale) === "uk-UA" ? "uk-UA" : "en-GB";
  const title =
    locale === "pl" ? "Historia ceny" : locale === "uk" ? "Історія ціни" : "Price history";
  const subtitle =
    locale === "pl"
      ? "Zmiany ceny od wystawienia — widoczne dla Investor Pro."
      : locale === "uk"
        ? "Зміни ціни від моменту публікації — для Investor Pro."
        : "Price changes since listing — visible to Investor Pro members.";

  const series = buildChartSeriesFromHistory(rows);
  const fmt = (pln: number) =>
    new Intl.NumberFormat(dateTag, { maximumFractionDigits: 0 }).format(Math.round(pln)) + " PLN";

  return (
    <section className="eos-offer-panel mt-8 overflow-hidden p-8 md:p-10">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
          <TrendingDown size={20} />
        </div>
        <div>
          <h3 className="text-lg font-black uppercase tracking-[0.14em] text-[var(--eos-text)]">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-[var(--eos-muted)]">{subtitle}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]/60 px-4 py-5">
        <PriceHistoryChart data={series} height={64} className="w-full max-w-lg" />
      </div>

      <ul className="mt-6 space-y-2">
        {[...rows].reverse().slice(0, 8).map((row) => (
          <li
            key={row.id}
            className="flex items-center justify-between gap-4 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] px-4 py-3 text-sm"
          >
            <span className="font-semibold tabular-nums text-[var(--eos-text)]">{fmt(row.pricePln)}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">
              {new Date(row.recordedAt).toLocaleString(dateTag, {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
