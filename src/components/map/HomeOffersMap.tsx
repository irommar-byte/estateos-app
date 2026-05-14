'use client';

import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import Map, { Marker, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

type OfferMapPin = {
  id: number;
  title: string;
  price: number;
  district: string;
  propertyType: string;
  lat: number;
  lng: number;
};

function formatPrice(pln: number) {
  try {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      maximumFractionDigits: 0,
    }).format(pln);
  } catch {
    return `${Math.round(pln)} PLN`;
  }
}

export default function HomeOffersMap() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const reduceMotion = useReducedMotion();
  const [pins, setPins] = useState<OfferMapPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OfferMapPin | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/offers-map', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data?.offers)) setPins(data.offers);
      })
      .catch(() => {
        if (!cancelled) setPins([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const view = useMemo(() => {
    if (!pins.length) {
      return { latitude: 52.2297, longitude: 21.0122, zoom: 10.5 };
    }
    const lat = pins.reduce((s, p) => s + p.lat, 0) / pins.length;
    const lng = pins.reduce((s, p) => s + p.lng, 0) / pins.length;
    return { latitude: lat, longitude: lng, zoom: 11.2 };
  }, [pins]);

  const mapMotion = useMemo(
    () => (reduceMotion ? { pitch: 0, bearing: 0 } : { pitch: 42, bearing: -12 }),
    [reduceMotion],
  );

  if (!token) {
    return (
      <div
        role="status"
        className="rounded-[2rem] border border-amber-500/30 bg-amber-500/5 p-8 text-center text-sm text-amber-100/90"
      >
        Brak <code className="font-mono text-amber-200">NEXT_PUBLIC_MAPBOX_TOKEN</code> — mapa nie może się załadować.
      </div>
    );
  }

  return (
    <div className="relative w-full touch-pan-x touch-pan-y overflow-hidden rounded-[2rem] border border-white/10 bg-[#050505] shadow-[0_0_80px_rgba(16,185,129,0.08)]">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-black/55 px-4 py-3 backdrop-blur-md md:px-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-emerald-400">Mapa ofert</p>
          <p className="text-xs text-white/50" aria-live="polite">
            {loading ? 'Ładowanie pinów…' : `${pins.length} aktywnych ofert z lokalizacją`}
          </p>
        </div>
        <Link
          href="/oferty"
          className="hidden rounded-full border border-white/15 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/80 transition-colors hover:border-white/40 hover:text-white sm:inline-flex"
        >
          Katalog
        </Link>
      </div>

      <div className="relative h-[min(72vh,640px)] w-full min-h-[420px] pt-[52px]">
        {loading && (
          <div
            className="pointer-events-none absolute inset-0 top-[52px] z-[5] flex flex-col items-center justify-center gap-3 bg-black/35 backdrop-blur-[2px]"
            aria-hidden
          >
            <div className="h-9 w-9 animate-pulse rounded-full border-2 border-emerald-400/30 border-t-emerald-400" />
            <span className="text-xs font-medium tracking-wide text-white/45">Ładowanie mapy…</span>
          </div>
        )}

        {!loading && pins.length === 0 && (
          <div
            role="status"
            className="pointer-events-none absolute inset-0 top-[52px] z-[5] flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-black/50 to-black/70 px-6 text-center"
          >
            <p className="text-sm font-semibold text-white/85">Brak pinezek do wyświetlenia</p>
            <p className="max-w-sm text-xs leading-relaxed text-white/45">
              Aktywne oferty bez współrzędnych nie pojawiają się na mapie. Pełną listę zobaczysz w katalogu.
            </p>
            <span className="mt-2 inline-flex rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/55">
              Sprawdź katalog
            </span>
          </div>
        )}

        <Map
          mapboxAccessToken={token}
          initialViewState={{
            longitude: view.longitude,
            latitude: view.latitude,
            zoom: view.zoom,
            ...mapMotion,
          }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          reuseMaps
          attributionControl={false}
        >
          <div className="absolute right-3 top-[64px] z-20">
            <NavigationControl showCompass={false} />
          </div>

          {pins.map((pin) => (
            <Marker
              key={pin.id}
              longitude={pin.lng}
              latitude={pin.lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelected((cur) => (cur?.id === pin.id ? null : pin));
              }}
            >
              <button
                type="button"
                className="flex h-10 w-10 -translate-y-1 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500 text-black shadow-[0_10px_30px_rgba(16,185,129,0.45)] transition-transform hover:scale-110 active:scale-95"
                aria-label={pin.title}
              >
                <MapPin className="h-5 w-5" strokeWidth={2.25} aria-hidden />
              </button>
            </Marker>
          ))}
        </Map>
      </div>

      {selected && (
        <div className="pointer-events-auto absolute bottom-[max(1rem,env(safe-area-inset-bottom,0px))] left-4 right-4 z-20 md:left-auto md:right-4 md:w-[380px]">
          <div className="rounded-2xl border border-white/10 bg-black/85 p-5 text-white shadow-2xl backdrop-blur-xl">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">
                  {selected.district.replaceAll('_', ' ')}
                </p>
                <h3 className="text-lg font-black leading-snug tracking-tight">{selected.title}</h3>
              </div>
              <button
                type="button"
                className="min-h-11 min-w-11 rounded-lg text-2xl leading-none text-white/40 transition-colors hover:bg-white/5 hover:text-white"
                onClick={() => setSelected(null)}
                aria-label="Zamknij podgląd oferty"
              >
                ×
              </button>
            </div>
            <p className="mb-4 text-sm font-semibold text-white/70">{formatPrice(selected.price)}</p>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/o/${selected.id}`}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-center text-[11px] font-black uppercase tracking-widest text-black hover:bg-emerald-400"
              >
                Zobacz ofertę
              </a>
              <Link
                href="/oferty"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white/80 hover:border-white/40"
              >
                Katalog
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
