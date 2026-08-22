"use client";

import { useState } from "react";
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

export function OfferPhotoCascade({
  offer,
  thumbClassName = "h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-[var(--eos-input)] sm:h-20 sm:w-28",
}: {
  offer: ExpandableOfferPreviewData;
  thumbClassName?: string;
}) {
  const images = collectImages(offer);
  const [open, setOpen] = useState(false);

  if (!images.length) {
    return <div className={thumbClassName} aria-hidden />;
  }

  if (open) {
    return (
      <div className="w-full basis-full space-y-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-600"
        >
          Zwiń zdjęcia
        </button>
        {images.map((src) => (
          <button
            key={src}
            type="button"
            onClick={() => setOpen(false)}
            className="block w-full overflow-hidden rounded-xl bg-[var(--eos-input)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-[50vh] w-full object-cover" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={`${thumbClassName} bg-cover bg-center`}
      style={{ backgroundImage: `url(${images[0]})` }}
      aria-label={`Pokaż zdjęcia: ${offer.title}`}
    />
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
