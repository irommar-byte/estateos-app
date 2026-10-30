"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import OfferMiniPlan from '@/components/offers/OfferMiniPlan';
import type { FloorPlanScanMeta } from '@/types/roomScan';
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { OfferImageMetaPublic } from "@/lib/upload/offerImageMeta";
import { OfferAdaptiveImage } from "@/components/offer/OfferAdaptiveImage";

type Props = {
  images: string[];
  index: number;
  isOpen: boolean;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  imageMeta?: Record<string, OfferImageMetaPublic>;
  accentClass?: string;
  primaryHoverClass?: string;
  borderActiveClass?: string;
  glowActiveClass?: string;
  /** Pomieszczenie przypisane do zdjęcia (np. „Salon”) — z przyciskiem „Pokaż na planie”. */
  roomOf?: (url: string) => string | null;
  onShowRoom?: (room: string) => void;
  /** Skan mieszkania — minirzut w rogu z podświetlonym pokojem ze zdjęcia. */
  miniPlanMeta?: FloorPlanScanMeta | null;
  /** Statystyki: ile czasu oglądano każde zdjęcie. */
  onPhotoDwell?: (url: string, ms: number) => void;
  /** Zakładki pomieszczeń: „Wszystkie (20) · Salon (4) · Kuchnia (3)”. */
  tabs?: Array<{ label: string; count: number; active: boolean; onSelect: () => void }>;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SWIPE_CLOSE_PX = 110;
const SWIPE_NAV_PX = 70;

type PointerSample = { id: number; x: number; y: number };

function distance(a: PointerSample, b: PointerSample) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export default function OfferGalleryLightbox({
  images,
  index,
  isOpen,
  onClose,
  onIndexChange,
  imageMeta,
  roomOf,
  onShowRoom,
  miniPlanMeta,
  onPhotoDwell,
  tabs,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragY, setDragY] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef<Map<number, PointerSample>>(new Map());
  // Statystyki zainteresowania: ile czasu klient patrzy na każde zdjęcie.
  const dwellRef = useRef<{ url: string; at: number } | null>(null);
  useEffect(() => {
    const flush = () => {
      const prev = dwellRef.current;
      if (prev && onPhotoDwell) onPhotoDwell(prev.url, Date.now() - prev.at);
      dwellRef.current = null;
    };
    flush();
    if (isOpen && images[index]) dwellRef.current = { url: images[index], at: Date.now() };
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, isOpen]);
  useEffect(
    () => () => {
      const prev = dwellRef.current;
      if (prev && onPhotoDwell) onPhotoDwell(prev.url, Date.now() - prev.at);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const pinchStartRef = useRef<{ distance: number; scale: number } | null>(null);
  const panStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  const dragYRef = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  useEffect(() => {
    dragYRef.current = dragY;
  }, [dragY]);

  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setDragY(0);
    dragYRef.current = 0;
    pinchStartRef.current = null;
    panStartRef.current = null;
    swipeStartRef.current = null;
    pointersRef.current.clear();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    resetView();
  }, [index, isOpen, resetView]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndexChange(index >= images.length - 1 ? 0 : index + 1);
      if (e.key === "ArrowLeft") onIndexChange(index <= 0 ? images.length - 1 : index - 1);
      if (e.key === "0") resetView();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, index, images.length, onClose, onIndexChange, resetView]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const clampOffset = useCallback((x: number, y: number, nextScale: number) => {
    const el = viewportRef.current;
    if (!el || nextScale <= 1) return { x: 0, y: 0 };
    const maxX = ((nextScale - 1) * el.clientWidth) / 2 + 40;
    const maxY = ((nextScale - 1) * el.clientHeight) / 2 + 40;
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, []);

  const goPrev = useCallback(() => {
    resetView();
    onIndexChange(index <= 0 ? images.length - 1 : index - 1);
  }, [images.length, index, onIndexChange, resetView]);

  const goNext = useCallback(() => {
    resetView();
    onIndexChange(index >= images.length - 1 ? 0 : index + 1);
  }, [images.length, index, onIndexChange, resetView]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });
    setIsInteracting(true);

    const points = [...pointersRef.current.values()];
    if (points.length === 2) {
      pinchStartRef.current = {
        distance: distance(points[0], points[1]),
        scale: scaleRef.current,
      };
      panStartRef.current = null;
      swipeStartRef.current = null;
      return;
    }

    if (scaleRef.current > 1) {
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        ox: offsetRef.current.x,
        oy: offsetRef.current.y,
      };
      swipeStartRef.current = null;
      return;
    }

    swipeStartRef.current = { x: e.clientX, y: e.clientY };
    setDragY(0);
    dragYRef.current = 0;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });
    const points = [...pointersRef.current.values()];

    if (points.length >= 2 && pinchStartRef.current) {
      const d = distance(points[0], points[1]);
      const ratio = d / Math.max(1, pinchStartRef.current.distance);
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinchStartRef.current.scale * ratio));
      setScale(next);
      setOffset((o) => clampOffset(o.x, o.y, next));
      setDragY(0);
      dragYRef.current = 0;
      return;
    }

    if (scaleRef.current > 1 && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setOffset(
        clampOffset(panStartRef.current.ox + dx, panStartRef.current.oy + dy, scaleRef.current),
      );
      return;
    }

    if (scaleRef.current <= 1 && swipeStartRef.current && points.length === 1) {
      const dx = e.clientX - swipeStartRef.current.x;
      const dy = e.clientY - swipeStartRef.current.y;
      if (Math.abs(dy) > Math.abs(dx)) {
        const nextY = Math.max(0, dy);
        setDragY(nextY);
        dragYRef.current = nextY;
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const hadSwipe = Boolean(swipeStartRef.current);
    const start = swipeStartRef.current;
    pointersRef.current.delete(e.pointerId);

    if (pointersRef.current.size < 2) {
      pinchStartRef.current = null;
    }

    if (pointersRef.current.size === 1 && scaleRef.current > 1) {
      const remaining = [...pointersRef.current.values()][0];
      panStartRef.current = {
        x: remaining.x,
        y: remaining.y,
        ox: offsetRef.current.x,
        oy: offsetRef.current.y,
      };
      return;
    }

    if (pointersRef.current.size === 0) {
      if (hadSwipe && start && scaleRef.current <= 1) {
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (dy > SWIPE_CLOSE_PX && dy > Math.abs(dx)) {
          onClose();
          resetView();
          setIsInteracting(false);
          return;
        }
        if (images.length > 1 && Math.abs(dx) > SWIPE_NAV_PX && Math.abs(dx) > Math.abs(dy)) {
          if (dx < 0) goNext();
          else goPrev();
          setIsInteracting(false);
          return;
        }
      }
      setDragY(0);
      dragYRef.current = 0;
      swipeStartRef.current = null;
      panStartRef.current = null;
      pinchStartRef.current = null;
      setIsInteracting(false);
    }
  };

  if (!mounted || !isOpen) return null;

  const dismissProgress = Math.min(1, dragY / 220);
  const sheetOpacity = 1 - dismissProgress * 0.45;

  const node = (
    <AnimatePresence>
      <motion.div
        key="offer-gallery-lightbox"
        initial={{ opacity: 0 }}
        animate={{ opacity: sheetOpacity }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[2147483000] flex flex-col bg-black"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          transform: dragY > 0 ? `translateY(${dragY * 0.35}px)` : undefined,
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Galeria zdjęć"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[2147483001] flex size-12 items-center justify-center rounded-full border border-white/25 bg-black/70 text-white shadow-[0_8px_30px_rgba(0,0,0,0.55)] backdrop-blur-md transition hover:bg-red-500 sm:right-5 sm:top-[max(1rem,env(safe-area-inset-top))]"
          aria-label="Zamknij galerię"
        >
          <X size={22} strokeWidth={2.5} />
        </button>

        <div className="pointer-events-none absolute left-3 top-[max(0.9rem,env(safe-area-inset-top))] z-[2147483001] rounded-full border border-white/20 bg-black/65 px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white backdrop-blur-md sm:left-5">
          {index + 1} / {images.length}
          {scale > 1 ? <span className="ml-2 text-white/55">{Math.round(scale * 100)}%</span> : null}
        </div>

        {tabs?.length ? (
          <div className="eos-lightbox-tabs" onClick={(e) => e.stopPropagation()}>
            {tabs.map((tab) => (
              <button key={tab.label} type="button" onClick={tab.onSelect} className={`eos-lightbox-tabs__tab ${tab.active ? "is-active" : ""}`}>
                {tab.label}
                <span>{tab.count}</span>
              </button>
            ))}
          </div>
        ) : null}

        {(() => {
          const room = roomOf?.(images[index] || '') || null;
          if (!room || !miniPlanMeta) return null;
          return (
            <div className="absolute bottom-[max(6.5rem,calc(env(safe-area-inset-bottom)+6rem))] left-3 z-[2147483001] sm:left-5">
              <OfferMiniPlan key={room} meta={miniPlanMeta} room={room} onClick={onShowRoom ? () => onShowRoom(room) : undefined} />
            </div>
          );
        })()}

        {(() => {
          const room = roomOf?.(images[index] || '') || null;
          if (!room) return null;
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onShowRoom?.(room);
              }}
              className="eos-lightbox-room absolute left-1/2 top-[max(0.9rem,env(safe-area-inset-top))] z-[2147483001] inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-black/65 py-1.5 pl-3.5 pr-1.5 text-[12px] font-semibold text-white backdrop-blur-md transition hover:border-[#c9a96e]/80"
            >
              {room}
              {onShowRoom ? (
                <span className="rounded-full bg-white px-2.5 py-1 text-[10.5px] font-semibold text-[#15171a]">Pokaż na planie</span>
              ) : null}
            </button>
          );
        })()}

        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          {images.length > 1 ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                className="absolute left-2 z-20 hidden size-12 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur-xl transition hover:bg-white/15 sm:left-4 sm:flex"
                aria-label="Poprzednie zdjęcie"
              >
                <ChevronLeft size={26} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                className="absolute right-2 z-20 hidden size-12 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur-xl transition hover:bg-white/15 sm:right-4 sm:flex"
                aria-label="Następne zdjęcie"
              >
                <ChevronRight size={26} strokeWidth={2.5} />
              </button>
            </>
          ) : null}

          <div
            ref={viewportRef}
            className="flex h-full w-full touch-none items-center justify-center overflow-hidden"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={() => {
              if (scale > 1) resetView();
              else {
                setScale(2.2);
                setOffset({ x: 0, y: 0 });
              }
            }}
            onWheel={(e) => {
              e.preventDefault();
              const next = Math.max(
                MIN_SCALE,
                Math.min(MAX_SCALE, scaleRef.current + (e.deltaY < 0 ? 0.18 : -0.18)),
              );
              setScale(next);
              setOffset((o) => clampOffset(o.x, o.y, next));
            }}
          >
            <div
              className="flex max-h-[min(86vh,960px)] max-w-[min(100vw,1400px)] items-center justify-center will-change-transform"
              style={{
                transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
                transformOrigin: "center center",
                transition: isInteracting ? "none" : "transform 0.16s ease-out",
              }}
            >
              <motion.div
                key={`${index}-${images[index]}`}
                initial={{ opacity: 0.35 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.18 }}
                className="max-h-[min(86vh,960px)] w-auto max-w-[min(100vw,1400px)] select-none object-contain"
              >
                <OfferAdaptiveImage
                  sdrSrc={images[index]}
                  meta={imageMeta?.[images[index]] || null}
                  showHdrBadge
                  imgClassName="max-h-[min(86vh,960px)] w-auto max-w-[min(100vw,1400px)] object-contain"
                />
              </motion.div>
            </div>
          </div>
        </div>

        {images.length > 1 ? (
          <div className="shrink-0 border-t border-white/10 bg-black/80 px-3 py-3 backdrop-blur-md sm:px-5 sm:py-4">
            <div className="mx-auto flex max-w-4xl gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {images.map((img, idx) => (
                <button
                  key={`${idx}-${img}`}
                  type="button"
                  onClick={() => onIndexChange(idx)}
                  className={`h-14 w-[4.5rem] shrink-0 overflow-hidden rounded-xl border-2 transition sm:h-16 sm:w-20 ${
                    index === idx
                      ? "scale-105 border-emerald-400/80 brightness-110 shadow-[0_0_24px_rgba(16,185,129,0.35)]"
                      : "border-transparent opacity-45 hover:opacity-100"
                  }`}
                >
                  <OfferAdaptiveImage
                    sdrSrc={img}
                    meta={imageMeta?.[img] || null}
                    showHdrBadge
                    badgeCompact
                    className="h-full w-full"
                    imgClassName="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
            <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
              Przesuń palcem · ściągnij w dół, aby zamknąć · uszczypnij, aby zbliżyć
            </p>
          </div>
        ) : (
          <p className="shrink-0 pb-4 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
            Ściągnij w dół, aby zamknąć · uszczypnij, aby zbliżyć
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(node, document.body);
}
