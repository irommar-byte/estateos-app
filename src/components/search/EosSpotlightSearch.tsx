"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Search, UserRound, X } from "lucide-react";
import EosSpotlightLens from "@/components/search/EosSpotlightLens";
import type { SpotlightResult } from "@/lib/spotlightSearch";

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

export default function EosSpotlightSearch({ floating = false }: Props) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotlightResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);
  const requestRef = useRef(0);

  const fetchResults = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
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
      setActiveIndex(0);
    } catch {
      if (requestId === requestRef.current) setResults([]);
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
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void fetchResults(query);
    }, 180);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [open, query, fetchResults]);

  const openResult = (href: string) => {
    window.open(href, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(0, results.length - 1)));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    }
    if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      openResult(results[activeIndex].href);
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
              className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+5.5rem)] z-[100070] w-[min(560px,calc(100vw-1.25rem))] -translate-x-1/2 overflow-hidden rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
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
                  placeholder="ID, miasto, dzielnica, agent, biuro, słowo z opisu…"
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

              <div className="max-h-[min(420px,calc(100svh-12rem))] overflow-y-auto overscroll-contain bg-[var(--eos-card)]">
                {loading ? (
                  <p className="px-5 py-8 text-center text-xs font-medium text-[var(--eos-muted)]">Szukam…</p>
                ) : results.length === 0 ? (
                  <p className="px-5 py-8 text-center text-xs font-medium text-[var(--eos-muted)]">
                    {query.trim() ? "Brak trafień. Spróbuj ID oferty, nazwiska lub nazwy biura." : "Wpisz numer oferty albo frazę."}
                  </p>
                ) : (
                  <ul className="divide-y divide-[var(--eos-border)]">
                    {results.map((item, index) => {
                      const Icon = kindIcon(item.kind);
                      const active = index === activeIndex;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => openResult(item.href)}
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
                                {item.title}
                              </span>
                              <span className="block truncate text-[11px] text-[var(--eos-muted)]">{item.subtitle}</span>
                            </span>
                            <span className="shrink-0 rounded-full border border-[var(--eos-border)] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-[var(--eos-subtle)]">
                              {kindLabel(item.kind)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="border-t border-[var(--eos-border)] bg-[var(--eos-surface)] px-4 py-2.5 text-[10px] font-medium text-[var(--eos-subtle)]">
                Enter — otwórz w nowej karcie · ⌘K — szybkie wyszukiwanie
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
          Szukaj
        </span>
      </button>
      {panel}
    </>
  );
}
