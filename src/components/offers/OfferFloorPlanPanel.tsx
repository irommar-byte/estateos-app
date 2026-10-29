'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileImage, Maximize2, ScanLine } from 'lucide-react';
import type { OfferPageCopy } from '@/content/offerPageCopy';
import type { Locale } from '@/i18n/config';
import type { FloorPlanScanMeta, PropertyRoomScan } from '@/types/roomScan';
import { formatRoomScanRoomCount } from '@/lib/roomScan/roomScanLabels';
import { resolvePublicAssetUrl } from '@/lib/roomScan/parseFloorPlanScanMeta';
import FloorPlan3dWalkthrough from '@/components/offers/FloorPlan3dWalkthrough';
import FloorPlanScanArtboard from '@/components/offers/FloorPlanScanArtboard';
import { formatListingAreaSqm } from '@/lib/listingRoomAreas';
import { cropScanMetaToRoom, roomsFromScanMeta } from '@/lib/roomScan/refineScanSections';
import { normalizeScanMeta } from '@/lib/roomScan/planNormalize';
import { planSpecs } from '@/lib/roomScan/planSpecs';
import type { RoomScanObjectCategory } from '@/types/roomScan';
import { photoRoomKey, sameRoomName, type OfferPhotoRoom } from '@/lib/offerPhotoRoomKey';

/** Meble i AGD po polsku, zgrupowane: „Krzesło ×6” zamiast sześciu „Chair”. Kolejność: od dużych do drobnych. */
const FURNITURE_LABEL: Record<RoomScanObjectCategory, { pl: string; en: string }> = {
  bed: { pl: 'Łóżko', en: 'Bed' },
  sofa: { pl: 'Sofa', en: 'Sofa' },
  table: { pl: 'Stół', en: 'Table' },
  chair: { pl: 'Krzesło', en: 'Chair' },
  storage: { pl: 'Szafa / szafka', en: 'Wardrobe / cabinet' },
  refrigerator: { pl: 'Lodówka', en: 'Fridge' },
  stove: { pl: 'Płyta grzewcza', en: 'Hob' },
  oven: { pl: 'Piekarnik', en: 'Oven' },
  dishwasher: { pl: 'Zmywarka', en: 'Dishwasher' },
  washerDryer: { pl: 'Pralka', en: 'Washing machine' },
  sink: { pl: 'Umywalka / zlew', en: 'Sink' },
  toilet: { pl: 'WC', en: 'Toilet' },
  bathtub: { pl: 'Wanna', en: 'Bathtub' },
  television: { pl: 'Telewizor', en: 'TV' },
  fireplace: { pl: 'Kominek', en: 'Fireplace' },
  stairs: { pl: 'Schody', en: 'Stairs' },
  unknown: { pl: 'Inne', en: 'Other' },
};
const FURNITURE_GROUPS: Array<{ pl: string; en: string; cats: RoomScanObjectCategory[] }> = [
  { pl: 'Meble', en: 'Furniture', cats: ['bed', 'sofa', 'table', 'chair', 'storage', 'television', 'fireplace', 'stairs'] },
  { pl: 'Kuchnia', en: 'Kitchen', cats: ['refrigerator', 'stove', 'oven', 'dishwasher'] },
  { pl: 'Łazienka', en: 'Bathroom', cats: ['bathtub', 'toilet', 'sink', 'washerDryer'] },
];

type OfferFloorPlanPanelProps = {
  floorPlanSrc: string;
  extraFloorPlanSrcs?: string[];
  floorPlan3dSrc?: string;
  scanMeta?: FloorPlanScanMeta | null;
  locale: Locale;
  copy: OfferPageCopy;
  themeColors: { textActive: string; borderActive: string; bgActiveSoft: string };
  variant?: 'full' | 'compact';
  onEnlarge?: () => void;
  /** Zdjęcia oferty i ich pomieszczenia — wybór pokoju pokazuje jego zdjęcia. */
  photos?: string[];
  photoRooms?: OfferPhotoRoom[];
  /** Z galerii: „Pokaż na planie” wybiera pomieszczenie. */
  focusRoom?: { room: string; nonce: number } | null;
  onOpenPhoto?: (url: string) => void;
};

function assetUrl(uri?: string | null): string {
  return uri ? resolvePublicAssetUrl(uri) : '';
}

export default function OfferFloorPlanPanel({
  floorPlanSrc,
  extraFloorPlanSrcs = [],
  floorPlan3dSrc,
  scanMeta,
  locale,
  copy,
  themeColors,
  variant = 'full',
  onEnlarge,
  photos = [],
  photoRooms = [],
  focusRoom = null,
  onOpenPhoto,
}: OfferFloorPlanPanelProps) {
  const roomScans = useMemo(() => roomsFromScanMeta(scanMeta || null), [scanMeta]);
  const [planKey, setPlanKey] = useState<'whole' | string>('whole');

  // Zdjęcia pogrupowane po pomieszczeniu (w kolejności galerii).
  const photosByRoom = useMemo(() => {
    const byKey = new Map(photoRooms.map((item) => [item.url, item.room]));
    const groups: Array<{ room: string; urls: string[] }> = [];
    for (const url of photos) {
      const room = byKey.get(photoRoomKey(url));
      if (!room) continue;
      const group = groups.find((g) => sameRoomName(g.room, room));
      if (group) group.urls.push(url);
      else groups.push({ room, urls: [url] });
    }
    return groups;
  }, [photos, photoRooms]);
  const photosFor = (name: string | null | undefined) => photosByRoom.find((g) => sameRoomName(g.room, name))?.urls || [];
  // Pomieszczenia ze zdjęciami, których nie ma na rzucie (np. balkon, widok) — osobne zakładki.
  const photoOnlyRooms = photosByRoom.filter((g) => !roomScans.some((room) => sameRoomName(room.name, g.room)));

  useEffect(() => {
    if (!focusRoom) return;
    const room = roomScans.find((r) => sameRoomName(r.name, focusRoom.room));
    setPlanKey(room ? room.id : photoOnlyRooms.some((g) => sameRoomName(g.room, focusRoom.room)) ? `photo:${focusRoom.room}` : 'whole');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRoom?.nonce]);
  const selectedRoom: PropertyRoomScan | null =
    planKey === 'whole' ? null : roomScans.find((room) => room.id === planKey) || null;
  const selectedPhotoRoom = planKey.startsWith('photo:') ? planKey.slice(6) : null;
  const selectedPhotos = selectedRoom ? photosFor(selectedRoom.name) : selectedPhotoRoom ? photosFor(selectedPhotoRoom) : [];
  const croppedSelected = selectedRoom ? cropScanMetaToRoom(scanMeta, selectedRoom) : null;
  const activeMeta = useMemo(() => normalizeScanMeta(croppedSelected || selectedRoom?.scanMeta || scanMeta), [croppedSelected, selectedRoom, scanMeta]);
  const active3d = assetUrl(selectedRoom?.floorPlan3dUri) || floorPlan3dSrc || '';
  const hasInteractive = Boolean(activeMeta?.walls?.length);
  // Zawsze „ubrany” rzut: pokój — gotowy rysunek z aplikacji (meble, wymiary); całe mieszkanie — wyprostowany plan z meblami.
  const roomImage = assetUrl(selectedRoom?.floorPlanPngUri);
  const showDrawing = selectedRoom ? !roomImage && hasInteractive : hasInteractive;
  // Bez planu całości (skanowane tylko pokoje) „Całe mieszkanie” to zestawienie pomieszczeń, a nie rysunek jednego z nich.
  const roomPngs = new Set(roomScans.map((room) => assetUrl(room.floorPlanPngUri)).filter(Boolean));
  const wholeImage = floorPlanSrc && !roomPngs.has(assetUrl(floorPlanSrc)) ? floorPlanSrc : '';
  const mosaicRooms = roomScans.filter((room) => room.floorPlanPngUri);
  const showMosaic = !selectedRoom && !hasInteractive && !wholeImage && mosaicRooms.length > 0;
  const furniture = activeMeta?.objects || [];

  const metaLine = useMemo(() => {
    if (!activeMeta && !selectedRoom) return null;
    const parts: string[] = [];
    if (selectedRoom) {
      parts.push(selectedRoom.name);
      if (selectedRoom.widthM && selectedRoom.lengthM) {
        parts.push(`${selectedRoom.widthM} × ${selectedRoom.lengthM} m`);
      }
      if (selectedRoom.areaM2) parts.push(`${selectedRoom.areaM2} m²`);
      if (selectedRoom.heightM) parts.push(`H ${selectedRoom.heightM} m`);
      return parts.join(' · ');
    }
    if (activeMeta?.roomCount && activeMeta.roomCount > 0) {
      parts.push(formatRoomScanRoomCount(activeMeta.roomCount, locale));
    }
    if (activeMeta?.totalAreaSqM) parts.push(`~${activeMeta.totalAreaSqM} m²`);
    if (activeMeta?.ceilingHeightM) parts.push(`H ${activeMeta.ceilingHeightM.toFixed(2)} m`);
    return parts.join(' · ');
  }, [activeMeta, locale, selectedRoom]);

  if (!floorPlanSrc && !floorPlan3dSrc && !roomScans.length && !scanMeta?.walls?.length) return null;

  const chips = roomScans.length > 0 || photoOnlyRooms.length > 0 ? (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => setPlanKey('whole')}
        aria-pressed={planKey === 'whole'}
        className={`eos-plan-chip ${planKey === 'whole' ? 'is-active' : ''}`}
      >
        {copy.floorPlanScan.wholeHome}
      </button>
      {roomScans.map((room) => (
        <button
          key={room.id || room.name}
          type="button"
        onClick={() => setPlanKey(room.id)}
          aria-pressed={planKey === room.id}
        className={`eos-plan-chip ${planKey === room.id ? 'is-active' : ''}`}
        >
          {room.name}
          {photosFor(room.name).length ? <span className="eos-plan-chip__count">{photosFor(room.name).length}</span> : null}
        </button>
      ))}
      {photoOnlyRooms.map((group) => (
        <button
          key={`photo-${group.room}`}
          type="button"
          onClick={() => setPlanKey(`photo:${group.room}`)}
          aria-pressed={planKey === `photo:${group.room}`}
          className={`eos-plan-chip ${planKey === `photo:${group.room}` ? 'is-active' : ''}`}
        >
          {group.room}
          <span className="eos-plan-chip__count">{group.urls.length}</span>
        </button>
      ))}
    </div>
  ) : null;

  // Pomiary z LiDAR-u pod każdym rzutem (pokój albo całe mieszkanie).
  const specs = scanMeta || roomScans.length ? planSpecs(selectedRoom, selectedRoom?.scanMeta || scanMeta || null, roomScans) : [];
  const specGrid = specs.length ? (
    <dl className="eos-plan-specs" key={`specs-${planKey}`}>
      {specs.map((spec) => (
        <div key={spec.label} className="eos-plan-specs__item">
          <dt>{spec.label}</dt>
          <dd>{spec.value}</dd>
        </div>
      ))}
    </dl>
  ) : null;

  const photoStrip = selectedPhotos.length ? (
    <div className="eos-plan-photos" key={planKey}>
      {selectedPhotos.slice(0, 12).map((url, i) => (
        <button
          key={url}
          type="button"
          onClick={() => onOpenPhoto?.(url)}
          className="eos-plan-photos__item"
          style={{ animationDelay: `${i * 40}ms` }}
          aria-label="Otwórz zdjęcie"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" loading="lazy" />
        </button>
      ))}
    </div>
  ) : null;

  const lang = locale === 'pl' ? 'pl' : 'en';
  const furnitureGroups = FURNITURE_GROUPS.map((group) => {
    const items = group.cats
      .map((cat) => ({ cat, count: furniture.filter((obj) => obj.category === cat).length }))
      .filter((item) => item.count > 0);
    return { label: group[lang], items };
  }).filter((group) => group.items.length);
  const furnitureRow = furnitureGroups.length ? (
    <div className="grid gap-x-6 gap-y-2 sm:grid-cols-3">
      {furnitureGroups.map((group) => (
        <div key={group.label}>
          <p className="mb-1 text-[11px] font-semibold text-[var(--eos-muted)]">{group.label}</p>
          <p className="text-[13px] leading-relaxed text-[var(--eos-text)]">
            {group.items.map((item, index) => (
              <span key={item.cat}>
                {index ? ' · ' : ''}
                {FURNITURE_LABEL[item.cat][lang]}
                {item.count > 1 ? <span className="text-[var(--eos-muted)]"> ×{item.count}</span> : null}
              </span>
            ))}
          </p>
        </div>
      ))}
    </div>
  ) : null;
  const planCanvas = (
    <div className="relative z-10 flex h-full w-full items-center justify-center p-4">
      {showDrawing && activeMeta ? (
        <FloorPlanScanArtboard
          walls={activeMeta.walls}
          meta={activeMeta}
          width={variant === 'compact' ? 640 : 960}
          height={variant === 'compact' ? 480 : 600}
          locale={locale}
        />
      ) : showMosaic ? (
        <div className="eos-plan-mosaic" style={{ gridTemplateColumns: `repeat(${mosaicRooms.length <= 2 ? mosaicRooms.length : mosaicRooms.length <= 4 ? 2 : 3}, minmax(0, 1fr))` }}>
          {mosaicRooms.map((room) => (
            <span
              key={room.id || room.name}
              role="button"
              tabIndex={0}
              className="eos-plan-mosaic__tile"
              onClick={(event) => {
                event.stopPropagation();
                setPlanKey(room.id);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') setPlanKey(room.id);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={assetUrl(room.floorPlanPngUri)} alt="" loading="lazy" />
              <span className="eos-plan-mosaic__label">
                {room.name}
                {room.areaM2 ? <b>{String(room.areaM2).replace('.', ',')} m²</b> : null}
              </span>
            </span>
          ))}
        </div>
      ) : roomImage || (selectedRoom ? '' : wholeImage) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={roomImage || wholeImage}
          src={roomImage || wholeImage}
          alt={copy.floorPlan}
          className="eos-plan-fade h-full w-full object-contain"
        />
      ) : null}
    </div>
  );

  if (!floorPlanSrc && floorPlan3dSrc && !roomScans.length && !hasInteractive) {
    return (
      <div className={variant === 'compact' ? 'eos-offer-panel overflow-hidden p-0' : 'eos-offer-panel mb-8 overflow-hidden p-0'}>
        <FloorPlan3dWalkthrough modelUrl={floorPlan3dSrc} copy={copy.floorPlanWalkthrough} compact={variant === 'compact'} />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <section className="eos-aside-card eos-reveal overflow-hidden !p-0">
        <div className="px-4 pb-3 pt-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h4 className="eos-aside-card__title !mb-1">{copy.floorPlan}</h4>
              {metaLine ? <p className="text-[12px] font-medium text-[var(--eos-muted)]">{metaLine}</p> : null}
            </div>
            {scanMeta ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-400/30 bg-sky-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-sky-700 dark:bg-sky-500/10 dark:text-sky-200">
                <ScanLine size={10} />
                {copy.floorPlanScan.lidarBadge}
              </span>
            ) : null}
          </div>
          {chips ? <div className="mb-3">{chips}</div> : null}
          <button type="button" onClick={onEnlarge} className="eos-plan-frame group block w-full" aria-label={copy.enlarge}>
            <div className="aspect-[4/3] w-full">{planCanvas}</div>
            <span className="eos-plan-frame__hint">
              <Maximize2 size={12} />
              {copy.enlarge}
            </span>
          </button>
          {specGrid ? <div className="mt-3">{specGrid}</div> : null}
          {photoStrip ? <div className="mt-3">{photoStrip}</div> : null}
        </div>
        {furnitureRow ? <div className="px-4 pb-4">{furnitureRow}</div> : null}
        {active3d || hasInteractive ? (
          <div className="border-t border-[var(--eos-border)] px-4 pb-4">
            <FloorPlan3dWalkthrough
              modelUrl={active3d}
              scanMeta={activeMeta}
              copy={copy.floorPlanWalkthrough}
              compact
            />
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="eos-offer-panel mb-8 overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--eos-border)] px-6 py-5 md:px-8">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <FileImage size={16} className={themeColors.textActive} />
            <h3 className="eos-offer-metric-label">{copy.floorPlan}</h3>
            {scanMeta ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-sky-800 dark:border-sky-400/25 dark:bg-sky-500/10 dark:text-sky-100">
                <ScanLine size={11} />
                {copy.floorPlanScan.lidarBadge}
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 text-sm text-[var(--eos-muted)]">
            {scanMeta ? metaLine || copy.floorPlanScan.subtitle : copy.floorPlanScan.layoutSubtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onEnlarge ? (
            <button
              type="button"
              onClick={onEnlarge}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition-colors ${themeColors.borderActive} ${themeColors.bgActiveSoft} hover:bg-[var(--eos-surface-strong)]`}
            >
              <Maximize2 size={13} />
              {copy.enlarge}
            </button>
          ) : null}
        </div>
      </div>

      {chips ? <div className="border-b border-[var(--eos-border)] px-6 py-3 md:px-8">{chips}</div> : null}

      <button
        type="button"
        onClick={onEnlarge}
        className="group block w-full px-6 py-6 md:px-8"
      >
        <div className="relative aspect-[16/10] overflow-hidden rounded-[1.75rem] border border-[var(--eos-border)] bg-[#f4f7fb] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_55%)]" />
          {planCanvas}
          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-5 py-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">{copy.enlarge}</span>
          </div>
        </div>
      </button>

      {specGrid ? <div className="px-6 pb-4 md:px-8">{specGrid}</div> : null}
      {photoStrip ? <div className="px-6 pb-5 md:px-8">{photoStrip}</div> : null}

      {furnitureRow ? (
        <div className="border-t border-[var(--eos-border)] px-6 py-4 md:px-8">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">
            {copy.floorPlanScan.furniture}
          </p>
          {furnitureRow}
        </div>
      ) : null}

      {active3d || hasInteractive ? (
        <FloorPlan3dWalkthrough
          modelUrl={active3d}
          scanMeta={activeMeta}
          copy={{
            ...copy.floorPlanWalkthrough,
            title: selectedRoom ? copy.floorPlanScan.roomWalkthrough : copy.floorPlanWalkthrough.title,
          }}
        />
      ) : null}

      {roomScans.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 border-t border-[var(--eos-border)] p-4 sm:grid-cols-2 md:grid-cols-3">
          {roomScans.map((room) => {
            const cropped = normalizeScanMeta(cropScanMetaToRoom(scanMeta, room));
            const areaLabel = room.areaM2 ? `${formatListingAreaSqm(room.areaM2)} m²` : null;
            const selected = planKey === room.id;
            return (
              <button
                key={room.id || room.name}
                type="button"
                onClick={() => setPlanKey(room.id)}
                className={`flex items-stretch overflow-hidden rounded-[1.15rem] border text-left transition ${
                  selected
                    ? 'border-[#c9a227]/60 bg-[#f7f1e4] shadow-[inset_0_0_0_1px_rgba(201,162,39,0.2)] dark:border-amber-400/35 dark:bg-amber-500/10'
                    : 'border-[#e4d7b8] bg-[#fffdf8] hover:border-[#c9a227]/45 dark:border-[var(--eos-border)] dark:bg-[var(--eos-surface)]'
                }`}
              >
                {cropped?.walls?.length ? (
                  <div className="h-[76px] w-[88px] shrink-0 overflow-hidden bg-[#f3ead8]">
                    <FloorPlanScanArtboard
                      walls={cropped.walls}
                      meta={cropped}
                      width={88}
                      height={76}
                      locale={locale}
                      compact
                    />
                  </div>
                ) : room.floorPlanPngUri ? (
                  <img
                    src={assetUrl(room.floorPlanPngUri)}
                    alt=""
                    className="h-[76px] w-[88px] shrink-0 object-cover bg-[#f3ead8]"
                  />
                ) : (
                  <div className="flex h-[76px] w-[88px] shrink-0 flex-col items-center justify-center bg-[#f3ead8] text-[#8a6d1f]">
                    <span className="font-[Georgia,serif] text-lg font-semibold leading-none tracking-tight">
                      {areaLabel ? formatListingAreaSqm(room.areaM2) : '—'}
                    </span>
                    {areaLabel ? (
                      <span className="mt-1 text-[8px] font-semibold uppercase tracking-[0.16em]">m²</span>
                    ) : null}
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col justify-center px-3.5 py-3">
                  {areaLabel ? (
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a6d1f]">
                      {areaLabel}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-sm font-semibold leading-snug tracking-[-0.01em] text-[#1a1916] dark:text-[var(--eos-text)]">
                    {room.name}
                  </p>
                  {room.widthM && room.lengthM ? (
                    <p className="mt-1 text-[11px] text-[#8a8170] dark:text-[var(--eos-muted)]">
                      {room.widthM} × {room.lengthM} m
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      ) : extraFloorPlanSrcs.filter((src) => src && src !== floorPlanSrc).length > 0 ? (
        <div className="grid grid-cols-2 gap-3 border-t border-[var(--eos-border)] p-4 md:grid-cols-3">
          {extraFloorPlanSrcs.filter((src) => src && src !== floorPlanSrc).map((src) => (
            <img key={src} src={src} alt="Dodatkowy plan" className="h-36 w-full rounded-xl object-contain bg-black/20" />
          ))}
        </div>
      ) : null}
    </section>
  );
}
