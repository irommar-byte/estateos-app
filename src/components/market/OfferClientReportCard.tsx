"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type ReportQuota = {
  kind: string;
  used: number;
  cap: number | null;
  remaining: number;
  windowLabel: string;
  message: string;
};

export type StoredOfferReport = {
  id: number;
  createdAt: string;
  mid: number | null;
  city: string | null;
  address: string | null;
  sentClassic: boolean;
  sentPro: boolean;
};

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pln(n: number) {
  return `${Math.round(n).toLocaleString("pl-PL")} zł`;
}

export function MarketReportDualPreview({
  htmlClassic,
  htmlPro,
  sending,
  sentClassic,
  sentPro,
  destLabel,
  onSend,
  onClose,
}: {
  htmlClassic: string;
  htmlPro: string;
  sending: "classic" | "pro" | null;
  sentClassic?: boolean;
  sentPro?: boolean;
  destLabel?: string;
  onSend: (variant: "classic" | "pro") => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center">
      <div className="eos-lux-panel flex max-h-[min(94dvh,960px)] w-full max-w-5xl flex-col overflow-hidden rounded-[1.75rem] shadow-2xl">
        <div className="shrink-0 border-b border-[rgba(196,163,90,0.2)] px-4 py-4 sm:px-5">
          <p className="eos-portal-label eos-portal-label--ok">Dwie wersje raportu</p>
          <h3 className="mt-1 text-lg font-black text-[var(--eos-text)]">Wyślij wybraną wersję do klienta</h3>
          <p className="mt-1 text-sm leading-relaxed text-[var(--eos-muted)]">
            Limit już pobrany. Każdą wersję można wysłać osobno — e-mail, panel klienta i powiadomienie.
            {destLabel ? ` Adres: ${destLabel}.` : " Wpisz e-mail na karcie, jeśli jeszcze go nie ma."}
          </p>
        </div>
        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 sm:grid-cols-2 sm:p-4">
          {(
            [
              {
                key: "pro" as const,
                title: "Dla klienta · mapa i rekomendacja",
                html: htmlPro || htmlClassic,
                sent: sentPro,
              },
              {
                key: "classic" as const,
                title: "Zestawienie transakcji",
                html: htmlClassic || htmlPro,
                sent: sentClassic,
              },
            ]
          ).map((item) => (
            <article
              key={item.key}
              className="flex min-h-[280px] flex-col overflow-hidden rounded-2xl border border-[rgba(196,163,90,0.22)] bg-white"
            >
              <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[rgba(196,163,90,0.16)] px-3 py-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700">
                    {item.sent ? "Wysłano" : "Gotowy do wysyłki"}
                  </p>
                  <p className="mt-0.5 text-sm font-black text-slate-900">{item.title}</p>
                </div>
                <button
                  type="button"
                  disabled={sending != null}
                  onClick={() => onSend(item.key)}
                  className="eos-lux-btn eos-lux-btn--primary !w-auto shrink-0 px-3 py-2 text-[10px] disabled:opacity-50"
                >
                  {sending === item.key ? "Wysyłam…" : item.sent ? "Wyślij ponownie" : "Wyślij do klienta"}
                </button>
              </div>
              <iframe
                title={item.title}
                srcDoc={item.html}
                className="min-h-[220px] w-full flex-1 bg-white sm:min-h-[360px]"
              />
            </article>
          ))}
        </div>
        <div className="flex shrink-0 justify-end border-t border-[rgba(196,163,90,0.2)] px-4 py-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose} className="eos-lux-btn eos-lux-btn--platinum !w-auto px-4 py-2 text-[11px]">
            Zamknij podgląd
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OfferClientReportCard({
  clientId,
  offerId,
  reportEmail,
}: {
  clientId: number;
  offerId: number;
  reportEmail?: string | null;
}) {
  const [quota, setQuota] = useState<ReportQuota | null>(null);
  const [reports, setReports] = useState<StoredOfferReport[]>([]);
  const [email, setEmail] = useState(reportEmail || "");
  const [busy, setBusy] = useState<"generate" | "send-classic" | "send-pro" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState<{
    reportId: number;
    html: string;
    htmlPro: string;
    sentClassic: boolean;
    sentPro: boolean;
  } | null>(null);

  useEffect(() => {
    setEmail(reportEmail || "");
  }, [reportEmail]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/market/report?clientId=${clientId}&offerId=${offerId}`,
        { cache: "no-store", credentials: "include" },
      );
      const json = await res.json();
      if (json?.quota) setQuota(json.quota);
      if (Array.isArray(json?.reports)) setReports(json.reports as StoredOfferReport[]);
    } catch {
      /* ignore */
    }
  }, [clientId, offerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const destLabel = email.trim();
  const remainingLabel =
    quota && quota.cap != null
      ? `${quota.remaining} / ${quota.cap}`
      : quota?.kind === "credits"
        ? String(quota.remaining)
        : null;
  const latest = reports[0] || null;

  const openPreview = async (report: StoredOfferReport) => {
    setMsg("");
    try {
      const res = await fetch(
        `/api/market/report?reportId=${report.id}&preview=both`,
        { cache: "no-store", credentials: "include" },
      );
      const json = await res.json();
      if (!json?.ok) {
        setMsg(String(json?.message || "Nie udało się otworzyć podglądu."));
        return;
      }
      setPreview({
        reportId: report.id,
        html: String(json.html || ""),
        htmlPro: String(json.htmlPro || json.html || ""),
        sentClassic: report.sentClassic,
        sentPro: report.sentPro,
      });
    } catch {
      setMsg("Nie udało się otworzyć podglądu.");
    }
  };

  const generate = async () => {
    setConfirming(false);
    setBusy("generate");
    setMsg("");
    try {
      const res = await fetch("/api/market/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          generate: true,
          clientId,
          offerId,
          email,
        }),
      });
      const json = await res.json();
      if (json?.quota) setQuota(json.quota);
      if (!json?.ok) {
        setMsg(String(json?.message || "Nie wygenerowano raportu."));
        return;
      }
      const id = Number(json.reportId);
      setPreview({
        reportId: id,
        html: String(json.html || ""),
        htmlPro: String(json.htmlPro || json.html || ""),
        sentClassic: false,
        sentPro: false,
      });
      setMsg("Raport zapisany przy tej ofercie. Limit pobrany — teraz możesz wysłać wybraną wersję do klienta.");
      await load();
    } catch {
      setMsg("Nie udało się wygenerować raportu.");
    } finally {
      setBusy(null);
    }
  };

  const sendVariant = async (variant: "classic" | "pro") => {
    if (!preview?.reportId) return;
    if (!destLabel) {
      setMsg("Wpisz e-mail klienta. Wysyłka nie zużyje kolejnego kredytu.");
      return;
    }
    setBusy(variant === "pro" ? "send-pro" : "send-classic");
    setMsg("");
    try {
      const res = await fetch("/api/market/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reportId: preview.reportId,
          variant,
          clientId,
          offerId,
          email,
        }),
      });
      const json = await res.json();
      if (json?.quota) setQuota(json.quota);
      if (!json?.ok) {
        setMsg(String(json?.message || "Nie wysłano raportu."));
        return;
      }
      setPreview((current) =>
        current
          ? {
              ...current,
              sentClassic: variant === "classic" ? true : current.sentClassic,
              sentPro: variant === "pro" ? true : current.sentPro,
            }
          : current,
      );
      const dest = Array.isArray(json.emails) ? json.emails.join(", ") : destLabel;
      setMsg(
        json.emailed
          ? `Wysłano do klienta na ${dest}. Raport jest też w jego panelu, a klient dostał powiadomienie.`
          : "Zapisano w panelu klienta. Sprawdź e-mail, jeśli wiadomość nie doszła.",
      );
      await load();
    } catch {
      setMsg("Nie udało się wysłać raportu.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="eos-lux-panel rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="eos-portal-label eos-portal-label--ok">Raport dla klienta</p>
            <p className="mt-1 text-sm font-black text-[var(--eos-text)]">Analiza wartości tej oferty</p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--eos-muted)]">
              Wygenerowanie zużywa 1 kredyt. Raport zostaje przy tej nieruchomości — potem wysyłasz wybraną wersję do klienta (e-mail + panel + powiadomienie).
            </p>
          </div>
          {quota ? (
            <span className="eos-lux-badge shrink-0">
              {remainingLabel ? `Zostało ${remainingLabel}` : quota.message}
            </span>
          ) : null}
        </div>

        <label className="mt-4 block">
          <span className="eos-portal-label">E-mail klienta</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="z karty klienta"
            className="eos-field-inset eos-field-inset--pill mt-1.5 w-full py-2.5 text-sm text-[var(--eos-text)] outline-none"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy != null}
            onClick={() => setConfirming(true)}
            className="eos-lux-btn eos-lux-btn--primary px-5 py-2.5 text-[11px] disabled:opacity-50"
          >
            {busy === "generate" ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Generuję…
              </>
            ) : latest ? (
              "Wygeneruj kolejny raport"
            ) : (
              "Wygeneruj raport dla tej oferty"
            )}
          </button>
          {latest ? (
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void openPreview(latest)}
              className="eos-lux-btn eos-lux-btn--platinum px-5 py-2.5 text-[11px] disabled:opacity-50"
            >
              Wyślij do klienta
            </button>
          ) : null}
        </div>

        {latest ? (
          <div className="mt-4 space-y-2">
            {reports.slice(0, 4).map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => void openPreview(report)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--eos-border)] px-3 py-3 text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-black text-[var(--eos-text)]">
                    {report.mid ? pln(report.mid) : "Raport zapisany"}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-[var(--eos-muted)]">
                    {formatWhen(report.createdAt)}
                    {report.sentPro || report.sentClassic
                      ? ` · wysłano${report.sentPro && report.sentClassic ? " obie wersje" : report.sentPro ? " wersję z mapą" : " zestawienie"}`
                      : " · jeszcze nie wysłany"}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                  Podgląd
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {msg ? <p className="mt-3 text-[12px] leading-relaxed text-[var(--eos-muted)]">{msg}</p> : null}
      </div>

      {confirming ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 sm:items-center">
          <div className="eos-lux-panel w-full max-w-lg overflow-hidden rounded-[1.75rem] shadow-2xl">
            <div className="px-5 py-5">
              <p className="eos-portal-label eos-portal-label--ok">Limit raportów</p>
              <h3 className="mt-1 text-lg font-black text-[var(--eos-text)]">Wygenerować raport tej oferty?</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--eos-muted)]">
                Potwierdzenie zużyje <span className="font-bold text-[var(--eos-text)]">1 kredyt</span>
                {quota && quota.cap != null ? ` — zostanie ${Math.max(0, quota.remaining - 1)} z ${quota.cap}` : ""}.
                Raport zostanie zapisany przy tej nieruchomości. Wysyłka do klienta nic więcej nie zdejmie.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-[rgba(196,163,90,0.2)] px-5 py-4">
              <button type="button" onClick={() => setConfirming(false)} className="eos-lux-btn eos-lux-btn--platinum px-4 py-2 text-[11px]">
                Nie
              </button>
              <button type="button" onClick={() => void generate()} className="eos-lux-btn eos-lux-btn--primary px-5 py-2 text-[11px]">
                Tak, wygeneruj
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {preview ? (
        <MarketReportDualPreview
          htmlClassic={preview.html}
          htmlPro={preview.htmlPro}
          sending={busy === "send-pro" ? "pro" : busy === "send-classic" ? "classic" : null}
          sentClassic={preview.sentClassic}
          sentPro={preview.sentPro}
          destLabel={destLabel}
          onSend={(variant) => void sendVariant(variant)}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  );
}
