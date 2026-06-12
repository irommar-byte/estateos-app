"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, UploadCloud } from "lucide-react";

type SessionState = {
  loading: boolean;
  ok: boolean;
  message: string;
};

type ExportResultItem = {
  offerId: number;
  portalUrl: string;
  publicUrl: string;
  editUrl: string;
};

type ExportState = {
  loading: boolean;
  message: string;
  error: string;
  items: ExportResultItem[];
  skippedCount: number;
};

type PropertyKind = "apartment" | "house";

export default function KeiAmerWorkspace() {
  const [session, setSession] = useState<SessionState>({
    loading: true,
    ok: false,
    message: "",
  });
  const [frameKey, setFrameKey] = useState(0);
  const [targetUserId, setTargetUserId] = useState("55");
  const [commissionPercent, setCommissionPercent] = useState("2");
  const [exportCount, setExportCount] = useState("1");
  const [propertyKind, setPropertyKind] = useState<PropertyKind>("apartment");
  const [exportState, setExportState] = useState<ExportState>({
    loading: false,
    message: "",
    error: "",
    items: [],
    skippedCount: 0,
  });

  const ensureSession = useCallback(async (force = false) => {
    setSession((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch("/api/admin/kei-amer/session", {
        method: force ? "POST" : "GET",
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      setSession({
        loading: false,
        ok: Boolean(data?.ok),
        message: String(data?.message || data?.error || ""),
      });
      if (data?.ok) setFrameKey((k) => k + 1);
    } catch {
      setSession({
        loading: false,
        ok: false,
        message: "Nie udało się połączyć z integracją KEI AMER.",
      });
    }
  }, []);

  useEffect(() => {
    void ensureSession(true);
  }, [ensureSession]);

  const handleExportLatest = async () => {
    const parsedUserId = Number(targetUserId);
    const parsedCommission = Number(commissionPercent);
    const parsedCount = Number(exportCount);

    if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
      setExportState({
        loading: false,
        message: "",
        error: "Podaj poprawne ID użytkownika (liczba > 0).",
        items: [],
        skippedCount: 0,
      });
      return;
    }
    if (!Number.isFinite(parsedCommission) || parsedCommission < 0) {
      setExportState({
        loading: false,
        message: "",
        error: "Podaj poprawny procent prowizji (≥ 0).",
        items: [],
        skippedCount: 0,
      });
      return;
    }
    if (!Number.isFinite(parsedCount) || parsedCount <= 0 || parsedCount > 25) {
      setExportState({
        loading: false,
        message: "",
        error: "Liczba ogłoszeń musi być od 1 do 25.",
        items: [],
        skippedCount: 0,
      });
      return;
    }

    setExportState({
      loading: true,
      message: "",
      error: "",
      items: [],
      skippedCount: 0,
    });

    try {
      const res = await fetch("/api/admin/kei-amer/export-latest", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: parsedUserId,
          agentCommissionPercent: parsedCommission,
          count: Math.floor(parsedCount),
          propertyKind,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setExportState({
          loading: false,
          message: "",
          error: String(data?.error || `Błąd eksportu (${res.status}).`),
          items: [],
          skippedCount: 0,
        });
        return;
      }

      const exported = Array.isArray(data?.exported) ? data.exported : [];
      const items: ExportResultItem[] =
        exported.length > 0
          ? exported.map((item: Record<string, unknown>) => ({
              offerId: Number(item.offerId) || 0,
              portalUrl: String(item.portalUrl || ""),
              publicUrl: String(item.publicUrl || ""),
              editUrl: String(item.editUrl || ""),
            }))
          : data?.offerId
            ? [
                {
                  offerId: Number(data.offerId) || 0,
                  portalUrl: String(data.portalUrl || ""),
                  publicUrl: String(data.publicUrl || ""),
                  editUrl: String(data.editUrl || ""),
                },
              ]
            : [];

      setExportState({
        loading: false,
        message: String(data?.message || "Eksport zakończony."),
        error: "",
        items: items.filter((item) => item.offerId > 0),
        skippedCount: Array.isArray(data?.skipped) ? data.skipped.length : 0,
      });
    } catch {
      setExportState({
        loading: false,
        message: "",
        error: "Błąd połączenia podczas eksportu.",
        items: [],
        skippedCount: 0,
      });
    }
  };

  return (
    <div className="mt-10 bg-[#0a0a0a] border border-white/5 rounded-[40px] p-6 md:p-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-black mb-2">KEI AMER — podgląd natywny</h3>
            <p className="text-gray-500 text-xs md:text-sm max-w-3xl leading-relaxed">
              Osadzony panel <span className="text-white/70">amer.kei.pl</span> z automatycznym logowaniem serwerowym.
              Eksport pobiera najnowsze ogłoszenia z Warszawy (OtoDom / OLX / Nieruchomosci-Online), tworzy oferty na
              wybranym użytkowniku z podaną prowizją i od razu je aktywuje. Już zaimportowane ogłoszenia są pomijane —
              kolejne kliknięcie bierze następne z listy.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void ensureSession(true)}
              disabled={session.loading}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-wider text-white/80 hover:text-white hover:border-white/25 transition-colors disabled:opacity-60"
            >
              {session.loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Odśwież sesję
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-white/50">ID użytkownika</span>
            <input
              type="number"
              min={1}
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              placeholder="55"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-white/50">Prowizja (%)</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={commissionPercent}
              onChange={(e) => setCommissionPercent(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              placeholder="2"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-white/50">Ile ogłoszeń</span>
            <input
              type="number"
              min={1}
              max={25}
              value={exportCount}
              onChange={(e) => setExportCount(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              placeholder="1"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-white/50">Typ nieruchomości</span>
            <select
              value={propertyKind}
              onChange={(e) => setPropertyKind(e.target.value as PropertyKind)}
              className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white focus:outline-none focus:border-emerald-500/50"
            >
              <option value="apartment">Mieszkanie</option>
              <option value="house">Dom</option>
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void handleExportLatest()}
              disabled={exportState.loading || session.loading || !session.ok}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-black text-xs font-black uppercase tracking-wider transition-colors shadow-[0_12px_32px_rgba(16,185,129,0.28)]"
            >
              {exportState.loading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              Export najnowsze
            </button>
          </div>
        </div>

        <div className="text-xs md:text-sm">
          {session.loading ? (
            <p className="text-white/50">Łączenie z KEI AMER…</p>
          ) : session.ok ? (
            <p className="text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
              {session.message || "Sesja KEI AMER gotowa."}
            </p>
          ) : (
            <p className="text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {session.message || "Brak sesji KEI AMER. Ustaw KEI_AMER_LOGIN / KEI_AMER_PASSWORD na serwerze."}
            </p>
          )}
        </div>

        {exportState.error ? (
          <p className="text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm">
            {exportState.error}
          </p>
        ) : null}

        {exportState.message ? (
          <div className="space-y-3">
            <p className="text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3 text-sm">
              {exportState.message}
              {exportState.skippedCount > 0 ? (
                <span className="block mt-1 text-emerald-200/70 text-xs">
                  Pominięto {exportState.skippedCount} ogłoszeń (już w bazie lub błąd importu).
                </span>
              ) : null}
            </p>

            {exportState.items.length > 0 ? (
              <div className="space-y-2">
                {exportState.items.map((item) => (
                  <div
                    key={item.offerId}
                    className="flex flex-wrap gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10"
                  >
                    <span className="text-xs font-bold text-white/70 self-center">#{item.offerId}</span>
                    {item.portalUrl ? (
                      <a
                        href={item.portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-white/80 hover:text-white"
                      >
                        Portal <ExternalLink size={12} />
                      </a>
                    ) : null}
                    {item.publicUrl ? (
                      <a
                        href={item.publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/15 border border-blue-400/30 text-[10px] font-bold uppercase tracking-wider text-blue-300 hover:bg-blue-500/25"
                      >
                        Oferta <ExternalLink size={12} />
                      </a>
                    ) : null}
                    {item.editUrl ? (
                      <a
                        href={item.editUrl}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-white/15"
                      >
                        Edytuj <ExternalLink size={12} />
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-[28px] overflow-hidden border border-white/10 bg-black min-h-[70vh]">
          {session.ok ? (
            <iframe
              key={frameKey}
              title="KEI AMER"
              src="/api/admin/kei-amer/proxy/index.php"
              className="w-full h-[70vh] md:h-[78vh] bg-white"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
            />
          ) : (
            <div className="h-[70vh] md:h-[78vh] flex items-center justify-center text-white/40 text-sm px-6 text-center">
              Podgląd KEI AMER pojawi się po poprawnym zalogowaniu integracji.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
