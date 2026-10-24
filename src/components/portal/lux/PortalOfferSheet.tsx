"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarCheck2, Columns2, Heart, Maximize2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { formatPln } from "./portalApi";
import { SENTIMENT_LABEL, matchSentiment, offerPpsm, type LuxMatch } from "./types";

type Rate = "like" | "maybe" | "dislike";

/** Ekran oferty: zdjęcia na cały ekran, rzut, „dlaczego ta”, ocena, ulubione, porównanie, termin. */
export default function PortalOfferSheet({
  match,
  onClose,
  isPartner,
  partnerName,
  inCompare,
  onToggleCompare,
  onToggleFavorite,
  onRate,
  onBook,
  canBook,
}: {
  match: LuxMatch | null;
  onClose: () => void;
  isPartner: boolean;
  partnerName?: string | null;
  inCompare: boolean;
  onToggleCompare: () => void;
  onToggleFavorite: () => void;
  onRate: (sentiment: Rate, note: string) => Promise<void>;
  onBook: () => void;
  canBook: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<Rate | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const galleryRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIndex(0);
    setNote("");
    setPlanOpen(false);
    if (galleryRef.current) galleryRef.current.scrollLeft = 0;
    if (!match) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [match, onClose]);

  if (!match || typeof document === "undefined") return null;
  const offer = match.offer;
  const photos = (offer.imageUrls?.length ? offer.imageUrls : [offer.imageUrl]).filter(Boolean);
  const own = isPartner
    ? match.partnerFeedback?.find((f) => f.name === partnerName)?.sentiment || null
    : matchSentiment(match.clientFeedback);
  const ppsm = offerPpsm(offer);
  const specs = [
    offer.rooms ? `${offer.rooms} ${offer.rooms === 1 ? "pokój" : offer.rooms < 5 ? "pokoje" : "pokoi"}` : null,
    offer.area ? `${offer.area} m²` : null,
    offer.floor != null ? `piętro ${offer.floor}${offer.totalFloors ? ` / ${offer.totalFloors}` : ""}` : null,
    offer.yearBuilt ? `${offer.yearBuilt} r.` : null,
  ].filter(Boolean);
  const amenities = [
    offer.hasBalcony ? "Balkon" : null,
    offer.hasParking ? "Parking" : null,
    offer.hasElevator ? "Winda" : null,
    offer.hasGarden ? "Ogród" : null,
  ].filter(Boolean) as string[];

  const rate = async (s: Rate) => {
    setBusy(s);
    try {
      await onRate(s, note);
    } finally {
      setBusy(null);
    }
  };

  return createPortal(
    <div className="portal-lux fixed inset-0 z-[90] overflow-y-auto bg-[#F6F3EE]" role="dialog" aria-modal="true" aria-label={offer.title}>
      <div className="relative bg-black">
        <div
          ref={galleryRef}
          className="lux-gallery h-[58vh] max-h-[620px] min-h-[300px]"
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
          }}
        >
          {photos.map((url, i) => (
            <img key={`${url}-${i}`} src={url} alt={`${offer.title} — zdjęcie ${i + 1}`} className="h-full w-full object-contain" loading={i < 2 ? "eager" : "lazy"} />
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij"
          className="absolute left-4 top-4 flex size-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur"
        >
          <X className="size-5" />
        </button>
        {!isPartner ? (
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-pressed={Boolean(match.favorite)}
            aria-label={match.favorite ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
            className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-black/60 backdrop-blur"
          >
            <Heart className={`size-5 ${match.favorite ? "fill-[#D8C3A0] text-[#D8C3A0]" : "text-white"}`} />
          </button>
        ) : null}
        <span className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-[#15171A]">
          {Math.min(index + 1, photos.length)} / {photos.length}
        </span>
        {match.favoriteBadge ? (
          <span className="absolute bottom-4 right-4 rounded-full bg-[#D8C3A0] px-3 py-1.5 text-xs font-extrabold text-black">
            {match.favoriteBadge}
          </span>
        ) : null}
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-5 pb-16 pt-5">
        <div>
          <p className="lux-kicker">{[offer.district, offer.city].filter(Boolean).join(" · ")}</p>
          <h2 className="lux-serif mt-1.5 text-[26px] font-medium leading-tight">{offer.title}</h2>
          <p className="lux-serif mt-2 text-[28px]">{formatPln(offer.price)}</p>
          <p className="text-[13px] text-[#5B574F]">
            {[ppsm ? `${ppsm.toLocaleString("pl-PL")} zł/m²` : null, ...specs].filter(Boolean).join(" · ")}
          </p>
          {amenities.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {amenities.map((a) => (
                <span key={a} className="lux-chip">
                  {a}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {match.clientWhy ? (
          <section className="lux-card p-4">
            <p className="text-[12px] font-extrabold text-[#7A5F33]">Dlaczego ta oferta</p>
            <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-[#2E2C28]">{match.clientWhy}</p>
          </section>
        ) : null}

        {offer.floorPlanUrl ? (
          <section className="lux-card overflow-hidden">
            <button type="button" onClick={() => setPlanOpen(true)} className="flex w-full items-center gap-4 p-4 text-left">
              <img src={offer.floorPlanUrl} alt="Rzut mieszkania" className="size-20 rounded-xl bg-white object-contain" />
              <span className="flex-1">
                <span className="block text-[15px] font-bold">Rzut mieszkania</span>
                <span className="text-[12px] text-[#5B574F]">Stuknij, żeby powiększyć</span>
              </span>
              <Maximize2 className="size-5 text-[#7A5F33]" />
            </button>
          </section>
        ) : null}

        {match.partnerFeedback?.length && !isPartner ? (
          <section className="lux-card p-4">
            <p className="text-[12px] font-extrabold text-[#7A5F33]">Oceny osób, które wybierają z Tobą</p>
            {match.partnerFeedback.map((f) => (
              <p key={f.companionId} className="mt-1.5 text-[14px]">
                <b>{f.name}:</b> {SENTIMENT_LABEL[f.sentiment]}
                {f.note ? <span className="text-[#5B574F]"> — „{f.note}”</span> : null}
              </p>
            ))}
          </section>
        ) : null}

        <section className="lux-card lux-card--gold p-4">
          <p className="text-[15px] font-bold">{isPartner ? `${partnerName || "Twoja"} ocena` : "Twoja ocena"}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(["like", "maybe", "dislike"] as Rate[]).map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy !== null}
                onClick={() => void rate(s)}
                aria-pressed={own === s}
                className={`min-h-[48px] rounded-xl px-2 text-[12px] font-bold transition ${
                  own === s
                    ? s === "like"
                      ? "bg-[var(--lux-accent)] text-[#F6F3EE]"
                      : "bg-black text-[#D8C3A0]"
                    : "border border-[#E6E0D6] bg-white text-[#15171A]"
                }`}
              >
                {busy === s ? "…" : SENTIMENT_LABEL[s]}
              </button>
            ))}
          </div>
          <label htmlFor="offer-note" className="sr-only">
            Co dokładnie?
          </label>
          <textarea
            id="offer-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Co dokładnie się podoba albo przeszkadza? (opcjonalnie)"
            className="mt-3 w-full rounded-2xl border border-[#E6E0D6] bg-white p-3 text-[14px]"
          />
        </section>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onToggleCompare} className={`lux-btn ${inCompare ? "lux-btn--ink" : "lux-btn--ghost"}`}>
            <Columns2 className="size-4" /> {inCompare ? "W porównaniu" : "Do porównania"}
          </button>
          {canBook && !isPartner ? (
            <button type="button" onClick={onBook} className="lux-btn lux-btn--primary">
              <CalendarCheck2 className="size-4" /> Umów oglądanie
            </button>
          ) : (
            <a href={`/oferta/${offer.id}`} target="_blank" rel="noreferrer" className="lux-btn lux-btn--ghost">
              Pełne ogłoszenie
            </a>
          )}
        </div>

        {offer.description ? (
          <section className="lux-card p-4">
            <p className="text-[12px] font-extrabold text-[#7A5F33]">Opis</p>
            <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-[#2E2C28]">{offer.description}</p>
          </section>
        ) : null}
      </div>

      {planOpen && offer.floorPlanUrl ? (
        <button type="button" onClick={() => setPlanOpen(false)} className="fixed inset-0 z-[95] flex items-center justify-center bg-black/90 p-4" aria-label="Zamknij rzut">
          <img src={offer.floorPlanUrl} alt="Rzut mieszkania" className="max-h-full max-w-full rounded-xl bg-white object-contain" />
        </button>
      ) : null}
    </div>,
    document.body,
  );
}
