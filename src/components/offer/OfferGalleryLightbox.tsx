"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Image as ImageIcon, Minus, Plus, RotateCw, X } from "lucide-react";

type Props = {
  images: string[];
  index: number;
  isOpen: boolean;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  accentClass?: string;
  primaryHoverClass?: string;
  borderActiveClass?: string;
  glowActiveClass?: string;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;

export default function OfferGalleryLightbox({
  images,
  index,
  isOpen,
  onClose,
  onIndexChange,
  accentClass = "text-emerald-500",
  primaryHoverClass = "hover:bg-emerald-500",
  borderActiveClass = "border-emerald-500/30",
  glowActiveClass = "shadow-[0_0_40px_rgba(16,185,129,0.3)]",
}: Props) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const resetView = useCallback(() => {
    setScale(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
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
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(MAX_SCALE, s + 0.25));
      if (e.key === "-") setScale((s) => Math.max(MIN_SCALE, s - 0.25));
      if (e.key === "0") resetView();
      if (e.key === "r" || e.key === "R") setRotation((r) => (r + 90) % 360);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, index, images.length, onClose, onIndexChange, resetView]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const clampOffset = useCallback((x: number, y: number, nextScale: number) => {
    const el = viewportRef.current;
    if (!el || nextScale <= 1) return { x: 0, y: 0 };
    const maxX = ((nextScale - 1) * el.clientWidth) / 2;
    const maxY = ((nextScale - 1) * el.clientHeight) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, []);

  const zoomBy = (delta: number) => {
    setScale((prev) => {
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev + delta));
      if (next <= 1) {
        setOffset({ x: 0, y: 0 });
      } else {
        setOffset((o) => clampOffset(o.x, o.y, next));
      }
      return next;
    });
  };

  const rotateBy = () => {
    setRotation((r) => (r + 90) % 360);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="eos-media-chrome fixed inset-0 z-[999999] flex flex-col bg-black/97 backdrop-blur-2xl"
        onClick={onClose}
      >
        <div className="eos-on-media flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-b from-black/90 to-transparent px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-4 py-2 backdrop-blur-md">
            <ImageIcon size={16} className={accentClass} />
            <span className="text-[10px] font-black uppercase tracking-widest text-white">
              {index + 1} / {images.length}
            </span>
            {scale > 1 ? (
              <span className="text-[10px] font-bold text-white/50">{Math.round(scale * 100)}%</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => zoomBy(-0.35)}
              className="rounded-full border border-white/10 bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
              aria-label="Oddal"
            >
              <Minus size={18} />
            </button>
            <button
              type="button"
              onClick={() => zoomBy(0.35)}
              className="rounded-full border border-white/10 bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
              aria-label="Przybliż"
            >
              <Plus size={18} />
            </button>
            <button
              type="button"
              onClick={rotateBy}
              className="rounded-full border border-white/10 bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
              aria-label="Obróć o 90°"
            >
              <RotateCw size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white/10 p-3 text-white transition-all hover:bg-red-500"
              aria-label="Zamknij"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          {images.length > 1 ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onIndexChange(index <= 0 ? images.length - 1 : index - 1);
                }}
                className={`absolute left-3 z-50 rounded-full border border-white/10 bg-black/55 p-4 text-white backdrop-blur-xl transition-all hover:scale-110 sm:left-6 ${primaryHoverClass}`}
              >
                <ChevronLeft size={24} strokeWidth={3} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onIndexChange(index >= images.length - 1 ? 0 : index + 1);
                }}
                className={`absolute right-3 z-50 rounded-full border border-white/10 bg-black/55 p-4 text-white backdrop-blur-xl transition-all hover:scale-110 sm:right-6 ${primaryHoverClass}`}
              >
                <ChevronRight size={24} strokeWidth={3} />
              </button>
            </>
          ) : null}

          <div
            ref={viewportRef}
            className="flex h-full w-full touch-none items-center justify-center overflow-hidden px-3 py-4 sm:px-8 sm:py-6"
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => {
              e.preventDefault();
              zoomBy(e.deltaY < 0 ? 0.15 : -0.15);
            }}
            onPointerDown={(e) => {
              if (scale <= 1) return;
              dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
              setIsDragging(true);
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!dragRef.current || scale <= 1) return;
              const dx = e.clientX - dragRef.current.x;
              const dy = e.clientY - dragRef.current.y;
              setOffset(clampOffset(dragRef.current.ox + dx, dragRef.current.oy + dy, scale));
            }}
            onPointerUp={() => {
              dragRef.current = null;
              setIsDragging(false);
            }}
            onPointerCancel={() => {
              dragRef.current = null;
              setIsDragging(false);
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={`${index}-${images[index]}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-center"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale}) rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                  transition: isDragging ? "none" : "transform 0.18s ease-out",
                }}
                onDoubleClick={() => {
                  if (scale > 1 || rotation !== 0) resetView();
                  else setScale(2);
                }}
              >
                <img
                  src={images[index]}
                  alt=""
                  draggable={false}
                  className="max-h-[min(82vh,920px)] w-auto max-w-[min(96vw,1280px)] select-none rounded-xl object-contain shadow-[0_0_80px_rgba(0,0,0,0.85)]"
                  style={{
                    filter: "contrast(1.06) saturate(1.12) brightness(1.04)",
                  }}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {images.length > 1 ? (
          <div className="shrink-0 border-t border-white/10 bg-black/50 px-4 py-4 backdrop-blur-md" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto flex max-w-4xl gap-2 overflow-x-auto custom-scrollbar">
              {images.map((img, idx) => (
                <button
                  key={`${idx}-${img}`}
                  type="button"
                  onClick={() => onIndexChange(idx)}
                  className={`h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-zinc-900 transition-all sm:h-20 sm:w-24 ${
                    index === idx
                      ? `${borderActiveClass} scale-105 brightness-110 ${glowActiveClass}`
                      : "border-transparent opacity-45 hover:opacity-100"
                  }`}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}
