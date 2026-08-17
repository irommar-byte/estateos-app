"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  ImageIcon,
  Loader2,
  Minimize2,
  RefreshCw,
  Send,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import {
  computeKeiItemPercent,
  computeKeiOverallPercent,
  KEI_IMPORT_STEPS,
  KEI_STEP_LABELS,
  type KeiExportItemProgress,
  type KeiImportStepId,
} from "@/lib/keiAmerExportWebClient";
import { useKeiAmerExportStore } from "@/store/useKeiAmerExportStore";
import {
  DEFAULT_KEI_OUTREACH_TEMPLATE,
  loadKeiOutreachSender,
  loadKeiOutreachTemplate,
  saveKeiOutreachSender,
  saveKeiOutreachTemplate,
  type KeiOutreachSenderProfile,
} from "@/lib/keiAmerOutreachMessage";

type ActionMode = "import" | "outreach";
type PropertyKind = "apartment" | "house";
type TransactionKind = "sale" | "rent";

type SessionState = { loading: boolean; ok: boolean; message: string };

type PreviewListing = {
  keiId: string;
  date: string;
  address: string;
  price: string;
  area: string;
  portalUrl: string;
  sourceLabel: string;
  transactionLabel?: string;
  alreadyImported: boolean;
  existingOfferId: number | null;
  outreachSent: boolean;
  outreachSentAt: string | null;
  blockedReason: "imported" | "outreach" | "inactive" | null;
  portalActive?: boolean | null;
  portalCheckReason?: string | null;
};

type PreviewState = {
  loading: boolean;
  error: string;
  message: string;
  page: number;
  hasNextPage: boolean;
  listings: PreviewListing[];
};

type FloorPlanSelection = { enabled: boolean; imageIndex: number };

type LastImagePeek = {
  loading: boolean;
  error: string;
  imageUrls: string[];
  suggestedFloorPlanIndex: number | null;
  suggestedFloorPlan: boolean;
  imageCount: number;
};

type OutreachResultItem = {
  keiId: string;
  portalUrl: string;
  address: string;
  inviteUrl: string;
  message: string;
  sentAt: string;
};

type FacetOption = {
  id: string;
  label: string;
  count: number;
  district?: string;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  dateFrom?: string;
  dateTo?: string;
};

type SearchFacets = {
  sampled: number;
  districts: FacetOption[];
  priceRanges: FacetOption[];
  areaRanges: FacetOption[];
  datePresets: FacetOption[];
};

const MAX_SELECT = 25;
const PAGE_SIZE = 20;

function FacetSelect(props: {
  label: string;
  value: string;
  options: FacetOption[];
  loading?: boolean;
  onChange: (value: string) => void;
  anyLabel?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-black uppercase tracking-wider text-white/50">{props.label}</span>
      <select
        value={props.value}
        disabled={props.loading}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white disabled:opacity-50"
      >
        <option value="">{props.anyLabel || "Dowolna"}</option>
        {props.options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.count > 0 ? `${opt.label} (${opt.count})` : opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SegmentedControl<T extends string>(props: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ id: T; label: string }>;
}) {
  return (
    <div className="flex rounded-xl bg-white/5 p-1 border border-white/10">
      {props.options.map((opt) => {
        const active = opt.id === props.value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => props.onChange(opt.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
              active ? "bg-white text-black shadow-lg" : "text-white/55 hover:text-white"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400"
        animate={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      />
    </div>
  );
}

function StepPill(props: {
  label: string;
  done: boolean;
  active: boolean;
  pulsate?: boolean;
  accent?: "blue" | "orange";
}) {
  const accentClass =
    props.accent === "orange"
      ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
      : "border-cyan-400/50 bg-cyan-500/20 text-cyan-100";

  return (
    <motion.span
      animate={props.pulsate && props.active && !props.done ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
      transition={props.pulsate && props.active && !props.done ? { duration: 0.9, repeat: Infinity } : undefined}
      className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wide border ${
        props.done
          ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-300"
          : props.active
            ? accentClass
            : "bg-white/[0.03] border-white/8 text-white/25"
      }`}
    >
      {props.label}
    </motion.span>
  );
}

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
              : "bg-white/5 border border-white/10 text-white/70 hover:text-white"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function ImportProgressModal(props: {
  open: boolean;
  running: boolean;
  message: string;
  items: KeiExportItemProgress[];
  resultsCount: number;
  skippedCount: number;
  onMinimize: () => void;
  onClose: () => void;
  onStop?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const overallPct = computeKeiOverallPercent(props.items);

  useEffect(() => {
    if (props.open) {
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
    }
  }, [props.open, props.items, props.message]);

  if (!props.open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[999999] flex items-start sm:items-center justify-center p-3 sm:p-6"
      style={{ paddingTop: "calc(var(--eos-nav-height, 5rem) + 0.75rem)" }}
    >
      <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={props.onMinimize} aria-label="Zminimalizuj" />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex w-full sm:max-w-2xl max-h-[calc(100dvh-var(--eos-nav-height,5rem)-1.5rem)] flex-col overflow-hidden rounded-[28px] border border-white/12 bg-gradient-to-b from-[#111] to-black shadow-[0_40px_120px_rgba(0,0,0,0.8)]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
          <div>
            <p className="text-lg font-black text-white">Import KEI</p>
            <p className="text-xs text-white/45 mt-0.5">{props.message || "Postęp z serwera"}</p>
          </div>
          <div className="flex items-center gap-2">
            {props.running && props.onStop ? (
              <button
                type="button"
                onClick={props.onStop}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-[11px] font-bold text-red-300"
              >
                Stop
              </button>
            ) : null}
            <button
              type="button"
              onClick={props.onMinimize}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/8 hover:bg-white/12 text-[11px] font-bold text-white/80"
            >
              <Minimize2 size={14} /> {props.running ? "Zminimalizuj" : "Zamknij"}
            </button>
            {!props.running ? (
              <button type="button" onClick={props.onClose} className="p-2 rounded-xl hover:bg-white/10 text-white/60">
                <X size={18} />
              </button>
            ) : null}
          </div>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div>
            <div className="flex items-end justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-white/40">Ogółem</span>
              <span className="text-2xl font-black tabular-nums text-white">{overallPct}%</span>
            </div>
            <ProgressBar percent={overallPct} />
          </div>

          {props.items.map((item) => {
            const pct = computeKeiItemPercent(item);
            const isActive = item.status === "active";
            const isDone = item.status === "done";
            const isSkipped = item.status === "skipped";
            return (
              <div
                key={`${item.index}-${item.portalUrl}`}
                className={`rounded-[22px] border p-4 ${
                  isActive
                    ? "border-cyan-400/35 bg-cyan-500/[0.08]"
                    : isDone
                      ? "border-emerald-400/25 bg-emerald-500/[0.06]"
                      : isSkipped
                        ? "border-amber-400/20 bg-amber-500/[0.04]"
                        : "border-white/8 bg-black/30 opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{item.address || item.portalUrl}</p>
                    <p className="text-xs text-white/50 mt-0.5">{item.stepLabel}</p>
                    {item.stepDetail ? <p className="text-[11px] text-white/40 mt-0.5">{item.stepDetail}</p> : null}
                  </div>
                  <span className="text-lg font-black tabular-nums text-white/80">{pct}%</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {KEI_IMPORT_STEPS.map((step) => {
                    const done = item.completedSteps.includes(step) || isDone;
                    const active = isActive && item.currentStep === step;
                    const isFloorPlan = step === "images" && item.imageProgress?.asFloorPlan;
                    return (
                      <StepPill
                        key={step}
                        label={isFloorPlan && (active || done) ? "Rzut" : KEI_STEP_LABELS[step]}
                        done={done}
                        active={active}
                        pulsate={props.running}
                        accent={isFloorPlan ? "orange" : "blue"}
                      />
                    );
                  })}
                </div>
                {item.aiRewrite && !item.aiRewrite.working ? (
                  <p className="text-[11px] text-cyan-200/80">
                    {item.aiRewrite.rewrittenByAi ? "Opis przepisany przez AI" : "Opis uzupełniony regułami"}
                  </p>
                ) : null}
                {isDone && item.publicUrl ? (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <a href={item.publicUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-300 hover:text-blue-200">
                      Podgląd oferty
                    </a>
                    {item.editUrl ? (
                      <a href={item.editUrl} className="text-xs font-bold text-white/70 hover:text-white">
                        Edycja
                      </a>
                    ) : null}
                  </div>
                ) : null}
                {item.reason ? <p className="text-xs text-amber-300/90 mt-2">{item.reason}</p> : null}
              </div>
            );
          })}

          {!props.running && props.resultsCount > 0 ? (
            <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              Zaimportowano: {props.resultsCount}
              {props.skippedCount > 0 ? ` · Pominięto: ${props.skippedCount}` : ""}
            </div>
          ) : null}
        </div>
      </motion.div>
    </div>
  );

  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}

function FloorPlanPicker(props: {
  portalUrl: string;
  peek: LastImagePeek | undefined;
  selection: FloorPlanSelection;
  onSelectIndex: (index: number) => void;
  onToggleEnabled: (enabled: boolean) => void;
  compact?: boolean;
}) {
  const { peek, selection } = props;
  const thumbSize = props.compact ? "w-[72px] h-[72px]" : "w-[88px] h-[88px]";
  return (
    <div className="rounded-xl border border-emerald-400/25 bg-black/30 p-3">
      {!props.compact ? (
        <p className="text-[10px] font-black uppercase tracking-wider text-white/45 mb-1">Które zdjęcie to rzut?</p>
      ) : null}
      <p className="text-[11px] text-white/45 mb-2">
        {peek?.loading
          ? "Ładowanie zdjęć z portalu…"
          : peek?.error
            ? peek.error
            : peek?.imageCount
              ? `${peek.imageCount} zdj. · dotknij miniaturę z planem (żółta ramka = sugerowane)`
              : "Brak podglądu zdjęć"}
      </p>
      {peek?.loading ? (
        <div className="flex items-center justify-center gap-2 text-xs text-white/50 py-6">
          <Loader2 size={16} className="animate-spin" />
        </div>
      ) : peek?.error ? null : (peek?.imageUrls?.length ?? 0) > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory">
          {peek!.imageUrls.map((_, imageIndex) => {
            const picked = selection.enabled && selection.imageIndex === imageIndex;
            const suggested = peek!.suggestedFloorPlanIndex === imageIndex;
            return (
              <button
                key={`${props.portalUrl}-${imageIndex}`}
                type="button"
                onClick={() => props.onSelectIndex(imageIndex)}
                className={`relative shrink-0 snap-start ${thumbSize} rounded-xl overflow-hidden border-2 transition-all ${
                  picked ? "border-amber-400 ring-2 ring-amber-400/30" : suggested ? "border-amber-400/40" : "border-white/10"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/admin/kei-amer/peek-image?portalUrl=${encodeURIComponent(props.portalUrl)}&imageIndex=${imageIndex}`}
                  alt={`Zdjęcie ${imageIndex + 1}`}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 right-1 text-[9px] font-black text-white drop-shadow">{imageIndex + 1}</span>
                {suggested ? (
                  <span className="absolute top-1 left-1 px-1 rounded bg-amber-500 text-[8px] font-black text-black">?</span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-center h-[72px] rounded-xl bg-white/5">
          <ImageIcon size={20} className="text-white/30" />
        </div>
      )}
      <label className="mt-3 flex items-center justify-between gap-3 cursor-pointer">
        <div>
          <p className="text-xs font-semibold text-white">Zapisz jako rzut (plan)</p>
          <p className="text-[11px] text-white/45">
            {selection.enabled ? `Zdjęcie #${selection.imageIndex + 1} → sekcja planu` : "Tylko galeria — bez planu"}
          </p>
        </div>
        <input
          type="checkbox"
          checked={selection.enabled}
          onChange={(e) => props.onToggleEnabled(e.target.checked)}
          className="w-5 h-5 accent-emerald-500"
        />
      </label>
    </div>
  );
}

function OutreachSenderCard(props: {
  sender: KeiOutreachSenderProfile;
  onChange: (next: KeiOutreachSenderProfile) => void;
  highlightMissing?: boolean;
}) {
  const border = props.highlightMissing
    ? "border-red-400/50 bg-red-500/[0.06]"
    : "border-emerald-400/30 bg-emerald-500/[0.04]";
  return (
    <div id="outreach-sender-card" className={`rounded-[24px] border p-5 space-y-4 ${border}`}>
      <div>
        <p className="text-sm font-black text-white">Dane do formularza OtoDom</p>
        <p className="text-xs text-white/55 mt-1 leading-relaxed">
          Wpisz raz — użyjesz przy każdym zaproszeniu. Pola na OtoDom:{" "}
          <span className="text-white/80">Imię</span>, <span className="text-white/80">E-mail</span>,{" "}
          <span className="text-white/80">Numer telefonu</span>. Treść wiadomości wkleisz skrótem Cmd+V.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200/90">Imię *</span>
          <input
            value={props.sender.name}
            onChange={(e) => props.onChange({ ...props.sender, name: e.target.value })}
            placeholder="np. Marian"
            className="w-full px-3 py-3 rounded-xl bg-black/50 border border-white/15 text-sm text-white"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200/90">E-mail *</span>
          <input
            type="email"
            value={props.sender.email}
            onChange={(e) => props.onChange({ ...props.sender, email: e.target.value })}
            placeholder="kontakt@estateos.pl"
            className="w-full px-3 py-3 rounded-xl bg-black/50 border border-white/15 text-sm text-white"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200/90">Telefon *</span>
          <input
            value={props.sender.phone}
            onChange={(e) => props.onChange({ ...props.sender, phone: e.target.value })}
            placeholder="+48 500 000 000"
            className="w-full px-3 py-3 rounded-xl bg-black/50 border border-white/15 text-sm text-white"
          />
        </label>
      </div>
    </div>
  );
}

function OutreachToast(props: {
  open: boolean;
  address: string;
  pendingCount: number;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {props.open ? (
        <motion.div
          key="outreach-toast"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          className="fixed bottom-24 inset-x-4 z-[80] mx-auto max-w-xl pointer-events-auto"
        >
      <div className="rounded-2xl border border-emerald-400/40 bg-[#0d1f17]/95 backdrop-blur-md shadow-2xl px-4 py-3.5 flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-black">
          <Check size={18} strokeWidth={3} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-emerald-100">Skopiowano · OtoDom otwarty</p>
          <p className="text-xs text-white/65 mt-0.5 line-clamp-2">{props.address}</p>
          <p className="text-[11px] text-emerald-200/90 mt-1.5">
            Wklej <span className="font-bold">Cmd+V</span> w pole „Twoja wiadomość” i kliknij Wyślij.
            {props.pendingCount > 0 ? ` · ${props.pendingCount} kolejnych w sekcji poniżej` : ""}
          </p>
        </div>
        <button type="button" onClick={props.onClose} className="p-1.5 text-white/40 hover:text-white shrink-0">
          <X size={16} />
        </button>
      </div>
    </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default function KeiAmerWorkspace() {
  const [session, setSession] = useState<SessionState>({ loading: true, ok: false, message: "" });
  const [actionMode, setActionMode] = useState<ActionMode>("import");
  const [propertyKind, setPropertyKind] = useState<PropertyKind>("apartment");
  const [transactionKind, setTransactionKind] = useState<TransactionKind>("sale");
  const [browseMode, setBrowseMode] = useState<"feed" | "search">("feed");
  const [districtId, setDistrictId] = useState("");
  const [priceRangeId, setPriceRangeId] = useState("");
  const [areaRangeId, setAreaRangeId] = useState("");
  const [datePresetId, setDatePresetId] = useState("");
  const [facets, setFacets] = useState<SearchFacets | null>(null);
  const [facetsLoading, setFacetsLoading] = useState(false);
  const [facetsError, setFacetsError] = useState("");
  const [targetUserId, setTargetUserId] = useState("55");
  const [commissionPercent, setCommissionPercent] = useState("2");
  const [exportCount, setExportCount] = useState("1");
  const [previewPage, setPreviewPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, PreviewListing>>({});
  const [floorPlanSelections, setFloorPlanSelections] = useState<Record<string, FloorPlanSelection>>({});
  const [lastImagePeeks, setLastImagePeeks] = useState<Record<string, LastImagePeek>>({});
  const [importedStackExpanded, setImportedStackExpanded] = useState(false);
  const [outreachStackExpanded, setOutreachStackExpanded] = useState(false);
  const [outreachLoading, setOutreachLoading] = useState(false);
  const [outreachError, setOutreachError] = useState("");
  const [outreachResults, setOutreachResults] = useState<OutreachResultItem[]>([]);
  const [outreachToastOpen, setOutreachToastOpen] = useState(false);
  const [outreachToastAddress, setOutreachToastAddress] = useState("");
  const [outreachToastPending, setOutreachToastPending] = useState(0);
  const [outreachTemplate, setOutreachTemplate] = useState(DEFAULT_KEI_OUTREACH_TEMPLATE);
  const [outreachSender, setOutreachSender] = useState<KeiOutreachSenderProfile>({
    name: "",
    email: "",
    phone: "",
  });
  const [outreachSenderMissing, setOutreachSenderMissing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>({
    loading: false,
    error: "",
    message: "",
    page: 1,
    hasNextPage: false,
    listings: [],
  });

  const exportRunning = useKeiAmerExportStore((s) => s.running);
  const exportVisible = useKeiAmerExportStore((s) => s.modalVisible);
  const exportMessage = useKeiAmerExportStore((s) => s.message);
  const exportItems = useKeiAmerExportStore((s) => s.items);
  const exportResults = useKeiAmerExportStore((s) => s.results);
  const exportSkipped = useKeiAmerExportStore((s) => s.skipped);
  const setExportVisible = useKeiAmerExportStore((s) => s.setModalVisible);
  const startKeiExport = useKeiAmerExportStore((s) => s.startExport);
  const cancelKeiExport = useKeiAmerExportStore((s) => s.cancelExport);
  const hydrateExport = useKeiAmerExportStore((s) => s.hydrateFromServer);
  const clearExportSession = useKeiAmerExportStore((s) => s.clearSession);

  const peekInflight = useRef(new Set<string>());
  const selectedList = useMemo(() => Object.values(selected), [selected]);
  const selectedCount = selectedList.length;
  const overallPercent = computeKeiOverallPercent(exportItems);

  useEffect(() => {
    void hydrateExport();
  }, [hydrateExport]);

  useEffect(() => {
    setOutreachTemplate(loadKeiOutreachTemplate());
    const saved = loadKeiOutreachSender();
    setOutreachSender(saved);
  }, []);

  const loadOutreachProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/kei-amer/outreach-profile", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.profile) return;
      const saved = loadKeiOutreachSender();
      const hasSaved = Boolean(saved.name.trim() && saved.email.trim() && saved.phone.trim());
      if (!hasSaved) {
        const profile = data.profile as KeiOutreachSenderProfile;
        setOutreachSender(profile);
        saveKeiOutreachSender(profile);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (actionMode === "outreach") void loadOutreachProfile();
  }, [actionMode, loadOutreachProfile]);

  const deliverOutreachItem = useCallback(async (item: OutreachResultItem) => {
    try {
      await navigator.clipboard.writeText(item.message);
      setCopiedKey(item.portalUrl);
      window.setTimeout(() => setCopiedKey(null), 2200);
    } catch {
      /* ignore */
    }
    if (item.portalUrl) {
      window.open(item.portalUrl, "_blank", "noopener,noreferrer");
    }
  }, []);

  useEffect(() => {
    if (!outreachToastOpen) return;
    const timer = window.setTimeout(() => setOutreachToastOpen(false), 12000);
    return () => window.clearTimeout(timer);
  }, [outreachToastOpen]);

  const openOutreachItem = useCallback(
    async (item: OutreachResultItem) => {
      await deliverOutreachItem(item);
      setOutreachToastAddress(item.address);
      setOutreachToastPending(0);
      setOutreachToastOpen(true);
    },
    [deliverOutreachItem],
  );

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
      setSession({ loading: false, ok: false, message: "Nie udało się połączyć z integracją KEI AMER." });
    }
  }, []);

  const loadLastImagePeek = useCallback(async (portalUrl: string) => {
    if (!portalUrl || peekInflight.current.has(portalUrl)) return;
    peekInflight.current.add(portalUrl);
    setLastImagePeeks((prev) => ({
      ...prev,
      [portalUrl]: {
        loading: true,
        error: "",
        imageUrls: [],
        suggestedFloorPlanIndex: null,
        suggestedFloorPlan: false,
        imageCount: 0,
      },
    }));
    try {
      const qs = new URLSearchParams({ portalUrl });
      const res = await fetch(`/api/admin/kei-amer/peek?${qs}`, { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Podgląd niedostępny"));
      const suggestedIdx =
        data.suggestedFloorPlanIndex ??
        (data.suggestedFloorPlan && data.imageUrls?.length ? data.imageUrls.length - 1 : null);
      setLastImagePeeks((prev) => ({
        ...prev,
        [portalUrl]: {
          loading: false,
          error: "",
          imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
          suggestedFloorPlanIndex: suggestedIdx,
          suggestedFloorPlan: suggestedIdx != null,
          imageCount: Number(data.imageCount) || 0,
        },
      }));
      if (suggestedIdx != null) {
        setFloorPlanSelections((prev) => {
          if (portalUrl in prev) return prev;
          return { ...prev, [portalUrl]: { enabled: true, imageIndex: suggestedIdx } };
        });
      }
    } catch (e) {
      setLastImagePeeks((prev) => ({
        ...prev,
        [portalUrl]: {
          loading: false,
          error: e instanceof Error ? e.message : "Błąd podglądu",
          imageUrls: [],
          suggestedFloorPlanIndex: null,
          suggestedFloorPlan: false,
          imageCount: 0,
        },
      }));
    } finally {
      peekInflight.current.delete(portalUrl);
    }
  }, []);

  const selectedDistrict = useMemo(
    () => facets?.districts.find((opt) => opt.id === districtId),
    [facets, districtId],
  );
  const selectedPrice = useMemo(
    () => facets?.priceRanges.find((opt) => opt.id === priceRangeId),
    [facets, priceRangeId],
  );
  const selectedArea = useMemo(
    () => facets?.areaRanges.find((opt) => opt.id === areaRangeId),
    [facets, areaRangeId],
  );
  const selectedDate = useMemo(
    () => facets?.datePresets.find((opt) => opt.id === datePresetId),
    [facets, datePresetId],
  );

  const loadFacets = useCallback(async () => {
    setFacetsLoading(true);
    setFacetsError("");
    try {
      const qs = new URLSearchParams({ propertyKind, transactionKind });
      const res = await fetch(`/api/admin/kei-amer/facets?${qs}`, { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || `Błąd filtrów (${res.status}).`));
      const next: SearchFacets = {
        sampled: Number(data?.sampled) || 0,
        districts: Array.isArray(data?.districts) ? data.districts : [],
        priceRanges: Array.isArray(data?.priceRanges) ? data.priceRanges : [],
        areaRanges: Array.isArray(data?.areaRanges) ? data.areaRanges : [],
        datePresets: Array.isArray(data?.datePresets) ? data.datePresets : [],
      };
      setFacets(next);
      setDistrictId((prev) => (next.districts.some((opt) => opt.id === prev) ? prev : ""));
      setPriceRangeId((prev) => (next.priceRanges.some((opt) => opt.id === prev) ? prev : ""));
      setAreaRangeId((prev) => (next.areaRanges.some((opt) => opt.id === prev) ? prev : ""));
      setDatePresetId((prev) => (next.datePresets.some((opt) => opt.id === prev) ? prev : ""));
    } catch (e) {
      setFacets(null);
      setFacetsError(e instanceof Error ? e.message : "Nie udało się pobrać list z KEI.");
    } finally {
      setFacetsLoading(false);
    }
  }, [propertyKind, transactionKind]);

  const loadPreview = useCallback(
    async (page = previewPage) => {
      setPreview((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const qs = new URLSearchParams({
          propertyKind,
          transactionKind,
          page: String(page),
          pageSize: String(PAGE_SIZE),
          mode: browseMode,
        });
        if (browseMode === "search") {
          if (selectedDistrict?.district) qs.set("district", selectedDistrict.district);
          if (selectedPrice?.minPrice != null) qs.set("minPrice", String(selectedPrice.minPrice));
          if (selectedPrice?.maxPrice != null) qs.set("maxPrice", String(selectedPrice.maxPrice));
          if (selectedArea?.minArea != null) qs.set("minArea", String(selectedArea.minArea));
          if (selectedArea?.maxArea != null) qs.set("maxArea", String(selectedArea.maxArea));
          if (selectedDate?.dateFrom) qs.set("dateFrom", selectedDate.dateFrom);
          if (selectedDate?.dateTo) qs.set("dateTo", selectedDate.dateTo);
          qs.set("verify", "1");
        }
        const res = await fetch(`/api/admin/kei-amer/preview?${qs}`, { credentials: "include", cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(String(data?.error || `Błąd podglądu (${res.status}).`));
        const listings = Array.isArray(data?.listings)
          ? data.listings.map((row: Record<string, unknown>) => ({
              keiId: String(row.keiId || ""),
              date: String(row.date || ""),
              address: String(row.address || ""),
              price: String(row.price || ""),
              area: String(row.area || ""),
              portalUrl: String(row.portalUrl || ""),
              sourceLabel: String(row.sourceLabel || ""),
              transactionLabel: String(row.transactionLabel || ""),
              alreadyImported: Boolean(row.alreadyImported),
              existingOfferId: Number(row.existingOfferId) || null,
              outreachSent: Boolean(row.outreachSent),
              outreachSentAt: row.outreachSentAt ? String(row.outreachSentAt) : null,
              blockedReason: (row.blockedReason as PreviewListing["blockedReason"]) || null,
              portalActive: typeof row.portalActive === "boolean" ? row.portalActive : null,
              portalCheckReason: row.portalCheckReason ? String(row.portalCheckReason) : null,
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
        setImportedStackExpanded(false);
        setOutreachStackExpanded(false);
      } catch (e) {
        setPreview({
          loading: false,
          error: e instanceof Error ? e.message : "Błąd połączenia.",
          message: "",
          page,
          hasNextPage: false,
          listings: [],
        });
      }
    },
    [previewPage, propertyKind, transactionKind, browseMode, selectedDistrict, selectedPrice, selectedArea, selectedDate],
  );

  const autoSelectByCount = useCallback(
    async (count: number) => {
      if (!session.ok) return;
      const n = Math.max(0, Math.min(Math.floor(count), MAX_SELECT));
      if (n === 0) {
        setSelected({});
        return;
      }
      try {
        const qs = new URLSearchParams({ propertyKind, transactionKind, selectionPool: "1" });
        const res = await fetch(`/api/admin/kei-amer/preview?${qs}`, { credentials: "include", cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const pool = Array.isArray(data?.listings) ? data.listings : [];
        const picks: Record<string, PreviewListing> = {};
        for (const row of pool) {
          if (Object.keys(picks).length >= n) break;
          if (row.blockedReason || row.alreadyImported || row.outreachSent) continue;
          const item: PreviewListing = {
            keiId: String(row.keiId || ""),
            date: String(row.date || ""),
            address: String(row.address || ""),
            price: String(row.price || ""),
            area: String(row.area || ""),
            portalUrl: String(row.portalUrl || ""),
            sourceLabel: String(row.sourceLabel || ""),
            transactionLabel: String(row.transactionLabel || ""),
            alreadyImported: Boolean(row.alreadyImported),
            existingOfferId: Number(row.existingOfferId) || null,
            outreachSent: Boolean(row.outreachSent),
            outreachSentAt: row.outreachSentAt ? String(row.outreachSentAt) : null,
            blockedReason: row.blockedReason || null,
          };
          if (!item.keiId || !item.portalUrl) continue;
          picks[item.portalUrl] = item;
        }
        setSelected(picks);
        setExportCount(String(Object.keys(picks).length));
        for (const item of Object.values(picks)) void loadLastImagePeek(item.portalUrl);
      } catch {
        /* ignore */
      }
    },
    [propertyKind, transactionKind, session.ok, loadLastImagePeek],
  );

  useEffect(() => {
    void ensureSession(true);
  }, [ensureSession]);

  useEffect(() => {
    if (!session.ok || session.loading) return;
    void loadFacets();
  }, [session.ok, session.loading, loadFacets]);

  useEffect(() => {
    if (!session.ok || session.loading || exportRunning) return;
    if (browseMode === "search") return;
    void loadPreview(previewPage);
  }, [session.ok, session.loading, propertyKind, transactionKind, previewPage, exportRunning, browseMode, loadPreview]);

  useEffect(() => {
    if (!session.ok || exportRunning) return;
    setPreviewPage(1);
    setSelected({});
    setFloorPlanSelections({});
    void autoSelectByCount(Number(exportCount) || 1);
  }, [propertyKind, transactionKind, session.ok]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolveFloorPlanSelection = useCallback(
    (portalUrl: string): FloorPlanSelection => {
      if (portalUrl in floorPlanSelections) return floorPlanSelections[portalUrl];
      const peek = lastImagePeeks[portalUrl];
      const idx = peek?.suggestedFloorPlanIndex;
      return { enabled: idx != null, imageIndex: idx ?? 0 };
    },
    [floorPlanSelections, lastImagePeeks],
  );

  const toggleSelection = (item: PreviewListing) => {
    if (item.blockedReason) return;
    setSelected((prev) => {
      const next = { ...prev };
      if (next[item.portalUrl]) {
        delete next[item.portalUrl];
      } else {
        if (Object.keys(next).length >= MAX_SELECT) return prev;
        next[item.portalUrl] = item;
        void loadLastImagePeek(item.portalUrl);
      }
      setExportCount(String(Object.keys(next).length));
      return next;
    });
  };

  const handleExportCountChange = (raw: string) => {
    setExportCount(raw);
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      setSelected({});
      return;
    }
    void autoSelectByCount(n);
  };

  const refreshAfterAction = useCallback(() => {
    setSelected({});
    setFloorPlanSelections({});
    setExportCount("1");
    void autoSelectByCount(1);
    void loadPreview(previewPage);
  }, [autoSelectByCount, loadPreview, previewPage]);

  const handleImport = () => {
    if (exportRunning || selectedCount === 0 || !session.ok) {
      if (exportRunning) setExportVisible(true);
      return;
    }
    const userId = Number(targetUserId);
    const comm = Number(commissionPercent);
    if (!Number.isFinite(userId) || userId <= 0) {
      alert("Podaj poprawne ID użytkownika docelowego.");
      return;
    }
    const blocked = selectedList.filter((row) => row.blockedReason);
    if (blocked.length > 0) {
      alert(`${blocked.length} ogłoszeń jest zablokowanych (import lub outreach). Odznacz je.`);
      return;
    }

    const floorPlanPayload: Record<string, FloorPlanSelection> = {};
    for (const row of selectedList) {
      floorPlanPayload[row.portalUrl] = resolveFloorPlanSelection(row.portalUrl);
    }

    const initialItems: KeiExportItemProgress[] = selectedList.map((row, index) => ({
      index,
      keiListingId: row.keiId,
      portalUrl: row.portalUrl,
      address: row.address,
      status: index === 0 ? "active" : "pending",
      completedSteps: [],
      currentStep: index === 0 ? ("check_duplicate" as KeiImportStepId) : null,
      stepLabel: index === 0 ? "Sprawdzanie duplikatu…" : "Oczekuje w kolejce…",
    }));

    startKeiExport(
      {
        targetUserId: userId,
        agentCommissionPercent: Number.isFinite(comm) ? comm : 2,
        propertyKind,
        transactionKind,
        selections: selectedList.map((row) => ({
          keiId: row.keiId,
          portalUrl: row.portalUrl,
          address: row.address,
        })),
        floorPlanSelections: floorPlanPayload,
      },
      initialItems,
      refreshAfterAction,
    );
  };

  const handleOutreach = async () => {
    if (outreachLoading || selectedCount === 0 || !session.ok) return;
    const blocked = selectedList.filter((row) => row.blockedReason);
    if (blocked.length > 0) {
      setOutreachError("Wybrane ogłoszenia zawierają pozycje zablokowane (już zaimportowane lub z wysłanym zaproszeniem).");
      return;
    }
    if (!outreachSender.name.trim() || !outreachSender.email.trim() || !outreachSender.phone.trim()) {
      setOutreachSenderMissing(true);
      setOutreachError("Uzupełnij imię, e-mail i telefon w sekcji „Dane do formularza OtoDom” powyżej.");
      document.getElementById("outreach-sender-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setOutreachSenderMissing(false);
    saveKeiOutreachTemplate(outreachTemplate);
    saveKeiOutreachSender(outreachSender);
    setOutreachLoading(true);
    setOutreachError("");
    try {
      const res = await fetch("/api/admin/kei-amer/outreach", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageTemplate: outreachTemplate,
          selections: selectedList.map((row) => ({
            keiId: row.keiId,
            portalUrl: row.portalUrl,
            address: row.address,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || "Nie udało się przygotować zaproszeń."));
      const items: OutreachResultItem[] = Array.isArray(data.items) ? data.items : [];
      setOutreachResults(items);
      if (items.length > 0) {
        await deliverOutreachItem(items[0]);
        setOutreachToastAddress(items[0].address);
        setOutreachToastPending(Math.max(0, items.length - 1));
        setOutreachToastOpen(true);
      }
      refreshAfterAction();
    } catch (e) {
      setOutreachError(e instanceof Error ? e.message : "Błąd połączenia.");
    } finally {
      setOutreachLoading(false);
    }
  };

  const copyOutreachMessage = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2200);
    } catch {
      /* ignore */
    }
  };

  const listingGroups = useMemo(() => {
    const imported: PreviewListing[] = [];
    const outreach: PreviewListing[] = [];
    const available: PreviewListing[] = [];
    for (const item of preview.listings) {
      if (item.blockedReason === "imported" || item.alreadyImported) imported.push(item);
      else if (item.blockedReason === "outreach" || item.outreachSent) outreach.push(item);
      else available.push(item);
    }
    return { imported, outreach, available };
  }, [preview.listings]);

  const primaryActionLabel =
    actionMode === "import"
      ? exportRunning
        ? `Import w toku (${overallPercent}%)`
        : `Importuj (${selectedCount})`
      : outreachLoading
        ? "Przygotowuję wiadomości…"
        : `Zaproszenie właściciela (${selectedCount})`;

  return (
    <div className="mt-10 bg-[#0a0a0a] border border-white/5 rounded-[40px] p-6 md:p-8 shadow-2xl relative pb-28">
      <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h3 className="text-xl md:text-2xl font-black mb-2">KEI AMER — eksport ogłoszeń</h3>
            <p className="text-gray-500 text-xs md:text-sm max-w-3xl leading-relaxed">
              Import do wybranego użytkownika albo zaproszenie właściciela na <span className="text-emerald-400/90">/dolacz</span>.
              Dla jednego ogłoszenia możliwe jest tylko jedno działanie — import albo outreach.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void ensureSession(true)}
              disabled={session.loading}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-wider text-white/80 hover:text-white disabled:opacity-60"
            >
              {session.loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Odśwież sesję
            </button>
            <button
              type="button"
              onClick={() => void loadPreview(previewPage)}
              disabled={preview.loading || !session.ok}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-wider text-white/80 hover:text-white disabled:opacity-60"
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
            <motion.button
              type="button"
              disabled={
                (!exportRunning && selectedCount === 0) ||
                (!exportRunning && !session.ok) ||
                outreachLoading
              }
              animate={
                (exportRunning || (selectedCount > 0 && session.ok)) && !outreachLoading
                  ? {
                      boxShadow: [
                        "0 0 0 0 rgba(52,211,153,0.45)",
                        "0 0 0 10px rgba(52,211,153,0)",
                        "0 0 0 0 rgba(52,211,153,0.45)",
                      ],
                    }
                  : undefined
              }
              transition={exportRunning || selectedCount > 0 ? { duration: 1.2, repeat: Infinity } : undefined}
              onClick={() => (actionMode === "import" ? handleImport() : void handleOutreach())}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500 text-black text-xs font-black uppercase tracking-wider hover:bg-emerald-400 disabled:opacity-50 disabled:animate-none"
            >
              {exportRunning || outreachLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : actionMode === "import" ? (
                <UploadCloud size={16} />
              ) : (
                <Send size={16} />
              )}
              {primaryActionLabel}
            </motion.button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-white/45 mb-2">Tryb działania</p>
            <SegmentedControl
              value={actionMode}
              onChange={setActionMode}
              options={[
                { id: "import", label: "Import do użytkownika" },
                { id: "outreach", label: "Zaproszenie właściciela" },
              ]}
            />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-white/45 mb-2">Transakcja</p>
            <SegmentedControl
              value={transactionKind}
              onChange={setTransactionKind}
              options={[
                { id: "sale", label: "Kupno" },
                { id: "rent", label: "Wynajem" },
              ]}
            />
          </div>
        </div>

        {actionMode === "outreach" ? (
          <div className="space-y-4">
            <OutreachSenderCard
              sender={outreachSender}
              highlightMissing={outreachSenderMissing}
              onChange={(next) => {
                setOutreachSender(next);
                saveKeiOutreachSender(next);
                if (next.name.trim() && next.email.trim() && next.phone.trim()) {
                  setOutreachSenderMissing(false);
                  setOutreachError("");
                }
              }}
            />
            <div className="rounded-[24px] border border-white/10 bg-white/[0.02] p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-white/50">Treść wiadomości (edytowalna)</p>
                <button
                  type="button"
                  onClick={() => setOutreachTemplate(DEFAULT_KEI_OUTREACH_TEMPLATE)}
                  className="text-[10px] font-bold uppercase text-white/45 hover:text-white"
                >
                  Przywróć domyślną
                </button>
              </div>
              <textarea
                value={outreachTemplate}
                onChange={(e) => setOutreachTemplate(e.target.value)}
                onBlur={() => saveKeiOutreachTemplate(outreachTemplate)}
                rows={7}
                className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-mono leading-relaxed"
              />
              <p className="text-[10px] text-white/40">
                Zmienne: <code className="text-emerald-300/80">{"{{location}}"}</code>,{" "}
                <code className="text-emerald-300/80">{"{{source}}"}</code>,{" "}
                <code className="text-emerald-300/80">{"{{inviteUrl}}"}</code>,{" "}
                <code className="text-emerald-300/80">{"{{siteUrl}}"}</code>.
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          {actionMode === "import" ? (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-white/50">ID użytkownika</span>
                <input
                  type="number"
                  min={1}
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
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
                  className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
                />
              </label>
            </>
          ) : null}

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-white/50">Ile ogłoszeń ({selectedCount})</span>
            <input
              type="number"
              min={0}
              max={MAX_SELECT}
              value={exportCount}
              onChange={(e) => handleExportCountChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-white/50">Typ nieruchomości</span>
            <select
              value={propertyKind}
              onChange={(e) => setPropertyKind(e.target.value as PropertyKind)}
              className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white"
            >
              <option value="apartment">Mieszkanie</option>
              <option value="house">Dom</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 md:col-span-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-white/50">Tryb listy</span>
            <SegmentedControl
              value={browseMode}
              onChange={(mode) => {
                setBrowseMode(mode);
                setSelected({});
                setPreviewPage(1);
              }}
              options={[
                { id: "feed", label: "Aktualne" },
                { id: "search", label: "Wyszukiwanie" },
              ]}
            />
          </label>
        </div>

        {browseMode === "search" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <FacetSelect
              label="Dzielnica"
              value={districtId}
              options={facets?.districts || []}
              loading={facetsLoading}
              onChange={setDistrictId}
              anyLabel="Cała Warszawa"
            />
            <FacetSelect
              label="Cena"
              value={priceRangeId}
              options={facets?.priceRanges || []}
              loading={facetsLoading}
              onChange={setPriceRangeId}
            />
            <FacetSelect
              label="Metraż"
              value={areaRangeId}
              options={facets?.areaRanges || []}
              loading={facetsLoading}
              onChange={setAreaRangeId}
              anyLabel="Dowolny"
            />
            <FacetSelect
              label="Data wystawienia"
              value={datePresetId}
              options={facets?.datePresets || []}
              loading={facetsLoading}
              onChange={setDatePresetId}
            />
            <div className="md:col-span-2 flex items-end">
              <button
                type="button"
                onClick={() => {
                  setSelected({});
                  setPreviewPage(1);
                  void loadPreview(1);
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 text-black text-xs font-black uppercase"
              >
                <RefreshCw size={14} /> Szukaj i sprawdź aktualność
              </button>
            </div>
            <p className="md:col-span-2 text-[11px] text-white/45">
              {facetsError
                ? facetsError
                : facetsLoading
                  ? "Pobieram dzielnice, ceny i metraże z amer.kei.pl…"
                  : facets?.sampled
                    ? `Listy z amer.kei.pl · ${facets.sampled} ogłoszeń w próbce. Wyszukiwanie obejmuje też starsze oferty i weryfikuje link na portalu.`
                    : "Wybierz dzielnicę, cenę albo metraż z listy KEI — bez ręcznego wpisywania."}
            </p>
          </div>
        ) : null}

        <div className="text-xs md:text-sm">
          {session.loading ? (
            <p className="text-white/50">Łączenie z KEI AMER…</p>
          ) : session.ok ? (
            <p className="text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">{session.message || "Sesja KEI AMER gotowa."}</p>
          ) : (
            <p className="text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{session.message || "Brak sesji KEI AMER."}</p>
          )}
        </div>

        {outreachError ? (
          <p className="text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm">{outreachError}</p>
        ) : null}

        {outreachResults.length > 0 ? (
          <div className="rounded-[24px] border border-emerald-400/25 bg-emerald-500/[0.06] p-4 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-emerald-200 flex items-center gap-2">
              <Sparkles size={14} /> Przygotowane wiadomości ({outreachResults.length})
            </p>
            {outreachResults.map((item) => (
              <div key={item.portalUrl} className="rounded-xl border border-white/10 bg-black/40 p-3">
                <p className="text-xs font-semibold text-white truncate mb-1">{item.address}</p>
                <pre className="text-[11px] text-white/70 whitespace-pre-wrap font-sans max-h-40 overflow-y-auto">{item.message}</pre>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => void openOutreachItem(item)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase"
                  >
                    <ExternalLink size={14} /> Otwórz OtoDom + kopiuj
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyOutreachMessage(item.portalUrl, item.message)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/15 text-[10px] font-black uppercase text-white/75"
                  >
                    {copiedKey === item.portalUrl ? <Check size={14} /> : <Copy size={14} />}
                    {copiedKey === item.portalUrl ? "Skopiowano" : "Tylko kopiuj"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {actionMode === "import" && selectedList.length > 0 ? (
          <div className="rounded-[24px] border border-amber-400/25 bg-amber-500/[0.05] p-4 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-200/90">
              Rzut lokalu — wybór zdjęcia ({selectedList.length})
            </p>
            {selectedList.map((item) => (
              <div key={item.portalUrl} className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-xs font-semibold text-white/85 truncate mb-2">{item.address || item.portalUrl}</p>
                <FloorPlanPicker
                  portalUrl={item.portalUrl}
                  peek={lastImagePeeks[item.portalUrl]}
                  selection={resolveFloorPlanSelection(item.portalUrl)}
                  onSelectIndex={(imageIndex) =>
                    setFloorPlanSelections((prev) => ({
                      ...prev,
                      [item.portalUrl]: { enabled: true, imageIndex },
                    }))
                  }
                  onToggleEnabled={(enabled) =>
                    setFloorPlanSelections((prev) => ({
                      ...prev,
                      [item.portalUrl]: {
                        enabled,
                        imageIndex: resolveFloorPlanSelection(item.portalUrl).imageIndex,
                      },
                    }))
                  }
                />
              </div>
            ))}
          </div>
        ) : null}

        <div className="rounded-[28px] border border-white/10 bg-white/[0.02] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-white/60">Podgląd ogłoszeń KEI</p>
            <p className="text-[10px] text-white/40">{selectedCount} zazn. · {PAGE_SIZE}/str.</p>
          </div>
          <div className="px-4 py-2 border-b border-white/10">
            <PagePager page={preview.page} hasNextPage={preview.hasNextPage} disabled={preview.loading || !session.ok} onChange={setPreviewPage} />
          </div>

          {preview.loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-white/50 text-sm">
              <Loader2 size={18} className="animate-spin" /> Ładowanie listy…
            </div>
          ) : preview.error ? (
            <p className="text-red-300/90 px-4 py-6 text-sm">{preview.error}</p>
          ) : (
            <>
              {listingGroups.imported.length > 0 ? (
                <StackSection
                  title={`Już w bazie (${listingGroups.imported.length})`}
                  expanded={importedStackExpanded}
                  onToggle={() => setImportedStackExpanded((v) => !v)}
                  tone="amber"
                >
                  {listingGroups.imported.map((item) => (
                    <BlockedRow key={item.keiId} item={item} badge={`#${item.existingOfferId}`} />
                  ))}
                </StackSection>
              ) : null}

              {listingGroups.outreach.length > 0 ? (
                <StackSection
                  title={`Wysłano zaproszenie (${listingGroups.outreach.length})`}
                  expanded={outreachStackExpanded}
                  onToggle={() => setOutreachStackExpanded((v) => !v)}
                  tone="cyan"
                >
                  {listingGroups.outreach.map((item) => (
                    <BlockedRow key={item.keiId} item={item} badge="OUTREACH" />
                  ))}
                </StackSection>
              ) : null}

              <div className="px-4 py-2.5 border-b border-emerald-500/20 bg-emerald-500/[0.04]">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300/90">
                  Dostępne · {listingGroups.available.length}
                </p>
              </div>

              <div className="divide-y divide-white/5">
                {listingGroups.available.map((item) => {
                  const isSelected = Boolean(selected[item.portalUrl]);
                  return (
                    <div key={item.keiId} className={isSelected ? "bg-emerald-500/[0.05]" : ""}>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => toggleSelection(item)}
                          className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                            isSelected ? "bg-emerald-500 border-emerald-400 text-black" : "border-white/25"
                          }`}
                        >
                          {isSelected ? <Check size={12} strokeWidth={3} /> : null}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-bold uppercase text-white/40">{item.date} · {item.sourceLabel}</p>
                          <p className="text-xs text-white/90 truncate">{item.address || "Brak adresu"}</p>
                          <p className="text-[10px] text-white/45">{item.price || "—"} · {item.area ? `${item.area} m²` : "—"}</p>
                        </div>
                        {item.portalUrl ? (
                          <a href={item.portalUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-white/50 hover:text-white">
                            <ExternalLink size={14} />
                          </a>
                        ) : null}
                      </div>
                      {isSelected && actionMode === "import" ? (
                        <div className="px-3 pb-2">
                          <p className="text-[10px] text-amber-300/80 font-semibold">
                            {resolveFloorPlanSelection(item.portalUrl).enabled
                              ? `Rzut: zdjęcie #${resolveFloorPlanSelection(item.portalUrl).imageIndex + 1}`
                              : "Bez rzutu — ustaw w panelu powyżej"}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {(selectedCount > 0 || exportRunning) && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-0 inset-x-0 z-[70] p-4 md:p-6 pointer-events-none"
          >
            <div className="max-w-3xl mx-auto pointer-events-auto">
              <motion.button
                type="button"
                disabled={
                  (!exportRunning && selectedCount === 0) ||
                  (!exportRunning && !session.ok) ||
                  outreachLoading
                }
                animate={
                  exportRunning
                    ? { boxShadow: ["0 0 0 0 rgba(52,211,153,0.4)", "0 0 0 12px rgba(52,211,153,0)", "0 0 0 0 rgba(52,211,153,0.4)"] }
                    : { boxShadow: "0 12px 32px rgba(16,185,129,0.28)" }
                }
                transition={exportRunning ? { duration: 1.2, repeat: Infinity } : undefined}
                onClick={() => (actionMode === "import" ? handleImport() : void handleOutreach())}
                className={`w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-wider transition-colors ${
                  exportRunning || selectedCount > 0
                    ? "bg-emerald-500 hover:bg-emerald-400 text-black"
                    : "bg-white/10 text-white/40"
                } disabled:opacity-60`}
              >
                {exportRunning || outreachLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : actionMode === "import" ? (
                  <UploadCloud size={18} />
                ) : (
                  <Send size={18} />
                )}
                {primaryActionLabel}
                {exportRunning ? " — dotknij, aby otworzyć" : ""}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ImportProgressModal
        open={exportVisible}
        running={exportRunning}
        message={exportMessage}
        items={exportItems}
        resultsCount={exportResults.length}
        skippedCount={exportSkipped}
        onMinimize={() => setExportVisible(false)}
        onStop={() => cancelKeiExport()}
        onClose={() => {
          setExportVisible(false);
          clearExportSession();
        }}
      />

      <OutreachToast
        open={outreachToastOpen}
        address={outreachToastAddress}
        pendingCount={outreachToastPending}
        onClose={() => setOutreachToastOpen(false)}
      />
    </div>
  );
}

function StackSection(props: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  tone: "amber" | "cyan";
  children: ReactNode;
}) {
  const toneClass = props.tone === "amber" ? "text-amber-200" : "text-cyan-200";
  return (
    <div className="border-b border-white/10">
      <button type="button" onClick={props.onToggle} className="w-full px-4 py-3 flex items-center gap-2 hover:bg-white/[0.03]">
        {props.expanded ? <ChevronDown size={16} className={toneClass} /> : <ChevronRight size={16} className={toneClass} />}
        <span className={`text-xs font-black uppercase tracking-wider ${toneClass}`}>{props.title}</span>
      </button>
      {props.expanded ? <div className="divide-y divide-white/5 bg-black/20">{props.children}</div> : null}
    </div>
  );
}

function BlockedRow(props: { item: PreviewListing; badge: string }) {
  return (
    <div className="px-3 py-2 flex items-center gap-2 opacity-65">
      <span className="text-[9px] font-black uppercase text-white/45 shrink-0">{props.badge}</span>
      <span className="text-[11px] text-white/60 truncate flex-1">{props.item.address || "—"}</span>
      {props.item.portalUrl ? (
        <a href={props.item.portalUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-white/40 hover:text-white">
          <ExternalLink size={12} />
        </a>
      ) : null}
    </div>
  );
}
