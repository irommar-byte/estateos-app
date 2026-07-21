"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { LocateFixed, MapPin } from "lucide-react";
import { mapboxForwardGeocodeUrl } from "@/lib/mapboxGeocodeClient";
import { isPlaceholderDistrict } from "@/lib/location/locationCatalog";
import { CarFormField, CarFormSection, carAlertErrorClass, carFieldInputClass } from "@/components/cars/carFormStyles";
import { useLocale } from "@/contexts/LocaleContext";
import { fmtCars } from "@/i18n/carsDictionary";

if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
}

const DEFAULT_CENTER = { lat: 52.2297, lng: 21.0122 };
const MAP_HEIGHT = 220;

export type CarCitySelection = {
  city: string;
  cityLat: number | null;
  cityLng: number | null;
  localityCountry?: string;
};

type ReversePayload = {
  city?: string;
  district?: string;
  strictCity?: boolean;
  addressLabel?: string;
  country?: string;
};

type GeocodeFeature = {
  id?: string;
  place_name?: string;
  text?: string;
  center?: [number, number];
};

type CarCityMapPickerProps = {
  city: string;
  cityLat: number | null;
  cityLng: number | null;
  localityCountry?: string;
  onChange: (selection: CarCitySelection) => void;
  highlighted?: boolean;
};

function cityLabelFromReverse(data: ReversePayload): string {
  const city = String(data.city || "").trim();
  const district = String(data.district || "").trim();
  if (data.strictCity && district && !isPlaceholderDistrict(district) && district.toLowerCase() !== "ogólna") {
    return `${city} ${district}`.trim();
  }
  if (city) return city;
  return String(data.addressLabel || "").trim();
}

async function reverseGeocodePin(lat: number, lng: number): Promise<CarCitySelection> {
  try {
    const res = await fetch(`/api/location/reverse?lat=${lat}&lng=${lng}`, { cache: "no-store" });
    const data = (await res.json()) as ReversePayload & { error?: string };
    if (res.ok) {
      return {
        city: cityLabelFromReverse(data),
        cityLat: lat,
        cityLng: lng,
        localityCountry: String(data.country || "").trim() || "Polska",
      };
    }
  } catch {
    // ignore
  }
  return { city: "", cityLat: lat, cityLng: lng, localityCountry: "Polska" };
}

export default function CarCityMapPicker({
  city,
  cityLat,
  cityLng,
  localityCountry,
  onChange,
  highlighted = false,
}: CarCityMapPickerProps) {
  const { dict } = useLocale();
  const m = dict.cars.map;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const reverseSeqRef = useRef(0);
  const manualQueryRef = useRef(false);
  const initialGeocodeRef = useRef(false);
  const skipReverseUntilRef = useRef(0);

  const [query, setQuery] = useState(city);
  const [suggestions, setSuggestions] = useState<GeocodeFeature[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const dismissSuggestions = useCallback(() => {
    setSuggestions([]);
    setSearchFocused(false);
    manualQueryRef.current = false;
  }, []);

  const centerLat = cityLat ?? DEFAULT_CENTER.lat;
  const centerLng = cityLng ?? DEFAULT_CENTER.lng;

  useEffect(() => {
    if (manualQueryRef.current) return;
    setQuery(city);
    setSuggestions([]);
  }, [city]);

  const applySelection = useCallback(
    (selection: CarCitySelection) => {
      manualQueryRef.current = false;
      setQuery(selection.city);
      onChange(selection);
    },
    [onChange],
  );

  const resolveCenter = useCallback(
    async (lat: number, lng: number) => {
      const seq = ++reverseSeqRef.current;
      setResolving(true);
      try {
        const selection = await reverseGeocodePin(lat, lng);
        if (seq !== reverseSeqRef.current) return;
        applySelection(selection);
      } finally {
        if (seq === reverseSeqRef.current) setResolving(false);
      }
    },
    [applySelection],
  );

  const flyTo = useCallback((lat: number, lng: number, zoom = 12, opts?: { skipReverse?: boolean }) => {
    const map = mapRef.current;
    if (!map) return;
    if (opts?.skipReverse) {
      skipReverseUntilRef.current = Date.now() + 700;
    }
    map.flyTo({ center: [lng, lat], zoom, duration: 450 });
  }, []);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      setMapError(m.mapTokenMissing);
      return;
    }
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [centerLng, centerLat],
      zoom: cityLat != null && cityLng != null ? 12 : 10,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.on("movestart", () => {
      dismissSuggestions();
    });
    map.on("moveend", () => {
      if (Date.now() < skipReverseUntilRef.current) return;
      const c = map.getCenter();
      void resolveCenter(c.lat, c.lng);
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || initialGeocodeRef.current) return;
    if (cityLat != null && cityLng != null) {
      initialGeocodeRef.current = true;
      flyTo(cityLat, cityLng, 12);
      return;
    }
    const q = city.trim();
    if (q.length < 2) return;
    initialGeocodeRef.current = true;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    void (async () => {
      try {
        const res = await fetch(mapboxForwardGeocodeUrl(q, token, { limit: 1, autocomplete: false }));
        const geo = await res.json();
        const feature = Array.isArray(geo?.features) ? geo.features[0] : null;
        const coords = feature?.center;
        if (!Array.isArray(coords) || coords.length < 2) return;
        const [lng, lat] = coords;
        flyTo(lat, lng, 12);
      } catch {
        // map stays on default center
      }
    })();
  }, [city, cityLat, cityLng, flyTo]);

  useEffect(() => {
    const q = query.trim();
    if (!searchFocused || !manualQueryRef.current || q.length < 3) {
      setSuggestions([]);
      return;
    }

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    const handle = window.setTimeout(() => {
      setSearching(true);
      fetch(mapboxForwardGeocodeUrl(q, token, { limit: 4, autocomplete: true, cityHint: q }))
        .then((res) => res.json())
        .then((geo) => setSuggestions(Array.isArray(geo?.features) ? geo.features : []))
        .catch(() => setSuggestions([]))
        .finally(() => setSearching(false));
    }, 280);

    return () => window.clearTimeout(handle);
  }, [query, searchFocused]);

  const selectSuggestion = async (feature: GeocodeFeature) => {
    const coords = feature.center;
    if (!Array.isArray(coords) || coords.length < 2) return;
    const [lng, lat] = coords;
    const label = String(feature.place_name || feature.text || "").trim();
    dismissSuggestions();
    // Zachowaj wybraną etykietę Mapbox — reverse po flyTo potrafił nadpisać np. Warszawę na inną miejscowość.
    skipReverseUntilRef.current = Date.now() + 700;
    reverseSeqRef.current += 1;
    flyTo(lat, lng, 12, { skipReverse: true });
    applySelection({
      city: label.split(",")[0]?.trim() || label,
      cityLat: lat,
      cityLng: lng,
      localityCountry: "Polska",
    });
  };

  const applyGpsLocation = () => {
    if (!navigator.geolocation) {
      setMapError(m.gpsUnsupported);
      return;
    }
    setLocating(true);
    setMapError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        flyTo(latitude, longitude, 13);
        setLocating(false);
      },
      () => {
        setMapError(m.gpsFailed);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const inputClass = `${carFieldInputClass} ${highlighted ? "ring-2 ring-amber-400/60 border-amber-400/60" : ""}`;

  return (
    <CarFormSection eyebrow={m.eyebrow} title={m.title} description={m.description}>
      <CarFormField label={m.cityLabel}>
        <div className="relative">
        <input
          value={query}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => {
            window.setTimeout(() => dismissSuggestions(), 160);
          }}
          onChange={(event) => {
            manualQueryRef.current = true;
            setSearchFocused(true);
            setQuery(event.target.value);
            onChange({
              city: event.target.value,
              cityLat,
              cityLng,
              localityCountry,
            });
          }}
          className={inputClass}
          placeholder={m.searchPlaceholder}
          autoComplete="off"
        />
        {searching ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--eos-muted)]">
            {m.searching}
          </span>
        ) : null}
        {searchFocused && suggestions.length > 0 ? (
          <ul className="absolute z-20 mt-1 max-h-32 w-full overflow-auto rounded-xl border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-lg">
            {suggestions.map((feature) => (
              <li key={String(feature.id || feature.place_name)}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-sky-500/10"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void selectSuggestion(feature);
                  }}
                >
                  {feature.place_name || feature.text}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        </div>
      </CarFormField>

      <div
        className="relative overflow-hidden rounded-xl border border-[var(--eos-border)]"
        onPointerDown={dismissSuggestions}
      >
        <div ref={mapContainerRef} style={{ height: MAP_HEIGHT }} className="w-full" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <MapPin className="h-8 w-8 -translate-y-3 text-sky-400 drop-shadow-md" strokeWidth={2.2} />
        </div>
        <button
          type="button"
          onClick={applyGpsLocation}
          disabled={locating}
          className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)]/95 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-sky-300 disabled:opacity-60"
        >
          <LocateFixed className="h-3.5 w-3.5" />
          {locating ? m.gpsLocating : m.gpsButton}
        </button>
      </div>

      <p className="text-xs text-[var(--eos-muted)]">
        {resolving
          ? m.resolvingCity
          : cityLat != null && cityLng != null
            ? fmtCars(m.pinCoords, {
                lat: cityLat.toFixed(4),
                lng: cityLng.toFixed(4),
                country: localityCountry ? ` · ${localityCountry}` : "",
              })
            : m.mapHint}
      </p>
      {mapError ? <p className={carAlertErrorClass}>{mapError}</p> : null}
    </CarFormSection>
  );
}
