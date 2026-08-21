"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Hand, Lock, LocateFixed, Maximize2, MousePointer2, Move, ZoomIn } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import LuxurySegmentSwitch from "@/components/ui/LuxurySegmentSwitch";
import { useLocale } from "@/contexts/LocaleContext";
import { useEcosystem } from "@/contexts/EcosystemContext";
import { numberFormatLocale } from "@/i18n/config";
import { useTheme } from "@/contexts/ThemeContext";
import { useFormatOfferPrice } from "@/hooks/useFormatOfferPrice";
import { useDisplayCurrency } from "@/contexts/DisplayCurrencyContext";
import {
  normalizeTransactionType,
  transactionModeFromOffers,
} from "@/lib/transactionType";
import { useIntelligencePreference } from "@/contexts/IntelligencePreferenceContext";

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

const OFFER_PIN_BASE =
  "px-4 py-2 backdrop-blur-2xl border text-[11px] font-black tracking-widest rounded-full cursor-pointer transition-all duration-300 ease-out";

const OFFERS_SOURCE_ID = "offers";
const CLUSTER_LAYER_ID = "clustered-point";
const UNCLUSTER_LAYER_ID = "unclustered-point";

function clusterBubbleDimensions(points: number) {
  if (points >= 50) return { diameter: 64, halo: 82, fontSize: 19 };
  if (points >= 25) return { diameter: 58, halo: 76, fontSize: 18 };
  if (points >= 15) return { diameter: 54, halo: 72, fontSize: 17 };
  if (points >= 10) return { diameter: 50, halo: 68, fontSize: 17 };
  if (points >= 8) return { diameter: 46, halo: 62, fontSize: 16 };
  if (points >= 4) return { diameter: 42, halo: 56, fontSize: 16 };
  return { diameter: 38, halo: 52, fontSize: 15 };
}

function formatClusterCount(n: number) {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

function clusterAccentHex(mode: "sale" | "rent") {
  return mode === "rent" ? "#2563eb" : "#10b981";
}

function buildClusterMarkerElement(
  count: number,
  accent: string,
  onActivate: () => void,
): HTMLDivElement {
  const { diameter, halo, fontSize } = clusterBubbleDimensions(count);
  const outer = document.createElement("div");
  outer.className = "relative z-30 flex items-center justify-center cursor-pointer";
  outer.style.width = `${halo}px`;
  outer.style.height = `${halo}px`;

  const haloEl = document.createElement("div");
  haloEl.className = "absolute rounded-full";
  haloEl.style.width = `${halo}px`;
  haloEl.style.height = `${halo}px`;
  haloEl.style.background = `radial-gradient(circle, ${accent}66 0%, ${accent}22 55%, transparent 72%)`;

  const disk = document.createElement("div");
  disk.className =
    "relative flex items-center justify-center rounded-full border-2 border-white/90 font-black text-white tabular-nums transition-transform duration-300 hover:scale-110 active:scale-95";
  disk.style.width = `${diameter}px`;
  disk.style.height = `${diameter}px`;
  disk.style.fontSize = `${fontSize}px`;
  disk.style.background = `linear-gradient(145deg, ${accent} 0%, ${accent}dd 100%)`;
  disk.style.boxShadow = `0 8px 28px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.35)`;
  disk.textContent = formatClusterCount(count);
  disk.onclick = (e) => {
    e.stopPropagation();
    onActivate();
  };

  outer.appendChild(haloEl);
  outer.appendChild(disk);
  return outer;
}

function ensureOffersClusterLayers(mapInstance: mapboxgl.Map) {
  if (!mapInstance.getSource(OFFERS_SOURCE_ID)) {
    mapInstance.addSource(OFFERS_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 56,
    });
  }
  if (!mapInstance.getLayer(CLUSTER_LAYER_ID)) {
    mapInstance.addLayer({
      id: CLUSTER_LAYER_ID,
      type: "circle",
      source: OFFERS_SOURCE_ID,
      filter: ["has", "point_count"],
      paint: { "circle-radius": 0, "circle-opacity": 0 },
    });
  }
  if (!mapInstance.getLayer(UNCLUSTER_LAYER_ID)) {
    mapInstance.addLayer({
      id: UNCLUSTER_LAYER_ID,
      type: "circle",
      source: OFFERS_SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      paint: { "circle-radius": 0, "circle-opacity": 0 },
    });
  }
}

function syncOffersGeoJson(mapInstance: mapboxgl.Map, offers: any[]) {
  const source = mapInstance.getSource(OFFERS_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
  if (!source) return;
  const features = offers
    .filter((offer) => offer.lng != null && offer.lat != null)
    .map((offer) => ({
      type: "Feature" as const,
      properties: {
        id: offer.id,
        transactionType: offer.transactionType,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [Number(offer.lng), Number(offer.lat)] as [number, number],
      },
    }));
  source.setData({ type: "FeatureCollection", features });
}

function offerPinColorClasses(transactionType: unknown) {
  const tx = normalizeTransactionType(transactionType);

  if (tx === "rent") {
    return `${OFFER_PIN_BASE} bg-blue-500/80 text-white border-blue-400/40 hover:bg-blue-400 hover:scale-110 shadow-[0_10px_30px_rgba(59,130,246,0.3)]`;
  }

  return `${OFFER_PIN_BASE} bg-emerald-500/80 text-black border-emerald-400/40 hover:bg-emerald-400 hover:scale-110 shadow-[0_10px_30px_rgba(16,185,129,0.3)]`;
}

const AFFINITY_PIN_GLOW =
  " ring-2 ring-white/70 shadow-[0_0_28px_rgba(255,255,255,0.35),0_10px_30px_rgba(16,185,129,0.35)] scale-[1.04]";

function resolveOfferPinClass(
  offer: { transactionType?: unknown; mapKind?: string },
  mapMarket: "home" | "car",
  affinity: boolean,
) {
  const base =
    mapMarket === "car" || offer.mapKind === "car"
      ? `${OFFER_PIN_BASE} bg-sky-500/85 text-white border-sky-300/45 hover:bg-sky-400 hover:scale-110 shadow-[0_10px_30px_rgba(14,165,233,0.35)]`
      : offerPinColorClasses(offer.transactionType);
  return affinity ? `${base}${AFFINITY_PIN_GLOW}` : base;
}

type Props = {
  /** Pełny ekran pod nawigacją — bez formularzy i nagłówków sekcji. */
  immersive?: boolean;
};

const MAP_STYLE = {
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
} as const;

function distributeOverlappingPins(offers: any[]) {
  const byCoord = new Map<string, any[]>();
  offers.forEach((offer) => {
    const lng = Number(offer?.lng);
    const lat = Number(offer?.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    const key = `${lng.toFixed(6)}:${lat.toFixed(6)}`;
    const arr = byCoord.get(key) || [];
    arr.push(offer);
    byCoord.set(key, arr);
  });

  const out = new Map<number, [number, number]>();
  byCoord.forEach((arr) => {
    const sorted = [...arr].sort((a, b) => Number(a.id) - Number(b.id));
    if (sorted.length === 1) {
      const o = sorted[0];
      out.set(Number(o.id), [Number(o.lng), Number(o.lat)]);
      return;
    }
    // Rozstawienie po okręgu: pin-y nie nakładają się na siebie przy tym samym adresie.
    const ringStepMeters = 18;
    const centerLng = Number(sorted[0].lng);
    const centerLat = Number(sorted[0].lat);
    const latMeters = 111_320;
    const lngMeters = 111_320 * Math.cos((centerLat * Math.PI) / 180);
    sorted.forEach((offer, idx) => {
      const angle = (2 * Math.PI * idx) / sorted.length;
      const radiusMeters = ringStepMeters * (1 + Math.floor(idx / 10));
      const dLat = (Math.sin(angle) * radiusMeters) / latMeters;
      const dLng = lngMeters !== 0 ? (Math.cos(angle) * radiusMeters) / lngMeters : 0;
      out.set(Number(offer.id), [centerLng + dLng, centerLat + dLat]);
    });
  });
  return out;
}

function normalizeCarForMap(car: any) {
  const lat = Number(car?.cityLat ?? car?.lat);
  const lng = Number(car?.cityLng ?? car?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const pricePln = Number(car?.pricePln || 0);
  return {
    ...car,
    id: Number(car.id),
    lat,
    lng,
    price: pricePln,
    pricePln,
    transactionType: "sale",
    mapKind: "car" as const,
    vehicleType: String(car?.vehicleType || "car").trim() || "car",
  };
}

export default function InteractiveMap({ immersive = false }: Props) {
  const { dict, locale } = useLocale();
  const { isCar } = useEcosystem();
  const { resolvedTheme } = useTheme();
  const { preference, setPreference } = useDisplayCurrency();
  const { formatPinLabel, rate } = useFormatOfferPrice();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const appliedMapTheme = useRef<"light" | "dark" | null>(null);
  const updateMarkersRef = useRef<() => void>(() => {});
  const autoRotateFrameRef = useRef<number | null>(null);
  const lastInteractionAtRef = useRef<number>(Date.now());
  const hoverFocusActiveRef = useRef(false);
  const canHoverRef = useRef(false);
  
  const [allOffers, setAllOffers] = useState<any[]>([]);
  const [filteredOffers, setFilteredOffers] = useState<any[]>([]);
  
  const [mapMarket, setMapMarket] = useState<"home" | "car">(isCar ? "car" : "home");
  const [vehicleKind, setVehicleKind] = useState<"car" | "motorcycle">("car");
  const [transactionMode, setTransactionMode] = useState<"sale" | "rent">("sale");
  const [priceMax, setPriceMax] = useState<number>(50_000_000);
  const [priceMaxRent, setPriceMaxRent] = useState<number>(50_000);
  const [priceMaxUi, setPriceMaxUi] = useState<number>(50_000_000);
  const [priceMaxRentUi, setPriceMaxRentUi] = useState<number>(50_000);
  const [priceMaxCar, setPriceMaxCar] = useState<number>(5_000_000);
  const [priceMaxCarUi, setPriceMaxCarUi] = useState<number>(5_000_000);

  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [mapInitError, setMapInitError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showTeaser, setShowTeaser] = useState(false);
  const [activeHoverPinId, setActiveHoverPinId] = useState<number | null>(null);
  const [showMapGuide, setShowMapGuide] = useState(false);
  const [forYouIds, setForYouIds] = useState<Set<number>>(() => new Set());
  const sliderChangingRef = useRef(false);
  const { enabled: intelligenceEnabled } = useIntelligencePreference();

  const priceLocale = numberFormatLocale(locale);
  const maxPriceLabel =
    transactionMode === "rent" ? dict.map.maxRentLabel : dict.map.maxPriceLabel;
  const isEurDisplay = preference === "EUR";
  const safeRate = rate > 0 ? rate : 4.32;

  const saleBounds = {
    minPln: 100_000,
    maxPln: 50_000_000,
    stepPln: 100_000,
  };
  const rentBounds = {
    minPln: 1_000,
    maxPln: 100_000,
    stepPln: 500,
  };
  const carBounds = {
    minPln: 1_000,
    maxPln: 5_000_000,
    stepPln: 1_000,
  };

  const saleUiMin = isEurDisplay ? Math.round(saleBounds.minPln / safeRate) : saleBounds.minPln;
  const saleUiMax = isEurDisplay ? Math.round(saleBounds.maxPln / safeRate) : saleBounds.maxPln;
  const saleUiStep = Math.max(
    1,
    isEurDisplay ? Math.round(saleBounds.stepPln / safeRate) : saleBounds.stepPln,
  );
  const rentUiMin = isEurDisplay ? Math.round(rentBounds.minPln / safeRate) : rentBounds.minPln;
  const rentUiMax = isEurDisplay ? Math.round(rentBounds.maxPln / safeRate) : rentBounds.maxPln;
  const rentUiStep = Math.max(
    1,
    isEurDisplay ? Math.round(rentBounds.stepPln / safeRate) : rentBounds.stepPln,
  );
  const carUiMin = isEurDisplay ? Math.round(carBounds.minPln / safeRate) : carBounds.minPln;
  const carUiMax = isEurDisplay ? Math.round(carBounds.maxPln / safeRate) : carBounds.maxPln;
  const carUiStep = Math.max(
    1,
    isEurDisplay ? Math.round(carBounds.stepPln / safeRate) : carBounds.stepPln,
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as Window & { isLoggedIn?: boolean; triggerTeaser?: () => void }).isLoggedIn =
        isLoggedIn;
      (window as Window & { triggerTeaser?: () => void }).triggerTeaser = () =>
        setShowTeaser(true);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    canHoverRef.current = window.matchMedia("(hover: hover)").matches;
    const dismissed = window.sessionStorage.getItem("estateos_map_guide_dismissed");
    setShowMapGuide(dismissed !== "1");
  }, []);

  const focusPin = useCallback((offerId: number, coords: [number, number]) => {
    if (!map.current || !canHoverRef.current) return;
    if (!Number.isFinite(offerId)) return;
    hoverFocusActiveRef.current = true;
    setActiveHoverPinId(offerId);
    lastInteractionAtRef.current = Date.now();
    map.current.flyTo({
      center: coords,
      zoom: 16.2,
      pitch: 58,
      bearing: -12,
      speed: 0.42,
      curve: 1.42,
      essential: true,
    });
  }, []);

  useEffect(() => {
    setMapMarket(isCar ? "car" : "home");
  }, [isCar]);

  useEffect(() => {
    fetch("/api/user/profile", { credentials: "include" })
      .then((res) => res.json())
      .then((user) => {
        if (user && user.email) setIsLoggedIn(true);
      })
      .catch(() => setIsLoggedIn(false));
  }, []);

  useEffect(() => {
    if (!isLoggedIn || mapMarket === "car" || !intelligenceEnabled) {
      setForYouIds(new Set());
      return;
    }
    let cancelled = false;
    const tx = transactionMode === "rent" ? "RENT" : "SALE";
    void fetch(`/api/discovery/for-you?limit=24&transaction=${tx}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (res) => {
        if (res.status === 401 || !res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data?.items?.length) {
          if (!cancelled) setForYouIds(new Set());
          return;
        }
        const next = new Set<number>();
        for (const item of data.items) {
          const id = Number(item.offerId ?? item.id);
          if (Number.isFinite(id) && id > 0) next.add(id);
        }
        setForYouIds(next);
      })
      .catch(() => {
        if (!cancelled) setForYouIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, mapMarket, transactionMode, intelligenceEnabled]);

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
          setMapInitError(dict.map.tokenMissing);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMapInitError(dict.map.configError);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (mapMarket === "car") {
          const res = await fetch(`/api/cars?t=${Date.now()}`, { cache: "no-store" });
          const data = await res.json().catch(() => []);
          const raw = Array.isArray(data) ? data : Array.isArray(data?.cars) ? data.cars : [];
          const list = raw.map(normalizeCarForMap).filter(Boolean);
          if (!cancelled) setAllOffers(list);
          return;
        }
        const res = await fetch(`/api/offers?t=${Date.now()}`, { cache: "no-store" });
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        if (cancelled) return;
        setAllOffers(list);
        if (list.length > 0) {
          setTransactionMode(transactionModeFromOffers(list));
        }
      } catch {
        if (!cancelled) setAllOffers([]);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [mapMarket]);

  useEffect(() => {
    const result = allOffers.filter((o) => {
      if (mapMarket === "car") {
        const kind = String(o.vehicleType || "car");
        if (kind !== vehicleKind) return false;
        return getOfferFilterPrice(o) <= priceMaxCar;
      }
      if (normalizeTransactionType(o.transactionType) !== transactionMode) {
        return false;
      }
      const price = getOfferFilterPrice(o);
      if (transactionMode === "rent") return price <= priceMaxRent;
      return price <= priceMax;
    });
    setFilteredOffers(result);
  }, [mapMarket, vehicleKind, transactionMode, priceMax, priceMaxRent, priceMaxCar, allOffers]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPriceMax(isEurDisplay ? Math.round(priceMaxUi * safeRate) : priceMaxUi);
      setPriceMaxRent(isEurDisplay ? Math.round(priceMaxRentUi * safeRate) : priceMaxRentUi);
      setPriceMaxCar(isEurDisplay ? Math.round(priceMaxCarUi * safeRate) : priceMaxCarUi);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [priceMaxUi, priceMaxRentUi, priceMaxCarUi, isEurDisplay, safeRate]);

  useEffect(() => {
    if (isEurDisplay) {
      setPriceMaxUi(Math.round(priceMax / safeRate));
      setPriceMaxRentUi(Math.round(priceMaxRent / safeRate));
      setPriceMaxCarUi(Math.round(priceMaxCar / safeRate));
      return;
    }
    setPriceMaxUi(priceMax);
    setPriceMaxRentUi(priceMaxRent);
    setPriceMaxCarUi(priceMaxCar);
  }, [isEurDisplay, priceMax, priceMaxRent, priceMaxCar, safeRate]);

  const updateMarkers = useCallback(() => {
    if (!map.current) return;
    if (!map.current.getLayer(CLUSTER_LAYER_ID)) return;

    const mapInstance = map.current;
    const offerById = new Map(filteredOffers.map((offer) => [String(offer.id), offer]));
    const distributed = distributeOverlappingPins(filteredOffers);
    const newMarkers: Record<string, boolean> = {};
    const accent = mapMarket === "car" ? "#0ea5e9" : clusterAccentHex(transactionMode);

    const rendered = mapInstance.queryRenderedFeatures({
      layers: [CLUSTER_LAYER_ID, UNCLUSTER_LAYER_ID],
    });

    for (const feature of rendered) {
      if (feature.geometry.type !== "Point") continue;
      const renderCoords = feature.geometry.coordinates as [number, number];
      const props = feature.properties ?? {};
      const isCluster = Boolean(props.cluster);
      const markerId = isCluster ? `cluster-${props.cluster_id}` : `offer-${props.id}`;
      if (newMarkers[markerId]) continue;
      newMarkers[markerId] = true;

      if (isCluster) {
        const count = Number(props.point_count) || 0;
        if (!markersRef.current[markerId]) {
          const clusterEl = buildClusterMarkerElement(count, accent, () => {
            const source = mapInstance.getSource(OFFERS_SOURCE_ID) as mapboxgl.GeoJSONSource;
            source.getClusterExpansionZoom(Number(props.cluster_id), (err, zoom) => {
              if (err || !map.current || zoom == null) return;
              mapInstance.easeTo({ center: renderCoords, zoom: zoom + 0.5, duration: 650, essential: true });
            });
          });
          markersRef.current[markerId] = new mapboxgl.Marker({ element: clusterEl })
            .setLngLat(renderCoords)
            .addTo(mapInstance);
        } else {
          markersRef.current[markerId].setLngLat(renderCoords);
          const disk = markersRef.current[markerId].getElement()?.lastElementChild as
            | HTMLElement
            | undefined;
          if (disk) disk.textContent = formatClusterCount(count);
        }
        continue;
      }

      const offer = offerById.get(String(props.id));
      if (!offer) continue;

      const coords: [number, number] =
        distributed.get(Number(offer.id)) || [Number(offer.lng), Number(offer.lat)];

      if (!markersRef.current[markerId]) {
        const outerEl = document.createElement("div");
        outerEl.className = "z-30 relative";
        const innerEl = document.createElement("div");
        const tx = normalizeTransactionType(offer.transactionType);
        const affinity = forYouIds.has(Number(offer.id));
        innerEl.className = resolveOfferPinClass(offer, mapMarket, affinity);
        innerEl.innerText = formatPinLabel(offer, tx === "rent");
          innerEl.onclick = (e) => {
            e.stopPropagation();
          const win = window as Window & {
            isLoggedIn?: boolean;
            triggerTeaser?: () => void;
          };
          if (win.isLoggedIn) {
            window.location.href = mapMarket === "car" || offer.mapKind === "car"
              ? `/cars/${offer.id}`
              : `/oferta/${offer.id}`;
          } else {
            win.triggerTeaser?.();
          }
        };
        innerEl.onmouseenter = () => {
          if (sliderChangingRef.current) return;
          focusPin(Number(offer.id), coords);
        };
        innerEl.onmouseover = innerEl.onmouseenter;
        innerEl.onmouseleave = () => {
          if (!canHoverRef.current) return;
          hoverFocusActiveRef.current = false;
          setActiveHoverPinId((prev) => (prev === Number(offer.id) ? null : prev));
        };

        outerEl.appendChild(innerEl);
        markersRef.current[markerId] = new mapboxgl.Marker({ element: outerEl })
          .setLngLat(coords)
          .addTo(mapInstance);
        } else {
        markersRef.current[markerId].setLngLat(coords);
        const rootEl = markersRef.current[markerId].getElement();
        const pinEl = rootEl?.firstElementChild as HTMLElement | undefined;
        if (pinEl) {
          const tx = normalizeTransactionType(offer.transactionType);
          const affinity = forYouIds.has(Number(offer.id));
          pinEl.className = resolveOfferPinClass(offer, mapMarket, affinity);
          pinEl.innerText = formatPinLabel(offer, mapMarket === "car" ? false : tx === "rent");
          pinEl.onmouseenter = () => {
            if (sliderChangingRef.current) return;
            focusPin(Number(offer.id), coords);
          };
          pinEl.onmouseover = pinEl.onmouseenter;
          pinEl.onmouseleave = () => {
            if (!canHoverRef.current) return;
            hoverFocusActiveRef.current = false;
            setActiveHoverPinId((prev) => (prev === Number(offer.id) ? null : prev));
          };
        }
      }
    }

    for (const id of Object.keys(markersRef.current)) {
      if (!newMarkers[id]) {
        const rootEl = markersRef.current[id].getElement();
        const pinEl = rootEl?.firstElementChild as HTMLElement | undefined;
        if (pinEl) {
          pinEl.onmouseenter = null;
          pinEl.onmouseover = null;
          pinEl.onmouseleave = null;
        }
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    }
  }, [filteredOffers, focusPin, formatPinLabel, forYouIds, transactionMode, mapMarket]);

  useEffect(() => {
    updateMarkersRef.current = updateMarkers;
  }, [updateMarkers]);

  useEffect(() => {
    if (!mapboxToken || !mapContainer.current || map.current) return;

    setMapInitError(null);
    mapboxgl.accessToken = mapboxToken;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_STYLE[resolvedTheme],
      center: [21.0122, 52.2297],
      zoom: immersive ? 2.2 : 3,
      pitch: 45,
      bearing: 0,
      antialias: true,
      cooperativeGestures: true,
    });

    const onLoad = () => {
      if (!map.current) return;
      appliedMapTheme.current = resolvedTheme;
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

      ensureOffersClusterLayers(map.current);
      syncOffersGeoJson(map.current, filteredOffers);
      setMapLoaded(true);
    };

    map.current.on("load", onLoad);
    map.current.on("error", (e) => {
      console.error("Mapbox error:", e);
      setMapInitError(dict.map.loadError);
    });

    return () => {
      map.current?.off("load", onLoad);
      map.current?.remove();
      map.current = null;
      setMapLoaded(false);
      markersRef.current = {};
    };
  }, [mapboxToken, immersive, locale, resolvedTheme]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    if (appliedMapTheme.current === resolvedTheme) return;
    appliedMapTheme.current = resolvedTheme;
    const nextStyle = MAP_STYLE[resolvedTheme];
    try {
      map.current.setStyle(nextStyle);
      map.current.once("style.load", () => {
        if (!map.current) return;
        ensureOffersClusterLayers(map.current);
        syncOffersGeoJson(map.current, filteredOffers);
        updateMarkersRef.current();
      });
    } catch {
      /* noop */
    }
  }, [resolvedTheme, mapLoaded, filteredOffers]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    ensureOffersClusterLayers(map.current);
    syncOffersGeoJson(map.current, filteredOffers);
    map.current.triggerRepaint();
  }, [filteredOffers, mapLoaded]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const handler = () => updateMarkersRef.current();
    map.current.on("render", handler);
    map.current.on("idle", handler);
    handler();
    return () => {
      map.current?.off("render", handler);
      map.current?.off("idle", handler);
    };
  }, [mapLoaded, updateMarkers]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const mapInstance = map.current;

    const markInteraction = () => {
      lastInteractionAtRef.current = Date.now();
    };

    mapInstance.on("dragstart", markInteraction);
    mapInstance.on("zoomstart", markInteraction);
    mapInstance.on("rotatestart", markInteraction);
    mapInstance.on("pitchstart", markInteraction);
    mapInstance.on("mousedown", markInteraction);
    mapInstance.on("touchstart", markInteraction);
    mapInstance.on("wheel", markInteraction);

    const spin = () => {
      if (!map.current) return;
      if (!hoverFocusActiveRef.current) {
        const now = Date.now();
        const idleForMs = now - lastInteractionAtRef.current;
        const zoom = map.current.getZoom();
        if (idleForMs > 1600 && zoom <= 4.8) {
          map.current.setBearing(map.current.getBearing() + 0.03);
        }
      }
      autoRotateFrameRef.current = window.requestAnimationFrame(spin);
    };
    autoRotateFrameRef.current = window.requestAnimationFrame(spin);

    return () => {
      mapInstance.off("dragstart", markInteraction);
      mapInstance.off("zoomstart", markInteraction);
      mapInstance.off("rotatestart", markInteraction);
      mapInstance.off("pitchstart", markInteraction);
      mapInstance.off("mousedown", markInteraction);
      mapInstance.off("touchstart", markInteraction);
      mapInstance.off("wheel", markInteraction);
      if (autoRotateFrameRef.current) {
        window.cancelAnimationFrame(autoRotateFrameRef.current);
        autoRotateFrameRef.current = null;
      }
    };
  }, [mapLoaded]);

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
    ((priceMaxUi - saleUiMin) / Math.max(1, saleUiMax - saleUiMin)) * 100;
  const rentSliderPct =
    ((priceMaxRentUi - rentUiMin) / Math.max(1, rentUiMax - rentUiMin)) * 100;
  const carSliderPct =
    ((priceMaxCarUi - carUiMin) / Math.max(1, carUiMax - carUiMin)) * 100;
  const sliderAccent =
    mapMarket === "car" ? "#0ea5e9" : transactionMode === "rent" ? "#3b82f6" : "#10b981";
  const sliderPct =
    mapMarket === "car" ? carSliderPct : transactionMode === "rent" ? rentSliderPct : saleSliderPct;
  const activeMaxLabel =
    mapMarket === "car"
      ? dict.map.maxPriceLabel
      : transactionMode === "rent"
        ? dict.map.maxRentLabel
        : dict.map.maxPriceLabel;
  const activeMaxUi = mapMarket === "car" ? priceMaxCarUi : transactionMode === "rent" ? priceMaxRentUi : priceMaxUi;

  return (
    <div
      className={
        immersive
          ? "interactive-map-shell relative h-full min-h-0 w-full flex-1 overflow-hidden bg-[var(--eos-bg)]"
          : "interactive-map-shell relative mt-10 h-[85vh] min-h-[600px] w-full overflow-hidden border-t border-[var(--eos-border)] bg-[var(--eos-bg)]"
      }
    >
      <div ref={mapContainer} className="absolute inset-0 z-0 h-full w-full min-h-[280px]" />

      <div className="interactive-map-galaxy pointer-events-none absolute inset-0 z-[1]" />
      <div className="interactive-map-vignette pointer-events-none absolute inset-0 z-[1]" />

      {/* For You affinity stays on pins only — ambient copy lives on DiscoveryPulse. */}

      {showMapGuide && (
        <motion.aside
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-6 left-4 z-30 w-[min(92vw,360px)] rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)]/90 p-4 shadow-[var(--eos-shadow-soft)] backdrop-blur-2xl sm:left-6 sm:p-5"
        >
          <button
            type="button"
            onClick={() => {
              setShowMapGuide(false);
              if (typeof window !== "undefined") {
                window.sessionStorage.setItem("estateos_map_guide_dismissed", "1");
              }
            }}
            className="absolute right-3 top-3 text-xs font-black uppercase tracking-widest text-[var(--eos-muted)] transition-colors hover:text-[var(--eos-text)]"
          >
            {dict.map.guideOk}
          </button>
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--eos-muted)]">
            {dict.map.guideTitle}
          </p>
          <div className="space-y-2 text-xs text-[var(--eos-text)]/90">
            <div className="flex items-center gap-2">
              <Move className="h-4 w-4 text-emerald-400" />
              <span>{dict.map.guidePan}</span>
                </div>
            <div className="flex items-center gap-2">
              <Hand className="h-4 w-4 text-emerald-400" />
              <span>{dict.map.guidePinch}</span>
              </div>
            <div className="flex items-center gap-2">
              <MousePointer2 className="h-4 w-4 text-emerald-400" />
              <span>{dict.map.guideHoverZoom}</span>
                </div>
              </div>
        </motion.aside>
      )}

      <div className="pointer-events-none absolute bottom-6 right-4 z-20 flex items-center gap-2 rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)]/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)] backdrop-blur-xl sm:right-6">
        <ZoomIn className={`h-3.5 w-3.5 ${activeHoverPinId ? "text-emerald-400" : "text-[var(--eos-muted)]"}`} />
        <span>{activeHoverPinId ? dict.map.hoverZoomActive : dict.map.hoverZoomHint}</span>
      </div>
      <div className="absolute bottom-16 right-4 z-20 flex flex-col items-end gap-2 sm:right-6">
        {!immersive ? (
          <Link
            href="/odkryj-mape"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)]/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--eos-text)] transition-colors hover:border-emerald-400/40 hover:text-emerald-400"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            {dict.map.openFullMap}
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => setShowMapGuide(true)}
          className="rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)]/85 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)] transition-colors hover:text-[var(--eos-text)]"
        >
          {dict.map.guideButton}
        </button>
      </div>

      {mapInitError && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-[var(--eos-bg)]/95 p-6 text-center">
          <p className="max-w-md text-sm leading-relaxed text-[var(--eos-muted)]">{mapInitError}</p>
                </div>
      )}

      {!mapboxToken && !mapInitError && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-[var(--eos-bg)] p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--eos-muted)]">
            {dict.addOffer.mapLoading}
          </p>
              </div>
      )}

      <div className="absolute left-1/2 top-4 z-30 flex w-[92%] max-w-lg -translate-x-1/2 flex-col items-center gap-3 sm:top-6 sm:gap-4">
        <LuxurySegmentSwitch
          ariaLabel={dict.map.market}
          value={mapMarket}
          onChange={setMapMarket}
          options={[
            { value: "home", label: dict.map.marketHome, accent: "home" },
            { value: "car", label: dict.map.marketCar, accent: "car" },
          ]}
        />

        {mapMarket === "car" ? (
          <LuxurySegmentSwitch
            ariaLabel={dict.map.type}
            value={vehicleKind}
            onChange={setVehicleKind}
            accent="car"
            options={[
              { value: "car", label: dict.map.carsCars, accent: "car" },
              { value: "motorcycle", label: dict.map.carsMotorcycles, accent: "car" },
            ]}
          />
        ) : (
          <LuxurySegmentSwitch
            ariaLabel={dict.map.type}
            value={transactionMode}
            onChange={setTransactionMode}
            options={[
              { value: "sale", label: dict.map.forSale, accent: "home" },
              { value: "rent", label: dict.map.forRent, accent: "rent" },
            ]}
          />
        )}

        <div className="eos-lux-map-lamp interactive-map-controls flex w-full items-center gap-3 p-3.5 sm:gap-4 sm:p-4">
          <div className="flex flex-1 flex-col gap-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">
                {activeMaxLabel}
              </span>
              <span className="text-xs font-black tracking-wider text-[var(--eos-text)]">
                {new Intl.NumberFormat(priceLocale, {
                  style: "currency",
                  currency: isEurDisplay ? "EUR" : "PLN",
                  maximumFractionDigits: 0,
                }).format(activeMaxUi)}
              </span>
            </div>
            <input
              type="range"
              min={mapMarket === "car" ? carUiMin : transactionMode === "rent" ? rentUiMin : saleUiMin}
              max={mapMarket === "car" ? carUiMax : transactionMode === "rent" ? rentUiMax : saleUiMax}
              step={mapMarket === "car" ? carUiStep : transactionMode === "rent" ? rentUiStep : saleUiStep}
              value={activeMaxUi}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (mapMarket === "car") setPriceMaxCarUi(next);
                else if (transactionMode === "rent") setPriceMaxRentUi(next);
                else setPriceMaxUi(next);
              }}
              onMouseDown={() => {
                sliderChangingRef.current = true;
                hoverFocusActiveRef.current = false;
              }}
              onMouseUp={() => {
                sliderChangingRef.current = false;
                lastInteractionAtRef.current = Date.now();
              }}
              onTouchStart={() => {
                sliderChangingRef.current = true;
                hoverFocusActiveRef.current = false;
              }}
              onTouchEnd={() => {
                sliderChangingRef.current = false;
                lastInteractionAtRef.current = Date.now();
              }}
              aria-label={activeMaxLabel}
              className="eos-lux-range"
              style={{
                background: `linear-gradient(to right, ${sliderAccent} 0%, ${sliderAccent} ${sliderPct}%, rgba(26,27,30,0.1) ${sliderPct}%, rgba(26,27,30,0.1) 100%)`,
              }}
            />
          </div>

          <div className="mx-0.5 h-9 w-px shrink-0 bg-[rgba(196,163,90,0.28)]" />

          <LuxurySegmentSwitch
            size="sm"
            ariaLabel="Waluta"
            accent="platinum"
            value={isEurDisplay ? "EUR" : "PLN"}
            onChange={(code) => setPreference(code)}
            options={[
              { value: "PLN", label: "PLN", accent: "platinum" },
              { value: "EUR", label: "EUR", accent: "platinum" },
            ]}
          />

          <button
            type="button"
            onClick={locateUser}
            className="eos-lux-map-locate"
            title={dict.map.locateMe}
            aria-label={dict.map.locateMe}
          >
            <LocateFixed className="h-5 w-5" />
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
