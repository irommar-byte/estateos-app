"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Building2, SlidersHorizontal, MapPin, Maximize, Lock, Eye, CalendarDays, Handshake, MessageSquare, Home } from "lucide-react";
import OffMarketModal from "@/components/OffMarketModal";
import { AnimatePresence, motion } from "framer-motion";
import { canonicalizeCity } from "@/lib/location/locationCatalog";

/** Zgodnie z `dodaj-oferte/ClientForm` (enum Prisma ↔ etykiety w aplikacji). */
const EMPTY_DISTRICTS: string[] = [];

const MAP_PROPERTY_TYPES = [
  { id: "FLAT", label: "Mieszkanie" },
  { id: "HOUSE", label: "Dom" },
  { id: "PLOT", label: "Działka" },
  { id: "COMMERCIAL", label: "Lokal" },
] as const;

const SALE_PRICE_OPTIONS: { key: string; label: string }[] = [
  { key: "ALL", label: "Wszystkie" },
  { key: "lte1m", label: "do 1 mln zł" },
  { key: "1_3", label: "1 – 3 mln zł" },
  { key: "3_5", label: "3 – 5 mln zł" },
  { key: "gt5", label: "5+ mln zł" },
];

const RENT_PRICE_OPTIONS: { key: string; label: string }[] = [
  { key: "ALL", label: "Wszystkie" },
  { key: "lte3k", label: "do 3 000 zł" },
  { key: "3_5k", label: "3 – 5 000 zł" },
  { key: "5_8k", label: "5 – 8 000 zł" },
  { key: "gt8k", label: "8 000+ zł" },
];

function parseOfferPrice(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return 0;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}

function matchesPriceBucket(mode: "sale" | "rent", pricePln: number, key: string): boolean {
  if (key === "ALL") return true;
  if (mode === "sale") {
    if (key === "lte1m") return pricePln <= 1_000_000;
    if (key === "1_3") return pricePln > 1_000_000 && pricePln <= 3_000_000;
    if (key === "3_5") return pricePln > 3_000_000 && pricePln <= 5_000_000;
    if (key === "gt5") return pricePln > 5_000_000;
    return true;
  }
  if (key === "lte3k") return pricePln <= 3000;
  if (key === "3_5k") return pricePln > 3000 && pricePln <= 5000;
  if (key === "5_8k") return pricePln > 5000 && pricePln <= 8000;
  if (key === "gt8k") return pricePln > 8000;
  return true;
}

function normalizeTransactionTypeStatic(value: unknown): "sale" | "rent" | "other" {
  const token = String(value || "").trim().toLowerCase();
  if (["sale", "sprzedaz", "sprzedaż", "sell"].includes(token)) return "sale";
  if (["rent", "wynajem", "lease"].includes(token)) return "rent";
  return "other";
}

function formatOfferPinLabel(price: unknown, offerTx: unknown): string {
  const tx = normalizeTransactionTypeStatic(offerTx);
  const n = parseOfferPrice(price);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const fmt = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);
  return tx === "rent" ? `${fmt} zł/m` : `${fmt} zł`;
}

const OFFER_PIN_BASE =
  "px-5 py-3 backdrop-blur-xl border text-xs font-bold rounded-full cursor-pointer hover:scale-125 active:scale-95 transition-all duration-300 ease-out";

function offerPinColorClasses(normalizeTx: (v: unknown) => "sale" | "rent" | "other", transactionType: unknown, isPartnerRaw: unknown) {
  const isPartner = isPartnerRaw === true || isPartnerRaw === 1 || String(isPartnerRaw).toLowerCase() === "true";
  if (isPartner) {
    return `${OFFER_PIN_BASE} bg-orange-500/90 text-black border-orange-400/55 hover:bg-orange-400 shadow-[0_12px_32px_rgba(249,115,22,0.45)] hover:shadow-[0_14px_40px_rgba(249,115,22,0.55)]`;
  }
  const tx = normalizeTx(transactionType);
  if (tx === "rent") {
    return `${OFFER_PIN_BASE} bg-blue-500/90 text-white border-blue-400/55 hover:bg-blue-400 shadow-[0_12px_32px_rgba(59,130,246,0.45)] hover:shadow-[0_14px_40px_rgba(59,130,246,0.55)]`;
  }
  return `${OFFER_PIN_BASE} bg-emerald-500/90 text-black border-emerald-400/50 hover:bg-emerald-400 shadow-[0_10px_30px_rgba(16,185,129,0.35)]`;
}

export default function InteractiveMap() {
  const mapContainer = useRef(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  
  const [allOffers, setAllOffers] = useState<any[]>([]);
  const [filteredOffers, setFilteredOffers] = useState<any[]>([]);
  
  const [transactionMode, setTransactionMode] = useState<"all" | "sale" | "rent">("sale");

  type DistrictCatalog = { strictCities: string[]; strictCityDistricts: Record<string, string[]> };
  const [locationCatalog, setLocationCatalog] = useState<DistrictCatalog>({ strictCities: [], strictCityDistricts: {} });
  const [filterCity, setFilterCity] = useState("Warszawa");
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [filterPropertyType, setFilterPropertyType] = useState<"ALL" | (typeof MAP_PROPERTY_TYPES)[number]["id"]>("ALL");
  const [filterPriceBucket, setFilterPriceBucket] = useState("ALL");
  const [filterPlotArea, setFilterPlotArea] = useState("");
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showTeaser, setShowTeaser] = useState(false);
    const [offMarketOffer, setOffMarketOffer] = useState<any>(null);
    const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).isLoggedIn = isLoggedIn;
      (window as any).triggerTeaser = () => setShowTeaser(true);
        (window as any).triggerOffMarket = (offer: any) => setOffMarketOffer(offer);
        (window as any).isPro = isPro;
    }
  }, [isLoggedIn]);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((res) => res.json())
      .then((user) => {
        if (user && user.email) {
          setIsLoggedIn(true);
          setIsPro(user.role === "PRO" || user.role === "ADMIN" || user.plan === "PRO");
        }
      })
      .catch(() => setIsLoggedIn(false));
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/location/districts", { cache: "no-store" });
        if (!res.ok) return;
        const catalog = await res.json();
        setLocationCatalog({
          strictCities: catalog.strictCities || [],
          strictCityDistricts: catalog.strictCityDistricts || {},
        });
      } catch {
        /* katalog pozostaje pusty – UI nadal działa na znanych danych ofert */
      }
    })();
  }, []);

  useEffect(() => {
    fetch("/api/offers?t=" + new Date().getTime(), { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setAllOffers(list);
        setFilteredOffers(list);
      })
      .catch(() => {
        setAllOffers([]);
        setFilteredOffers([]);
      });
  }, []);

  const normalizeTransactionType = (value: unknown): "sale" | "rent" | "other" =>
    normalizeTransactionTypeStatic(value);

  // LOGIKA FILTROWANIA
  useEffect(() => {
    let result = [...allOffers];
    const cityCanonical = canonicalizeCity(filterCity);

    if (transactionMode !== "all") {
      result = result.filter((o) => normalizeTransactionType(o.transactionType) === transactionMode);
    }

    result = result.filter((o) => {
      const offerCityCanon = canonicalizeCity(o.city || "");
      return !cityCanonical || offerCityCanon === cityCanonical;
    });

    if (selectedDistricts.length > 0) {
      result = result.filter((o) => selectedDistricts.includes(String(o.district || "")));
    }

    if (filterPropertyType !== "ALL") {
      result = result.filter((o) => String(o.propertyType || "") === filterPropertyType);
    }

    const priceMode: "sale" | "rent" = transactionMode === "rent" ? "rent" : "sale";
    result = result.filter((o) => matchesPriceBucket(priceMode, parseOfferPrice(o.price), filterPriceBucket));

    const showPlotArea = filterPropertyType === "HOUSE" || filterPropertyType === "PLOT";
    if (showPlotArea && filterPlotArea) {
      const minPlot = parseInt(filterPlotArea.replace(/\D/g, ""), 10) || 0;
      result = result.filter((o) => {
        const plot = typeof o.plotArea === "number" ? o.plotArea : parseOfferPrice(o.plotArea);
        return plot >= minPlot;
      });
    }

    setFilteredOffers([...result]);
  }, [transactionMode, filterCity, selectedDistricts, filterPropertyType, filterPriceBucket, filterPlotArea, allOffers]);

  const citySelectOptions =
    locationCatalog.strictCities && locationCatalog.strictCities.length > 0
      ? locationCatalog.strictCities
      : [filterCity];

  const catalogDistricts =
    filterCity && locationCatalog.strictCityDistricts[filterCity]
      ? locationCatalog.strictCityDistricts[filterCity]!
      : EMPTY_DISTRICTS;

  const districtChoices = useMemo(() => {
    if (catalogDistricts.length > 0) return catalogDistricts;
    const cityCanon = canonicalizeCity(filterCity);
    return Array.from(
      new Set(
        allOffers
          .filter((o: any) => canonicalizeCity(o.city || "") === cityCanon)
          .map((o: any) => String(o.district || "").trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "pl"));
  }, [catalogDistricts, allOffers, filterCity]);

  const toggleDistrict = (d: string) => {
    setSelectedDistricts((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  useEffect(() => {
    setFilterPriceBucket("ALL");
  }, [transactionMode]);

  const priceBucketOptions = transactionMode === "rent" ? RENT_PRICE_OPTIONS : SALE_PRICE_OPTIONS;

  // INICJALIZACJA MAPY
  useEffect(() => {
    if (!mapContainer.current) return;
    if (!map.current) {
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [21.0122, 52.2297],
        zoom: 12,
        pitch: 60,
        bearing: -17,
        antialias: true,
        // Scroll/trackpad bez Ctrl/⌘ przewija stronę; zoom mapy wtedy wymaga Ctrl lub ⌘.
        cooperativeGestures: true,
      });

      map.current.on('load', () => {
        const layers = map.current!.getStyle().layers;
        const labelLayerId = layers?.find(layer => layer.type === 'symbol' && layer.layout?.['text-field'])?.id;
        
        map.current!.addLayer({
          'id': '3d-buildings', 'source': 'composite', 'source-layer': 'building', 'filter': ['==', 'extrude', 'true'], 'type': 'fill-extrusion', 'minzoom': 15,
          'paint': {
            'fill-extrusion-color': '#111',
            'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'height']],
            'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'min_height']],
            'fill-extrusion-opacity': 0.8
          }
        }, labelLayerId);
        map.current!.addSource('offers', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterMaxZoom: 14, clusterRadius: 50 });
        map.current!.addLayer({ id: 'clustered-point', type: 'circle', source: 'offers', filter: ['has', 'point_count'], paint: { 'circle-radius': 0, 'circle-opacity': 0 } });
        map.current!.addLayer({ id: 'unclustered-point', type: 'circle', source: 'offers', filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': 0, 'circle-opacity': 0 } });
        
        map.current!.on('render', updateMarkers);
        map.current!.on('idle', updateMarkers);
        setMapLoaded(true);
      });
    }

    if (map.current && map.current.getSource('offers') && map.current.isStyleLoaded()) {
      const features = filteredOffers.filter((o) => o.lng && o.lat).map((offer: any) => ({
        type: "Feature" as const,
        properties: {
          id: offer.id,
          price: offer.price ?? "",
          priceLabel: formatOfferPinLabel(offer.price, offer.transactionType),
          transactionType: offer.transactionType,
          isPartner: !!(offer.badges?.isPartner),
        },
        geometry: { type: "Point" as const, coordinates: [offer.lng, offer.lat] },
      }));
      const source = map.current.getSource('offers') as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData({ type: 'FeatureCollection', features });
        map.current.triggerRepaint(); 
      }
    }
  }, [filteredOffers, mapLoaded]);

  // LOGIKA PINÓW Z KOLORAMI RYNKU
  const updateMarkers = () => {
    if (!map.current) return;
    const newMarkers: { [key: string]: boolean } = {};
    const features = map.current.queryRenderedFeatures({ layers: ['clustered-point', 'unclustered-point'] });

    features.forEach((feature: any) => {
      const coords = feature.geometry.coordinates as [number, number];
      const isCluster = feature.properties.cluster;
      const id = isCluster ? `cluster-${feature.properties.cluster_id}` : `offer-${feature.properties.id}`;
      newMarkers[id] = true;

      if (!markersRef.current[id]) {
        const outerEl = document.createElement("div");
        outerEl.className = "z-30 relative";
        const innerEl = document.createElement("div");

        if (isCluster) {
          innerEl.className = "w-12 h-12 backdrop-blur-xl border rounded-full flex items-center justify-center font-bold text-lg cursor-pointer hover:text-white hover:scale-125 active:scale-95 transition-all duration-300 bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:bg-emerald-500 hover:shadow-[0_0_60px_rgba(16,185,129,0.9)]";
          innerEl.innerText = feature.properties.point_count;
          innerEl.onclick = (e) => {
            e.stopPropagation();
            const source: any = map.current!.getSource('offers');
            source.getClusterExpansionZoom(feature.properties.cluster_id, (err: any, zoom: any) => {
              if (err) return; map.current!.easeTo({ center: coords, zoom: zoom + 1 });
            });
          };
        } else {
          innerEl.className = offerPinColorClasses(normalizeTransactionType, feature.properties.transactionType, feature.properties.isPartner);
          innerEl.innerText = String(
            feature.properties.priceLabel ?? formatOfferPinLabel(feature.properties.price, feature.properties.transactionType),
          );
          innerEl.onclick = (e) => {
            e.stopPropagation();
            if ((window as any).isLoggedIn) window.location.href = `/oferta/${feature.properties.id}`;
            else (window as any).triggerTeaser();
          };
        }
        
        outerEl.appendChild(innerEl);
        markersRef.current[id] = new mapboxgl.Marker({ element: outerEl }).setLngLat(coords).addTo(map.current!);
      } else if (!isCluster && markersRef.current[id]) {
        const rootEl = markersRef.current[id].getElement();
        const pinEl = rootEl?.firstElementChild as HTMLElement | undefined;
        if (pinEl) {
          pinEl.className = offerPinColorClasses(normalizeTransactionType, feature.properties.transactionType, feature.properties.isPartner);
          pinEl.innerText = String(
            feature.properties.priceLabel ?? formatOfferPinLabel(feature.properties.price, feature.properties.transactionType),
          );
        }
      }
    });

    for (const id in markersRef.current) {
      if (!newMarkers[id]) { markersRef.current[id].remove(); delete markersRef.current[id]; }
    }
  };

  const handleFocusMap = () => {
    setSelectedDistricts([]);
    setFilterPropertyType("ALL");
    setFilterPriceBucket("ALL");
    setFilterPlotArea("");
    if (!map.current || filteredOffers.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds(
      [filteredOffers[0].lng, filteredOffers[0].lat],
      [filteredOffers[0].lng, filteredOffers[0].lat],
    );
    filteredOffers.forEach((o) => bounds.extend([o.lng, o.lat]));

    const w = typeof window !== "undefined" ? window.innerWidth : 1280;
    const padding =
      w < 640
        ? { top: 120, bottom: 96, left: 24, right: 24 }
        : w < 1024
          ? { top: 210, bottom: 130, left: 64, right: 64 }
          : { top: 250, bottom: 150, left: 100, right: 100 };

    map.current.fitBounds(bounds, { padding, maxZoom: 15, pitch: 45, duration: 2500, essential: true });
  };

  const showPlotAreaField = filterPropertyType === "HOUSE" || filterPropertyType === "PLOT";

  return (
    <div className="w-full bg-[#050505] py-7 sm:py-10 lg:py-12 relative">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 relative z-30 flex flex-col items-center">
        
        {/* NOWY PRZEŁĄCZNIK KUPNO / WYNAJEM */}
        <div className="relative z-50 mb-4 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-full p-1 flex shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
           <button onClick={() => setTransactionMode('sale')} className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all relative flex items-center gap-1.5 ${transactionMode === 'sale' ? 'text-black' : 'text-emerald-500/70 hover:text-emerald-500'}`}>
             {transactionMode === 'sale' && <motion.div layoutId="transactionTab" className="absolute inset-0 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)] -z-10" />}
             <span className="relative z-10">Na Sprzedaż</span>
           </button>
           <button onClick={() => setTransactionMode('rent')} className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all relative flex items-center gap-1.5 ${transactionMode === 'rent' ? 'text-black' : 'text-blue-500/70 hover:text-blue-500'}`}>
             {transactionMode === 'rent' && <motion.div layoutId="transactionTab" className="absolute inset-0 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.3)] -z-10" />}
             <span className="relative z-10">Na Wynajem</span>
           </button>
        </div>


        {/* Wyszukiwarka — logika i katalog jak `/szukaj` + formularz ogłoszenia (enum Prisma) */}
        <div className="z-50 w-full max-w-7xl px-4 sm:px-6 py-6 sm:py-7 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-[#0a0a0a]/90 border border-white/10 rounded-[2rem] p-6">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <Home size={14} />
                  Miasto
                </label>
                <select
                  className="w-full bg-[#050505] border border-white/10 rounded-2xl px-4 py-3 text-white font-bold outline-none"
                  value={filterCity}
                  onChange={(e) => {
                    setFilterCity(e.target.value);
                    setSelectedDistricts([]);
                    setFilterPlotArea("");
                  }}
                >
                  {citySelectOptions.map((c) => (
                    <option key={c} className="bg-[#050505] text-white" value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-[#0a0a0a]/90 border border-white/10 rounded-[2rem] p-6">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <Building2 size={14} />
                  Typ nieruchomości
                </label>
                <select
                  className="w-full bg-[#050505] border border-white/10 rounded-2xl px-4 py-3 text-white font-bold outline-none"
                  value={filterPropertyType}
                  onChange={(e) => {
                    const v = e.target.value as typeof filterPropertyType;
                    setFilterPropertyType(v);
                    if (v !== "HOUSE" && v !== "PLOT") setFilterPlotArea("");
                  }}
                >
                  <option className="bg-[#050505] text-white" value="ALL">
                    Wszystkie typy
                  </option>
                  {MAP_PROPERTY_TYPES.map((t) => (
                    <option key={t.id} className="bg-[#050505] text-white" value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 bg-[#0a0a0a]/90 border border-white/10 rounded-[2rem] p-6">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-2 block">
                  Dzielnice · {filterCity}
                </label>
                <p className="text-[9px] text-white/35 font-medium mb-4 leading-relaxed">
                  Brak zaznaczenia = całe miasto. Zaznaczanie działa tak jak w formularzu „Kupujesz? Znajdziemy to.”
                </p>
                <div className="flex flex-wrap gap-2">
                  {districtChoices.length === 0 ? (
                    <span className="text-xs text-white/40 font-medium">Ładuję listę dzielnic…</span>
                  ) : (
                    districtChoices.map((d) => {
                      const on = selectedDistricts.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleDistrict(d)}
                          className={`px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                            on ? "eos-chip-on" : "eos-chip-off"
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="bg-[#0a0a0a]/90 border border-white/10 rounded-[2rem] p-6">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <SlidersHorizontal size={14} />
                  Zakres ceny{transactionMode === "rent" ? " (miesięcznie)" : ""}
                </label>
                <select
                  className="w-full bg-[#050505] border border-white/10 rounded-2xl px-4 py-3 text-white font-bold outline-none"
                  value={filterPriceBucket}
                  onChange={(e) => setFilterPriceBucket(e.target.value)}
                >
                  {priceBucketOptions.map((o) => (
                    <option key={o.key} className="bg-[#050505] text-white" value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {showPlotAreaField && (
                <motion.div
                  initial={{ opacity: 0.8, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-[#0a0a0a]/90 border border-white/10 rounded-[2rem] p-6 flex items-start gap-4"
                >
                  <Maximize className="text-emerald-500 shrink-0 mt-1" size={20} />
                  <div className="w-full">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">Minimalna pow. działki (m²)</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="np. 500"
                      className="w-full bg-[#050505] border border-white/10 rounded-2xl px-4 py-3 text-white font-bold outline-none placeholder:text-white/25"
                      value={filterPlotArea}
                      onChange={(e) => setFilterPlotArea(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>
                </motion.div>
              )}
            </div>

            <div className="flex justify-center lg:justify-end">
              <button
                type="button"
                onClick={handleFocusMap}
                className="group w-full lg:w-auto relative flex justify-center lg:justify-start items-center gap-3 bg-white/5 backdrop-blur-md border border-white/10 active:scale-95 px-6 py-4 rounded-full transition-all duration-500 overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] cursor-pointer pointer-events-auto hover:bg-emerald-500/20 hover:border-emerald-500/80 hover:shadow-[0_0_40px_rgba(16,185,129,0.5)]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                <MapPin size={18} className="text-emerald-500 group-hover:text-white transition-colors z-10 duration-300" />
                <div className="flex flex-col items-start z-10 pointer-events-none">
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/60 group-hover:text-white transition-colors leading-none mb-1 duration-300">
                    Pokaż na mapie
                  </span>
                  <span className="text-sm font-extrabold text-white transition-colors leading-none drop-shadow-md duration-300 group-hover:text-emerald-400">
                    {filteredOffers.length}{" "}
                    {filteredOffers.length === 1
                      ? "Oferta"
                      : filteredOffers.length > 1 && filteredOffers.length < 5
                        ? "Oferty"
                        : "Ofert"}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="w-full h-[min(52svh,420px)] sm:h-[min(58svh,520px)] lg:h-[min(64svh,640px)] xl:h-[min(68svh,720px)] rounded-[1.5rem] sm:rounded-[3rem] overflow-hidden border border-white/5 relative shadow-[0_0_100px_rgba(0,0,0,0.8)] mt-5 sm:mt-7 lg:mt-8">
          <div className="absolute inset-0 pointer-events-none border-[1px] border-white/5 rounded-[1.5rem] sm:rounded-[3rem] z-20 shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]" />
          <div ref={mapContainer} className="w-full h-full z-10" />
        </div>
      </div>
    
      <AnimatePresence>
        {showTeaser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[999999] bg-black/60 backdrop-blur-md flex items-start overflow-y-auto pt-10 pb-10 sm:pt-20 sm:pb-20 justify-center p-6">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-[#0a0a0a] border border-white/10 p-10 rounded-[3rem] max-w-lg w-full shadow-[0_0_100px_rgba(0,0,0,1)] relative text-center">
              <button onClick={() => setShowTeaser(false)} className="absolute top-8 right-8 text-white/20 hover:text-white transition-colors">✕</button>
              
              <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-emerald-500/20">
                <Lock className="text-emerald-500" size={40} />
              </div>
              
              <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">
                <span className="text-emerald-500">Przed premierą</span> na szerokim rynku
              </h2>
              <p className="text-lg text-white/50 mb-10 leading-relaxed font-medium">
                Oferta jest w pierwszych 24 godzinach po publikacji pełniej widoczna dla kont PRO; po tym okresie szczegóły i kontakt dostępne są tak jak przy zwykłej publikacji. Załóż konto lub zaloguj się, żeby iść dalej.
              </p>
              
              <div className="grid grid-cols-1 gap-3 mb-10 text-left">
                  <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <Eye className="text-emerald-500" size={20} />
                    <span className="text-xs font-bold text-white/80 uppercase tracking-widest">Odkryj szczegóły i adresy</span>
                  </div>
                  <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <MessageSquare className="text-emerald-500" size={20} />
                    <span className="text-xs font-bold text-white/80 uppercase tracking-widest">Bezpośredni kontakt z klientem</span>
                  </div>
                  <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <CalendarDays className="text-emerald-500" size={20} />
                    <span className="text-xs font-bold text-white/80 uppercase tracking-widest">Umawiaj terminy prezentacji</span>
                  </div>
                  <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <Handshake className="text-[#D4AF37]" size={20} />
                    <span className="text-xs font-bold text-[#D4AF37]/90 uppercase tracking-widest">Negocjuj cenę i składaj propozycje</span>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                <Link href="/szukaj" className="btn-action py-6 rounded-2xl font-black text-sm uppercase tracking-widest shadow-[0_20px_40px_rgba(16,185,129,0.2)]">
                  Zarejestruj się za darmo
                </Link>
                <Link href="/login" className="text-white/40 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors py-2">
                  Masz już konto? Zaloguj się
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    
    </div>
  );
}
