"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import LuxSheet from "./LuxSheet";
import { portalAction } from "./portalApi";

type LngLat = [number, number];

if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
}

const WARSAW: LngLat = [21.0122, 52.2297];

function featureOf(points: LngLat[]) {
  const ring = points.length >= 3 ? [...points, points[0]] : points;
  return {
    type: "FeatureCollection" as const,
    features: [
      ...(points.length >= 3
        ? [{ type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [ring] } }]
        : points.length === 2
          ? [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: points } }]
          : []),
      ...points.map((p) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: p } })),
    ],
  };
}

/** „Narysuj obszar”: klient zaznacza punkty na mapie, z których powstaje obszar poszukiwań. */
export default function PortalAreaSheet({
  open,
  onClose,
  token,
  initial,
  criteriaEditAllowed,
  agentName,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  initial: LngLat[] | null;
  criteriaEditAllowed: boolean;
  agentName: string;
  onSaved: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [points, setPoints] = useState<LngLat[]>(initial || []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pointsRef = useRef(points);
  pointsRef.current = points;

  const sync = useCallback((next: LngLat[]) => {
    const source = mapRef.current?.getSource("area") as mapboxgl.GeoJSONSource | undefined;
    source?.setData(featureOf(next) as unknown as GeoJSON.FeatureCollection);
  }, []);

  useEffect(() => {
    if (!open) return;
    setPoints(initial || []);
    setMessage("");
  }, [open, initial]);

  useEffect(() => {
    if (!open || !containerRef.current || mapRef.current) return;
    if (!mapboxgl.accessToken) {
      setMessage("Mapa jest chwilowo niedostępna.");
      return;
    }
    const start = initial?.length ? initial[0] : WARSAW;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: start,
      zoom: initial?.length ? 12 : 11,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      map.addSource("area", { type: "geojson", data: featureOf(pointsRef.current) as unknown as GeoJSON.FeatureCollection });
      map.addLayer({ id: "area-fill", type: "fill", source: "area", paint: { "fill-color": "#0E4D3F", "fill-opacity": 0.18 }, filter: ["==", "$type", "Polygon"] });
      map.addLayer({ id: "area-line", type: "line", source: "area", paint: { "line-color": "#0E4D3F", "line-width": 2.5 }, filter: ["in", "$type", "Polygon", "LineString"] });
      map.addLayer({ id: "area-pts", type: "circle", source: "area", paint: { "circle-radius": 6, "circle-color": "#000", "circle-stroke-color": "#D8C3A0", "circle-stroke-width": 2 }, filter: ["==", "$type", "Point"] });
      if (initial && initial.length >= 3) {
        const bounds = new mapboxgl.LngLatBounds();
        initial.forEach((p) => bounds.extend(p));
        map.fitBounds(bounds, { padding: 40, duration: 0 });
      }
    });
    map.on("click", (e) => {
      const next: LngLat[] = [...pointsRef.current, [e.lngLat.lng, e.lngLat.lat]].slice(0, 40) as LngLat[];
      setPoints(next);
      sync(next);
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [open, initial, sync]);

  const update = (next: LngLat[]) => {
    setPoints(next);
    sync(next);
  };

  const save = async (polygon: LngLat[] | null) => {
    setBusy(true);
    setMessage("");
    try {
      const json = await portalAction<{ applied: boolean }>(token, "save_search_area", { polygon });
      setMessage(
        json.applied
          ? "Zapisane — kolejne propozycje będą tylko z tego obszaru."
          : `Wysłane do ${agentName}. Po akceptacji propozycje będą z tego obszaru.`,
      );
      onSaved();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Błąd");
    } finally {
      setBusy(false);
    }
  };

  return (
    <LuxSheet open={open} onClose={onClose} kicker="Moje kryteria" title="Gdzie chcesz mieszkać?" wide>
      <p className="text-[14px] leading-relaxed text-[var(--lux-ink-2)]">
        Stukaj w mapę, żeby zaznaczyć granice obszaru — wystarczą 3–4 punkty.
        {criteriaEditAllowed ? "" : ` Zmianę zatwierdzi ${agentName}.`}
      </p>
      <div ref={containerRef} className="mt-3 h-[420px] w-full overflow-hidden rounded-[22px] bg-[var(--lux-well)]" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="lux-chip" disabled={!points.length} onClick={() => update(points.slice(0, -1))}>
          Cofnij punkt
        </button>
        <button type="button" className="lux-chip" disabled={!points.length} onClick={() => update([])}>
          Wyczyść
        </button>
        {initial?.length ? (
          <button type="button" className="lux-chip" disabled={busy} onClick={() => void save(null)}>
            Usuń obszar
          </button>
        ) : null}
      </div>
      {message ? <p className="mt-3 text-[13px] font-semibold text-[var(--lux-accent)]">{message}</p> : null}
      <button
        type="button"
        className="lux-btn lux-btn--primary mt-4 w-full"
        disabled={points.length < 3 || busy}
        onClick={() => void save(points)}
      >
        {busy ? "Zapisuję…" : points.length < 3 ? `Zaznacz jeszcze ${3 - points.length}` : "Zapisz obszar"}
      </button>
    </LuxSheet>
  );
}
