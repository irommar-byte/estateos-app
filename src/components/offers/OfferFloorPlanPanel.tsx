'use client';

import { useMemo, useState } from 'react';
import { FileImage, Maximize2, ScanLine } from 'lucide-react';
import type { OfferPageCopy } from '@/content/offerPageCopy';
import type { Locale } from '@/i18n/config';
import type { FloorPlanScanMeta, PropertyRoomScan } from '@/types/roomScan';
import { formatRoomScanRoomCount } from '@/lib/roomScan/roomScanLabels';
import { resolvePublicAssetUrl } from '@/lib/roomScan/parseFloorPlanScanMeta';
import FloorPlan3dWalkthrough from '@/components/offers/FloorPlan3dWalkthrough';
import FloorPlanScanArtboard from '@/components/offers/FloorPlanScanArtboard';

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
}: OfferFloorPlanPanelProps) {
  const roomScans = Array.isArray(scanMeta?.roomScans) ? scanMeta.roomScans : [];
  const [planKey, setPlanKey] = useState<'whole' | string>('whole');
  const selectedRoom: PropertyRoomScan | null =
    planKey === 'whole' ? null : roomScans.find((room) => room.id === planKey) || null;
  const activeMeta = selectedRoom?.scanMeta || scanMeta;
  const activeImage = assetUrl(selectedRoom?.floorPlanPngUri) || floorPlanSrc;
  const active3d = assetUrl(selectedRoom?.floorPlan3dUri) || floorPlan3dSrc || '';
  const hasInteractive = Boolean(activeMeta?.walls?.length);
  const [viewMode, setViewMode] = useState<'image' | 'interactive'>(hasInteractive ? 'interactive' : 'image');
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

  const chips = roomScans.length > 0 ? (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setPlanKey('whole')}
        className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${
          planKey === 'whole'
            ? `${themeColors.bgActiveSoft} text-[var(--eos-text)]`
            : 'border border-[var(--eos-border)] text-[var(--eos-muted)]'
        }`}
      >
        {copy.floorPlanScan.wholeHome}
      </button>
      {roomScans.map((room) => (
        <button
          key={room.id || room.name}
          type="button"
        onClick={() => {
          setPlanKey(room.id);
          onEnlarge?.();
        }}
          className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${
            planKey === room.id
              ? `${themeColors.bgActiveSoft} text-[var(--eos-text)]`
              : 'border border-[var(--eos-border)] text-[var(--eos-muted)]'
          }`}
        >
          {room.name}
        </button>
      ))}
    </div>
  ) : null;

  const furnitureRow = furniture.length > 0 ? (
    <div className="flex flex-wrap gap-2">
      {furniture.map((obj) => (
        <span
          key={obj.id}
          className="rounded-full border border-sky-400/30 bg-sky-100 px-2.5 py-1 text-[10px] font-bold text-sky-800 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-100"
        >
          {obj.label}
        </span>
      ))}
    </div>
  ) : null;

  const planCanvas = (
    <div className="relative z-10 flex h-full w-full items-center justify-center p-4">
      {viewMode === 'interactive' && hasInteractive && activeMeta ? (
        <FloorPlanScanArtboard
          walls={activeMeta.walls}
          meta={activeMeta}
          width={variant === 'compact' ? 640 : 960}
          height={variant === 'compact' ? 480 : 600}
          locale={locale}
        />
      ) : activeImage ? (
        <img
          src={activeImage}
          alt={copy.floorPlan}
          className="h-full w-full object-contain"
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
      <div className="eos-offer-panel overflow-hidden p-0">
        <div className="p-4">
          <button
            type="button"
            onClick={onEnlarge}
            className="group w-full text-left transition-colors"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className={`eos-offer-metric-label ${themeColors.textActive}`}>{copy.floorPlan}</p>
                {scanMeta ? (
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-sky-300/90">
                    {copy.floorPlanScan.lidarBadge}
                    {metaLine ? ` · ${metaLine}` : ''}
                  </p>
                ) : null}
              </div>
              <Maximize2 size={14} className="text-[var(--eos-muted)] transition-colors group-hover:text-[var(--eos-text)]" />
            </div>
          </button>
          {chips ? <div className="mb-3">{chips}</div> : null}
          <button type="button" onClick={onEnlarge} className="block w-full">
            <div className="overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[#050505]">
              <div className="aspect-[4/3] w-full">{planCanvas}</div>
            </div>
          </button>
        </div>
        {furnitureRow ? <div className="px-4 pb-3">{furnitureRow}</div> : null}
        {active3d ? (
          <div className="border-t border-[var(--eos-border)] px-4 pb-4">
            <FloorPlan3dWalkthrough modelUrl={active3d} copy={copy.floorPlanWalkthrough} compact />
          </div>
        ) : null}
      </div>
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
          {hasInteractive ? (
            <div className="inline-flex rounded-full border border-[var(--eos-border)] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('image')}
                className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition-colors ${
                  viewMode === 'image'
                    ? `${themeColors.bgActiveSoft} text-[var(--eos-text)]`
                    : 'text-[var(--eos-muted)] hover:text-[var(--eos-text)]'
                }`}
              >
                {copy.floorPlanScan.viewImage}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('interactive')}
                className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition-colors ${
                  viewMode === 'interactive'
                    ? `${themeColors.bgActiveSoft} text-[var(--eos-text)]`
                    : 'text-[var(--eos-muted)] hover:text-[var(--eos-text)]'
                }`}
              >
                {copy.floorPlanScan.viewInteractive}
              </button>
            </div>
          ) : null}
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
        <div className="relative aspect-[16/10] overflow-hidden rounded-[1.75rem] border border-[var(--eos-border)] bg-[#050505] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_55%)]" />
          {planCanvas}
          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-5 py-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">{copy.enlarge}</span>
          </div>
        </div>
      </button>

      {furnitureRow ? (
        <div className="border-t border-[var(--eos-border)] px-6 py-4 md:px-8">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">
            {copy.floorPlanScan.furniture}
          </p>
          {furnitureRow}
        </div>
      ) : null}

      {active3d ? (
        <FloorPlan3dWalkthrough
          modelUrl={active3d}
          copy={{
            ...copy.floorPlanWalkthrough,
            title: selectedRoom ? copy.floorPlanScan.roomWalkthrough : copy.floorPlanWalkthrough.title,
          }}
        />
      ) : null}

      {roomScans.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 border-t border-[var(--eos-border)] p-4 sm:grid-cols-2 md:grid-cols-3">
          {roomScans.map((room) => (
            <button
              key={room.id || room.name}
              type="button"
              onClick={() => {
                setPlanKey(room.id);
                onEnlarge?.();
              }}
              className={`rounded-2xl border p-3 text-left transition-colors ${
                planKey === room.id
                  ? 'border-sky-400/40 bg-sky-500/10'
                  : 'border-[var(--eos-border)] hover:bg-[var(--eos-surface-strong)]'
              }`}
            >
              <p className="text-sm font-bold text-[var(--eos-text)]">{room.name}</p>
              <p className="mt-1 text-[11px] text-[var(--eos-muted)]">
                {[
                  room.widthM && room.lengthM ? `${room.widthM} × ${room.lengthM} m` : null,
                  room.areaM2 ? `${room.areaM2} m²` : null,
                  room.heightM ? `H ${room.heightM} m` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </button>
          ))}
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
