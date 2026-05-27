"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Lock, LocateFixed } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale } from "@/contexts/LocaleContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useFormatOfferPrice } from "@/hooks/useFormatOfferPrice";
import { useDisplayCurrency } from "@/contexts/DisplayCurrencyContext";
import {
  normalizeTransactionType,
  transactionModeFromOffers,
} from "@/lib/transactionType";

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

function offerPinColorClasses(transactionType: unknown) {
  const tx = normalizeTransactionType(transactionType);

  if (tx === "rent") {
    return `${OFFER_PIN_BASE} bg-blue-500/80 text-white border-blue-400/40 hover:bg-blue-400 hover:scale-110 shadow-[0_10px_30px_rgba(59,130,246,0.3)]`;
  }

  return `${OFFER_PIN_BASE} bg-emerald-500/80 text-black border-emerald-400/40 hover:bg-emerald-400 hover:scale-110 shadow-[0_10px_30px_rgba(16,185,129,0.3)]`;
}

type Props = {
  /** Pełny ekran pod nawigacją — bez formularzy i nagłówków sekcji. */
  immersive?: boolean;
};

const MAP_STYLE = {
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
} as const;

export default function InteractiveMap({ immersive = false }: Props) {
  const { dict, locale } = useLocale();
  const { resolvedTheme } = useTheme();
  const { preference } = useDisplayCurrency();
  const { formatPinLabel, rate } = useFormatOfferPrice();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const appliedMapTheme = useRef<"light" | "dark" | null>(null);

  const [allOffers, setAllOffers] = useState<any[]>([]);
  const [filteredOffers, setFilteredOffers] = useState<any[]>([]);

  const [transactionMode, setTransactionMode] = useState<"sale" | "rent">("sale");
  const [priceMax, setPriceMax] = useState<number>(50_000_000);
  const [priceMaxRent, setPriceMaxRent] = useState<number>(50_000);
  const [priceMaxUi, setPriceMaxUi] = useState<number>(50_000_000);
  const [priceMaxRentUi, setPriceMaxRentUi] = useState<number>(50_000);

  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [mapInitError, setMapInitError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showTeaser, setShowTeaser] = useState(false);

  const priceLocale = locale === "pl" ? "pl-PL" : "en-US";
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
        const list = Array.isArray(data) ? data : [];
        setAllOffers(list);
        if (list.length > 0) {
          setTransactionMode(transactionModeFromOffers(list));
        }
      })
      .catch(() => setAllOffers([]));
  }, []);

  useEffect(() => {
    const result = allOffers.filter((o) => {
      if (normalizeTransactionType(o.transactionType) !== transactionMode) {
        return false;
      }
      const price = getOfferFilterPrice(o);
      if (transactionMode === "rent") return price <= priceMaxRent;
      return price <= priceMax;
    });
    setFilteredOffers(result);
  }, [transactionMode, priceMax, priceMaxRent, allOffers]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPriceMax(isEurDisplay ? Math.round(priceMaxUi * safeRate) : priceMaxUi);
      setPriceMaxRent(isEurDisplay ? Math.round(priceMaxRentUi * safeRate) : priceMaxRentUi);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [priceMaxUi, priceMaxRentUi, isEurDisplay, safeRate]);

  useEffect(() => {
    if (isEurDisplay) {
      setPriceMaxUi(Math.round(priceMax / safeRate));
      setPriceMaxRentUi(Math.round(priceMaxRent / safeRate));
      return;
    }
    setPriceMaxUi(priceMax);
    setPriceMaxRentUi(priceMaxRent);
  }, [isEurDisplay, priceMax, priceMaxRent, safeRate]);

  const updateMarkers = useCallback(() => {
    if (!map.current) return;
    const newMarkers: Record<string, boolean> = {};

    filteredOffers
      .filter((offer) => offer.lng != null && offer.lat != null)
      .forEach((offer) => {
        const id = `offer-${offer.id}`;
        const coords: [number, number] = [Number(offer.lng), Number(offer.lat)];
        newMarkers[id] = true;

        if (!markersRef.current[id]) {
          const outerEl = document.createElement("div");
          outerEl.className = "z-30 relative";
          const innerEl = document.createElement("div");
          const tx = normalizeTransactionType(offer.transactionType);
          innerEl.className = offerPinColorClasses(offer.transactionType);
          innerEl.innerText = formatPinLabel(offer, tx === "rent");
          innerEl.onclick = (e) => {
            e.stopPropagation();
            const win = window as Window & {
              isLoggedIn?: boolean;
              triggerTeaser?: () => void;
            };
            if (win.isLoggedIn) {
              window.location.href = `/oferta/${offer.id}`;
            } else {
              win.triggerTeaser?.();
            }
          };

          outerEl.appendChild(innerEl);
          markersRef.current[id] = new mapboxgl.Marker({ element: outerEl })
            .setLngLat(coords)
            .addTo(map.current!);
        } else {
          markersRef.current[id].setLngLat(coords);
          const rootEl = markersRef.current[id].getElement();
          const pinEl = rootEl?.firstElementChild as HTMLElement | undefined;
          if (pinEl) {
            const tx = normalizeTransactionType(offer.transactionType);
            pinEl.className = offerPinColorClasses(offer.transactionType);
            pinEl.innerText = formatPinLabel(offer, tx === "rent");
          }
        }
      });

    for (const id of Object.keys(markersRef.current)) {
      if (!newMarkers[id]) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    }
  }, [filteredOffers, formatPinLabel, rate]);

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

      updateMarkers();
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
  }, [mapboxToken, immersive, locale, resolvedTheme, updateMarkers]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    if (appliedMapTheme.current === resolvedTheme) return;
    appliedMapTheme.current = resolvedTheme;
    const nextStyle = MAP_STYLE[resolvedTheme];
    try {
      map.current.setStyle(nextStyle);
      map.current.once("style.load", () => {
        if (!map.current) return;
        updateMarkers();
      });
    } catch {
      /* noop */
    }
  }, [resolvedTheme, mapLoaded, updateMarkers]);

  useEffect(() => {
    if (!mapLoaded) return;
    updateMarkers();
  }, [mapLoaded, updateMarkers]);

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
  const sliderAccent = transactionMode === "rent" ? "#3b82f6" : "#10b981";
  const sliderPct = transactionMode === "rent" ? rentSliderPct : saleSliderPct;

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
        <div className="interactive-map-controls flex rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)]/90 p-1.5 shadow-[var(--eos-shadow-soft)] backdrop-blur-3xl">
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

        <div className="interactive-map-controls flex w-full items-center gap-4 rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)]/90 p-4 shadow-[var(--eos-shadow-soft)] backdrop-blur-3xl sm:p-5">
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">
                {maxPriceLabel}
              </span>
              <span className="text-xs font-black tracking-wider text-[var(--eos-text)]">
                {new Intl.NumberFormat(priceLocale, {
                  style: "currency",
                  currency: isEurDisplay ? "EUR" : "PLN",
                  maximumFractionDigits: 0,
                }).format(transactionMode === "rent" ? priceMaxRentUi : priceMaxUi)}
              </span>
            </div>
            <input
              type="range"
              min={transactionMode === "rent" ? rentUiMin : saleUiMin}
              max={transactionMode === "rent" ? rentUiMax : saleUiMax}
              step={transactionMode === "rent" ? rentUiStep : saleUiStep}
              value={transactionMode === "rent" ? priceMaxRentUi : priceMaxUi}
              onChange={(e) =>
                transactionMode === "rent"
                  ? setPriceMaxRentUi(Number(e.target.value))
                  : setPriceMaxUi(Number(e.target.value))
              }
              aria-label={maxPriceLabel}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 outline-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_15px_rgba(255,255,255,0.5)]"
              style={{
                background: `linear-gradient(to right, ${sliderAccent} 0%, ${sliderAccent} ${sliderPct}%, rgba(255,255,255,0.1) ${sliderPct}%, rgba(255,255,255,0.1) 100%)`,
              }}
            />
          </div>

          <div className="mx-1 h-10 w-px bg-[var(--eos-border)]" />

          <button
            type="button"
            onClick={locateUser}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--eos-border)] bg-[var(--eos-input)] transition-all hover:border-emerald-500/40 hover:bg-[var(--eos-surface-strong)] active:scale-95"
            title={dict.map.locateMe}
            aria-label={dict.map.locateMe}
          >
            <LocateFixed className="h-5 w-5 text-[var(--eos-text)]" />
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
