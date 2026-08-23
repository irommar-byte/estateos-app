"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { plainOfferDescription } from "@/lib/offerDescriptionHtml";

export type ExpandableOfferPreviewData = {
  title: string;
  excerpt?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
};

function collectImages(offer: ExpandableOfferPreviewData): string[] {
  const raw = Array.isArray(offer.imageUrls) && offer.imageUrls.length
    ? offer.imageUrls
    : offer.imageUrl
    ? [offer.imageUrl]
    : [];
  const out: string[] = [];
  for (const item of raw) {
    const url = String(item || "").trim();
    if (url && !out.includes(url)) out.push(url);
  }
  return out;
}

const EASE = [0.16, 1, 0.3, 1] as const;
const FOLD_EASE = [0.45, 0, 1, 1] as const;

type Origin = { x: number; y: number; w: number; h: number };
type Delta = { x: number; y: number; scale: number; rotate: number };

function fallbackDelta(index: number): Delta {
  return {
    x: -28 + (index % 3) * 6,
    y: -36 - index * 3,
    scale: 0.2,
    rotate: index % 2 === 0 ? -9 : 8,
  };
}

export function OfferPhotoCascade({
  offer,
  thumbClassName = "h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-[var(--eos-input)] sm:h-20 sm:w-28",
  onOpen,
}: {
  offer: ExpandableOfferPreviewData;
  thumbClassName?: string;
  onOpen?: () => void;
}) {
  const images = collectImages(offer);
  const [open, setOpen] = useState(false);
  const [enlarged, setEnlarged] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const thumbRef = useRef<HTMLButtonElement>(null);
  const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const originRef = useRef<Origin | null>(null);
  const deltasRef = useRef<Delta[]>([]);

  const measureOrigin = () => {
    const thumb = thumbRef.current?.getBoundingClientRect();
    originRef.current = thumb
      ? { x: thumb.left, y: thumb.top, w: thumb.width, h: thumb.height }
      : null;
  };

  const openCascade = () => {
    measureOrigin();
    setEnlarged(null);
    setReady(false);
    setOpen(true);
    onOpen?.();
  };

  const close = () => {
    setEnlarged(null);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (enlarged) setEnlarged(null);
      else close();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, enlarged]);

  useLayoutEffect(() => {
    if (!open || enlarged || ready) return;
    const origin = originRef.current;
    deltasRef.current = images.map((_, index) => {
      const tile = tileRefs.current[index]?.getBoundingClientRect();
      if (!origin || !tile?.width || !tile?.height) return fallbackDelta(index);
      const ox = origin.x + origin.w / 2;
      const oy = origin.y + origin.h / 2;
      return {
        x: ox - (tile.left + tile.width / 2),
        y: oy - (tile.top + tile.height / 2),
        scale: Math.min(0.34, origin.w / tile.width, origin.h / tile.height),
        rotate: index % 2 === 0 ? -8 : 7,
      };
    });
    setReady(true);
  }, [open, enlarged, images, ready]);

  if (!images.length) {
    return <div className={thumbClassName} aria-hidden />;
  }

  const overlay =
    typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {open ? (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Zdjęcia oferty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.32 }}
                className="fixed inset-0 z-[90] bg-black/72"
                onClick={() => {
                  if (enlarged) setEnlarged(null);
                  else close();
                }}
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    close();
                  }}
                  className="absolute right-4 top-[max(0.85rem,env(safe-area-inset-top))] z-[95] inline-flex size-11 items-center justify-center rounded-full border border-white/25 bg-black/70 text-white shadow-lg"
                  aria-label="Zamknij zdjęcia"
                >
                  <X className="size-5" />
                </button>
                {enlarged ? (
                  <span className="flex h-full items-center justify-center p-4 pt-16">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={enlarged}
                      alt=""
                      className="max-h-[78vh] max-w-[min(96vw,1100px)] cursor-zoom-out rounded-2xl object-contain"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEnlarged(null);
                      }}
                    />
                  </span>
                ) : (
                  <span
                    className="block px-2.5 pt-[max(3.5rem,calc(env(safe-area-inset-top)+2.75rem))]"
                    style={{ height: "50vh" }}
                  >
                    <span className="grid h-full grid-cols-3 gap-2" style={{ gridAutoRows: "calc((50vh - 1.25rem) / 2)" }}>
                      {images.map((src, index) => {
                        const delta = deltasRef.current[index] || fallbackDelta(index);
                        return (
                          <motion.button
                            key={`${ready ? "fly" : "measure"}-${src}-${index}`}
                            type="button"
                            ref={(node) => {
                              tileRefs.current[index] = node;
                            }}
                            initial={ready ? { opacity: 0.92, x: delta.x, y: delta.y, scale: delta.scale, rotate: delta.rotate } : { opacity: 0, x: 0, y: 0, scale: 1, rotate: 0 }}
                            animate={{ opacity: ready ? 1 : 0, x: 0, y: 0, scale: 1, rotate: 0 }}
                            exit={{
                              opacity: 0,
                              x: delta.x,
                              y: delta.y,
                              scale: delta.scale,
                              rotate: delta.rotate,
                              transition: {
                                duration: 0.52,
                                delay: (images.length - 1 - index) * 0.12,
                                ease: FOLD_EASE,
                              },
                            }}
                            transition={{
                              duration: ready ? 0.78 : 0,
                              delay: ready ? index * 0.18 : 0,
                              ease: EASE,
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (ready) setEnlarged(src);
                            }}
                            className="overflow-hidden rounded-xl bg-black/35"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt="" className="h-full w-full object-contain" />
                          </motion.button>
                        );
                      })}
                    </span>
                  </span>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={thumbRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          openCascade();
        }}
        className={`${thumbClassName} bg-[var(--eos-input)]`}
        aria-label={`Pokaż zdjęcia: ${offer.title}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[0]} alt="" className="h-full w-full object-contain" />
      </button>
      {overlay}
    </>
  );
}

export function OfferDescriptionToggle({
  offer,
  className = "mt-1 text-[11px] leading-snug text-[var(--eos-muted)]",
  hint = false,
}: {
  offer: ExpandableOfferPreviewData;
  className?: string;
  hint?: boolean;
}) {
  const text = plainOfferDescription(offer.description || offer.excerpt);
  const [open, setOpen] = useState(false);
  if (!text) return null;

  return (
    <button type="button" onClick={() => setOpen((value) => !value)} className="block w-full text-left">
      <p className={`${className} ${open ? "whitespace-pre-wrap" : "line-clamp-2"}`}>{text}</p>
      {hint ? (
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--eos-subtle)]">
          {open ? "Zwiń opis" : "Kliknij początek opisu, żeby otworzyć całość do szybkiego przeglądu"}
        </p>
      ) : null}
    </button>
  );
}
