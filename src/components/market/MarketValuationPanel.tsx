"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { MarketComp, PriceScore, ValuationResult } from "@/lib/market/types";

type Props = {
  lat?: number | null;
  lng?: number | null;
  area?: number | null;
  rooms?: number | null;
  floor?: number | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  listingPrice?: number | null;
  purpose?: "crm" | "listing" | "consumer" | "hub";
  onApply?: (price: number) => void;
  applyLabel?: string;
  showReport?: boolean;
  reportEmail?: string;
};

function pln(n: number) {
  return `${Math.round(n).toLocaleString("pl-PL")} zł`;
}
function ppsm(n: number) {
  return `${Math.round(n).toLocaleString("pl-PL")} zł/m²`;
}

function ScoreBadge({ score }: { score: PriceScore }) {
  const color =
    score.tone === "good"
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : score.tone === "high"
        ? "text-red-400 border-red-500/30 bg-red-500/10"
        : score.tone === "low"
          ? "text-sky-400 border-sky-500/30 bg-sky-500/10"
          : "text-amber-400 border-amber-500/30 bg-amber-500/10";
  return (
    <div className={`rounded-2xl border px-4 py-3 ${color}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.16em]">EstateOS™ Price Score</p>
      <p className="mt-1 text-3xl font-black tabular-nums">{score.score}<span className="text-base font-bold opacity-70"> / 100</span></p>
      <p className="mt-1 text-sm font-semibold">{score.label}</p>
      <p className="mt-1 text-[12px] leading-relaxed opacity-80">{score.detail}</p>
    </div>
  );
}

function CompRow({ c }: { c: MarketComp }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--eos-border)] py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--eos-text)]">{c.address || c.district || "Okolica"}</p>
        <p className="text-[11px] text-[var(--eos-muted)]">
          {[c.area ? `${c.area} m²` : null, c.rooms ? `${c.rooms} pok.` : null, c.floor != null ? `p. ${c.floor}` : null, c.deedAt]
            .filter(Boolean)
            .join(" · ")}
          {c.distanceM ? ` · ${c.distanceM} m` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-black tabular-nums text-[var(--eos-text)]">{pln(c.price)}</p>
        <p className="text-[11px] tabular-nums text-[var(--eos-muted)]">{ppsm(c.ppsm)}</p>
      </div>
    </div>
  );
}

export default function MarketValuationPanel({
  lat,
  lng,
  area,
  rooms,
  floor,
  city,
  district,
  address,
  listingPrice,
  purpose = "crm",
  onApply,
  applyLabel = "Zastosuj rekomendację",
  showReport = true,
  reportEmail,
}: Props) {
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reportState, setReportState] = useState<"idle" | "sending" | "sent" | "pay">("idle");
  const [reportMsg, setReportMsg] = useState("");

  const load = useCallback(async () => {
    if (lat == null || lng == null || !area) {
      setResult(null);
      setError("Uzupełnij adres na mapie i powierzchnię, żeby zobaczyć wycenę z aktów RCN.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/market/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat,
          lng,
          area,
          rooms,
          floor,
          city,
          district,
          address,
          listingPrice,
          purpose,
        }),
      });
      const json = await res.json();
      if (!json?.ok) {
        setResult(null);
        setError(String(json?.message || "Nie udało się policzyć wyceny."));
        return;
      }
      setResult(json as ValuationResult);
    } catch {
      setError("Brak połączenia z EstateOS™ Market.");
    } finally {
      setLoading(false);
    }
  }, [lat, lng, area, rooms, floor, city, district, address, listingPrice, purpose]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 400);
    return () => clearTimeout(t);
  }, [load]);

  const sendReport = async () => {
    if (!result) return;
    setReportState("sending");
    try {
      const res = await fetch("/api/market/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat,
          lng,
          area,
          rooms,
          floor,
          city,
          district,
          address,
          listingPrice,
          email: reportEmail,
        }),
      });
      const json = await res.json();
      if (res.status === 402 || json?.code === "NEEDS_CREDIT") {
        setReportState("pay");
        setReportMsg(String(json?.message || "Potrzebny 1 kredyt raportu."));
        return;
      }
      if (!json?.ok) {
        setReportState("idle");
        setReportMsg(String(json?.message || "Nie wysłano raportu."));
        return;
      }
      setReportState("sent");
      setReportMsg(json.emailed ? "Raport wyszedł na e-mail." : "Raport zapisany — sprawdź skrzynkę, jeśli mail nie doszedł.");
    } catch {
      setReportState("idle");
      setReportMsg("Nie udało się wysłać raportu.");
    }
  };

  const buyCredit = async () => {
    const draftRes = await fetch("/api/market/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat, lng, area, rooms, floor, city, district, address, listingPrice, email: reportEmail,
      }),
    });
    const draft = await draftRes.json();
    const checkout = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan: "market_report",
        draftId: draft.draftId,
        email: reportEmail,
        returnUrl: typeof window !== "undefined" ? window.location.href : "/wycena",
        cancelUrl: typeof window !== "undefined" ? window.location.href : "/wycena",
      }),
    });
    const pay = await checkout.json();
    if (pay?.url) window.location.href = pay.url;
  };

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-emerald-500/20 bg-[var(--eos-card)]">
      <div className="border-b border-emerald-500/15 px-5 py-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">EstateOS™ Market</p>
        <p className="mt-1 text-sm font-semibold text-[var(--eos-text)]">Rzeczywiste ceny transakcyjne — Rejestr Cen Nieruchomości</p>
      </div>
      <div className="space-y-4 p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--eos-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Liczę porównywalne akty…
          </div>
        ) : null}
        {error ? <p className="text-sm leading-relaxed text-amber-500/90">{error}</p> : null}
        {result ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">Najbardziej prawdopodobna</p>
                <p className="text-2xl font-black tabular-nums tracking-tight text-[var(--eos-text)]">{pln(result.estimated.mid)}</p>
                <p className="text-xs text-[var(--eos-muted)]">{ppsm(result.estimated.ppsm)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">Zakres</p>
                <p className="text-lg font-black tabular-nums text-[var(--eos-text)]">{pln(result.estimated.low)} – {pln(result.estimated.high)}</p>
                <p className="text-xs text-[var(--eos-muted)]">
                  {result.stats.count} aktów · {result.stats.windowMonths} mies.
                  {result.stats.basis === "comps" ? ` · ${result.stats.radiusM} m` : result.stats.basis === "district" ? " · mediana dzielnicy" : " · mediana miasta"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">Cena ofertowa</p>
                <p className="text-lg font-black tabular-nums text-emerald-500">{pln(result.estimated.recommendedAsk)}</p>
                {onApply ? (
                  <button type="button" onClick={() => onApply(result.estimated.recommendedAsk)} className="mt-2 text-[12px] font-bold text-emerald-500 hover:underline">
                    {applyLabel}
                  </button>
                ) : null}
              </div>
            </div>
            {result.vsListing ? <ScoreBadge score={result.vsListing} /> : null}
            {result.comps.length ? (
              <div>
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">Porównywalne transakcje</p>
                {result.comps.slice(0, 8).map((c) => (
                  <CompRow key={c.id} c={c} />
                ))}
              </div>
            ) : null}
            {showReport ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={reportState === "sending"}
                  onClick={() => void sendReport()}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-[12px] font-black uppercase tracking-[0.12em] text-black disabled:opacity-50"
                >
                  {reportState === "sending" ? "Wysyłam…" : "Generuj raport dla właściciela"}
                </button>
                {reportState === "pay" ? (
                  <button type="button" onClick={() => void buyCredit()} className="text-[12px] font-bold text-emerald-500">
                    Kup 1 kredyt (49 zł)
                  </button>
                ) : null}
                <Link href="/market" className="text-[12px] font-bold text-[var(--eos-muted)] hover:text-[var(--eos-text)]">
                  Otwórz Market
                </Link>
                {reportMsg ? <p className="w-full text-[12px] text-[var(--eos-muted)]">{reportMsg}</p> : null}
              </div>
            ) : null}
            <p className="text-[10px] leading-relaxed text-[var(--eos-muted)]">{result.coverage.disclaimer}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
