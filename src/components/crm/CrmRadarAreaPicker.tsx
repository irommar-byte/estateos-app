"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Scan, MapPin } from "lucide-react";
import { canonicalizeCity } from "@/lib/location/locationCatalog";
import {
  RADAR_AREA_RETICLE_PX,
  RADAR_AREA_MAX_KM,
  RADAR_AREA_MIN_KM,
  radiusKmFromZoom,
  zoomFromRadiusKm,
  type RadarMapAreaSelection,
} from "@/lib/radarMapArea";

if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
}

const DEFAULT_CENTER = { lat: 52.2297, lng: 21.0122 };

type Props = {
  open: boolean;
  initialLat?: number | null;
  initialLng?: number | null;
  initialRadiusKm?: number | null;
  onCancel: () => void;
  onApply: (selection: RadarMapAreaSelection) => void;
};

export default function CrmRadarAreaPicker({
  open,
  initialLat,
  initialLng,
  initialRadiusKm,
  onCancel,
  onApply,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [radiusKm, setRadiusKm] = useState(
    initialRadiusKm && initialRadiusKm > 0 ? initialRadiusKm : 2.5,
  );
  const [center, setCenter] = useState({
    lat: initialLat ?? DEFAULT_CENTER.lat,
    lng: initialLng ?? DEFAULT_CENTER.lng,
  });
  const [addressLabel, setAddressLabel] = useState("");
  const [resolving, setResolving] = useState(false);

  const updateRadiusFromMap = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    setCenter({ lat: c.lat, lng: c.lng });
    setRadiusKm(radiusKmFromZoom(c.lat, map.getZoom()));
  }, []);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setResolving(true);
    try {
      const res = await fetch(`/api/location/reverse?lat=${lat}&lng=${lng}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok) {
        setAddressLabel(
          data.addressLabel ||
            [data.city, data.district].filter(Boolean).join(", ") ||
            `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        );
        return {
          city: canonicalizeCity(data.city) || "Warszawa",
          district: String(data.district || "").trim(),
          addressLabel: String(data.addressLabel || "").trim(),
        };
      }
    } catch {
      // ignore
    } finally {
      setResolving(false);
    }
    return {
      city: "Warszawa",
      district: "",
      addressLabel: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const lat = initialLat ?? DEFAULT_CENTER.lat;
    const lng = initialLng ?? DEFAULT_CENTER.lng;
    const r = initialRadiusKm && initialRadiusKm > 0 ? initialRadiusKm : 2.5;
    setCenter({ lat, lng });
    setRadiusKm(r);
    void reverseGeocode(lat, lng);
  }, [open, initialLat, initialLng, initialRadiusKm, reverseGeocode]);

  useEffect(() => {
    if (!open) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      return;
    }
    if (!mapContainerRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    const lat = initialLat ?? DEFAULT_CENTER.lat;
    const lng = initialLng ?? DEFAULT_CENTER.lng;
    const zoom = zoomFromRadiusKm(
      lat,
      initialRadiusKm && initialRadiusKm > 0 ? initialRadiusKm : 2.5,
    );

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [lng, lat],
      zoom,
      pitch: 0,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "top-right");
    map.on("moveend", () => {
      updateRadiusFromMap();
      const c = map.getCenter();
      void reverseGeocode(c.lat, c.lng);
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [open, initialLat, initialLng, initialRadiusKm, updateRadiusFromMap, reverseGeocode]);

  const applyRadiusSlider = (next: number) => {
    setRadiusKm(next);
    const map = mapRef.current;
    if (!map) return;
    const z = zoomFromRadiusKm(center.lat, next);
    map.easeTo({ zoom: z, duration: 400 });
  };

  const handleApply = async () => {
    const map = mapRef.current;
    const lat = map ? map.getCenter().lat : center.lat;
    const lng = map ? map.getCenter().lng : center.lng;
    const r = map ? radiusKmFromZoom(lat, map.getZoom()) : radiusKm;
    const geo = await reverseGeocode(lat, lng);
    onApply({
      lat,
      lng,
      radiusKm: r,
      city: geo.city,
      district: geo.district,
      addressLabel: geo.addressLabel || addressLabel,
    });
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100000] flex flex-col bg-black"
        >
          <div className="relative z-20 flex items-center justify-between border-b border-white/10 bg-black/80 px-5 py-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <Scan className="text-emerald-400" size={22} />
              <div>
                <p className="text-sm font-black text-white">Wybierz obszar na mapie</p>
                <p className="text-[10px] uppercase tracking-widest text-white/40">
                  Przesuń mapę · okrąg = zasięg radaru
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20"
            >
              <X size={20} />
            </button>
          </div>

          <div className="relative min-h-0 flex-1">
            <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-400/90 shadow-[0_0_40px_rgba(16,185,129,0.35)]"
              style={{
                width: RADAR_AREA_RETICLE_PX,
                height: RADAR_AREA_RETICLE_PX,
                boxShadow: "inset 0 0 30px rgba(16,185,129,0.15)",
              }}
            />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_26%,rgba(0,0,0,0.55)_70%)]" />
          </div>

          <div className="relative z-20 space-y-4 border-t border-white/10 bg-[#0a0a0a]/95 px-5 py-5 backdrop-blur-xl">
            <div className="flex items-start gap-2 text-xs text-white/60">
              <MapPin size={16} className="mt-0.5 shrink-0 text-emerald-500" />
              <span>{resolving ? "Ustalam lokalizację…" : addressLabel || "—"}</span>
            </div>
            <div>
              <div className="mb-2 flex justify-between text-[10px] font-bold uppercase tracking-widest text-white/40">
                <span>Promień</span>
                <span className="text-emerald-400">{radiusKm.toFixed(1)} km</span>
              </div>
              <input
                type="range"
                min={RADAR_AREA_MIN_KM}
                max={RADAR_AREA_MAX_KM}
                step={0.1}
                value={radiusKm}
                onChange={(e) => applyRadiusSlider(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-xl border border-white/15 py-4 text-[11px] font-black uppercase tracking-widest text-white/60"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={() => void handleApply()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-4 text-[11px] font-black uppercase tracking-widest text-black"
              >
                <Check size={18} />
                Zastosuj obszar
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
