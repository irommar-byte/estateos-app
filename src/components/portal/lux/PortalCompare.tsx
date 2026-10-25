"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { ChevronLeft } from "lucide-react";
import { formatPln } from "./portalApi";
import { SENTIMENT_LABEL, matchSentiment, offerPpsm, type LuxMatch } from "./types";

if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
}

const LETTERS = ["A", "B", "C", "D"];

type Row = { label: string; values: string[]; best?: number | null };

function bestIndex(values: Array<number | null>, lowerBetter: boolean): number | null {
  const valid = values.map((v, i) => ({ v, i })).filter((x) => x.v != null && Number.isFinite(x.v)) as Array<{ v: number; i: number }>;
  if (valid.length < 2) return null;
  const target = lowerBetter ? Math.min(...valid.map((x) => x.v)) : Math.max(...valid.map((x) => x.v));
  const hits = valid.filter((x) => x.v === target);
  return hits.length === 1 ? hits[0].i : null;
}

const yesNo = (v: boolean | null | undefined) => (v == null ? "—" : v ? "Tak" : "Nie");

/** Porównywarka: parametry, wizualnie i mapa z pinezkami-zdjęciami. */
export default function PortalCompare({
  open,
  onClose,
  matches,
  onOpenOffer,
  onRemove,
  agentName,
}: {
  open: boolean;
  onClose: () => void;
  matches: LuxMatch[];
  onOpenOffer: (m: LuxMatch) => void;
  onRemove: (matchId: number) => void;
  agentName: string;
}) {
  const [tab, setTab] = useState<"params" | "visual" | "map">("params");
  const [onlyDiff, setOnlyDiff] = useState(true);
  const [selected, setSelected] = useState(0);
  const mapBox = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const rows: Row[] = useMemo(() => {
    const o = matches.map((m) => m.offer);
    const ppsm = o.map(offerPpsm);
    const list: Row[] = [
      { label: "Cena", values: o.map((x) => formatPln(x.price)), best: bestIndex(o.map((x) => Number(x.price) || null), true) },
      { label: "Cena za m²", values: ppsm.map((v) => (v ? `${v.toLocaleString("pl-PL")} zł` : "—")), best: bestIndex(ppsm, true) },
      { label: "Metraż", values: o.map((x) => (x.area ? `${x.area} m²` : "—")), best: bestIndex(o.map((x) => Number(x.area) || null), false) },
      { label: "Pokoje", values: o.map((x) => (x.rooms ? String(x.rooms) : "—")), best: bestIndex(o.map((x) => x.rooms ?? null), false) },
      { label: "Piętro", values: o.map((x) => (x.floor != null ? `${x.floor}${x.totalFloors ? ` / ${x.totalFloors}` : ""}` : "—")) },
      { label: "Rok budowy", values: o.map((x) => (x.yearBuilt ? String(x.yearBuilt) : "—")), best: bestIndex(o.map((x) => x.yearBuilt ?? null), false) },
      { label: "Balkon", values: o.map((x) => yesNo(x.hasBalcony)) },
      { label: "Parking", values: o.map((x) => yesNo(x.hasParking)) },
      { label: "Winda", values: o.map((x) => yesNo(x.hasElevator)) },
      { label: "Lokalizacja", values: o.map((x) => [x.district, x.city].filter(Boolean).join(", ") || "—") },
      {
        label: "Twoja ocena",
        values: matches.map((m) => {
          const s = matchSentiment(m.clientFeedback);
          return s ? SENTIMENT_LABEL[s] : "—";
        }),
      },
    ];
    const partners = new Set(matches.flatMap((m) => (m.partnerFeedback || []).map((f) => f.name)));
    for (const name of partners) {
      list.push({
        label: `Ocena: ${name}`,
        values: matches.map((m) => {
          const f = (m.partnerFeedback || []).find((x) => x.name === name);
          return f ? SENTIMENT_LABEL[f.sentiment] : "—";
        }),
      });
    }
    return list;
  }, [matches]);

  const visibleRows = onlyDiff ? rows.filter((r) => new Set(r.values).size > 1 || r.label.startsWith("Ocena") || r.label === "Twoja ocena") : rows;

  const agreement = useMemo(() => {
    return matches.map((m) => {
      const own = matchSentiment(m.clientFeedback);
      const others = (m.partnerFeedback || []).map((f) => f.sentiment);
      if (!own || !others.length) return null;
      return others.every((s) => s === own) ? "Zgoda" : "Różne zdania";
    });
  }, [matches]);

  useEffect(() => {
    if (!open || tab !== "map" || !mapBox.current) return;
    if (!mapboxgl.accessToken) return;
    const points = matches.filter((m) => Number.isFinite(Number(m.offer.lat)) && Number.isFinite(Number(m.offer.lng)) && m.offer.lat);
    const map = new mapboxgl.Map({
      container: mapBox.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: points.length ? [Number(points[0].offer.lng), Number(points[0].offer.lat)] : [21.0122, 52.2297],
      zoom: 12,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    markersRef.current = matches.map((m, i) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "lux-map-pin";
      el.setAttribute("aria-label", `Oferta ${LETTERS[i]}: ${m.offer.title}`);
      const photo = document.createElement("span");
      photo.className = "lux-map-pin__photo";
      photo.style.backgroundImage = `url("${m.offer.imageUrl}")`;
      const label = document.createElement("span");
      label.className = "lux-map-pin__label";
      label.textContent = `${LETTERS[i]} · ${Math.round(Number(m.offer.price) / 1000)} tys.`;
      el.appendChild(photo);
      el.appendChild(label);
      el.addEventListener("click", () => setSelected(i));
      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" });
      if (m.offer.lat && m.offer.lng) marker.setLngLat([Number(m.offer.lng), Number(m.offer.lat)]).addTo(map);
      return marker;
    });
    if (points.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      points.forEach((m) => bounds.extend([Number(m.offer.lng), Number(m.offer.lat)]));
      map.fitBounds(bounds, { padding: 70, duration: 0, maxZoom: 15 });
    }
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [open, tab, matches]);

  useEffect(() => {
    markersRef.current.forEach((marker, i) => {
      const el = marker.getElement();
      const photo = el.querySelector(".lux-map-pin__photo") as HTMLElement | null;
      if (photo) {
        photo.style.transition = "transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1)";
        photo.style.transform = `scale(${i === selected ? 1.15 : 0.92})`;
      }
      el.style.zIndex = i === selected ? "2" : "1";
    });
  }, [selected]);

  if (!open || typeof document === "undefined") return null;
  const sel = matches[selected];
  const ppsmValues = matches.map((m) => offerPpsm(m.offer));
  const ppsmMin = Math.min(...(ppsmValues.filter(Boolean) as number[]));
  const ppsmMax = Math.max(...(ppsmValues.filter(Boolean) as number[]));

  return createPortal(
    <div className="portal-lux fixed inset-0 z-[90] overflow-y-auto bg-[var(--lux-well)]" role="dialog" aria-modal="true" aria-label="Porównanie ofert">
      <header className="rounded-b-[28px] bg-black px-5 pb-5 pt-4 text-[#F6F3EE]">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={onClose} aria-label="Wróć do panelu" className="flex size-10 items-center justify-center rounded-full border border-[#D8C3A0]/35">
              <ChevronLeft className="size-4 text-[#D8C3A0]" />
            </button>
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#D8C3A0]">Porównanie</span>
            <img src="/brand/estateos-wordmark.png" alt="EstateOS" className="ml-auto h-[22px] w-auto" />
          </div>
          <h2 className="lux-serif mt-4 text-[28px] font-medium leading-tight">
            {matches.length} {matches.length === 1 ? "oferta" : matches.length < 5 ? "oferty" : "ofert"} obok siebie
          </h2>
          <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, matches.length)}, minmax(0, 1fr))` }}>
            {matches.map((m, i) => (
              <div key={m.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onOpenOffer(m)}
                  className="relative block h-[92px] w-full overflow-hidden rounded-[14px] bg-[#3a3d42] bg-cover bg-center"
                  style={{ backgroundImage: `url("${m.offer.imageUrl}")` }}
                  aria-label={`Otwórz ofertę ${LETTERS[i]}`}
                >
                  <span className="absolute left-1.5 top-1.5 flex size-[22px] items-center justify-center rounded-full bg-black text-[11px] font-extrabold text-[#D8C3A0]">
                    {LETTERS[i]}
                  </span>
                </button>
                <p className="mt-1.5 truncate text-[12px] font-bold">{m.offer.district || m.offer.city}</p>
                <div className="flex items-center justify-between">
                  <p className="text-[12px] text-[#BDB6AA]">{Math.round(Number(m.offer.price) / 1000)} tys.</p>
                  <button type="button" onClick={() => onRemove(m.id)} className="text-[11px] text-[#BDB6AA] underline">
                    usuń
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 pb-16">
        <nav aria-label="Widok porównania" className="mt-4 grid grid-cols-3 gap-1 rounded-[14px] bg-[var(--lux-well)] p-1">
          {([
            ["params", "Parametry"],
            ["visual", "Wizualnie"],
            ["map", "Mapa"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={`h-[38px] rounded-[10px] text-[13px] ${tab === key ? "bg-[var(--lux-card)] font-bold shadow-sm" : "font-semibold text-[var(--lux-ink-2)]"}`}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === "params" ? (
          <section className="mt-5">
            <div className="flex items-baseline justify-between">
              <h3 className="lux-serif text-[22px] font-medium">Parametry</h3>
              <label className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--lux-ink-2)]">
                <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} className="accent-[#0E4D3F]" />
                Tylko różnice
              </label>
            </div>
            <div className="lux-card mt-3 overflow-hidden">
              <div className="grid bg-black px-3 py-2.5 text-[11px] font-extrabold tracking-[0.08em] text-[#D8C3A0]" style={{ gridTemplateColumns: `96px repeat(${matches.length}, minmax(0, 1fr))` }}>
                <span />
                {matches.map((m, i) => (
                  <span key={m.id} className="text-center">
                    {LETTERS[i]}
                  </span>
                ))}
              </div>
              {visibleRows.map((row) => (
                <div key={row.label} className="grid items-center border-t border-[var(--lux-line)] px-3 py-2.5 text-[13px]" style={{ gridTemplateColumns: `96px repeat(${matches.length}, minmax(0, 1fr))` }}>
                  <span className="text-[var(--lux-ink-2)]">{row.label}</span>
                  {row.values.map((v, i) => (
                    <span key={i} className={`text-center ${row.best === i ? "font-extrabold text-[var(--lux-accent)]" : ""}`}>
                      {v}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <p className="mt-2 px-1 text-[12px] text-[var(--lux-ink-2)]">Pogrubiona zieleń = najlepsza wartość w wierszu.</p>
          </section>
        ) : null}

        {tab === "visual" ? (
          <section className="mt-5 space-y-3">
            <h3 className="lux-serif text-[22px] font-medium">Wizualnie</h3>
            <div className="lux-card p-4">
              <p className="text-[13px] font-bold">Dopasowanie do Twoich kryteriów</p>
              <div className="mt-3 space-y-3">
                {matches.map((m, i) => (
                  <div key={m.id} className="flex items-center gap-2.5">
                    <span className="w-[18px] text-[12px] font-extrabold">{LETTERS[i]}</span>
                    <div className="h-2.5 flex-1 rounded-full bg-[var(--lux-well)]">
                      <div className="h-2.5 rounded-full bg-[var(--lux-accent)] transition-all duration-700" style={{ width: `${Math.max(4, Math.min(100, m.score))}%` }} />
                    </div>
                    <span className="w-9 text-right text-[12px] font-bold">{m.score}%</span>
                  </div>
                ))}
              </div>
            </div>
            {ppsmValues.filter(Boolean).length > 1 && ppsmMax > ppsmMin ? (
              <div className="lux-card p-4">
                <p className="text-[13px] font-bold">Cena za m²</p>
                <div className="relative mt-4 h-[64px]">
                  <div className="absolute inset-x-0 top-[28px] h-2 rounded-full bg-[var(--lux-well)]" />
                  {matches.map((m, i) => {
                    const v = offerPpsm(m.offer);
                    if (!v) return null;
                    const left = ((v - ppsmMin) / (ppsmMax - ppsmMin)) * 90;
                    return (
                      <span
                        key={m.id}
                        className="absolute top-0 flex size-[26px] items-center justify-center rounded-full bg-black text-[11px] font-extrabold text-[#D8C3A0]"
                        style={{ left: `${left}%` }}
                      >
                        {LETTERS[i]}
                      </span>
                    );
                  })}
                  <span className="absolute left-0 top-[44px] text-[11px] text-[var(--lux-ink-2)]">{ppsmMin.toLocaleString("pl-PL")} zł</span>
                  <span className="absolute right-0 top-[44px] text-[11px] text-[var(--lux-ink-2)]">{ppsmMax.toLocaleString("pl-PL")} zł/m²</span>
                </div>
              </div>
            ) : null}
            {agreement.some(Boolean) ? (
              <div className="lux-card p-4">
                <p className="text-[13px] font-bold">Czy się zgadzacie?</p>
                <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${matches.length}, minmax(0, 1fr))` }}>
                  {agreement.map((a, i) => (
                    <div key={i} className={`rounded-xl p-2 text-center text-[12px] font-bold ${a === "Zgoda" ? "bg-[var(--lux-well)] text-[var(--lux-accent)]" : a ? "bg-[var(--lux-well)] text-[var(--lux-gold-ink)]" : "bg-[var(--lux-well)] text-[var(--lux-ink-3)]"}`}>
                      {LETTERS[i]} · {a || "brak ocen"}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="lux-card p-3">
              <p className="mb-2 text-[13px] font-bold">Zdjęcia obok siebie</p>
              <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${matches.length}, minmax(0, 1fr))` }}>
                {matches.map((m) => (
                  <div key={m.id} className="space-y-1.5">
                    {(m.offer.imageUrls?.length ? m.offer.imageUrls : [m.offer.imageUrl]).slice(0, 3).map((url, idx) => (
                      <img key={idx} src={url} alt="" className="h-[84px] w-full rounded-[10px] object-cover" loading="lazy" />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {tab === "map" ? (
          <section className="mt-5">
            <h3 className="lux-serif text-[22px] font-medium">Na mapie</h3>
            {mapboxgl.accessToken ? (
              <div ref={mapBox} className="mt-3 h-[380px] w-full overflow-hidden rounded-[22px] bg-[var(--lux-well)]" />
            ) : (
              <p className="mt-3 text-[14px]">Mapa jest chwilowo niedostępna.</p>
            )}
            {sel ? (
              <button type="button" onClick={() => onOpenOffer(sel)} className="lux-card mt-3 flex w-full items-center gap-3 p-3.5 text-left">
                <span className="size-16 shrink-0 rounded-[14px] bg-[var(--lux-line-strong)] bg-cover bg-center" style={{ backgroundImage: `url("${sel.offer.imageUrl}")` }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-extrabold">
                    {LETTERS[selected]} · {sel.offer.district || sel.offer.city} · {formatPln(sel.offer.price)}
                  </span>
                  <span className="block truncate text-[12px] text-[var(--lux-ink-2)]">{sel.offer.title}</span>
                </span>
              </button>
            ) : null}
          </section>
        ) : null}

        <a href="#portal-chat" onClick={onClose} className="lux-btn lux-btn--ghost mt-6 w-full">
          Zapytaj {agentName.split(" ")[0]} o porównanie
        </a>
      </div>
    </div>,
    document.body,
  );
}
