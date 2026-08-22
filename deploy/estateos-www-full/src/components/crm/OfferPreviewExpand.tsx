"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
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
}: {
  offer: ExpandableOfferPreviewData;
  thumbClassName?: string;
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
  };

  const close = () => {
    setEnlarged(null);
    setOpen(false);
  };

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
              <motion.button
                type="button"
                aria-label="Zamknij zdjęcia"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.42 }}
                className="fixed inset-0 z-[90] bg-black/62 text-left"
                onClick={() => {
                  if (enlarged) setEnlarged(null);
                  else close();
                }}
              >
                {enlarged ? (
                  <span className="flex h-full items-center justify-center p-4" onClick={(event) => event.stopPropagation()}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={enlarged}
                      alt=""
                      className="max-h-[78vh] max-w-[min(96vw,1100px)] rounded-2xl object-contain"
                    />
                  </span>
                ) : (
                  <span
                    className="block px-2.5 pt-[max(0.75rem,env(safe-area-inset-top))]"
                    style={{ height: "50vh" }}
                    onClick={(event) => event.stopPropagation()}
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
                            onClick={() => (ready ? setEnlarged(src) : undefined)}
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
              </motion.button>
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
        onClick={openCascade}
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
}: {
  offer: ExpandableOfferPreviewData;
  className?: string;
}) {
  const text = plainOfferDescription(offer.description || offer.excerpt);
  const [open, setOpen] = useState(false);
  if (!text) return null;

  return (
    <button type="button" onClick={() => setOpen((value) => !value)} className="block w-full text-left">
      <p className={`${className} ${open ? "whitespace-pre-wrap" : "line-clamp-2"}`}>{text}</p>
    </button>
  );
}
