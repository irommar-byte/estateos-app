"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ExternalLink,
  Eye,
  ImageIcon,
  Loader2,
  Pencil,
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
  address?: string;
  status: "pending" | "active" | "done" | "skipped";
  completedSteps: ImportStepId[];
  currentStep: ImportStepId | null;
  stepLabel: string;
  stepDetail?: string;
  imageProgress?: { index: number; total: number; label: string; asFloorPlan: boolean };
  offerId?: number;
  publicUrl?: string;
  editUrl?: string;
  reason?: string;
  aiRewrite?: boolean;
};

type ImportProgressState = {
  visible: boolean;
  status: "idle" | "running" | "done" | "error";
  total: number;
  message: string;
  items: ItemProgress[];
};

type SelectedListingMeta = {
  keiId: string;
  portalUrl: string;
  address: string;
};

type ExportFinalResult = {
  ok: boolean;
  exported: Record<string, unknown>[];
  skipped: unknown[];
  message: string;
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

function computeItemPercent(item: ItemProgress): number {
  if (item.status === "done" || item.status === "skipped") return 100;
  if (item.status === "pending") return 0;
  const stepIdx = item.currentStep ? STEP_ORDER.indexOf(item.currentStep) : 0;
  const base = (Math.max(stepIdx, 0) + 0.35) / STEP_ORDER.length;
  let imagePart = 0;
  if (item.currentStep === "images" && item.imageProgress && item.imageProgress.total > 0) {
    imagePart = item.imageProgress.index / item.imageProgress.total / STEP_ORDER.length;
  }
  return Math.min(98, Math.round((base + imagePart) * 100));
}

function computeOverallPercent(items: ItemProgress[]): number {
  if (items.length === 0) return 0;
  const sum = items.reduce((acc, item) => acc + computeItemPercent(item), 0);
  return Math.round(sum / items.length);
}

function AppleSwitch(props: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      onClick={() => props.onChange(!props.checked)}
      className={`inline-flex items-center gap-2.5 rounded-full px-1 py-1 transition-colors ${
        props.checked ? "bg-emerald-500/20" : "bg-white/5 hover:bg-white/10"
      }`}
    >
      <span
        className={`relative w-11 h-6 rounded-full transition-colors ${
          props.checked ? "bg-emerald-500" : "bg-white/20"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            props.checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
      <span className={`text-[11px] font-semibold pr-2 ${props.checked ? "text-emerald-200" : "text-white/60"}`}>
        {props.label}
      </span>
    </button>
  );
}

function ImportOfferQueue(props: {
  progress: ImportProgressState;
  exporting: boolean;
  onClear: () => void;
}) {
  const { progress, exporting } = props;
  if (!progress.visible && !exporting) return null;
  if (progress.items.length === 0 && exporting) {
    return (
      <div className="rounded-[28px] border border-cyan-400/20 bg-gradient-to-b from-cyan-500/[0.08] to-black/40 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]">
        <div className="flex items-center gap-3">
          <Loader2 size={20} className="text-cyan-300 animate-spin shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">Przygotowanie importu…</p>
            <p className="text-xs text-white/50 mt-0.5">{progress.message || "Łączenie z serwerem"}</p>
          </div>
        </div>
      </div>
    );
  }

  const overallPct = computeOverallPercent(progress.items);
  const doneCount = progress.items.filter((i) => i.status === "done").length;
  const isComplete = progress.status === "done" && !exporting;

  return (
    <div className="rounded-[28px] border border-white/12 bg-gradient-to-b from-white/[0.04] to-black/50 overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.1)]">
      <div className="px-5 py-4 border-b border-white/10 bg-black/20 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {exporting ? (
            <Loader2 size={22} className="text-cyan-300 animate-spin shrink-0" />
          ) : isComplete ? (
            <CheckCircle2 size={22} className="text-emerald-400 shrink-0" />
          ) : (
            <Circle size={22} className="text-white/30 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">
              {isComplete ? "Import zakończony" : "Import ogłoszeń — postęp na żywo"}
            </p>
            <p className="text-[11px] text-white/45 mt-0.5">
              {doneCount} / {progress.total} ukończonych · ogółem {overallPct}%
            </p>
          </div>
        </div>
        {isComplete ? (
          <button
            type="button"
            onClick={props.onClear}
            className="px-3 py-1.5 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-[10px] font-black uppercase tracking-wider text-white/70"
          >
            Wyczyść
          </button>
        ) : null}
      </div>

      <div className="p-4 space-y-3 max-h-[min(70vh,640px)] overflow-y-auto">
        {progress.items.map((item) => {
          const pct = computeItemPercent(item);
          const isActive = item.status === "active";
          const isDone = item.status === "done";
          const isSkipped = item.status === "skipped";

          return (
            <div
              key={`${item.index}-${item.portalUrl}`}
              className={`rounded-[22px] border p-4 transition-all duration-300 ${
                isActive
                  ? "border-cyan-400/35 bg-gradient-to-br from-cyan-500/[0.12] via-black/40 to-black/60 shadow-[0_8px_32px_rgba(34,211,238,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : isDone
                    ? "border-emerald-400/25 bg-gradient-to-br from-emerald-500/[0.08] to-black/50 shadow-[0_4px_24px_rgba(16,185,129,0.12)]"
                    : isSkipped
                      ? "border-amber-400/20 bg-amber-500/[0.04]"
                      : "border-white/8 bg-black/30 opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-1">
                    Ogłoszenie {item.index + 1}
                    {item.offerId ? ` · #${item.offerId}` : ""}
                  </p>
                  <p className="text-sm font-semibold text-white truncate">
                    {item.address || item.portalUrl}
                  </p>
                  {isActive ? (
                    <p className="text-xs text-cyan-200/90 mt-1 truncate">{item.stepLabel}</p>
                  ) : isDone ? (
                    <p className="text-xs text-emerald-300/90 mt-1">Zaimportowano pomyślnie</p>
                  ) : isSkipped ? (
                    <p className="text-xs text-amber-300/90 mt-1">{item.reason || "Pominięto"}</p>
                  ) : (
                    <p className="text-xs text-white/40 mt-1">Oczekuje w kolejce…</p>
                  )}
                  {item.stepDetail && isActive ? (
                    <p className="text-[11px] text-white/45 mt-0.5 truncate">{item.stepDetail}</p>
                  ) : null}
                  {item.imageProgress && isActive ? (
                    <p className="text-[11px] text-cyan-300/80 mt-1">
                      {item.imageProgress.label}
                      {item.imageProgress.asFloorPlan ? " · zapis jako rzut lokalu" : ""}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`shrink-0 tabular-nums text-lg font-black ${
                    isDone ? "text-emerald-400" : isActive ? "text-cyan-300" : "text-white/35"
                  }`}
                >
                  {pct}%
                </span>
              </div>

              {!isDone && !isSkipped ? (
                <>
                  <div className="h-2.5 rounded-full bg-black/50 border border-white/10 overflow-hidden shadow-inner mb-3">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${
                        isActive
                          ? "bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 shadow-[0_0_12px_rgba(34,211,238,0.5)]"
                          : "bg-white/15"
                      }`}
                      style={{ width: `${Math.max(pct, isActive ? 3 : 0)}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {STEP_ORDER.map((step) => {
                      const done = item.completedSteps.includes(step);
                      const current = isActive && item.currentStep === step;
                      return (
                        <span
                          key={step}
                          className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wide border ${
                            done
                              ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-300"
                              : current
                                ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.2)]"
                                : "bg-white/[0.03] border-white/8 text-white/25"
                          }`}
                        >
                          {STEP_LABELS[step]}
                        </span>
                      );
                    })}
                  </div>
                </>
              ) : isDone ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {item.publicUrl ? (
                    <a
                      href={item.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/15 border border-blue-400/35 text-[11px] font-black uppercase tracking-wider text-blue-200 hover:bg-blue-500/25 shadow-[0_4px_16px_rgba(59,130,246,0.2)] transition-colors"
                    >
                      <Eye size={14} /> Podgląd
                    </a>
                  ) : null}
                  {item.editUrl ? (
                    <a
                      href={item.editUrl}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-[11px] font-black uppercase tracking-wider text-white hover:bg-white/15 shadow-[0_4px_16px_rgba(0,0,0,0.25)] transition-colors"
                    >
                      <Pencil size={14} /> Edytuj
                    </a>
                  ) : null}
                  {item.portalUrl ? (
                    <a
                      href={item.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-[11px] font-black uppercase tracking-wider text-white/75 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <ExternalLink size={14} /> Pokaż oryginał
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FloorPlanToggle(props: {
  portalUrl: string;
  peek: LastImagePeek | undefined;
  asFloorPlan: boolean;
  onChange: (portalUrl: string, value: boolean) => void;
  compact?: boolean;
}) {
  const { peek, portalUrl, asFloorPlan, onChange, compact } = props;
  const thumbSrc = peek?.lastImageUrl
    ? `/api/admin/kei-amer/peek-image?portalUrl=${encodeURIComponent(portalUrl)}`
    : null;

  return (
    <div
      className={`rounded-xl border flex items-center gap-3 transition-all ${
        asFloorPlan
          ? "bg-emerald-500/[0.08] border-emerald-400/35 shadow-[0_0_0_1px_rgba(52,211,153,0.15)_inset]"
          : "bg-black/30 border-white/10"
      } ${compact ? "p-2 mt-2" : "p-2.5 mt-2"}`}
    >
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center relative">
        {peek?.loading ? (
          <Loader2 size={16} className="animate-spin text-white/40" />
        ) : thumbSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbSrc} alt="Ostatnie zdjęcie" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={18} className="text-white/30" />
        )}
        {asFloorPlan ? (
          <span className="absolute bottom-0 inset-x-0 bg-emerald-600/90 text-[8px] font-black uppercase text-center py-0.5 text-white">
            Rzut
          </span>
        ) : null}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">Ostatnie zdjęcie</p>
        <p className="text-[11px] text-white/60 truncate">
          {peek?.loading
            ? "Pobieram podgląd z portalu…"
            : peek?.error
              ? peek.error
              : peek?.imageCount
                ? `${peek.imageCount} zdjęć · ${peek.suggestedFloorPlan ? "system wykrył rzut" : "zwykłe zdjęcie"}`
                : "Zaznacz ogłoszenie, aby załadować podgląd"}
        </p>
        <div className="mt-2">
          <AppleSwitch
            checked={asFloorPlan}
            onChange={(value) => onChange(portalUrl, value)}
            label={asFloorPlan ? "Importuję jako rzut lokalu" : "Importuję do galerii"}
          />
        </div>
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
    buffer = buffer.replace(/\r\n/g, "\n");
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      for (const line of chunk.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        try {
          onEvent(JSON.parse(trimmed.slice(6)) as Record<string, unknown>);
        } catch {
          // ignore malformed chunk
        }
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
  const [selectedMeta, setSelectedMeta] = useState<Map<string, SelectedListingMeta>>(new Map());
  const [floorPlanOverrides, setFloorPlanOverrides] = useState<Record<string, boolean>>({});
  const [lastImagePeeks, setLastImagePeeks] = useState<Record<string, LastImagePeek>>({});
  const [expandedImported, setExpandedImported] = useState<Set<string>>(new Set());
  const [importProgress, setImportProgress] = useState<ImportProgressState>({
    visible: false,
    status: "idle",
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
        return { ...prev, [portalUrl]: false };
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
        const nextMeta = new Map<string, SelectedListingMeta>();
        for (const row of pool) {
          if (next.size >= n) break;
          if (row.alreadyImported) continue;
          const keiId = String(row.keiId || "");
          const portalUrl = String(row.portalUrl || "");
          if (!keiId || !portalUrl) continue;
          next.set(keiId, portalUrl);
          nextMeta.set(keiId, {
            keiId,
            portalUrl,
            address: String(row.address || portalUrl),
          });
        }
        setSelectedMap(next);
        setSelectedMeta(nextMeta);
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
    setSelectedMeta(new Map());
    setFloorPlanOverrides({});
    void autoSelectByCount(Number(exportCount) || 1);
  }, [propertyKind, session.ok]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExportCountChange = (raw: string) => {
    setExportCount(raw);
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      setSelectedMap(new Map());
      setSelectedMeta(new Map());
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
        setSelectedMeta((meta) => {
          const nextMeta = new Map(meta);
          nextMeta.delete(item.keiId);
          return nextMeta;
        });
        setFloorPlanOverrides((prevOverrides) => {
          const copy = { ...prevOverrides };
          delete copy[item.portalUrl];
          return copy;
        });
      } else {
        if (next.size >= MAX_SELECT) return prev;
        next.set(item.keiId, item.portalUrl);
        setSelectedMeta((meta) =>
          new Map(meta).set(item.keiId, {
            keiId: item.keiId,
            portalUrl: item.portalUrl,
            address: item.address || item.portalUrl,
          }),
        );
        void loadLastImagePeek(item.portalUrl);
      }
      setExportCount(String(next.size));
      return next;
    });
  };

  const resolveFloorPlan = (portalUrl: string): boolean => {
    if (Object.prototype.hasOwnProperty.call(floorPlanOverrides, portalUrl)) {
      return floorPlanOverrides[portalUrl];
    }
    return lastImagePeeks[portalUrl]?.suggestedFloorPlan ?? false;
  };

  const setFloorPlanForUrl = (portalUrl: string, value: boolean) => {
    setFloorPlanOverrides((prev) => ({ ...prev, [portalUrl]: value }));
  };

  const updateProgressFromEvent = useCallback((payload: Record<string, unknown>) => {
    const type = String(payload.type || "");

    if (type === "batch_start") {
      const total = Number(payload.total) || 0;
      setImportProgress((prev) => ({
        ...prev,
        visible: true,
        status: "running",
        total,
        message: "",
        items:
          prev.items.length > 0
            ? prev.items
            : [],
      }));
      return;
    }

    if (type === "connected") {
      setImportProgress((prev) => ({
        ...prev,
        visible: true,
        status: "running",
        message: String(payload.message || "Rozpoczynam import…"),
      }));
      return;
    }

    if (type === "item_start") {
      const index = Number(payload.index) || 0;
      setImportProgress((prev) => {
        const items = [...prev.items];
        const existingIdx = items.findIndex((i) => i.index === index);
        const base = {
          index,
          keiListingId: String(payload.keiListingId || ""),
          portalUrl: String(payload.portalUrl || ""),
          address: payload.address ? String(payload.address) : undefined,
          status: "active" as const,
          completedSteps: [] as ImportStepId[],
          currentStep: null,
          stepLabel: "Rozpoczynanie importu…",
        };
        if (existingIdx >= 0) {
          items[existingIdx] = { ...items[existingIdx], ...base, address: base.address || items[existingIdx].address };
        } else {
          items.push(base);
        }
        items.sort((a, b) => a.index - b.index);
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
            aiRewrite: payload.detail === "AI ✓" ? true : item.aiRewrite,
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
                publicUrl: String(payload.publicUrl || item.publicUrl || ""),
                editUrl: String(payload.editUrl || item.editUrl || ""),
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
        status: "done",
        visible: true,
        message: String(payload.message || prev.message),
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
      overrides[portalUrl] = resolveFloorPlan(portalUrl);
    }

    const queueItems: ItemProgress[] = selections.map((sel, index) => ({
      index,
      keiListingId: sel.keiId,
      portalUrl: sel.portalUrl,
      address: selectedMeta.get(sel.keiId)?.address || sel.portalUrl,
      status: "pending",
      completedSteps: [],
      currentStep: null,
      stepLabel: "Oczekuje w kolejce…",
    }));

    setImportProgress({
      visible: true,
      status: "running",
      total: selections.length,
      message: "Łączenie z serwerem…",
      items: queueItems,
    });
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
          floorPlanOverrides: overrides,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setImportProgress((prev) => ({ ...prev, status: "error", visible: true }));
        setExportState({
          loading: false,
          message: "",
          error: String(data?.error || `Błąd eksportu (${res.status}).`),
          items: [],
          skippedCount: 0,
        });
        return;
      }

      const outcome = { result: null as ExportFinalResult | null };

      await consumeExportStream(res, (payload) => {
        if (payload.type === "result") {
          outcome.result = payload as unknown as ExportFinalResult;
          return;
        }
        if (payload.type === "error") {
          throw new Error(String(payload.message || "Eksport nie powiódł się."));
        }
        updateProgressFromEvent(payload);
      });

      const finalResult = outcome.result;
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

      setImportProgress((prev) => ({
        ...prev,
        status: "done",
        visible: true,
        message: String(finalResult.message || prev.message),
      }));
      setSelectedMap(new Map());
      setSelectedMeta(new Map());
      setFloorPlanOverrides({});
      setExportCount("1");
      void autoSelectByCount(1);
      void loadPreview(previewPage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Błąd połączenia podczas eksportu.";
      setImportProgress((prev) => ({
        ...prev,
        status: "error",
        visible: true,
        message,
      }));
      setExportState({
        loading: false,
        message: "",
        error: message,
        items: [],
        skippedCount: 0,
      });
    }
  };

  const selectedListings = useMemo(() => {
    return Array.from(selectedMeta.values());
  }, [selectedMeta]);

  const toggleImportedExpand = (keiId: string) => {
    setExpandedImported((prev) => {
      const next = new Set(prev);
      if (next.has(keiId)) next.delete(keiId);
      else next.add(keiId);
      return next;
    });
  };

  const dismissImportProgress = () => {
    setImportProgress({
      visible: false,
      status: "idle",
      total: 0,
      message: "",
      items: [],
    });
  };

  return (
    <div className="mt-10 bg-[#0a0a0a] border border-white/5 rounded-[40px] p-6 md:p-8 shadow-2xl relative">
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

        {selectedListings.length > 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-white/50">
              Rzut lokalu — podgląd ostatniego zdjęcia ({selectedListings.length})
            </p>
            {selectedListings.map((item) => (
              <div key={item.keiId}>
                <p className="text-xs text-white/70 truncate mb-1">{item.address || item.portalUrl}</p>
                <FloorPlanToggle
                  portalUrl={item.portalUrl}
                  peek={lastImagePeeks[item.portalUrl]}
                  asFloorPlan={resolveFloorPlan(item.portalUrl)}
                  onChange={setFloorPlanForUrl}
                />
              </div>
            ))}
          </div>
        ) : null}

        {exportState.error ? (
          <p className="text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm">
            {exportState.error}
          </p>
        ) : null}

        <ImportOfferQueue
          progress={importProgress}
          exporting={exportState.loading}
          onClear={dismissImportProgress}
        />

        {exportState.message && importProgress.status === "done" && !exportState.loading ? (
          <p className="text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3 text-sm">
            {exportState.message}
            {exportState.skippedCount > 0 ? (
              <span className="block mt-1 text-emerald-200/70 text-xs">
                Pominięto {exportState.skippedCount} ogłoszeń (już w bazie lub błąd importu).
              </span>
            ) : null}
          </p>
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
                const isExpanded = expandedImported.has(item.keiId);

                if (disabled && !isExpanded) {
                  return (
                    <button
                      key={item.keiId}
                      type="button"
                      onClick={() => toggleImportedExpand(item.keiId)}
                      className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-white/[0.03] transition-colors opacity-55"
                    >
                      <ChevronRight size={14} className="text-white/35 shrink-0" />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-300/80 shrink-0">
                        w bazie #{item.existingOfferId}
                      </span>
                      <span className="text-xs text-white/55 truncate flex-1">
                        {item.address || "Brak adresu"}
                      </span>
                      <span className="text-[10px] text-white/30 shrink-0 hidden sm:inline">
                        {item.price || "—"}
                      </span>
                    </button>
                  );
                }

                return (
                  <div
                    key={item.keiId}
                    className={`px-3 py-2.5 ${
                      disabled
                        ? "opacity-60 bg-white/[0.02]"
                        : isSelected
                          ? "bg-emerald-500/[0.07]"
                          : "hover:bg-white/[0.03]"
                    }`}
                  >
                    {disabled ? (
                      <button
                        type="button"
                        onClick={() => toggleImportedExpand(item.keiId)}
                        className="flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-white/40 hover:text-white/60"
                      >
                        <ChevronDown size={14} />
                        Zwiń zaimportowane
                      </button>
                    ) : null}
                    <div className="flex items-center gap-3">
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
                        {isSelected && resolveFloorPlan(item.portalUrl) ? (
                          <span className="text-[9px] font-black uppercase text-emerald-300">rzut</span>
                        ) : null}
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

                    {isSelected && !disabled ? (
                      <FloorPlanToggle
                        portalUrl={item.portalUrl}
                        peek={lastImagePeeks[item.portalUrl]}
                        asFloorPlan={resolveFloorPlan(item.portalUrl)}
                        onChange={setFloorPlanForUrl}
                        compact
                      />
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
