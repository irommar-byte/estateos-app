"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, UploadCloud } from "lucide-react";

type SessionState = {
  loading: boolean;
  ok: boolean;
  message: string;
};

type ExportState = {
  loading: boolean;
  message: string;
  error: string;
  offerId: number | null;
  portalUrl: string;
  publicUrl: string;
  editUrl: string;
};

export default function KeiAmerWorkspace() {
  const [session, setSession] = useState<SessionState>({
    loading: true,
    ok: false,
    message: "",
  });
  const [frameKey, setFrameKey] = useState(0);
  const [exportState, setExportState] = useState<ExportState>({
    loading: false,
    message: "",
    error: "",
    offerId: null,
    portalUrl: "",
    publicUrl: "",
    editUrl: "",
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
    setExportState({
      loading: true,
      message: "",
      error: "",
      offerId: null,
      portalUrl: "",
      publicUrl: "",
      editUrl: "",
    });

    try {
      const res = await fetch("/api/admin/kei-amer/export-latest", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: 55,
          agentCommissionPercent: 2,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setExportState({
          loading: false,
          message: "",
          error: String(data?.error || `Błąd eksportu (${res.status}).`),
          offerId: null,
          portalUrl: "",
          publicUrl: "",
          editUrl: "",
        });
        return;
      }

      setExportState({
        loading: false,
        message: String(data?.message || "Eksport zakończony."),
        error: "",
        offerId: Number(data?.offerId) || null,
        portalUrl: String(data?.portalUrl || ""),
        publicUrl: String(data?.publicUrl || ""),
        editUrl: String(data?.editUrl || ""),
      });
    } catch {
      setExportState({
        loading: false,
        message: "",
        error: "Błąd połączenia podczas eksportu.",
        offerId: null,
        portalUrl: "",
        publicUrl: "",
        editUrl: "",
      });
    }
  };

  return (
    <div className="mt-10 bg-[#0a0a0a] border border-white/5 rounded-[40px] p-6 md:p-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-black mb-2">KEI AMER — podgląd natywny</h3>
            <p className="text-gray-500 text-xs md:text-sm max-w-3xl leading-relaxed">
              Osadzony panel <span className="text-white/70">amer.kei.pl</span> z automatycznym logowaniem serwerowym.
              Eksport „Najnowsze” wyszukuje najświeższe mieszkanie w Warszawie z linkiem OtoDom / OLX /
              Nieruchomosci-Online, tworzy ofertę na użytkowniku <b>#55</b> z <b>2%</b> prowizji i od razu ją aktywuje.
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
              onClick={() => void handleExportLatest()}
              disabled={exportState.loading || session.loading || !session.ok}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-black text-xs font-black uppercase tracking-wider transition-colors shadow-[0_12px_32px_rgba(16,185,129,0.28)]"
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
            </p>
            <div className="flex flex-wrap gap-3">
              {exportState.portalUrl ? (
                <a
                  href={exportState.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-wider text-white/80 hover:text-white"
                >
                  Link portalu <ExternalLink size={14} />
                </a>
              ) : null}
              {exportState.publicUrl ? (
                <a
                  href={exportState.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-500/15 border border-blue-400/30 text-xs font-bold uppercase tracking-wider text-blue-300 hover:bg-blue-500/25"
                >
                  Oferta #{exportState.offerId} <ExternalLink size={14} />
                </a>
              ) : null}
              {exportState.editUrl ? (
                <a
                  href={exportState.editUrl}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/15"
                >
                  Edytuj <ExternalLink size={14} />
                </a>
              ) : null}
            </div>
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
