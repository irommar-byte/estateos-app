"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Lock, LocateFixed } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale } from "@/contexts/LocaleContext";
import { useFormatOfferPrice } from "@/hooks/useFormatOfferPrice";

function parseOfferPrice(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return 0;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}

function getOfferFilterPrice(offer: { pricePln?: unknown; price?: unknown }): number {
  const pln = offer.pricePln;
  if (typeof pln === "number" && Number.isFinite(pln) && pln > 0) return pln;
  return parseOfferPrice(offer.price);
}

function normalizeTransactionTypeStatic(value: unknown): "sale" | "rent" | "other" {
  const token = String(value || "").trim().toLowerCase();
  if (["sale", "sprzedaz", "sprzedaż", "sell"].includes(token)) return "sale";
  if (["rent", "wynajem", "lease"].includes(token)) return "rent";
  return "other";
}

const OFFER_PIN_BASE =
  "px-4 py-2 backdrop-blur-2xl border text-[11px] font-black tracking-widest rounded-full cursor-pointer transition-all duration-300 ease-out";

function offerPinColorClasses(transactionType: unknown) {
  const tx = normalizeTransactionTypeStatic(transactionType);

  if (tx === "rent") {
    return `${OFFER_PIN_BASE} bg-blue-500/80 text-white border-blue-400/40 hover:bg-blue-400 hover:scale-110 shadow-[0_10px_30px_rgba(59,130,246,0.3)]`;
  }

  return `${OFFER_PIN_BASE} bg-emerald-500/80 text-black border-emerald-400/40 hover:bg-emerald-400 hover:scale-110 shadow-[0_10px_30px_rgba(16,185,129,0.3)]`;
}

type Props = {
  /** Pełny ekran pod nawigacją — bez formularzy i nagłówków sekcji. */
  immersive?: boolean;
};

export default function InteractiveMap({ immersive = false }: Props) {
  const { dict, locale } = useLocale();
  const { formatPinLabel, preference, rate } = useFormatOfferPrice();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});

  const [allOffers, setAllOffers] = useState<any[]>([]);
  const [filteredOffers, setFilteredOffers] = useState<any[]>([]);

  const [transactionMode, setTransactionMode] = useState<"sale" | "rent">("sale");
  const [priceMax, setPriceMax] = useState<number>(50_000_000);
  const [priceMaxRent, setPriceMaxRent] = useState<number>(50_000);

  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [mapInitError, setMapInitError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showTeaser, setShowTeaser] = useState(false);

  const priceLocale = locale === "pl" ? "pl-PL" : "en-US";
  const maxPriceLabel =
    transactionMode === "rent" ? dict.map.maxRentLabel : dict.map.maxPriceLabel;

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as Window & { isLoggedIn?: boolean; triggerTeaser?: () => void }).isLoggedIn =
        isLoggedIn;
      (window as Window & { triggerTeaser?: () => void }).triggerTeaser = () =>
        setShowTeaser(true);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    fetch("/api/user/profile", { credentials: "include" })
      .then((res) => res.json())
      .then((user) => {
        if (user && user.email) setIsLoggedIn(true);
      })
      .catch(() => setIsLoggedIn(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const envToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
    if (envToken) {
      setMapboxToken(envToken);
      return;
    }
    fetch("/api/map/config", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { mapboxToken?: string | null }) => {
        if (cancelled) return;
        const token = String(data?.mapboxToken || "").trim();
        setMapboxToken(token || null);
        if (!token) {
          setMapInitError(
            locale === "pl"
              ? "Brak klucza Mapbox na serwerze (NEXT_PUBLIC_MAPBOX_TOKEN lub MAPBOX_TOKEN)."
              : "Mapbox token missing on server (NEXT_PUBLIC_MAPBOX_TOKEN or MAPBOX_TOKEN).",
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMapInitError(
            locale === "pl"
              ? "Nie udało się pobrać konfiguracji mapy."
              : "Could not load map configuration.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    fetch(`/api/offers?t=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setAllOffers(Array.isArray(data) ? data : []);
      })
      .catch(() => setAllOffers([]));
  }, []);

  useEffect(() => {
    const result = allOffers.filter((o) => {
      if (normalizeTransactionTypeStatic(o.transactionType) !== transactionMode) {
        return false;
      }
      const price = getOfferFilterPrice(o);
      if (transactionMode === "rent") return price <= priceMaxRent;
      return price <= priceMax;
    });
    setFilteredOffers(result);
  }, [transactionMode, priceMax, priceMaxRent, allOffers]);

  const updateMarkers = useCallback(() => {
    if (!map.current) return;
    const newMarkers: Record<string, boolean> = {};
    const features = map.current.queryRenderedFeatures({
      layers: ["clustered-point", "unclustered-point"],
    });

    features.forEach((feature: any) => {
      const coords = feature.geometry.coordinates as [number, number];
      const isCluster = feature.properties.cluster;
      const id = isCluster
        ? `cluster-${feature.properties.cluster_id}`
        : `offer-${feature.properties.id}`;
      newMarkers[id] = true;

      if (!markersRef.current[id]) {
        const outerEl = document.createElement("div");
        outerEl.className = "z-30 relative";
        const innerEl = document.createElement("div");

        if (isCluster) {
          innerEl.className =
            "w-10 h-10 backdrop-blur-2xl border rounded-full flex items-center justify-center font-black text-sm cursor-pointer hover:scale-110 transition-all duration-300 bg-white/10 border-white/20 text-white shadow-[0_10px_30px_rgba(0,0,0,0.5)]";
          innerEl.innerText = feature.properties.point_count;
          innerEl.onclick = (e) => {
            e.stopPropagation();
            const source = map.current!.getSource("offers") as mapboxgl.GeoJSONSource;
            source.getClusterExpansionZoom(
              feature.properties.cluster_id,
              (err, zoom) => {
                if (err || zoom == null) return;
                map.current!.easeTo({ center: coords, zoom: zoom + 2, pitch: 60 });
              },
            );
          };
        } else {
          const offer = filteredOffers.find(
            (o) => String(o.id) === String(feature.properties.id),
          );
          const tx = normalizeTransactionTypeStatic(feature.properties.transactionType);
          innerEl.className = offerPinColorClasses(feature.properties.transactionType);
          innerEl.innerText = offer
            ? formatPinLabel(offer, tx === "rent")
            : "—";
          innerEl.onclick = (e) => {
            e.stopPropagation();
            const win = window as Window & {
              isLoggedIn?: boolean;
              triggerTeaser?: () => void;
            };
            if (win.isLoggedIn) {
              window.location.href = `/oferta/${feature.properties.id}`;
            } else {
              win.triggerTeaser?.();
            }
          };
        }

        outerEl.appendChild(innerEl);
        markersRef.current[id] = new mapboxgl.Marker({ element: outerEl })
          .setLngLat(coords)
          .addTo(map.current!);
      } else if (!isCluster && markersRef.current[id]) {
        const rootEl = markersRef.current[id].getElement();
        const pinEl = rootEl?.firstElementChild as HTMLElement | undefined;
        if (pinEl) {
          const offer = filteredOffers.find(
            (o) => String(o.id) === String(feature.properties.id),
          );
          const tx = normalizeTransactionTypeStatic(feature.properties.transactionType);
          pinEl.className = offerPinColorClasses(feature.properties.transactionType);
          pinEl.innerText = offer
            ? formatPinLabel(offer, tx === "rent")
            : "—";
        }
      }
    });

    for (const id of Object.keys(markersRef.current)) {
      if (!newMarkers[id]) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    }
  }, [filteredOffers, formatPinLabel, preference, rate]);

  useEffect(() => {
    if (!mapboxToken || !mapContainer.current || map.current) return;

    setMapInitError(null);
    mapboxgl.accessToken = mapboxToken;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [21.0122, 52.2297],
      zoom: immersive ? 2.2 : 3,
      pitch: 45,
      bearing: 0,
      antialias: true,
      cooperativeGestures: true,
    });

    const onLoad = () => {
      if (!map.current) return;
      try {
        map.current.resize();
      } catch {
        /* noop */
      }

      try {
        const layers = map.current.getStyle().layers;
        const labelLayerId = layers?.find(
          (layer) => layer.type === "symbol" && layer.layout?.["text-field"],
        )?.id;
        if (labelLayerId) {
          map.current.addLayer(
            {
              id: "3d-buildings",
              source: "composite",
              "source-layer": "building",
              filter: ["==", "extrude", "true"],
              type: "fill-extrusion",
              minzoom: 15,
              paint: {
                "fill-extrusion-color": "#111",
                "fill-extrusion-height": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  15,
                  0,
                  15.05,
                  ["get", "height"],
                ],
                "fill-extrusion-base": [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  15,
                  0,
                  15.05,
                  ["get", "min_height"],
                ],
                "fill-extrusion-opacity": 0.8,
              },
            },
            labelLayerId,
          );
        }
      } catch {
        /* 3D warstwa opcjonalna — kafelki mapy muszą działać bez niej */
      }

      if (!map.current.getSource("offers")) {
        map.current.addSource("offers", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50,
        });
        map.current.addLayer({
          id: "clustered-point",
          type: "circle",
          source: "offers",
          filter: ["has", "point_count"],
          paint: { "circle-radius": 0, "circle-opacity": 0 },
        });
        map.current.addLayer({
          id: "unclustered-point",
          type: "circle",
          source: "offers",
          filter: ["!", ["has", "point_count"]],
          paint: { "circle-radius": 0, "circle-opacity": 0 },
        });
      }

      map.current.on("render", updateMarkers);
      map.current.on("idle", updateMarkers);
      setMapLoaded(true);
    };

    map.current.on("load", onLoad);
    map.current.on("error", (e) => {
      console.error("Mapbox error:", e);
      setMapInitError(
        locale === "pl"
          ? "Mapa nie załadowała się — sprawdź token Mapbox i domenę w panelu Mapbox."
          : "Map failed to load — check Mapbox token and allowed URLs.",
      );
    });

    return () => {
      map.current?.off("load", onLoad);
      map.current?.remove();
      map.current = null;
      setMapLoaded(false);
      markersRef.current = {};
    };
  }, [mapboxToken, immersive, locale, updateMarkers]);

  useEffect(() => {
    if (!map.current?.getSource("offers") || !map.current.isStyleLoaded()) return;

    const features = filteredOffers
      .filter((o) => o.lng != null && o.lat != null)
      .map((offer: any) => ({
        type: "Feature" as const,
        properties: {
          id: offer.id,
          price: offer.price ?? "",
          transactionType: offer.transactionType,
          isPartner: !!offer.badges?.isPartner,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [Number(offer.lng), Number(offer.lat)],
        },
      }));

    const source = map.current.getSource("offers") as mapboxgl.GeoJSONSource;
    source?.setData({ type: "FeatureCollection", features });
    map.current.triggerRepaint();
  }, [filteredOffers, mapLoaded, preference, rate]);

  useEffect(() => {
    const el = mapContainer.current;
    if (!el) return;

    const resize = () => {
      try {
        map.current?.resize();
      } catch {
        /* noop */
      }
    };

    const ro = new ResizeObserver(() => resize());
    ro.observe(el);
    window.addEventListener("resize", resize);
    const t = window.setTimeout(resize, 120);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resize);
      window.clearTimeout(t);
    };
  }, [mapboxToken]);

  const locateUser = () => {
    if (!navigator.geolocation || !map.current) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        map.current!.flyTo({
          center: [longitude, latitude],
          zoom: 13,
          pitch: 60,
          bearing: -20,
          speed: 1.2,
          curve: 1.5,
        });
      },
      () => {
        alert(dict.map.geolocationDenied);
      },
    );
  };

  const saleSliderPct =
    ((priceMax - 100_000) / (50_000_000 - 100_000)) * 100;
  const rentSliderPct = ((priceMaxRent - 1_000) / (100_000 - 1_000)) * 100;
  const sliderAccent = transactionMode === "rent" ? "#3b82f6" : "#10b981";
  const sliderPct = transactionMode === "rent" ? rentSliderPct : saleSliderPct;

  return (
    <div
      className={
        immersive
          ? "relative h-full min-h-0 w-full flex-1 overflow-hidden bg-[#0a0a0a]"
          : "relative mt-10 h-[85vh] min-h-[600px] w-full overflow-hidden border-t border-white/10 bg-[#0a0a0a]"
      }
    >
      <div ref={mapContainer} className="absolute inset-0 z-0 h-full w-full min-h-[280px]" />

      <div className="pointer-events-none absolute inset-0 z-[1] shadow-[inset_0_0_80px_rgba(0,0,0,0.55)]" />

      {mapInitError && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-[#0a0a0a]/95 p-6 text-center">
          <p className="max-w-md text-sm leading-relaxed text-zinc-400">{mapInitError}</p>
        </div>
      )}

      {!mapboxToken && !mapInitError && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-[#0a0a0a] p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            {locale === "pl" ? "Ładowanie mapy…" : "Loading map…"}
          </p>
        </div>
      )}

      <div className="absolute left-1/2 top-4 z-30 flex w-[92%] max-w-lg -translate-x-1/2 flex-col items-center gap-3 sm:top-6 sm:gap-4">
        <div className="flex rounded-full border border-white/10 bg-zinc-900/60 p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-3xl">
          <button
            type="button"
            onClick={() => setTransactionMode("sale")}
            className={`relative flex min-w-[120px] items-center justify-center rounded-full px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
              transactionMode === "sale"
                ? "text-black"
                : "text-emerald-500/50 hover:text-emerald-400"
            }`}
          >
            {transactionMode === "sale" && (
              <motion.div
                layoutId="txTab"
                className="absolute inset-0 z-0 rounded-full bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
              />
            )}
            <span className="relative z-10">{dict.map.forSale}</span>
          </button>
          <button
            type="button"
            onClick={() => setTransactionMode("rent")}
            className={`relative flex min-w-[120px] items-center justify-center rounded-full px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
              transactionMode === "rent"
                ? "text-white"
                : "text-blue-500/50 hover:text-blue-400"
            }`}
          >
            {transactionMode === "rent" && (
              <motion.div
                layoutId="txTab"
                className="absolute inset-0 z-0 rounded-full bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.4)]"
              />
            )}
            <span className="relative z-10">{dict.map.forRent}</span>
          </button>
        </div>

        <div className="flex w-full items-center gap-4 rounded-3xl border border-white/10 bg-zinc-900/60 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-3xl sm:p-5">
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                {maxPriceLabel}
              </span>
              <span className="text-xs font-black tracking-wider text-white">
                {new Intl.NumberFormat(priceLocale, {
                  style: "currency",
                  currency: "PLN",
                  maximumFractionDigits: 0,
                }).format(transactionMode === "rent" ? priceMaxRent : priceMax)}
              </span>
            </div>
            <input
              type="range"
              min={transactionMode === "rent" ? 1000 : 100_000}
              max={transactionMode === "rent" ? 100_000 : 50_000_000}
              step={transactionMode === "rent" ? 500 : 100_000}
              value={transactionMode === "rent" ? priceMaxRent : priceMax}
              onChange={(e) =>
                transactionMode === "rent"
                  ? setPriceMaxRent(Number(e.target.value))
                  : setPriceMax(Number(e.target.value))
              }
              aria-label={maxPriceLabel}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 outline-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_15px_rgba(255,255,255,0.5)]"
              style={{
                background: `linear-gradient(to right, ${sliderAccent} 0%, ${sliderAccent} ${sliderPct}%, rgba(255,255,255,0.1) ${sliderPct}%, rgba(255,255,255,0.1) 100%)`,
              }}
            />
          </div>

          <div className="mx-1 h-10 w-px bg-white/10" />

          <button
            type="button"
            onClick={locateUser}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all hover:border-white/30 hover:bg-white/10 active:scale-95"
            title={dict.map.locateMe}
            aria-label={dict.map.locateMe}
          >
            <LocateFixed className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showTeaser && (
          <motion.div
            data-lenis-prevent
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999999] flex items-center justify-center overflow-hidden bg-black/80 p-4 backdrop-blur-xl sm:p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative max-h-[calc(100svh-2rem)] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-white/10 bg-zinc-950 p-6 text-center shadow-[0_0_100px_rgba(0,0,0,1)] sm:p-10"
            >
              <button
                type="button"
                onClick={() => setShowTeaser(false)}
                className="absolute right-8 top-8 text-white/20 transition-colors hover:text-white"
              >
                ✕
              </button>

              <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-500/20 bg-emerald-500/10 shadow-[inset_0_0_20px_rgba(16,185,129,0.2)]">
                <Lock className="text-emerald-500" size={32} />
              </div>

              <h2 className="mb-4 text-3xl font-black tracking-tighter text-white">
                <span className="text-emerald-400">{dict.map.teaserTitleHighlight}</span>{" "}
                {dict.map.teaserTitle}
              </h2>
              <p className="mb-10 text-sm font-medium leading-relaxed text-zinc-400">
                {dict.map.teaserBody}
              </p>

              <div className="flex flex-col gap-3">
                <Link
                  href="/login"
                  className="btn-action rounded-full py-4 text-[11px] font-black uppercase tracking-widest shadow-[0_10px_30px_rgba(16,185,129,0.3)]"
                >
                  {dict.map.teaserLogin}
                </Link>
                <button
                  type="button"
                  onClick={() => setShowTeaser(false)}
                  className="py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 transition-colors hover:text-white"
                >
                  {dict.map.teaserBack}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
