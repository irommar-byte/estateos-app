"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Clock3, Search, UserRound, X } from "lucide-react";
import EosSpotlightLens from "@/components/search/EosSpotlightLens";
import type { SpotlightResult, SpotlightSection } from "@/lib/spotlightSearch";
import { pushSpotlightRecent, readSpotlightRecent, type SpotlightRecentItem } from "@/lib/spotlightSearchHistory";

type Props = {
  floating?: boolean;
};

function kindIcon(kind: SpotlightResult["kind"]) {
  if (kind === "offer") return Building2;
  if (kind === "agency") return Building2;
  return UserRound;
}

function kindLabel(kind: SpotlightResult["kind"]) {
  if (kind === "offer") return "Oferta";
  if (kind === "agency") return "Biuro";
  return "Agent";
}

function fold(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function highlightTitle(title: string, query: string) {
  const tokens = query
    .trim()
    .split(/[\s,;|/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!tokens.length) return title;
  const foldedTitle = fold(title);
  let matchToken = "";
  let matchIndex = -1;
  for (const token of tokens) {
    const idx = foldedTitle.indexOf(fold(token));
    if (idx >= 0) {
      matchToken = token;
      matchIndex = idx;
      break;
    }
  }
  if (matchIndex < 0 || !matchToken) return title;
  const before = title.slice(0, matchIndex);
  const hit = title.slice(matchIndex, matchIndex + matchToken.length);
  const after = title.slice(matchIndex + matchToken.length);
  return (
    <>
      {before}
      <mark className="rounded bg-emerald-500/18 px-0.5 text-[var(--eos-text)]">{hit}</mark>
      {after}
    </>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-0 divide-y divide-[var(--eos-border)]">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex animate-pulse items-center gap-3 px-4 py-3.5">
          <div className="size-12 rounded-2xl bg-[var(--eos-input)]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-[72%] rounded bg-[var(--eos-input)]" />
            <div className="h-2.5 w-[54%] rounded bg-[var(--eos-input)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ResultButton({
  item,
  active,
  query,
  onOpen,
  onHover,
}: {
  item: SpotlightResult;
  active: boolean;
  query: string;
  onOpen: () => void;
  onHover: () => void;
}) {
  const Icon = kindIcon(item.kind);
  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onClick={onOpen}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
        active ? "bg-[var(--eos-accent-soft)]" : "hover:bg-[var(--eos-input)]"
      }`}
    >
      <span className="relative flex size-12 shrink-0 overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)]">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[var(--eos-muted)]">
            <Icon className="size-5" />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="mb-0.5 block truncate text-sm font-semibold text-[var(--eos-text)]">
          {highlightTitle(item.title, query)}
        </span>
        <span className="block truncate text-[11px] text-[var(--eos-muted)]">{item.subtitle}</span>
        {item.detail ? (
          <span className="mt-1 block line-clamp-2 text-[10px] leading-relaxed text-[var(--eos-subtle)]">{item.detail}</span>
        ) : null}
      </span>
      <span className="shrink-0 rounded-full border border-[var(--eos-border)] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-[var(--eos-subtle)]">
        {kindLabel(item.kind)}
      </span>
    </button>
  );
}

export default function EosSpotlightSearch({ floating = false }: Props) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotlightResult[]>([]);
  const [sections, setSections] = useState<SpotlightSection[]>([]);
  const [recent, setRecent] = useState<SpotlightRecentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [tookMs, setTookMs] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);
  const requestRef = useRef(0);

  const flatResults = useMemo(() => results, [results]);

  const fetchResults = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setResults([]);
      setSections([]);
      setLoading(false);
      setTookMs(0);
      return;
    }

    const requestId = ++requestRef.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/spotlight/search?q=${encodeURIComponent(trimmed)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (requestId !== requestRef.current) return;
      setResults(Array.isArray(data?.results) ? data.results : []);
      setSections(Array.isArray(data?.sections) ? data.sections : []);
      setTookMs(Number(data?.tookMs || 0));
      setActiveIndex(0);
    } catch {
      if (requestId === requestRef.current) {
        setResults([]);
        setSections([]);
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    setRecent(readSpotlightRecent());
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSections([]);
      setActiveIndex(0);
      setTookMs(0);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void fetchResults(query);
    }, 110);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [open, query, fetchResults]);

  const openResult = (href: string, searchQuery: string) => {
    if (searchQuery.trim()) setRecent(pushSpotlightRecent(searchQuery.trim()));
    window.open(href, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(0, flatResults.length - 1)));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    }
    if (event.key === "Enter" && flatResults[activeIndex]) {
      event.preventDefault();
      openResult(flatResults[activeIndex].href, query);
    }
  };

  const panel =
    open && mounted
      ? createPortal(
          <AnimatePresence>
            <motion.div
              key="spotlight-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100060] bg-[rgba(8,10,16,0.52)] backdrop-blur-xl"
              onClick={() => setOpen(false)}
            />
            <motion.div
              key="spotlight-panel"
              initial={{ opacity: 0, y: -16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+5.5rem)] z-[100070] w-[min(620px,calc(100vw-1.25rem))] -translate-x-1/2 overflow-hidden rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-3 border-b border-[var(--eos-border)] bg-[var(--eos-surface)] px-4 py-3.5">
                <EosSpotlightLens active={loading || open} size="md" />
                <label htmlFor={inputId} className="sr-only">
                  Szukaj ofert, agentów i biur
                </label>
                <input
                  ref={inputRef}
                  id={inputId}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={onInputKeyDown}
                  placeholder="ID oferty, miasto, dzielnica, agent, słowo z opisu…"
                  className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[var(--eos-text)] outline-none placeholder:text-[var(--eos-subtle)]"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1.5 text-[var(--eos-muted)] transition-colors hover:bg-[var(--eos-input)] hover:text-[var(--eos-text)]"
                  aria-label="Zamknij wyszukiwanie"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="max-h-[min(460px,calc(100svh-12rem))] overflow-y-auto overscroll-contain bg-[var(--eos-card)]">
                {loading ? (
                  <SkeletonRows />
                ) : !query.trim() && recent.length ? (
                  <div className="py-2">
                    <p className="px-4 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-subtle)]">
                      Ostatnie
                    </p>
                    <ul>
                      {recent.map((item) => (
                        <li key={`${item.query}-${item.at}`}>
                          <button
                            type="button"
                            onClick={() => setQuery(item.query)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--eos-input)]"
                          >
                            <Clock3 className="size-4 text-[var(--eos-muted)]" />
                            <span className="truncate text-sm font-medium text-[var(--eos-text)]">{item.query}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : flatResults.length === 0 ? (
                  <p className="px-5 py-8 text-center text-xs font-medium leading-relaxed text-[var(--eos-muted)]">
                    {query.trim()
                      ? "Brak trafień. Spróbuj numer oferty, dzielnicę, nazwisko agenta albo słowo z opisu (np. piekarnia, balkon)."
                      : "Wpisz numer oferty, miasto, dzielnicę lub frazę z opisu."}
                  </p>
                ) : sections.length ? (
                  <div className="divide-y divide-[var(--eos-border)]">
                    {sections.map((section) => (
                      <div key={section.kind} className="py-1">
                        <p className="px-4 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-subtle)]">
                          {section.label}
                        </p>
                        <ul>
                          {section.items.map((item) => {
                            const index = flatResults.findIndex((row) => row.id === item.id);
                            return (
                              <li key={item.id}>
                                <ResultButton
                                  item={item}
                                  query={query}
                                  active={index === activeIndex}
                                  onHover={() => setActiveIndex(Math.max(index, 0))}
                                  onOpen={() => openResult(item.href, query)}
                                />
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ul className="divide-y divide-[var(--eos-border)]">
                    {flatResults.map((item, index) => (
                      <li key={item.id}>
                        <ResultButton
                          item={item}
                          query={query}
                          active={index === activeIndex}
                          onHover={() => setActiveIndex(index)}
                          onOpen={() => openResult(item.href, query)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-[var(--eos-border)] bg-[var(--eos-surface)] px-4 py-2.5 text-[10px] font-medium text-[var(--eos-subtle)]">
                <span>Enter — otwórz · ↑↓ — wybór · Esc — zamknij</span>
                <span>{tookMs > 0 ? `${tookMs} ms` : "⌘K"}</span>
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        aria-label="Szukaj ofert, agentów i biur"
        className={`group relative overflow-visible rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-1 transition-all hover:border-sky-400/40 hover:shadow-[0_10px_28px_rgba(59,130,246,0.16)] ${
          floating
            ? "fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-[calc(1rem+env(safe-area-inset-left))] z-[45] shadow-[var(--eos-shadow-soft)] backdrop-blur-xl lg:hidden"
            : ""
        }`}
      >
        <EosSpotlightLens active={open || loading} hovered={hovered} />
        <span className="pointer-events-none absolute -bottom-1 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-black/75 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-white opacity-0 transition-opacity group-hover:opacity-100 sm:block">
          Szukaj · ⌘K
        </span>
      </button>
      {panel}
    </>
  );
}
