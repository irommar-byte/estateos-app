"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { ExternalLink, MapPin } from "lucide-react";

type Props = {
  lat: number;
  lng: number;
  title?: string;
  street?: string | null;
  city?: string;
  district?: string;
  previewImageUrl?: string | null;
  /** Dokładna pinezka (import admin) vs. podgląd okolicy (strona oferty). */
  showPin?: boolean;
  /** Wariant kolorystyczny panelu. */
  variant?: "admin" | "offer";
  sectionLabel?: string;
  footerCaption?: string;
};

function add3dBuildingsLayer(map: mapboxgl.Map) {
  const layers = map.getStyle()?.layers || [];
  const labelLayerId = layers.find((l) => l.type === "symbol" && (l.layout as Record<string, unknown>)?.["text-field"])?.id;

  if (map.getLayer("estateos-neighborhood-3d-buildings")) return;

  try {
    map.addLayer(
      {
        id: "estateos-neighborhood-3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": "#334155",
          "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 14, 0, 16.5, ["get", "height"]],
          "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 14, 0, 16.5, ["get", "min_height"]],
          "fill-extrusion-opacity": 0.88,
        },
      } as mapboxgl.LayerSpecification,
      labelLayerId,
    );
  } catch {
    /* styl bez warstwy building */
  }
}

function createPinElement(): HTMLDivElement {
  const root = document.createElement("div");
  root.className = "relative flex flex-col items-center pointer-events-none";
  root.innerHTML = `
    <div class="absolute -top-1 w-12 h-12 rounded-full bg-blue-500/25 animate-ping"></div>
    <div class="relative z-10 w-10 h-10 rounded-full bg-blue-500 border-2 border-white shadow-[0_0_24px_rgba(59,130,246,0.65)] flex items-center justify-center">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/>
        <circle cx="12" cy="10" r="2.5" fill="white"/>
      </svg>
    </div>
    <div class="relative z-10 -mt-1 w-0 h-0 border-l-[7px] border-r-[7px] border-t-[10px] border-l-transparent border-r-transparent border-t-blue-500"></div>
  `;
  return root;
}

export default function NeighborhoodMapPreview({
  lat,
  lng,
  title,
  street,
  city,
  district,
  previewImageUrl,
  showPin = true,
  variant = "admin",
  sectionLabel,
  footerCaption,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const orbitFrameRef = useRef<number | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const isOffer = variant === "offer";
  const locationLine = [street, district, city].filter(Boolean).join(", ");
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}&z=${showPin ? 18 : 15}`;
  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
  const defaultLabel = showPin ? "Podgląd lokalizacji (Mapbox)" : "Okolica nieruchomości";
  const defaultFooter = showPin
    ? "Widok satelitarny z modelem 3D budynków i pinezką w miejscu wskazanym przez OtoDom."
    : "Widok okolicy bez dokładnej pinezki — pokazuje charakter rejonu, nie precyzyjny adres.";

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
    if (!token) {
      setMapError("Brak NEXT_PUBLIC_MAPBOX_TOKEN — mapa podglądowa niedostępna.");
      return;
    }

    mapboxgl.accessToken = token;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let bootAttempts = 0;
    let outerRaf = 0;
    let innerRaf = 0;

    const teardown = () => {
      if (orbitFrameRef.current) cancelAnimationFrame(orbitFrameRef.current);
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      resizeObserver?.disconnect();
    };

    const center: [number, number] = [lng, lat];

    const boot = () => {
      if (cancelled || mapRef.current) return;
      const el = containerRef.current;
      bootAttempts += 1;
      if (!el || el.clientWidth < 32 || el.clientHeight < 32) {
        if (bootAttempts < 120) innerRaf = requestAnimationFrame(boot);
        return;
      }

      const map = new mapboxgl.Map({
        container: el,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center,
        zoom: showPin ? 17.2 : 15.4,
        pitch: showPin ? 62 : 52,
        bearing: showPin ? -28 : -18,
        antialias: true,
        attributionControl: true,
      });

      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

      map.on("style.load", () => {
        map.setFog({
          range: [0.5, 10],
          color: isOffer ? "#e2e8f0" : "#0f172a",
          "high-color": isOffer ? "#f8fafc" : "#1e293b",
          "space-color": isOffer ? "#cbd5e1" : "#020617",
          "star-intensity": 0.05,
        } as mapboxgl.FogSpecification);

        add3dBuildingsLayer(map);
      });

      map.on("load", () => {
        if (cancelled) return;
        map.resize();

        if (showPin) {
          markerRef.current = new mapboxgl.Marker({ element: createPinElement(), anchor: "bottom" })
            .setLngLat(center)
            .addTo(map);
        }

        map.flyTo({
          center,
          zoom: showPin ? 17.8 : 15.8,
          pitch: showPin ? 64 : 54,
          bearing: showPin ? -32 : -22,
          speed: 0.85,
          curve: 1.4,
          essential: true,
        });

        const start = performance.now();
        const durationMs = showPin ? 4800 : 3600;
        const initialBearing = map.getBearing();

        const tick = (now: number) => {
          if (cancelled || !mapRef.current) return;
          const t = Math.min(1, (now - start) / durationMs);
          const eased = 1 - Math.pow(1 - t, 3);
          map.easeTo({
            center,
            bearing: initialBearing + eased * (showPin ? 120 : 80),
            pitch: showPin ? 66 : 56,
            zoom: showPin ? 17.9 : 16,
            duration: 100,
            easing: (x) => x,
          });
          if (t < 1) orbitFrameRef.current = requestAnimationFrame(tick);
        };

        orbitFrameRef.current = requestAnimationFrame(tick);
      });

      map.on("error", (e) => {
        console.error("Neighborhood map preview:", e);
        setMapError("Mapa nie załadowała się — sprawdź token Mapbox.");
      });

      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(el);
    };

    outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(boot);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(outerRaf);
      cancelAnimationFrame(innerRaf);
      teardown();
    };
  }, [lat, lng, showPin, isOffer]);

  const labelClass = isOffer
    ? "text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1 flex items-center gap-2"
    : "text-[10px] font-black uppercase tracking-widest text-blue-400/90 mb-1 flex items-center gap-2";
  const lineClass = isOffer ? "text-sm text-[var(--eos-text)]" : "text-sm text-white/80";
  const coordClass = isOffer ? "text-[11px] text-[var(--eos-muted)] font-mono mt-1" : "text-[11px] text-white/40 font-mono mt-1";
  const linkClass = isOffer
    ? "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--eos-input)] border border-[var(--eos-border)] text-[10px] font-bold uppercase tracking-wider text-[var(--eos-muted)] hover:text-[var(--eos-text)] hover:border-[var(--eos-border-strong)] transition-colors shadow-[0_8px_22px_rgba(0,0,0,0.08)]"
    : "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-white/70 hover:text-white hover:border-white/25 transition-colors";
  const mapShellClass = isOffer
    ? "relative rounded-2xl overflow-hidden border border-[var(--eos-border)] bg-[var(--eos-input)] min-h-[280px] md:min-h-[320px] shadow-[0_18px_48px_rgba(0,0,0,0.12)]"
    : "relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 min-h-[320px] md:min-h-[380px]";
  const footerClass = isOffer
    ? "pointer-events-none absolute bottom-3 left-4 right-4 text-[10px] text-[var(--eos-muted)]"
    : "pointer-events-none absolute bottom-3 left-4 right-4 text-[10px] text-white/50";
  const gradientClass = isOffer
    ? "pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--eos-card)]/95 to-transparent"
    : "pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={labelClass}>
            <MapPin size={12} />
            {sectionLabel || defaultLabel}
          </p>
          <p className={lineClass}>
            {locationLine || title || "Wskazane współrzędne"}
          </p>
          {!showPin ? (
            <p className={`${coordClass} opacity-0 h-0 overflow-hidden`} aria-hidden>
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </p>
          ) : (
            <p className={coordClass}>
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
            Google Maps <ExternalLink size={12} />
          </a>
          {showPin ? (
            <a href={streetViewUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
              Street View <ExternalLink size={12} />
            </a>
          ) : null}
        </div>
      </div>

      <div className={previewImageUrl && !isOffer ? "grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4" : ""}>
        <div className={mapShellClass}>
          {mapError ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-amber-500">
              {mapError}
            </div>
          ) : null}
          <div ref={containerRef} className={`absolute inset-0 w-full h-full ${isOffer ? "min-h-[280px] md:min-h-[320px]" : "min-h-[320px] md:min-h-[380px]"}`} />
          <div className={gradientClass} />
          <p className={footerClass}>{footerCaption || defaultFooter}</p>
        </div>

        {previewImageUrl && !isOffer ? (
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/30 flex flex-col min-h-[200px] lg:min-h-[380px]">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 px-4 py-3 border-b border-white/10">
              Pierwsze zdjęcie z ogłoszenia
            </p>
            <div className="relative flex-1 min-h-[180px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImageUrl}
                alt={title ? `Podgląd: ${title}` : "Zdjęcie nieruchomości z OtoDom"}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
