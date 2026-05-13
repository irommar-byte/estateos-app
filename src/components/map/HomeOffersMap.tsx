'use client';

import Link from 'next/link';
import { MapPin } from 'lucide-react';
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

  if (!token) {
    return (
      <div className="rounded-[2rem] border border-amber-500/30 bg-amber-500/5 p-8 text-center text-sm text-amber-100/90">
        Brak <code className="font-mono text-amber-200">NEXT_PUBLIC_MAPBOX_TOKEN</code> — mapa nie może się załadować.
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-[2rem] border border-white/10 bg-[#050505] shadow-[0_0_80px_rgba(16,185,129,0.08)]">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-black/55 px-4 py-3 backdrop-blur-md md:px-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-emerald-400">Mapa ofert</p>
          <p className="text-xs text-white/50">
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

      <div className="h-[min(72vh,640px)] w-full min-h-[420px] pt-[52px]">
        <Map
          mapboxAccessToken={token}
          initialViewState={{
            longitude: view.longitude,
            latitude: view.latitude,
            zoom: view.zoom,
            pitch: 42,
            bearing: -12,
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
                className="flex h-10 w-10 -translate-y-1 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500 text-black shadow-[0_10px_30px_rgba(16,185,129,0.45)] transition-transform hover:scale-110"
                aria-label={pin.title}
              >
                <MapPin className="h-5 w-5" strokeWidth={2.25} />
              </button>
            </Marker>
          ))}
        </Map>
      </div>

      {selected && (
        <div className="pointer-events-auto absolute bottom-4 left-4 right-4 z-20 md:left-auto md:right-4 md:w-[380px]">
          <div className="rounded-2xl border border-white/10 bg-black/80 p-5 text-white shadow-2xl backdrop-blur-xl">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">
                  {selected.district.replaceAll('_', ' ')}
                </p>
                <h3 className="text-lg font-black leading-snug tracking-tight">{selected.title}</h3>
              </div>
              <button
                type="button"
                className="text-white/40 hover:text-white"
                onClick={() => setSelected(null)}
                aria-label="Zamknij"
              >
                ×
              </button>
            </div>
            <p className="mb-4 text-sm font-semibold text-white/70">{formatPrice(selected.price)}</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/o/${selected.id}`}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-center text-[11px] font-black uppercase tracking-widest text-black hover:bg-emerald-400"
              >
                Zobacz ofertę
              </Link>
              <Link
                href="/oferty"
                className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white/80 hover:border-white/40"
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
