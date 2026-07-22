"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Images } from "lucide-react";
import OfferGalleryLightbox from "@/components/offer/OfferGalleryLightbox";
import { carImageSrc } from "@/lib/carsPresentation";

type CarDetailGalleryProps = {
  title: string;
  imageUrl: string;
  imagesJson: string;
  overlay?: ReactNode;
  caption?: ReactNode;
};

function parseImages(imagesJson: string, imageUrl: string): string[] {
  const list: string[] = [];
  try {
    const parsed = JSON.parse(imagesJson || "[]");
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const url = carImageSrc(String(item || "").trim());
        if (url && !list.includes(url)) list.push(url);
      }
    }
  } catch {
    // ignore
  }
  const cover = carImageSrc(imageUrl);
  if (cover && !list.includes(cover)) list.unshift(cover);
  if (!list.length && cover) list.push(cover);
  return list;
}

export default function CarDetailGallery({
  title,
  imageUrl,
  imagesJson,
  overlay,
  caption,
}: CarDetailGalleryProps) {
  const images = useMemo(() => parseImages(imagesJson, imageUrl), [imagesJson, imageUrl]);
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const safeIndex = images.length ? Math.min(index, images.length - 1) : 0;
  const current = images[safeIndex] || carImageSrc(imageUrl);

  const go = useCallback(
    (delta: number) => {
      if (images.length <= 1) return;
      setIndex((prev) => (prev + delta + images.length) % images.length);
    },
    [images.length],
  );

  const openAt = (i: number) => {
    setIndex(i);
    setLightboxOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-3xl border border-[var(--eos-border)] bg-zinc-950">
        <button
          type="button"
          onClick={() => openAt(safeIndex)}
          className="group relative block aspect-[16/9] w-full text-left sm:aspect-[16/8]"
          aria-label="Otwórz galerię"
        >
          <Image
            src={current}
            alt={title}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.02]"
            priority
            unoptimized
            sizes="(max-width: 1024px) 100vw, 1100px"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          {images.length > 1 ? (
            <span className="pointer-events-none absolute bottom-4 right-4 z-[2] inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white backdrop-blur-md">
              <Images className="size-3.5 opacity-90" aria-hidden />
              {safeIndex + 1} / {images.length}
            </span>
          ) : null}
          {caption}
        </button>

        {overlay ? <div className="absolute right-4 top-4 z-[3] sm:right-6 sm:top-6">{overlay}</div> : null}

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              className="absolute left-3 top-1/2 z-[3] flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-md transition hover:bg-black/65"
              aria-label="Poprzednie zdjęcie"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              className="absolute right-3 top-1/2 z-[3] flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-md transition hover:bg-black/65"
              aria-label="Następne zdjęcie"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {images.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => openAt(i)}
              className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border transition sm:h-20 sm:w-28 sm:rounded-2xl ${
                i === safeIndex
                  ? "border-sky-400 ring-2 ring-sky-400/35"
                  : "border-[var(--eos-border)] opacity-80 hover:opacity-100"
              }`}
              aria-label={`Zdjęcie ${i + 1}`}
            >
              <Image src={src} alt="" fill className="object-cover" unoptimized sizes="112px" />
            </button>
          ))}
        </div>
      ) : null}

      <OfferGalleryLightbox
        images={images}
        index={safeIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setIndex}
      />
    </div>
  );
}
