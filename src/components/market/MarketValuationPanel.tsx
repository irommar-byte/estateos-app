"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { MarketComp, PriceScore, ValuationResult } from "@/lib/market/types";

type ReportQuota = {
  kind: "admin" | "investor" | "office" | "credits" | "none";
  used: number;
  cap: number | null;
  remaining: number;
  windowLabel: string;
  message: string;
};

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
  clientId?: number | null;
};

function pln(n: number) {
  return `${Math.round(n).toLocaleString("pl-PL")} zł`;
}
function ppsm(n: number) {
  return `${Math.round(n).toLocaleString("pl-PL")} zł/m²`;
}

function PriceCompare({ result, listingPrice }: { result: ValuationResult; listingPrice?: number | null }) {
  const clientPrice = (result.listingPrice && result.listingPrice > 0 ? result.listingPrice : listingPrice) || null;
  const recommended = result.estimated.recommendedAsk;
  if (!clientPrice || !recommended) return null;
  const max = Math.max(clientPrice, recommended, result.estimated.high);
  const width = (n: number) => `${Math.max(8, Math.min(100, Math.round((n / max) * 100)))}%`;
  const delta = clientPrice - recommended;
  const pct = recommended > 0 ? (delta / recommended) * 100 : 0;
  const absPct = Math.abs(pct).toFixed(1).replace(".", ",");
  let caption: string;
  if (Math.abs(pct) < 1.5) {
    caption = "Cena klienta jest zbliżona do rekomendacji z transakcji.";
  } else if (delta < 0) {
    caption = `Klient wycenia o ${pln(Math.abs(delta))} (${absPct}%) poniżej rekomendacji z aktów.`;
  } else {
    caption = `Klient wycenia o ${pln(Math.abs(delta))} (${absPct}%) powyżej rekomendacji z aktów.`;
  }
  return (
    <div className="eos-inset-well space-y-3 rounded-2xl px-4 py-4">
      <p className="eos-portal-label">Porównanie ceny</p>
      <div>
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <span className="text-xs text-[var(--eos-muted)]">Cena zaproponowana przez klienta</span>
          <span className="text-sm font-black tabular-nums text-[var(--eos-text)]">{pln(clientPrice)}</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[var(--eos-input)]">
          <div className="h-full rounded-full bg-[#0071e3]" style={{ width: width(clientPrice) }} />
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <span className="text-xs text-[var(--eos-muted)]">Rekomendacja z transakcji RCN</span>
          <span className="text-sm font-black tabular-nums text-emerald-600">{pln(recommended)}</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[var(--eos-input)]">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: width(recommended) }} />
        </div>
      </div>
      <p className="text-[12px] leading-relaxed text-[var(--eos-muted)]">
        Zakres rynkowy: {pln(result.estimated.low)} – {pln(result.estimated.high)}. {caption}
      </p>
    </div>
  );
}

function ScoreBadge({ score }: { score: PriceScore }) {
  const color =
    score.tone === "good"
      ? "border-emerald-500/35 text-emerald-700"
      : score.tone === "high"
        ? "border-rose-500/35 text-rose-700"
        : score.tone === "low"
          ? "border-sky-500/35 text-sky-700"
          : "border-amber-500/35 text-amber-800";
  return (
    <div className={`eos-lux-panel rounded-2xl px-4 py-3 ${color}`}>
      <p className="eos-portal-label">EstateOS™ Price Score</p>
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
  clientId,
}: Props) {
  const [result, setResult] = useState<(ValuationResult & { access?: { quota?: ReportQuota | null } }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reportState, setReportState] = useState<"idle" | "confirming" | "generating" | "sending" | "sent" | "pay">("idle");
  const [reportMsg, setReportMsg] = useState("");
  const [email, setEmail] = useState(reportEmail || "");
  const [alternateEmail, setAlternateEmail] = useState("");
  const [quota, setQuota] = useState<ReportQuota | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [generatedReportId, setGeneratedReportId] = useState<number | null>(null);

  useEffect(() => {
    setEmail(reportEmail || "");
  }, [reportEmail]);

  const loadQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/market/report", { cache: "no-store", credentials: "include" });
      const json = await res.json();
      if (json?.quota) setQuota(json.quota);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadQuota();
  }, [loadQuota]);

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
        credentials: "include",
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
      if (json?.access?.quota) setQuota(json.access.quota);
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

  const reportBody = () => ({
    lat,
    lng,
    area,
    rooms,
    floor,
    city,
    district,
    address,
    listingPrice,
    email,
    alternateEmail,
    clientId: clientId || undefined,
  });

  const propertyLabel = [address, district, city].filter(Boolean).join(", ") || "tej nieruchomości";
  const propertyMeta = [area ? `${area} m²` : null, rooms ? `${rooms} pok.` : null].filter(Boolean).join(" · ");

  const askGenerate = () => {
    if (!result) return;
    if (quota && quota.remaining <= 0) {
      setReportMsg(quota.message);
      if (quota.kind === "none" || quota.kind === "credits") setReportState("pay");
      return;
    }
    setReportMsg("");
    setReportState("confirming");
  };

  const confirmGenerate = async () => {
    if (!result) return;
    setReportState("generating");
    setReportMsg("");
    try {
      const res = await fetch("/api/market/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...reportBody(), generate: true }),
      });
      const json = await res.json();
      if (json?.quota) setQuota(json.quota);
      if (res.status === 402 || json?.code === "NEEDS_CREDIT") {
        setReportState("pay");
        setReportMsg(String(json?.message || "Potrzebny 1 kredyt raportu."));
        return;
      }
      if (!json?.ok) {
        setReportState("idle");
        setReportMsg(String(json?.message || "Nie wygenerowano raportu."));
        return;
      }
      const id = Number(json.reportId);
      setGeneratedReportId(Number.isFinite(id) && id > 0 ? id : null);
      setPreviewHtml(String(json.html || ""));
      setReportState("idle");
      setReportMsg("Raport wygenerowany — 1 punkt z limitu już pobrany. Wysyłka e-mail nic więcej nie zdejmie.");
      void loadQuota();
    } catch {
      setReportState("idle");
      setReportMsg("Nie udało się wygenerować raportu.");
    }
  };

  const confirmSend = async () => {
    if (!generatedReportId) {
      setReportMsg("Najpierw wygeneruj raport — dopiero to schodzi z limitu.");
      return;
    }
    if (!email.trim() && !alternateEmail.trim() && !reportEmail) {
      setReportMsg("Wpisz e-mail klienta albo adres alternatywny. Wysyłka nie zużyje kolejnego punktu.");
      return;
    }
    setReportState("sending");
    try {
      const res = await fetch("/api/market/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...reportBody(), reportId: generatedReportId }),
      });
      const json = await res.json();
      if (json?.quota) setQuota(json.quota);
      if (!json?.ok) {
        setReportState("idle");
        setReportMsg(String(json?.message || "Nie wysłano raportu."));
        return;
      }
      setPreviewHtml(null);
      setReportState("sent");
      const dest = Array.isArray(json.emails) ? json.emails.join(", ") : email;
      setReportMsg(
        json.emailed
          ? `Raport wyszedł na ${dest}.${json.clientRecorded ? " Zapisaliśmy to też w panelu klienta." : ""} Limit się nie zmienił.`
          : "Raport zapisany — sprawdź skrzynkę, jeśli mail nie doszedł. Limit się nie zmienił.",
      );
      void loadQuota();
    } catch {
      setReportState("idle");
      setReportMsg("Nie udało się wysłać raportu.");
    }
  };

  const buyCredit = async () => {
    const draftRes = await fetch("/api/market/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        lat, lng, area, rooms, floor, city, district, address, listingPrice, email,
      }),
    });
    const draft = await draftRes.json();
    const checkout = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        plan: "market_report",
        draftId: draft.draftId,
        email,
        returnUrl: typeof window !== "undefined" ? window.location.href : "/wycena",
        cancelUrl: typeof window !== "undefined" ? window.location.href : "/wycena",
      }),
    });
    const pay = await checkout.json();
    if (pay?.url) window.location.href = pay.url;
  };

  const remainingLabel =
    quota && quota.cap != null
      ? `${quota.remaining} / ${quota.cap}`
      : quota?.kind === "credits"
        ? `${quota.remaining}`
        : null;

  return (
    <>
    <div className="eos-lux-panel rounded-[1.75rem]">
      <div className="border-b border-[rgba(196,163,90,0.22)] px-5 py-4">
        <p className="eos-portal-label eos-portal-label--ok">EstateOS™ Market</p>
        <p className="mt-1 text-sm font-semibold text-[var(--eos-text)]">Rzeczywiste ceny transakcyjne — Rejestr Cen Nieruchomości</p>
      </div>
      <div className="space-y-4 p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--eos-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Liczę porównywalne akty…
          </div>
        ) : null}
        {error ? <p className="text-sm leading-relaxed text-amber-600">{error}</p> : null}
        {result ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="eos-inset-well rounded-2xl px-3 py-3">
                <p className="eos-portal-label">Najbardziej prawdopodobna</p>
                <p className="mt-1 text-2xl font-black tabular-nums tracking-tight text-[var(--eos-text)]">{pln(result.estimated.mid)}</p>
                <p className="text-xs text-[var(--eos-muted)]">{ppsm(result.estimated.ppsm)}</p>
              </div>
              <div className="eos-inset-well rounded-2xl px-3 py-3">
                <p className="eos-portal-label">Zakres</p>
                <p className="mt-1 text-lg font-black tabular-nums text-[var(--eos-text)]">{pln(result.estimated.low)} – {pln(result.estimated.high)}</p>
                <p className="text-xs text-[var(--eos-muted)]">
                  {result.stats.count} aktów · {result.stats.windowMonths} mies.
                  {result.stats.basis === "comps" ? ` · ${result.stats.radiusM} m` : result.stats.basis === "district" ? " · mediana dzielnicy" : " · mediana miasta"}
                </p>
              </div>
              <div className="eos-inset-well rounded-2xl px-3 py-3">
                <p className="eos-portal-label">Cena ofertowa</p>
                <p className="mt-1 text-lg font-black tabular-nums text-emerald-600">{pln(result.estimated.recommendedAsk)}</p>
                {onApply ? (
                  <button type="button" onClick={() => onApply(result.estimated.recommendedAsk)} className="eos-lux-btn eos-lux-btn--link !min-h-0 !px-0 !py-1 !text-[11px] !tracking-[0.08em] !text-emerald-700">
                    {applyLabel}
                  </button>
                ) : null}
              </div>
            </div>
            {result.vsListing ? <ScoreBadge score={result.vsListing} /> : null}
            <PriceCompare result={result} listingPrice={listingPrice} />
            {result.comps.length ? (
              <div className="eos-inset-well rounded-2xl px-3 py-2">
                <p className="eos-portal-label mb-1 px-1 pt-1">Porównywalne transakcje</p>
                {result.comps.slice(0, 8).map((c) => (
                  <CompRow key={c.id} c={c} />
                ))}
              </div>
            ) : null}
            {showReport ? (
              <div className="eos-lux-panel space-y-3 rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="eos-portal-label eos-portal-label--ok">Raport dla właściciela</p>
                  {quota ? (
                    <span className="eos-lux-badge">
                      {remainingLabel ? `Zostało ${remainingLabel}` : quota.message}
                    </span>
                  ) : null}
                </div>
                {quota?.message ? (
                  <p className="text-[12px] leading-relaxed text-[var(--eos-muted)]">{quota.message}</p>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="eos-portal-label">E-mail klienta</span>
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="z karty klienta, jeśli jest"
                      className="eos-field-inset eos-field-inset--pill mt-1.5 w-full py-2.5 text-sm text-[var(--eos-text)] outline-none"
                    />
                  </label>
                  <label>
                    <span className="eos-portal-label">E-mail alternatywny</span>
                    <input
                      type="email"
                      autoComplete="off"
                      value={alternateEmail}
                      onChange={(e) => setAlternateEmail(e.target.value)}
                      placeholder="np. współwłaściciel"
                      className="eos-field-inset eos-field-inset--pill mt-1.5 w-full py-2.5 text-sm text-[var(--eos-text)] outline-none"
                    />
                  </label>
                </div>
                <p className="text-[11px] leading-relaxed text-[var(--eos-muted)]">
                  Limit schodzi dopiero po potwierdzeniu wygenerowania raportu tej nieruchomości. Potem możesz wysłać go na e-mail albo do panelu klienta — bez kolejnego punktu.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={reportState === "generating" || reportState === "sending"}
                    onClick={askGenerate}
                    className="eos-lux-btn eos-lux-btn--primary px-5 py-2.5 text-[11px] disabled:opacity-50"
                  >
                    {reportState === "generating" ? "Generuję raport…" : generatedReportId ? "Wygeneruj kolejny" : "Generuj raport dla właściciela"}
                  </button>
                  {generatedReportId ? (
                    <button
                      type="button"
                      disabled={reportState === "sending"}
                      onClick={() => void confirmSend()}
                      className="eos-lux-btn eos-lux-btn--platinum px-5 py-2.5 text-[11px] disabled:opacity-50"
                    >
                      {reportState === "sending" ? "Wysyłam…" : "Wyślij e-mail"}
                    </button>
                  ) : null}
                  {reportState === "pay" ? (
                    <button type="button" onClick={() => void buyCredit()} className="eos-lux-btn eos-lux-btn--gold px-4 py-2 text-[11px]">
                      Kup 1 kredyt (49 zł)
                    </button>
                  ) : null}
                  <Link href="/market" className="eos-lux-btn eos-lux-btn--link !min-h-0 !px-2 !py-1 !text-[11px] !text-[var(--eos-muted)]">
                    Otwórz Market
                  </Link>
                </div>
                {reportMsg ? <p className="text-[12px] text-[var(--eos-muted)]">{reportMsg}</p> : null}
              </div>
            ) : null}
            <p className="text-[10px] leading-relaxed text-[var(--eos-muted)]">{result.coverage.disclaimer}</p>
          </>
        ) : null}
      </div>
    </div>

      {reportState === "confirming" && result ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 sm:items-center">
          <div className="eos-lux-panel w-full max-w-lg overflow-hidden rounded-[1.75rem] shadow-2xl">
            <div className="px-5 py-5">
              <p className="eos-portal-label eos-portal-label--ok">Limit raportów</p>
              <h3 className="mt-1 text-lg font-black text-[var(--eos-text)]">Wygenerować raport tej nieruchomości?</h3>
              <p className="mt-3 text-sm font-semibold text-[var(--eos-text)]">{propertyLabel}</p>
              {propertyMeta ? <p className="mt-0.5 text-[12px] text-[var(--eos-muted)]">{propertyMeta}</p> : null}
              <p className="mt-4 text-sm leading-relaxed text-[var(--eos-muted)]">
                Potwierdzenie zużyje <span className="font-bold text-[var(--eos-text)]">1 punkt z limitu</span>
                {quota && quota.cap != null ? ` — zostanie ${Math.max(0, quota.remaining - 1)} z ${quota.cap}` : ""}.
                Wysyłka e-mail albo zapis w panelu klienta nie zdejmie kolejnego.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-[rgba(196,163,90,0.2)] px-5 py-4">
              <button
                type="button"
                onClick={() => setReportState("idle")}
                className="eos-lux-btn eos-lux-btn--platinum px-4 py-2 text-[11px]"
              >
                Nie
              </button>
              <button
                type="button"
                onClick={() => void confirmGenerate()}
                className="eos-lux-btn eos-lux-btn--primary px-5 py-2 text-[11px]"
              >
                Tak, wygeneruj
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewHtml ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 sm:items-center">
          <div className="eos-lux-panel flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[1.75rem] shadow-2xl">
            <div className="border-b border-[rgba(196,163,90,0.2)] px-5 py-4">
              <p className="eos-portal-label eos-portal-label--ok">Raport wygenerowany</p>
              <h3 className="mt-1 text-lg font-black text-[var(--eos-text)]">Limit już pobrany — możesz wysłać e-mail</h3>
              <p className="mt-1 text-sm text-[var(--eos-muted)]">
                {email.trim() || alternateEmail.trim() || reportEmail
                  ? `Wyślemy na: ${[email, alternateEmail, reportEmail].filter(Boolean).join(", ")}`
                  : "Wpisz e-mail poniżej albo zamknij i wyślij później."}
                {" · wysyłka nie zdejmie kolejnego punktu"}
              </p>
            </div>
            <iframe
              title="Podgląd raportu EstateOS Market"
              srcDoc={previewHtml}
              className="min-h-[52vh] w-full flex-1 bg-white"
            />
            <div className="flex flex-wrap justify-end gap-2 border-t border-[rgba(196,163,90,0.2)] px-5 py-4">
              <button
                type="button"
                onClick={() => setPreviewHtml(null)}
                className="eos-lux-btn eos-lux-btn--platinum px-4 py-2 text-[11px]"
              >
                Zostaw bez wysyłki
              </button>
              <button
                type="button"
                disabled={reportState === "sending"}
                onClick={() => void confirmSend()}
                className="eos-lux-btn eos-lux-btn--primary px-5 py-2 text-[11px] disabled:opacity-50"
              >
                {reportState === "sending" ? "Wysyłam…" : "Wyślij e-mail"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
