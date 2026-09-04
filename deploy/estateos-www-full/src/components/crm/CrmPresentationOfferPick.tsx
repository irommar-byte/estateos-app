"use client";

import { useMemo, useState } from "react";

export type PresentationPickOffer = {
  id: number;
  title: string;
  city?: string | null;
  street?: string | null;
  price?: number | null;
  area?: number | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  score?: number;
  notifiedAt?: string | null;
};

function money(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  return `${Math.round(value).toLocaleString("pl-PL")} zł`;
}

function OfferCard({
  offer,
  selected,
  expanded,
  onSelect,
  onToggle,
  meta,
}: {
  offer: PresentationPickOffer;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggle: () => void;
  meta?: string;
}) {
  const photos = (offer.imageUrls?.length ? offer.imageUrls : offer.imageUrl ? [offer.imageUrl] : []).filter(Boolean);
  return (
    <div
      className={`overflow-hidden rounded-2xl border ${
        selected ? "border-emerald-500/60 bg-emerald-500/10" : "border-[var(--eos-border)] bg-[var(--eos-input)]"
      }`}
    >
      <button type="button" onClick={onSelect} className="flex w-full items-stretch gap-3 p-2 text-left">
        {photos[0] ? (
          <img src={photos[0]} alt="" className="h-[4.5rem] w-[5.5rem] shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="flex h-[4.5rem] w-[5.5rem] shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-[11px] font-black text-emerald-700">
            #{offer.id}
          </div>
        )}
        <div className="min-w-0 flex-1 py-1">
          <p className="line-clamp-2 text-[12px] font-black leading-snug text-[var(--eos-text)]">
            #{offer.id} · {offer.title}
          </p>
          <p className="mt-1 text-[10px] text-[var(--eos-muted)]">
            {[meta, offer.city, money(offer.price)].filter(Boolean).join(" · ")}
          </p>
        </div>
      </button>
      <button
        type="button"
        onClick={onToggle}
        className="w-full border-t border-[var(--eos-border)]/70 px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-emerald-700"
      >
        {expanded ? "Zwiń podgląd" : "Rozwiń zdjęcia i szczegóły"}
      </button>
      {expanded ? (
        <div className="space-y-2 px-3 pb-3">
          {photos.length > 1 ? (
            <div className="grid grid-cols-3 gap-1.5">
              {photos.slice(1, 4).map((url) => (
                <img key={url} src={url} alt="" className="h-16 w-full rounded-lg object-cover" />
              ))}
            </div>
          ) : null}
          <p className="text-[11px] leading-relaxed text-[var(--eos-muted)]">
            {[offer.street, offer.city, offer.area ? `${offer.area} m²` : null, money(offer.price)]
              .filter(Boolean)
              .join(" · ") || "Oferta z portfela agenta."}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default function CrmPresentationOfferPick({
  managedOffers,
  matches,
  selectedId,
  onSelect,
}: {
  managedOffers: PresentationPickOffer[];
  matches: Array<{
    id: number;
    score: number;
    notifiedAt: string | null;
    offer: PresentationPickOffer & { id: number; title: string };
  }>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const selected = Number(selectedId);
  const matchCards = useMemo(
    () =>
      [...matches]
        .sort((a, b) => Number(Boolean(b.notifiedAt)) - Number(Boolean(a.notifiedAt)) || b.score - a.score)
        .slice(0, 8),
    [matches],
  );

  return (
    <div className="space-y-4">
      {managedOffers.length ? (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">
            Nieruchomości agenta
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {managedOffers.slice(0, 8).map((offer) => (
              <OfferCard
                key={`m-${offer.id}`}
                offer={offer}
                selected={selected === offer.id}
                expanded={expandedId === offer.id}
                onSelect={() => onSelect(String(offer.id))}
                onToggle={() => setExpandedId((current) => (current === offer.id ? null : offer.id))}
                meta={offer.city || "W portfelu"}
              />
            ))}
          </div>
        </div>
      ) : null}
      {matchCards.length ? (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">
            Dopasowania klienta
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {matchCards.map((row) => (
              <OfferCard
                key={`match-${row.id}`}
                offer={row.offer}
                selected={selected === row.offer.id}
                expanded={expandedId === row.offer.id}
                onSelect={() => onSelect(String(row.offer.id))}
                onToggle={() => setExpandedId((current) => (current === row.offer.id ? null : row.offer.id))}
                meta={`${row.notifiedAt ? "Wysłana" : "Match"} · ${row.score}%`}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
