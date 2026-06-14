"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Circle,
  ExternalLink,
  Eye,
  ImageIcon,
  Loader2,
  RefreshCw,
  UploadCloud,
} from "lucide-react";

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

type ImportStepId = "check_duplicate" | "fetch_portal" | "create_offer" | "images" | "activate";

type LastImagePeek = {
  loading: boolean;
  error: string;
  lastImageUrl: string | null;
  suggestedFloorPlan: boolean;
  imageCount: number;
};

type ItemProgress = {
  index: number;
  keiListingId: string;
  portalUrl: string;
  status: "pending" | "active" | "done" | "skipped";
  completedSteps: ImportStepId[];
  currentStep: ImportStepId | null;
  stepLabel: string;
  stepDetail?: string;
  imageProgress?: { index: number; total: number; label: string; asFloorPlan: boolean };
  offerId?: number;
  reason?: string;
};

type ImportProgressState = {
  active: boolean;
  total: number;
  message: string;
  items: ItemProgress[];
};

const MAX_SELECT = 25;
const PAGE_SIZE = 20;

const STEP_ORDER: ImportStepId[] = [
  "check_duplicate",
  "fetch_portal",
  "create_offer",
  "images",
  "activate",
];

const STEP_LABELS: Record<ImportStepId, string> = {
  check_duplicate: "Duplikat",
  fetch_portal: "Portal",
  create_offer: "Oferta",
  images: "Zdjęcia",
  activate: "Publikacja",
};

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

function ImportProgressPanel(props: { progress: ImportProgressState }) {
  const { progress } = props;
  if (!progress.active) return null;

  const doneCount = progress.items.filter((i) => i.status === "done").length;
  const pct = progress.total > 0 ? Math.round((doneCount / progress.total) * 100) : 0;
  const activeItem = progress.items.find((i) => i.status === "active");

  return (
    <div className="rounded-[24px] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <div className="px-5 py-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">Import w toku</p>
          <p className="text-sm font-semibold text-white/90 mt-1">
            {doneCount} / {progress.total} ogłoszeń
          </p>
        </div>
        <div className="flex items-center gap-3 min-w-[180px]">
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-bold text-white/60 tabular-nums w-10 text-right">{pct}%</span>
        </div>
      </div>

      {activeItem ? (
        <div className="px-5 py-3 bg-emerald-500/[0.06] border-b border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-emerald-300/70 font-bold">Teraz</p>
          <p className="text-sm text-white/90 truncate">{activeItem.stepLabel}</p>
          {activeItem.stepDetail ? (
            <p className="text-xs text-white/45 truncate mt-0.5">{activeItem.stepDetail}</p>
          ) : null}
          {activeItem.imageProgress ? (
            <p className="text-[11px] text-cyan-300/80 mt-1">
              {activeItem.imageProgress.label}
              {activeItem.imageProgress.asFloorPlan ? " · rzut lokalu" : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="divide-y divide-white/5 max-h-[280px] overflow-y-auto">
        {progress.items.map((item) => (
          <div key={`${item.index}-${item.portalUrl}`} className="px-5 py-3 flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {item.status === "done" ? (
                <CheckCircle2 size={18} className="text-emerald-400" />
              ) : item.status === "skipped" ? (
                <Circle size={18} className="text-amber-400/70" />
              ) : item.status === "active" ? (
                <Loader2 size={18} className="text-cyan-300 animate-spin" />
              ) : (
                <Circle size={18} className="text-white/20" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="text-[10px] font-bold text-white/40">#{item.index + 1}</span>
                {item.offerId ? (
                  <span className="text-[10px] font-black text-emerald-300">oferta #{item.offerId}</span>
                ) : null}
                {item.status === "skipped" ? (
                  <span className="text-[10px] text-amber-300/90 truncate">{item.reason}</span>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1">
                {STEP_ORDER.map((step) => {
                  const done = item.completedSteps.includes(step);
                  const current = item.status === "active" && item.currentStep === step;
                  return (
                    <span
                      key={step}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${
                        done
                          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                          : current
                            ? "bg-cyan-500/15 text-cyan-200 border border-cyan-400/30"
                            : "bg-white/5 text-white/30 border border-white/5"
                      }`}
                    >
                      {done ? <Check size={8} strokeWidth={3} /> : null}
                      {STEP_LABELS[step]}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {progress.message ? (
        <div className="px-5 py-3 border-t border-white/10 text-xs text-white/50">{progress.message}</div>
      ) : null}
    </div>
  );
}

function FloorPlanToggle(props: {
  portalUrl: string;
  peek: LastImagePeek | undefined;
  asFloorPlan: boolean | undefined;
  onChange: (portalUrl: string, value: boolean) => void;
}) {
  const { peek, portalUrl, asFloorPlan, onChange } = props;
  const effective = asFloorPlan ?? peek?.suggestedFloorPlan ?? false;

  return (
    <div className="mt-2 p-2.5 rounded-xl bg-black/30 border border-white/10 flex items-center gap-3">
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
        {peek?.loading ? (
          <Loader2 size={16} className="animate-spin text-white/40" />
        ) : peek?.lastImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={peek.lastImageUrl} alt="Ostatnie zdjęcie" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={18} className="text-white/30" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">Ostatnie zdjęcie</p>
        <p className="text-[11px] text-white/60 truncate">
          {peek?.loading
            ? "Analiza…"
            : peek?.error
              ? peek.error
              : peek?.imageCount
                ? `${peek.imageCount} zdj. · ${peek.suggestedFloorPlan ? "wykryto rzut" : "zdjęcie"}`
                : "Brak podglądu"}
        </p>
        <label className="mt-1.5 inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={effective}
            onChange={(e) => onChange(portalUrl, e.target.checked)}
            className="rounded border-white/20 bg-black/40 text-emerald-500 focus:ring-emerald-500/40"
          />
          <span className="text-[10px] font-semibold text-white/75">Importuj jako rzut lokalu</span>
        </label>
      </div>
    </div>
  );
}

async function consumeExportStream(
  response: Response,
  onEvent: (payload: Record<string, unknown>) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Brak strumienia odpowiedzi.");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const line = chunk.trim();
      if (!line.startsWith("data: ")) continue;
      try {
        onEvent(JSON.parse(line.slice(6)) as Record<string, unknown>);
      } catch {
        // ignore malformed chunk
      }
    }
  }
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
  const [floorPlanOverrides, setFloorPlanOverrides] = useState<Record<string, boolean>>({});
  const [lastImagePeeks, setLastImagePeeks] = useState<Record<string, LastImagePeek>>({});
  const [importProgress, setImportProgress] = useState<ImportProgressState>({
    active: false,
    total: 0,
    message: "",
    items: [],
  });
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

  const loadLastImagePeek = useCallback(async (portalUrl: string) => {
    if (!portalUrl) return;

    setLastImagePeeks((prev) => ({
      ...prev,
      [portalUrl]: prev[portalUrl] ?? {
        loading: true,
        error: "",
        lastImageUrl: null,
        suggestedFloorPlan: false,
        imageCount: 0,
      },
    }));

    try {
      const qs = new URLSearchParams({ portalUrl });
      const res = await fetch(`/api/admin/kei-amer/peek?${qs.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLastImagePeeks((prev) => ({
          ...prev,
          [portalUrl]: {
            loading: false,
            error: String(data?.error || "Podgląd niedostępny"),
            lastImageUrl: null,
            suggestedFloorPlan: false,
            imageCount: 0,
          },
        }));
        return;
      }

      setLastImagePeeks((prev) => ({
        ...prev,
        [portalUrl]: {
          loading: false,
          error: "",
          lastImageUrl: data.lastImageUrl ? String(data.lastImageUrl) : null,
          suggestedFloorPlan: Boolean(data.suggestedFloorPlan),
          imageCount: Number(data.imageCount) || 0,
        },
      }));

      setFloorPlanOverrides((prev) => {
        if (Object.prototype.hasOwnProperty.call(prev, portalUrl)) return prev;
        if (data.suggestedFloorPlan) {
          return { ...prev, [portalUrl]: true };
        }
        return prev;
      });
    } catch {
      setLastImagePeeks((prev) => ({
        ...prev,
        [portalUrl]: {
          loading: false,
          error: "Błąd podglądu",
          lastImageUrl: null,
          suggestedFloorPlan: false,
          imageCount: 0,
        },
      }));
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
        for (const portalUrl of next.values()) {
          void loadLastImagePeek(portalUrl);
        }
      } catch {
        // ignore pool fetch errors
      }
    },
    [propertyKind, session.ok, loadLastImagePeek],
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
    setFloorPlanOverrides({});
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
        void loadLastImagePeek(item.portalUrl);
      }
      setExportCount(String(next.size));
      return next;
    });
  };

  const setFloorPlanForUrl = (portalUrl: string, value: boolean) => {
    setFloorPlanOverrides((prev) => ({ ...prev, [portalUrl]: value }));
  };

  const updateProgressFromEvent = useCallback((payload: Record<string, unknown>) => {
    const type = String(payload.type || "");

    if (type === "batch_start") {
      const total = Number(payload.total) || 0;
      setImportProgress({
        active: true,
        total,
        message: "",
        items: [],
      });
      return;
    }

    if (type === "item_start") {
      const index = Number(payload.index) || 0;
      setImportProgress((prev) => {
        const items = [...prev.items];
        const existing = items.find((i) => i.index === index);
        if (!existing) {
          items.push({
            index,
            keiListingId: String(payload.keiListingId || ""),
            portalUrl: String(payload.portalUrl || ""),
            status: "active",
            completedSteps: [],
            currentStep: null,
            stepLabel: "Rozpoczynanie importu…",
          });
        } else {
          existing.status = "active";
        }
        return { ...prev, items };
      });
      return;
    }

    if (type === "step") {
      const index = Number(payload.index) || 0;
      const step = String(payload.step || "") as ImportStepId;
      setImportProgress((prev) => {
        const items = prev.items.map((item) => {
          if (item.index !== index) return item;
          const completedSteps = [...item.completedSteps];
          const stepIdx = STEP_ORDER.indexOf(step);
          for (let i = 0; i < stepIdx; i += 1) {
            const s = STEP_ORDER[i];
            if (!completedSteps.includes(s)) completedSteps.push(s);
          }
          return {
            ...item,
            status: "active" as const,
            currentStep: step,
            completedSteps,
            stepLabel: String(payload.label || item.stepLabel),
            stepDetail: payload.detail ? String(payload.detail) : item.stepDetail,
          };
        });
        return { ...prev, items };
      });
      return;
    }

    if (type === "image_progress") {
      const index = Number(payload.index) || 0;
      setImportProgress((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.index !== index
            ? item
            : {
                ...item,
                imageProgress: {
                  index: Number(payload.imageIndex) || 0,
                  total: Number(payload.imageTotal) || 0,
                  label: String(payload.label || ""),
                  asFloorPlan: Boolean(payload.asFloorPlan),
                },
              },
        ),
      }));
      return;
    }

    if (type === "item_done") {
      const index = Number(payload.index) || 0;
      setImportProgress((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.index !== index
            ? item
            : {
                ...item,
                status: "done" as const,
                completedSteps: [...STEP_ORDER],
                currentStep: null,
                offerId: Number(payload.offerId) || item.offerId,
                stepLabel: "Zaimportowano",
              },
        ),
      }));
      return;
    }

    if (type === "item_skip") {
      const index = Number(payload.index) || 0;
      setImportProgress((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.index !== index
            ? item
            : {
                ...item,
                status: "skipped" as const,
                currentStep: null,
                reason: String(payload.reason || "Pominięto"),
              },
        ),
      }));
      return;
    }

    if (type === "batch_done") {
      setImportProgress((prev) => ({
        ...prev,
        message: String(payload.message || ""),
      }));
    }
  }, []);

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

    const overrides: Record<string, boolean> = {};
    for (const { portalUrl } of selections) {
      if (Object.prototype.hasOwnProperty.call(floorPlanOverrides, portalUrl)) {
        overrides[portalUrl] = floorPlanOverrides[portalUrl];
      }
    }

    setImportProgress({ active: true, total: selections.length, message: "", items: [] });
    setExportState({
      loading: true,
      message: "",
      error: "",
      items: [],
      skippedCount: 0,
    });

    try {
      const res = await fetch("/api/admin/kei-amer/export-stream", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: parsedUserId,
          agentCommissionPercent: parsedCommission,
          count: selections.length,
          propertyKind,
          selections,
          floorPlanOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setImportProgress((prev) => ({ ...prev, active: false }));
        setExportState({
          loading: false,
          message: "",
          error: String(data?.error || `Błąd eksportu (${res.status}).`),
          items: [],
          skippedCount: 0,
        });
        return;
      }

      let finalResult: Record<string, unknown> | null = null;

      await consumeExportStream(res, (payload) => {
        if (payload.type === "result") {
          finalResult = payload;
          return;
        }
        if (payload.type === "error") {
          throw new Error(String(payload.message || "Eksport nie powiódł się."));
        }
        updateProgressFromEvent(payload);
      });

      if (!finalResult?.ok) {
        throw new Error("Brak wyniku eksportu.");
      }

      const exported = Array.isArray(finalResult.exported) ? finalResult.exported : [];
      const items: ExportResultItem[] = exported.map((item: Record<string, unknown>) => ({
        offerId: Number(item.offerId) || 0,
        portalUrl: String(item.portalUrl || ""),
        publicUrl: String(item.publicUrl || ""),
        editUrl: String(item.editUrl || ""),
      }));

      setExportState({
        loading: false,
        message: String(finalResult.message || "Eksport zakończony."),
        error: "",
        items: items.filter((item) => item.offerId > 0),
        skippedCount: Array.isArray(finalResult.skipped) ? finalResult.skipped.length : 0,
      });

      setImportProgress((prev) => ({ ...prev, active: false }));
      setSelectedMap(new Map());
      setFloorPlanOverrides({});
      setExportCount("1");
      void autoSelectByCount(1);
      void loadPreview(previewPage);
    } catch (error) {
      setImportProgress((prev) => ({ ...prev, active: false }));
      setExportState({
        loading: false,
        message: "",
        error: error instanceof Error ? error.message : "Błąd połączenia podczas eksportu.",
        items: [],
        skippedCount: 0,
      });
    }
  };

  const selectedListings = useMemo(() => {
    return preview.listings.filter((item) => selectedMap.has(item.keiId));
  }, [preview.listings, selectedMap]);

  return (
    <div className="mt-10 bg-[#0a0a0a] border border-white/5 rounded-[40px] p-6 md:p-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-black mb-2">KEI AMER — eksport ogłoszeń</h3>
            <p className="text-gray-500 text-xs md:text-sm max-w-3xl leading-relaxed">
              Zaznacz ptaszkiem ogłoszenia do importu lub ustaw liczbę — auto-zaznaczy najnowsze.
              {PAGE_SIZE} ogłoszeń na stronę. Ostatnie zdjęcie możesz oznaczyć jako rzut lokalu.
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

        <ImportProgressPanel progress={importProgress} />

        {exportState.error ? (
          <p className="text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm">
            {exportState.error}
          </p>
        ) : null}

        {exportState.message && !importProgress.active ? (
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

        {selectedListings.length > 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-white/50">
              Rzut lokalu — podgląd ostatniego zdjęcia
            </p>
            {selectedListings.map((item) => (
              <div key={item.keiId}>
                <p className="text-xs text-white/70 truncate mb-1">{item.address || item.portalUrl}</p>
                <FloorPlanToggle
                  portalUrl={item.portalUrl}
                  peek={lastImagePeeks[item.portalUrl]}
                  asFloorPlan={floorPlanOverrides[item.portalUrl]}
                  onChange={setFloorPlanForUrl}
                />
              </div>
            ))}
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
            <p className="text-[10px] text-white/40 shrink-0">{selectedCount} zaznaczonych · {PAGE_SIZE}/str.</p>
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
