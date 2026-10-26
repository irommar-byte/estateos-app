"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, ExternalLink, ImageIcon, PencilLine, Sparkles, X } from "lucide-react";
import { useKeiAmerExportStore } from "@/store/useKeiAmerExportStore";
import type { KeiExportItemProgress } from "@/lib/keiAmerExportWebClient";
import {
  KEI_STEP_ORDER,
  KEI_STEP_TITLES,
  formatEta,
  formatPricePl,
  keiItemPercent,
  summarizeKeiJob,
} from "@/lib/keiImportProgressModel";

const EASE = [0.22, 1, 0.36, 1] as const;

function ProgressBar({ percent, done, thin }: { percent: number; done?: boolean; thin?: boolean }) {
  return (
    <div
      className={`k-bar${thin ? " k-bar--thin" : ""}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div
        className={`k-bar__fill${done ? " k-bar__fill--done" : ""}${percent <= 0 ? " k-bar__fill--idle" : ""}`}
        style={{ width: `${Math.max(done ? 100 : 2, Math.min(100, percent))}%` }}
      />
    </div>
  );
}

function ProgressRing({ percent, done, size = 30 }: { percent: number; done?: boolean; size?: number }) {
  const stroke = 2.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, done ? 100 : percent)) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle className="k-ring-track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
      <circle
        className={`k-ring-fill${done ? " k-ring-fill--done" : ""}`}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

function StepTimeline({ item }: { item: KeiExportItemProgress }) {
  const isDone = item.status === "done";
  return (
    <ol className="k-steps" aria-label="Etapy importu">
      {KEI_STEP_ORDER.map((step) => {
        const done = isDone || item.completedSteps.includes(step);
        const active = item.status === "active" && item.currentStep === step;
        const label =
          step === "images" && item.imageProgress?.asFloorPlan && (active || done)
            ? "Rzut"
            : step === "activate" && item.publishState === "review"
              ? "Szkic"
              : KEI_STEP_TITLES[step];
        return (
          <li
            key={step}
            className={`k-step${done && !active ? " k-step--done" : ""}${active ? " k-step--active" : ""}`}
            aria-current={active ? "step" : undefined}
          >
            <span className="k-dot" />
            <span className="k-step__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function portalLabel(url: string): string {
  if (/otodom/i.test(url)) return "Otodom";
  if (/olx/i.test(url)) return "OLX";
  if (/nieruchomosci-online/i.test(url)) return "Nieruchomosci-Online";
  return "Portal";
}

function itemChip(item: KeiExportItemProgress): { tone: string; label: string } {
  if (item.status === "done") {
    return item.publishState === "review"
      ? { tone: "k-chip--gold", label: "Szkic do przejrzenia" }
      : { tone: "k-chip--good", label: "Opublikowano" };
  }
  if (item.status === "skipped") {
    switch (item.skipKind) {
      case "duplicate":
        return { tone: "k-chip--neutral", label: "Już w bazie" };
      case "inactive":
        return { tone: "k-chip--neutral", label: "Nieaktualne" };
      case "quality":
        return { tone: "k-chip--warn", label: "Za słabe dane" };
      case "blocked":
        return { tone: "k-chip--neutral", label: "Zablokowane" };
      case "cancelled":
        return { tone: "k-chip--neutral", label: "Anulowano" };
      default:
        return { tone: "k-chip--danger", label: "Błąd" };
    }
  }
  if (item.status === "active") return { tone: "k-chip--gold", label: `${keiItemPercent(item)}%` };
  return { tone: "k-chip--neutral", label: "W kolejce" };
}

function ItemCard({ item, highlight }: { item: KeiExportItemProgress; highlight: boolean }) {
  const chip = itemChip(item);
  const price = formatPricePl(item.price);
  const area = item.area ? `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 }).format(item.area)} m²` : null;
  const facts = [price, area, item.district].filter(Boolean).join(" · ");
  const heading = item.title || item.address || item.portalUrl;
  const portal = portalLabel(item.portalUrl);
  const secondary =
    facts ||
    (item.title && item.address ? item.address : item.status === "pending" ? `${portal} · czeka na swoją kolej` : portal);
  const showTimeline = item.status === "active" || item.status === "done";
  const imageShare =
    item.status === "active" && item.currentStep === "images" && item.imageProgress && item.imageProgress.total > 0
      ? Math.round((item.imageProgress.index / item.imageProgress.total) * 100)
      : null;

  return (
    <li
      data-item={item.index}
      className={`k-item k-card p-4 transition-[border-color,box-shadow] duration-300 ${
        highlight ? "border-[color:var(--k-gold)] shadow-[0_0_0_3px_var(--k-gold-soft)]" : ""
      } ${item.status === "pending" ? "opacity-70" : ""}`}
    >
      <div className="flex gap-3.5">
        {item.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura z portalu źródłowego
          <img src={item.thumbUrl} alt="" className="k-thumb" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <div className="k-thumb flex items-center justify-center text-[color:var(--k-ink-3)]">
            <ImageIcon size={20} strokeWidth={1.5} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold leading-snug text-[color:var(--k-ink)]" title={heading}>
                {heading}
              </p>
              <p className="mt-0.5 truncate text-[12.5px] text-[color:var(--k-ink-3)]">
                {secondary}
              </p>
            </div>
            <span className={`k-chip ${chip.tone}`}>
              {item.status === "done" && item.publishState !== "review" ? <Check size={12} strokeWidth={2.6} /> : null}
              {chip.label}
            </span>
          </div>

          {showTimeline ? (
            <div className="mt-3.5">
              <StepTimeline item={item} />
            </div>
          ) : null}

          {item.status === "active" ? (
            <div className="mt-3 space-y-2">
              <p className="text-[12.5px] text-[color:var(--k-ink-2)]">
                {item.stepLabel}
                {item.stepDetail && item.stepDetail !== item.stepLabel ? (
                  <span className="text-[color:var(--k-ink-3)]"> · {item.stepDetail}</span>
                ) : null}
              </p>
              {imageShare != null ? <ProgressBar percent={imageShare} thin /> : null}
            </div>
          ) : null}

          {item.status === "done" ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px]">
              {item.aiRewritten ? (
                <span className="inline-flex items-center gap-1.5 text-[color:var(--k-gold-ink)]">
                  <Sparkles size={13} /> Opis napisany przez AI
                </span>
              ) : (
                <span className="text-[color:var(--k-ink-3)]">Opis z szablonu</span>
              )}
              {item.imageCount != null ? (
                <span className="text-[color:var(--k-ink-3)]">{item.imageCount} zdjęć</span>
              ) : null}
              {item.publicUrl ? (
                <a
                  href={item.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-[color:var(--k-ink)] underline-offset-4 hover:underline"
                >
                  Zobacz ofertę <ExternalLink size={12} />
                </a>
              ) : null}
              {item.editUrl ? (
                <a
                  href={item.editUrl}
                  className="inline-flex items-center gap-1 font-semibold text-[color:var(--k-ink-2)] underline-offset-4 hover:underline"
                >
                  <PencilLine size={12} /> Edytuj
                </a>
              ) : null}
            </div>
          ) : null}

          {item.status === "done" && item.stepDetail && item.publishState === "review" ? (
            <p className="mt-2 text-[12px] text-[color:var(--k-gold-ink)]">{item.stepDetail}</p>
          ) : null}
          {item.status === "skipped" && item.reason ? (
            <p
              className={`mt-2 text-[12.5px] ${
                item.skipKind === "error" || !item.skipKind ? "text-[color:var(--k-danger)]" : "text-[color:var(--k-ink-3)]"
              }`}
            >
              {item.reason}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function FinishedSummary({ items, onClose }: { items: KeiExportItemProgress[]; onClose: () => void }) {
  const done = items.filter((item) => item.status === "done");
  const thumbs = done.map((item) => item.thumbUrl).filter(Boolean).slice(0, 4) as string[];
  if (done.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="k-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
    >
      <div className="flex -space-x-3">
        {thumbs.map((src, idx) => (
          // eslint-disable-next-line @next/next/no-img-element -- miniatury nowych ofert
          <img
            key={src + idx}
            src={src}
            alt=""
            referrerPolicy="no-referrer"
            className="h-12 w-12 rounded-full border-2 border-[color:var(--k-card)] object-cover"
          />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="k-serif text-[18px] text-[color:var(--k-ink)]">
          {done.length === 1 ? "Nowa oferta jest gotowa" : `${done.length} nowe oferty są gotowe`}
        </p>
        <p className="mt-0.5 text-[12.5px] text-[color:var(--k-ink-3)]">
          Każdą możesz od razu otworzyć lub poprawić — zmiany widać na portalu natychmiast.
        </p>
      </div>
      <button type="button" className="k-btn k-btn--solid" onClick={onClose}>
        Gotowe
      </button>
    </motion.div>
  );
}

function useFocusTrap(open: boolean, containerRef: React.RefObject<HTMLDivElement | null>, onEscape: () => void) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = containerRef.current;
    const focusables = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [],
      ).filter((el) => !el.hasAttribute("disabled"));
    requestAnimationFrame(() => focusables()[0]?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscape();
        return;
      }
      if (event.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, containerRef, onEscape]);
}

export function KeiImportProgressSheet() {
  const open = useKeiAmerExportStore((s) => s.modalVisible);
  const running = useKeiAmerExportStore((s) => s.running);
  const stopping = useKeiAmerExportStore((s) => s.stopping);
  const message = useKeiAmerExportStore((s) => s.message);
  const items = useKeiAmerExportStore((s) => s.items);
  const source = useKeiAmerExportStore((s) => s.source);
  const targetCount = useKeiAmerExportStore((s) => s.targetCount);
  const jobStatus = useKeiAmerExportStore((s) => s.jobStatus);
  const error = useKeiAmerExportStore((s) => s.error);
  const setVisible = useKeiAmerExportStore((s) => s.setModalVisible);
  const cancelExport = useKeiAmerExportStore((s) => s.cancelExport);
  const clearSession = useKeiAmerExportStore((s) => s.clearSession);
  const reduceMotion = useReducedMotion();

  const [confirmStop, setConfirmStop] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const userScrolledAt = useRef(0);

  const summary = useMemo(
    () => summarizeKeiJob({ items, running, source, targetCount }),
    [items, running, source, targetCount],
  );
  const activeIndex = items.find((item) => item.status === "active")?.index ?? null;

  const minimize = useCallback(() => {
    setConfirmStop(false);
    setVisible(false);
  }, [setVisible]);
  const close = useCallback(() => {
    setVisible(false);
    if (!running) clearSession();
  }, [setVisible, running, clearSession]);

  useFocusTrap(open, containerRef, running ? minimize : close);

  // Przewijamy do aktywnej pozycji tylko przy jej zmianie i gdy użytkownik sam nie przewija.
  useEffect(() => {
    if (!open || activeIndex == null) return;
    if (Date.now() - userScrolledAt.current < 4000) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-item="${activeIndex}"]`);
    node?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
  }, [open, activeIndex, reduceMotion]);

  if (!open || typeof document === "undefined") return null;

  const visibleItems = items.filter((item) => showSkipped || item.status !== "skipped" || item.skipKind === "error");
  const hiddenSkipped = items.length - visibleItems.length;
  const eta = formatEta(summary.etaSeconds);
  const title =
    jobStatus === "error"
      ? "Import zatrzymany błędem"
      : running
        ? source === "auto"
          ? "Automatyczny import"
          : "Import ofert"
        : "Import zakończony";

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="kei-sheet"
        className="kei-lux fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <button
          type="button"
          aria-label={running ? "Zminimalizuj okno importu" : "Zamknij okno importu"}
          className="absolute inset-0 bg-[color:var(--k-backdrop)] backdrop-blur-[6px]"
          onClick={running ? minimize : close}
        />
        <motion.div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="kei-sheet-title"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.38, ease: EASE }}
          className="relative flex max-h-[min(88dvh,820px)] w-full flex-col overflow-hidden rounded-t-[26px] border border-[color:var(--k-line)] bg-[color:var(--k-bg)] shadow-[var(--k-shadow)] sm:max-w-[680px] sm:rounded-[26px]"
        >
          <header className="shrink-0 border-b border-[color:var(--k-line)] px-6 pb-5 pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="k-kicker">EstateOS · KEI</p>
                <h2 id="kei-sheet-title" className="k-serif mt-1.5 text-[26px] leading-tight text-[color:var(--k-ink)]">
                  {title}
                </h2>
                <p className="mt-1.5 text-[13px] text-[color:var(--k-ink-2)]" aria-live="polite">
                  {items.length ? summary.headline : message}
                  {running && eta ? <span className="text-[color:var(--k-ink-3)]"> · zostało {eta}</span> : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {running ? (
                  <button type="button" className="k-btn k-btn--ghost" onClick={minimize}>
                    <ChevronDown size={16} /> Zwiń
                  </button>
                ) : (
                  <button type="button" className="k-btn k-btn--ghost h-9 w-9 p-0" onClick={close} aria-label="Zamknij">
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-5 flex items-center gap-4">
              <div className="flex-1">
                <ProgressBar percent={summary.percent} done={!running && jobStatus === "done"} />
              </div>
              <span className="w-12 text-right text-[15px] font-semibold tabular-nums text-[color:var(--k-ink)]">
                {summary.percent}%
              </span>
            </div>
            {stopping ? (
              <p className="mt-3 text-[12.5px] text-[color:var(--k-warn)]">
                Zatrzymuję — bieżąca oferta zostanie dokończona, kolejne już nie wystartują.
              </p>
            ) : null}
            {error && !running ? (
              <p className="mt-3 rounded-xl bg-[color:var(--k-danger-soft)] px-3.5 py-2.5 text-[12.5px] text-[color:var(--k-danger)]">
                {error}
              </p>
            ) : null}
          </header>

          <div
            ref={listRef}
            className="k-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5"
            onWheel={() => (userScrolledAt.current = Date.now())}
            onTouchMove={() => (userScrolledAt.current = Date.now())}
          >
            {!running && jobStatus === "done" ? <FinishedSummary items={items} onClose={close} /> : null}
            {items.length === 0 ? (
              <div className="space-y-3" aria-hidden>
                {[0, 1].map((n) => (
                  <div key={n} className="k-card h-[96px] animate-pulse opacity-60" />
                ))}
              </div>
            ) : (
              <ul className="space-y-3">
                {visibleItems.map((item) => (
                  <ItemCard key={`${item.index}-${item.portalUrl}`} item={item} highlight={item.index === activeIndex} />
                ))}
              </ul>
            )}
            {hiddenSkipped > 0 ? (
              <button
                type="button"
                className="k-btn k-btn--ghost w-full"
                onClick={() => setShowSkipped((value) => !value)}
              >
                {showSkipped ? "Ukryj pominięte" : `Pokaż pominięte (${hiddenSkipped}) — duplikaty i nieaktualne`}
              </button>
            ) : null}
          </div>

          {running ? (
            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[color:var(--k-line)] px-6 py-4">
              <p className="text-[12px] text-[color:var(--k-ink-3)]">
                Import działa na serwerze — możesz zamknąć to okno i wrócić później.
              </p>
              {confirmStop ? (
                <div className="flex items-center gap-2">
                  <button type="button" className="k-btn k-btn--ghost" onClick={() => setConfirmStop(false)}>
                    Wróć
                  </button>
                  <button
                    type="button"
                    className="k-btn k-btn--danger"
                    onClick={() => {
                      setConfirmStop(false);
                      cancelExport();
                    }}
                  >
                    Zatrzymaj import
                  </button>
                </div>
              ) : (
                <button type="button" className="k-btn" disabled={stopping} onClick={() => setConfirmStop(true)}>
                  Zatrzymaj
                </button>
              )}
            </footer>
          ) : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

/** Szklana kapsuła widoczna na każdej stronie Centrali, gdy import trwa w tle. */
export function KeiImportPill() {
  const running = useKeiAmerExportStore((s) => s.running);
  const open = useKeiAmerExportStore((s) => s.modalVisible);
  const items = useKeiAmerExportStore((s) => s.items);
  const source = useKeiAmerExportStore((s) => s.source);
  const targetCount = useKeiAmerExportStore((s) => s.targetCount);
  const stopping = useKeiAmerExportStore((s) => s.stopping);
  const setVisible = useKeiAmerExportStore((s) => s.setModalVisible);
  const summary = useMemo(() => summarizeKeiJob({ items, running, source, targetCount }), [items, running, source, targetCount]);
  const active = items.find((item) => item.status === "active");
  const eta = formatEta(summary.etaSeconds);

  return (
    <AnimatePresence>
      {running && !open ? (
        <motion.button
          key="kei-pill"
          type="button"
          onClick={() => setVisible(true)}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.36, ease: EASE }}
          className="kei-lux fixed bottom-5 right-5 z-[110] flex max-w-[calc(100vw-2.5rem)] items-center gap-3 rounded-full border border-[color:var(--k-line)] bg-[color:color-mix(in_srgb,var(--k-card)_82%,transparent)] py-2 pl-2 pr-5 text-left shadow-[var(--k-shadow)] backdrop-blur-xl transition-transform hover:-translate-y-0.5"
          aria-label="Pokaż postęp importu"
        >
          <span className="relative flex h-[34px] w-[34px] items-center justify-center">
            <ProgressRing percent={summary.percent} size={34} />
            <span className="absolute text-[10px] font-semibold tabular-nums text-[color:var(--k-ink)]">{summary.percent}</span>
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold text-[color:var(--k-ink)]">
              {stopping ? "Zatrzymuję import…" : source === "auto" ? "Automatyczny import" : "Import ofert"}
              <span className="font-normal text-[color:var(--k-ink-3)]"> · {summary.headline.split(" · ")[0]}</span>
            </span>
            <span className="block max-w-[260px] truncate text-[12px] text-[color:var(--k-ink-3)]">
              {active?.stepLabel || "Na serwerze"}
              {eta ? ` · ${eta}` : ""}
            </span>
          </span>
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}

/** Montowany raz w układzie Centrali: przywraca trwający import po odświeżeniu strony. */
export default function KeiImportProgressHost() {
  const hydrate = useKeiAmerExportStore((s) => s.hydrateFromServer);
  useEffect(() => {
    void hydrate();
    const onFocus = () => {
      if (!useKeiAmerExportStore.getState().running) void hydrate();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [hydrate]);
  return (
    <>
      <KeiImportPill />
      <KeiImportProgressSheet />
    </>
  );
}
