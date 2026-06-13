"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Eye, Loader2, RefreshCw, UploadCloud } from "lucide-react";

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

type PreviewListing = {
  keiId: string;
  date: string;
  address: string;
  price: string;
  area: string;
  portalUrl: string;
  sourceLabel: string;
  alreadyImported: boolean;
  existingOfferId: number | null;
  willExport: boolean;
};

type PreviewState = {
  loading: boolean;
  error: string;
  message: string;
  listings: PreviewListing[];
};

type PropertyKind = "apartment" | "house";

export default function KeiAmerWorkspace() {
  const [session, setSession] = useState<SessionState>({
    loading: true,
    ok: false,
    message: "",
  });
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
  const [preview, setPreview] = useState<PreviewState>({
    loading: false,
    error: "",
    message: "",
    listings: [],
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
    } catch {
      setSession({
        loading: false,
        ok: false,
        message: "Nie udało się połączyć z integracją KEI AMER.",
      });
    }
  }, []);

  const loadPreview = useCallback(async () => {
    const count = Math.max(Number(exportCount) || 1, 10);
    setPreview((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const qs = new URLSearchParams({
        propertyKind,
        count: String(Math.min(count + 5, 20)),
      });
      const res = await fetch(`/api/admin/kei-amer/preview?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPreview({
          loading: false,
          error: String(data?.error || `Błąd podglądu (${res.status}).`),
          message: "",
          listings: [],
        });
        return;
      }
      const listings = Array.isArray(data?.listings)
        ? data.listings.map((row: Record<string, unknown>) => ({
            keiId: String(row.keiId || ""),
            date: String(row.date || ""),
            address: String(row.address || ""),
            price: String(row.price || ""),
            area: String(row.area || ""),
            portalUrl: String(row.portalUrl || ""),
            sourceLabel: String(row.sourceLabel || ""),
            alreadyImported: Boolean(row.alreadyImported),
            existingOfferId: Number(row.existingOfferId) || null,
            willExport: Boolean(row.willExport),
          }))
        : [];
      setPreview({
        loading: false,
        error: "",
        message: String(data?.message || ""),
        listings,
      });
    } catch {
      setPreview({
        loading: false,
        error: "Błąd połączenia podczas ładowania podglądu.",
        message: "",
        listings: [],
      });
    }
  }, [exportCount, propertyKind]);

  useEffect(() => {
    void ensureSession(true);
  }, [ensureSession]);

  useEffect(() => {
    if (!session.ok || session.loading) return;
    void loadPreview();
  }, [session.ok, session.loading, propertyKind, exportCount, loadPreview]);

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
      void loadPreview();
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
            <h3 className="text-xl md:text-2xl font-black mb-2">KEI AMER — eksport ogłoszeń</h3>
            <p className="text-gray-500 text-xs md:text-sm max-w-3xl leading-relaxed">
              Lista najnowszych ogłoszeń z <span className="text-white/70">amer.kei.pl</span> (Warszawa).
              Zielone pozycje zostaną wyeksportowane po kliknięciu. Już zaimportowane są pomijane automatycznie.
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
            <button
              type="button"
              onClick={() => void loadPreview()}
              disabled={preview.loading || session.loading || !session.ok}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-wider text-white/80 hover:text-white hover:border-white/25 transition-colors disabled:opacity-60"
            >
              {preview.loading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
              Odśwież listę
            </button>
            <a
              href="https://amer.kei.pl/newAmer/index.php"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-wider text-white/60 hover:text-white"
            >
              Panel KEI <ExternalLink size={14} />
            </a>
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

        <div className="rounded-[28px] border border-white/10 bg-white/[0.02] min-h-[320px]">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-wider text-white/60">Podgląd kolejki importu</p>
            {preview.message ? (
              <p className="text-[11px] text-white/45 truncate">{preview.message}</p>
            ) : null}
          </div>

          {preview.loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-white/50 text-sm">
              <Loader2 size={18} className="animate-spin" />
              Ładowanie listy z KEI…
            </div>
          ) : preview.error ? (
            <p className="text-red-300/90 px-4 py-8 text-sm">{preview.error}</p>
          ) : preview.listings.length === 0 ? (
            <p className="text-white/40 px-4 py-8 text-sm text-center">
              {session.ok
                ? "Brak ogłoszeń spełniających kryteria. Zmień typ lub odśwież listę."
                : "Podgląd pojawi się po poprawnym zalogowaniu KEI AMER."}
            </p>
          ) : (
            <div className="divide-y divide-white/5 max-h-[70vh] overflow-y-auto">
              {preview.listings.map((item) => (
                <div
                  key={item.keiId}
                  className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${
                    item.willExport
                      ? "bg-emerald-500/[0.07]"
                      : item.alreadyImported
                        ? "bg-white/[0.02] opacity-70"
                        : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                        {item.date || "—"}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                        {item.sourceLabel}
                      </span>
                      {item.willExport ? (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300">
                          Do eksportu
                        </span>
                      ) : item.alreadyImported ? (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">
                          W bazie #{item.existingOfferId}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-white/90 truncate">{item.address || "Brak adresu"}</p>
                    <p className="text-xs text-white/50 mt-0.5">
                      {item.price || "—"} · {item.area ? `${item.area} m²` : "—"}
                    </p>
                  </div>
                  {item.portalUrl ? (
                    <a
                      href={item.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-white/80 hover:text-white"
                    >
                      Zobacz ogłoszenie <ExternalLink size={12} />
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
