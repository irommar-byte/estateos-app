"use client";

import { Images } from "lucide-react";
import { mosaicCellClass, offerPhotoMosaicCells, OFFER_GALLERY_GRID_MAX } from "@/lib/offerPhotoMosaic";

type Props = {
  images: string[];
  onOpen: (index: number) => void;
  isArchived?: boolean;
  galleryLabel: string;
};

export default function OfferPhotoGallery({ images, onOpen, isArchived, galleryLabel }: Props) {
  if (images.length === 0) return null;

  const gridCount = Math.min(images.length, OFFER_GALLERY_GRID_MAX);
  const cells = offerPhotoMosaicCells(gridCount);
  const extraImages = images.slice(OFFER_GALLERY_GRID_MAX);

  return (
    <div className="space-y-2">
      <div
        className={`grid h-[min(48vh,420px)] grid-cols-4 grid-rows-2 gap-1 overflow-hidden rounded-[2rem] border border-white/5 bg-zinc-950 shadow-2xl backdrop-blur-3xl sm:h-[min(56vh,520px)] sm:gap-1.5 sm:rounded-[2.5rem] ${
          isArchived ? "grayscale opacity-50" : ""
        }`}
      >
        {images.slice(0, gridCount).map((src, idx) => (
          <button
            key={`${idx}-${src}`}
            type="button"
            onClick={() => onOpen(idx)}
            className={`${mosaicCellClass(cells[idx])} group relative overflow-hidden bg-zinc-900 text-left`}
          >
            <img
              src={src}
              alt=""
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              style={{ filter: "contrast(1.04) saturate(1.08) brightness(1.02)" }}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            {idx === 0 && images.length > 1 ? (
              <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white backdrop-blur-md">
                <Images size={12} className="opacity-80" />
                {galleryLabel.replace("{n}", String(images.length))}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {extraImages.length > 0 ? (
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin] sm:gap-2">
          {extraImages.map((src, i) => {
            const index = OFFER_GALLERY_GRID_MAX + i;
            return (
              <button
                key={`extra-${index}-${src}`}
                type="button"
                onClick={() => onOpen(index)}
                className="relative h-[4.5rem] w-[6.5rem] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 sm:h-24 sm:w-36 sm:rounded-2xl"
              >
                <img
                  src={src}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  style={{ filter: "contrast(1.04) saturate(1.06) brightness(1.02)" }}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
