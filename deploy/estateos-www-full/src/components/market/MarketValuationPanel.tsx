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
              <div className="space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-600">Raport dla właściciela</p>
                  {quota ? (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                      {remainingLabel ? `Zostało ${remainingLabel}` : quota.message}
                    </span>
                  ) : null}
                </div>
                {quota?.message ? (
                  <p className="text-[12px] leading-relaxed text-[var(--eos-muted)]">{quota.message}</p>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--eos-muted)]">
                      E-mail klienta
                    </span>
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="z karty klienta, jeśli jest"
                      className="mt-1 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)] outline-none focus:border-emerald-500/50"
                    />
                  </label>
                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--eos-muted)]">
                      E-mail alternatywny
                    </span>
                    <input
                      type="email"
                      autoComplete="off"
                      value={alternateEmail}
                      onChange={(e) => setAlternateEmail(e.target.value)}
                      placeholder="np. współwłaściciel"
                      className="mt-1 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-sm text-[var(--eos-text)] outline-none focus:border-emerald-500/50"
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
                    className="rounded-full bg-emerald-500 px-4 py-2 text-[12px] font-black uppercase tracking-[0.12em] text-black disabled:opacity-50"
                  >
                    {reportState === "generating" ? "Generuję raport…" : generatedReportId ? "Wygeneruj kolejny" : "Generuj raport dla właściciela"}
                  </button>
                  {generatedReportId ? (
                    <button
                      type="button"
                      disabled={reportState === "sending"}
                      onClick={() => void confirmSend()}
                      className="rounded-full border border-emerald-500/40 px-4 py-2 text-[12px] font-black uppercase tracking-[0.12em] text-emerald-700 disabled:opacity-50"
                    >
                      {reportState === "sending" ? "Wysyłam…" : "Wyślij e-mail"}
                    </button>
                  ) : null}
                  {reportState === "pay" ? (
                    <button type="button" onClick={() => void buyCredit()} className="text-[12px] font-bold text-emerald-500">
                      Kup 1 kredyt (49 zł)
                    </button>
                  ) : null}
                  <Link href="/market" className="text-[12px] font-bold text-[var(--eos-muted)] hover:text-[var(--eos-text)]">
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

      {reportState === "confirming" && result ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 sm:items-center">
          <div className="w-full max-w-lg overflow-hidden rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-2xl">
            <div className="px-5 py-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-500">Limit raportów</p>
              <h3 className="mt-1 text-lg font-black text-[var(--eos-text)]">Wygenerować raport tej nieruchomości?</h3>
              <p className="mt-3 text-sm font-semibold text-[var(--eos-text)]">{propertyLabel}</p>
              {propertyMeta ? <p className="mt-0.5 text-[12px] text-[var(--eos-muted)]">{propertyMeta}</p> : null}
              <p className="mt-3 text-2xl font-black tabular-nums text-[var(--eos-text)]">{pln(result.estimated.mid)}</p>
              <p className="mt-1 text-[12px] text-[var(--eos-muted)]">Najbardziej prawdopodobna wartość z aktów RCN</p>
              <p className="mt-4 text-sm leading-relaxed text-[var(--eos-muted)]">
                Potwierdzenie zużyje <span className="font-bold text-[var(--eos-text)]">1 punkt z limitu</span>
                {quota && quota.cap != null ? ` — zostanie ${Math.max(0, quota.remaining - 1)} z ${quota.cap}` : ""}.
                Wysyłka e-mail albo zapis w panelu klienta nie zdejmie kolejnego.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--eos-border)] px-5 py-4">
              <button
                type="button"
                onClick={() => setReportState("idle")}
                className="rounded-full border border-[var(--eos-border)] px-4 py-2 text-[11px] font-black uppercase tracking-wider text-[var(--eos-text)]"
              >
                Nie
              </button>
              <button
                type="button"
                onClick={() => void confirmGenerate()}
                className="rounded-full bg-emerald-500 px-5 py-2 text-[11px] font-black uppercase tracking-wider text-black"
              >
                Tak, wygeneruj
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewHtml ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 sm:items-center">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-2xl">
            <div className="border-b border-[var(--eos-border)] px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-500">Raport wygenerowany</p>
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
            <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--eos-border)] px-5 py-4">
              <button
                type="button"
                onClick={() => setPreviewHtml(null)}
                className="rounded-full border border-[var(--eos-border)] px-4 py-2 text-[11px] font-black uppercase tracking-wider text-[var(--eos-text)]"
              >
                Zostaw bez wysyłki
              </button>
              <button
                type="button"
                disabled={reportState === "sending"}
                onClick={() => void confirmSend()}
                className="rounded-full bg-emerald-500 px-5 py-2 text-[11px] font-black uppercase tracking-wider text-black disabled:opacity-50"
              >
                {reportState === "sending" ? "Wysyłam…" : "Wyślij e-mail"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
