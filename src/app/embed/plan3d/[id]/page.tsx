'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import FloorPlan3dOrbit from '@/components/offers/FloorPlan3dOrbit';
import { parseFloorPlanScanMeta } from '@/lib/roomScan/parseFloorPlanScanMeta';
import { cropScanMetaToRoom, roomsFromScanMeta } from '@/lib/roomScan/refineScanSections';
import { normalizeScanMeta } from '@/lib/roomScan/planNormalize';
import { resolveWholePlanMeta } from '@/lib/roomScan/wholePlan';
import { useRoomPhotoColors } from '@/lib/roomPhotoColors';
import { photoRoomKey, sameRoomName } from '@/lib/offerPhotoRoomKey';
import type { FloorPlanScanMeta } from '@/types/roomScan';

/**
 * Pełnoekranowy model 3D planu (obrót palcem, przybliżanie szczypaniem) — osadzany w aplikacji EstateOS
 * w WebView zamiast podglądu AR. Ten sam silnik co na stronie oferty: całe mieszkanie i każde pomieszczenie.
 * Parametry: ?room=<nazwa pomieszczenia>&theme=dark|light
 */
export default function EmbedPlan3dPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const search = useSearchParams();
  const dark = search.get('theme') !== 'light';
  const [scanMeta, setScanMeta] = useState<FloorPlanScanMeta | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoRooms, setPhotoRooms] = useState<Array<{ url: string; room: string }>>([]);
  const [failed, setFailed] = useState(false);
  const [roomName, setRoomName] = useState<string | null>(search.get('room'));

  useEffect(() => {
    let alive = true;
    fetch(`/api/offers/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('offer'))))
      .then((offer) => {
        if (!alive) return;
        const meta = parseFloorPlanScanMeta(offer?.floorPlanScanMeta ?? null);
        if (!meta) setFailed(true);
        setScanMeta(meta);
        try {
          const imgs = typeof offer?.images === 'string' ? JSON.parse(offer.images) : offer?.images;
          setPhotos(Array.isArray(imgs) ? imgs.map(String) : []);
        } catch {
          setPhotos([]);
        }
      })
      .catch(() => alive && setFailed(true));
    fetch(`/api/offers/${id}/photo-rooms`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => alive && setPhotoRooms(Array.isArray(json?.items) ? json.items : []))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [id]);

  const rooms = useMemo(() => roomsFromScanMeta(scanMeta), [scanMeta]);
  const whole = useMemo(() => resolveWholePlanMeta(scanMeta), [scanMeta]);
  const selected = roomName ? rooms.find((r) => sameRoomName(r.name, roomName)) || null : null;
  const meta = useMemo(() => {
    const cropped = selected ? cropScanMetaToRoom(scanMeta, selected) : null;
    const raw = cropped || selected?.scanMeta || whole.meta;
    return raw ? normalizeScanMeta(raw) : null;
  }, [selected, scanMeta, whole]);

  const groups = useMemo(() => {
    const byKey = new Map(photoRooms.map((it) => [it.url, it.room]));
    const out: Array<{ room: string; urls: string[] }> = [];
    for (const url of photos) {
      const room = byKey.get(photoRoomKey(url));
      if (!room) continue;
      const g = out.find((x) => sameRoomName(x.room, room));
      if (g) g.urls.push(url);
      else out.push({ room, urls: [url] });
    }
    return out;
  }, [photos, photoRooms]);
  const roomColors = useRoomPhotoColors(groups);

  const bg = dark ? '#0d0e10' : '#eef2f6';
  const fg = dark ? '#f5f5f7' : '#14161b';
  const chipBg = dark ? 'rgba(255,255,255,0.08)' : 'rgba(20,22,27,0.06)';

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2147483646, background: bg, color: fg, overscrollBehavior: 'none' }}
      className="select-none"
    >
      {meta?.walls?.length ? (
        <FloorPlan3dOrbit
          key={selected?.id || 'whole'}
          meta={meta as FloorPlanScanMeta}
          roomColors={roomColors}
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm opacity-70">
          {failed ? 'Ta oferta nie ma jeszcze skanu pomieszczeń.' : 'Wczytywanie modelu 3D…'}
        </div>
      )}

      <div
        className="pointer-events-none absolute inset-x-0 top-0 px-5 pt-4"
        style={{ background: `linear-gradient(${bg}, transparent)` }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-60">Model 3D</p>
        <p className="text-xl font-semibold tracking-tight">{selected?.name || 'Całe mieszkanie'}</p>
        <p className="mt-0.5 text-xs opacity-60">Obracaj palcem · przybliżaj dwoma palcami</p>
      </div>

      {rooms.length > 0 ? (
        <div className="absolute inset-x-0 bottom-0 pb-[max(16px,env(safe-area-inset-bottom))] pt-6" style={{ background: `linear-gradient(transparent, ${bg})` }}>
          <div className="flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
            {[{ id: 'whole', name: null as string | null }, ...rooms.map((r, i) => ({ id: r.id || `r${i}`, name: r.name }))].map((r) => {
              const active = (r.name ?? null) === (selected?.name ?? null);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRoomName(r.name)}
                  className="shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors"
                  style={{ background: active ? '#0ea5e9' : chipBg, color: active ? '#fff' : fg }}
                >
                  {r.name || 'Całe mieszkanie'}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
