"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, Eye, Loader2, RefreshCw, UploadCloud } from "lucide-react";

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
};

type PreviewState = {
  loading: boolean;
  error: string;
  message: string;
  page: number;
  hasNextPage: boolean;
  listings: PreviewListing[];
};

type PropertyKind = "apartment" | "house";

const MAX_SELECT = 25;
const PAGE_SIZE = 12;

function PagePager(props: {
  page: number;
  hasNextPage: boolean;
  onChange: (page: number) => void;
  disabled?: boolean;
}) {
  const maxPage = props.page + (props.hasNextPage ? 1 : 0);
  const pages = Array.from({ length: maxPage }, (_, i) => i + 1);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          disabled={props.disabled}
          onClick={() => props.onChange(p)}
          className={`min-w-[2.25rem] h-9 px-3 rounded-xl text-xs font-black transition-colors disabled:opacity-50 ${
            p === props.page
              ? "bg-emerald-500 text-black"
              : "bg-white/5 border border-white/10 text-white/70 hover:text-white hover:border-white/25"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

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
  const [previewPage, setPreviewPage] = useState(1);
  const [selectedMap, setSelectedMap] = useState<Map<string, string>>(new Map());
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
    page: 1,
    hasNextPage: false,
    listings: [],
  });

  const selectedCount = selectedMap.size;

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

  const loadPreview = useCallback(
    async (page = previewPage) => {
      setPreview((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const qs = new URLSearchParams({
          propertyKind,
          page: String(page),
          pageSize: String(PAGE_SIZE),
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
            page,
            hasNextPage: false,
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
            }))
          : [];
        setPreview({
          loading: false,
          error: "",
          message: String(data?.message || ""),
          page: Number(data?.page) || page,
          hasNextPage: Boolean(data?.hasNextPage),
          listings,
        });
      } catch {
        setPreview({
          loading: false,
          error: "Błąd połączenia podczas ładowania podglądu.",
          message: "",
          page,
          hasNextPage: false,
          listings: [],
        });
      }
    },
    [previewPage, propertyKind],
  );

  const autoSelectByCount = useCallback(
    async (count: number) => {
      if (!session.ok) return;
      const n = Math.max(0, Math.min(Math.floor(count), MAX_SELECT));
      if (n === 0) {
        setSelectedMap(new Map());
        return;
      }

      try {
        const qs = new URLSearchParams({
          propertyKind,
          selectionPool: "1",
        });
        const res = await fetch(`/api/admin/kei-amer/preview?${qs.toString()}`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;

        const pool = Array.isArray(data?.listings) ? data.listings : [];
        const next = new Map<string, string>();
        for (const row of pool) {
          if (next.size >= n) break;
          if (row.alreadyImported) continue;
          const keiId = String(row.keiId || "");
          const portalUrl = String(row.portalUrl || "");
          if (!keiId || !portalUrl) continue;
          next.set(keiId, portalUrl);
        }
        setSelectedMap(next);
        setExportCount(String(next.size));
      } catch {
        // ignore pool fetch errors
      }
    },
    [propertyKind, session.ok],
  );

  useEffect(() => {
    void ensureSession(true);
  }, [ensureSession]);

  useEffect(() => {
    if (!session.ok || session.loading) return;
    void loadPreview(previewPage);
  }, [session.ok, session.loading, propertyKind, previewPage, loadPreview]);

  useEffect(() => {
    if (!session.ok) return;
    setPreviewPage(1);
    setSelectedMap(new Map());
    void autoSelectByCount(Number(exportCount) || 1);
  }, [propertyKind, session.ok]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExportCountChange = (raw: string) => {
    setExportCount(raw);
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      setSelectedMap(new Map());
      return;
    }
    void autoSelectByCount(n);
  };

  const toggleSelection = (item: PreviewListing) => {
    if (item.alreadyImported) return;

    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (next.has(item.keiId)) {
        next.delete(item.keiId);
      } else {
        if (next.size >= MAX_SELECT) return prev;
        next.set(item.keiId, item.portalUrl);
      }
      setExportCount(String(next.size));
      return next;
    });
  };

  const handleExport = async () => {
    const parsedUserId = Number(targetUserId);
    const parsedCommission = Number(commissionPercent);

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
    if (selectedCount <= 0) {
      setExportState({
        loading: false,
        message: "",
        error: "Zaznacz co najmniej jedno ogłoszenie do eksportu.",
        items: [],
        skippedCount: 0,
      });
      return;
    }
    if (selectedCount > MAX_SELECT) {
      setExportState({
        loading: false,
        message: "",
        error: `Maksymalnie ${MAX_SELECT} ogłoszeń na raz.`,
        items: [],
        skippedCount: 0,
      });
      return;
    }

    const selections = Array.from(selectedMap.entries()).map(([keiId, portalUrl]) => ({
      keiId,
      portalUrl,
    }));

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
          count: selections.length,
          propertyKind,
          selections,
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
      const items: ExportResultItem[] = exported.map((item: Record<string, unknown>) => ({
        offerId: Number(item.offerId) || 0,
        portalUrl: String(item.portalUrl || ""),
        publicUrl: String(item.publicUrl || ""),
        editUrl: String(item.editUrl || ""),
      }));

      setExportState({
        loading: false,
        message: String(data?.message || "Eksport zakończony."),
        error: "",
        items: items.filter((item) => item.offerId > 0),
        skippedCount: Array.isArray(data?.skipped) ? data.skipped.length : 0,
      });

      setSelectedMap(new Map());
      setExportCount("1");
      void autoSelectByCount(1);
      void loadPreview(previewPage);
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
              Zaznacz ptaszkiem ogłoszenia do importu lub ustaw liczbę — auto-zaznaczy najnowsze.
              Strony 1, 2, 3… pokazują starsze ogłoszenia z KEI.
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
              onClick={() => void loadPreview(previewPage)}
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
            <span className="text-[10px] font-black uppercase tracking-wider text-white/50">
              Ile ogłoszeń ({selectedCount} zazn.)
            </span>
            <input
              type="number"
              min={0}
              max={MAX_SELECT}
              value={exportCount}
              onChange={(e) => handleExportCountChange(e.target.value)}
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
              onClick={() => void handleExport()}
              disabled={exportState.loading || session.loading || !session.ok || selectedCount <= 0}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-black text-xs font-black uppercase tracking-wider transition-colors shadow-[0_12px_32px_rgba(16,185,129,0.28)]"
            >
              {exportState.loading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              Export ({selectedCount})
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

        <div className="rounded-[28px] border border-white/10 bg-white/[0.02]">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-white/60">Podgląd ogłoszeń KEI</p>
              {preview.message ? (
                <p className="text-[11px] text-white/45 mt-0.5">{preview.message}</p>
              ) : null}
            </div>
            <p className="text-[10px] text-white/40 shrink-0">{selectedCount} zaznaczonych</p>
          </div>

          <div className="px-4 py-2 border-b border-white/10">
            <PagePager
              page={preview.page}
              hasNextPage={preview.hasNextPage}
              disabled={preview.loading || !session.ok}
              onChange={(p) => setPreviewPage(p)}
            />
          </div>

          {preview.loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-white/50 text-sm">
              <Loader2 size={18} className="animate-spin" />
              Ładowanie listy z KEI…
            </div>
          ) : preview.error ? (
            <p className="text-red-300/90 px-4 py-6 text-sm">{preview.error}</p>
          ) : preview.listings.length === 0 ? (
            <p className="text-white/40 px-4 py-6 text-sm text-center">
              {session.ok
                ? "Brak ogłoszeń na tej stronie. Spróbuj innej strony lub typu."
                : "Podgląd pojawi się po poprawnym zalogowaniu KEI AMER."}
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {preview.listings.map((item) => {
                const isSelected = selectedMap.has(item.keiId);
                const disabled = item.alreadyImported;

                return (
                  <div
                    key={item.keiId}
                    className={`px-3 py-2.5 flex items-center gap-3 ${
                      disabled
                        ? "opacity-60"
                        : isSelected
                          ? "bg-emerald-500/[0.07]"
                          : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleSelection(item)}
                      className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center disabled:cursor-not-allowed ${
                        isSelected
                          ? "bg-emerald-500 border-emerald-400 text-black"
                          : "border-white/25 bg-black/30"
                      }`}
                    >
                      {isSelected ? <Check size={12} strokeWidth={3} /> : null}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-white/40">
                          {item.date || "—"}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">
                          {item.sourceLabel}
                        </span>
                        {disabled ? (
                          <span className="text-[9px] font-black uppercase text-amber-300/90">
                            w bazie #{item.existingOfferId}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-white/90 truncate">{item.address || "Brak adresu"}</p>
                      <p className="text-[10px] text-white/45">
                        {item.price || "—"} · {item.area ? `${item.area} m²` : "—"}
                      </p>
                    </div>

                    {item.portalUrl ? (
                      <a
                        href={item.portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 p-2 rounded-lg text-white/50 hover:text-white"
                        aria-label="Otwórz ogłoszenie"
                      >
                        <ExternalLink size={14} />
                      </a>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          <div className="px-4 py-2 border-t border-white/10">
            <PagePager
              page={preview.page}
              hasNextPage={preview.hasNextPage}
              disabled={preview.loading || !session.ok}
              onChange={(p) => setPreviewPage(p)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
