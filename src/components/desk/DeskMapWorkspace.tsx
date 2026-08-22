'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

type MapPin = {
  id: number;
  title?: string | null;
  lat: number;
  lng: number;
  kind?: string;
  label?: string;
};

export function DeskMapWorkspace({ caseId }: { caseId?: number | null }) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [token, setToken] = useState<string | null>(process.env.NEXT_PUBLIC_MAPBOX_TOKEN || null);
  const [tokenChecked, setTokenChecked] = useState(Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pins, setPins] = useState<MapPin[]>([]);
  const [focus, setFocus] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  const [layer, setLayer] = useState<'all' | 'offers' | 'clients' | 'matched'>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!token && !tokenChecked) {
        const res = await fetch('/api/map/config');
        const json = await res.json().catch(() => ({}));
        setToken(json.mapboxToken || null);
        setTokenChecked(true);
      }
      const q = new URLSearchParams({ mode: layer });
      if (caseId) q.set('caseId', String(caseId));
      const res = await fetch(`/api/desk/map?${q}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Błąd mapy');

      const nextPins: MapPin[] = [];
      if (layer === 'all' || layer === 'offers') {
        for (const o of json.offers || []) {
          if (o.lat != null && o.lng != null) {
            nextPins.push({ id: o.id, title: o.title, lat: o.lat, lng: o.lng, kind: 'offer' });
          }
        }
      }
      if (layer === 'all' || layer === 'clients') {
        for (const c of json.clients || []) {
          if (c.lat != null && c.lng != null) {
            nextPins.push({
              id: c.caseId,
              label: c.label,
              lat: c.lat,
              lng: c.lng,
              kind: 'client',
            });
          }
        }
      }
      if (layer === 'matched' || (caseId && layer === 'all')) {
        for (const o of json.matchedOffers || []) {
          if (o.lat != null && o.lng != null) {
            nextPins.push({ id: o.id, title: o.title, lat: o.lat, lng: o.lng, kind: 'matched' });
          }
        }
      }
      for (const oh of json.openHouses || []) {
        if (oh.lat != null && oh.lng != null) {
          nextPins.push({ id: oh.id, title: oh.title, lat: oh.lat, lng: oh.lng, kind: 'oh' });
        }
      }

      setPins(nextPins);
      return nextPins;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
      setPins([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [caseId, layer, token, tokenChecked]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!containerRef.current || !token) return;

    if (!mapRef.current) {
      mapboxgl.accessToken = token;
      mapRef.current = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [21.0122, 52.2297],
        zoom: 10,
      });
      mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    }

    let cancelled = false;
    (async () => {
      if (cancelled || !mapRef.current) return;

      for (const m of markersRef.current) m.remove();
      markersRef.current = [];

      for (const pin of pins) {
        const color =
          pin.kind === 'client'
            ? '#9a7b3c'
            : pin.kind === 'matched'
              ? '#2f5d3a'
              : pin.kind === 'oh'
                ? '#a33b1f'
                : '#1a1612';
        const el = document.createElement('div');
        el.className = 'eos-desk-map-pin';
        el.style.background = color;
        el.title = pin.title || pin.label || '';
        const marker = new mapboxgl.Marker(el).setLngLat([pin.lng, pin.lat]).addTo(mapRef.current!);
        markersRef.current.push(marker);
      }

      if (focus) {
        mapRef.current.flyTo({ center: [focus.lng, focus.lat], zoom: 14 });
      } else if (pins.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        pins.forEach((p) => bounds.extend([p.lng, p.lat]));
        mapRef.current.fitBounds(bounds, { padding: 48, maxZoom: 13 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, pins, focus]);

  useEffect(() => {
    const onFocus = (e: Event) => {
      const detail = (e as CustomEvent).detail as { lat: number; lng: number; label?: string };
      if (detail?.lat != null && detail?.lng != null) setFocus(detail);
    };
    window.addEventListener('desk-map-focus', onFocus);
    return () => window.removeEventListener('desk-map-focus', onFocus);
  }, []);

  const showMap = Boolean(tokenChecked && token);

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
        {(['all', 'offers', 'clients', 'matched'] as const).map((l) => (
          <button
            key={l}
            type="button"
            className={layer === l ? 'eos-desk-btn eos-desk-btn-primary' : 'eos-desk-btn'}
            onClick={() => setLayer(l)}
          >
            {l}
          </button>
        ))}
        {focus ? (
          <button type="button" className="eos-desk-btn" onClick={() => setFocus(null)}>
            Reset view
          </button>
        ) : null}
      </div>

      {loading ? <p className="eos-desk-muted">Ładuję dane mapy…</p> : null}
      {error ? <p style={{ color: 'var(--desk-danger)' }}>{error}</p> : null}

      {!loading && tokenChecked && !token ? (
        <div className="eos-desk-card" style={{ padding: '1rem', marginBottom: '0.75rem' }}>
          <p className="eos-desk-kicker">Mapa niedostępna</p>
          <p style={{ margin: '0.35rem 0 0.65rem', fontSize: '0.92rem' }}>
            Brak tokenu Mapbox. Poniżej lista punktów — możesz otworzyć nawigację w Google Maps.
          </p>
          {pins.length === 0 ? (
            <p className="eos-desk-muted">Brak punktów z współrzędnymi w tym widoku.</p>
          ) : (
            <ul className="eos-desk-checklist">
              {pins.map((p) => (
                <li key={`${p.kind}-${p.id}`}>
                  <span>
                    {p.title || p.label || `#${p.id}`}{' '}
                    <span className="eos-desk-muted">· {p.kind}</span>
                  </span>
                  <a
                    className="eos-desk-btn"
                    href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Navigate
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {showMap ? (
        <div
          ref={containerRef}
          className="eos-desk-map-container"
          style={{ height: 'min(62vh, 520px)', borderRadius: '12px', overflow: 'hidden' }}
        />
      ) : null}

      {!loading && pins.length === 0 && showMap ? (
        <p className="eos-desk-muted" style={{ marginTop: '0.65rem' }}>
          Brak punktów z współrzędnymi — uzupełnij geolokalizację ofert lub kryteria MAP u kupujących.
        </p>
      ) : null}

      {focus ? (
        <p className="eos-desk-muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
          NAVIGATE → {focus.label || `${focus.lat.toFixed(4)}, ${focus.lng.toFixed(4)}`}{' '}
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${focus.lat},${focus.lng}`}
            target="_blank"
            rel="noreferrer"
          >
            Google Maps
          </a>
        </p>
      ) : null}
    </div>
  );
}
