'use client';

import { useMemo, useState } from 'react';
import { FileImage, Maximize2, ScanLine } from 'lucide-react';
import type { OfferPageCopy } from '@/content/offerPageCopy';
import type { Locale } from '@/i18n/config';
import type { FloorPlanScanMeta } from '@/types/roomScan';
import { formatRoomScanRoomCount } from '@/lib/roomScan/roomScanLabels';
import FloorPlan3dWalkthrough from '@/components/offers/FloorPlan3dWalkthrough';
import FloorPlanScanArtboard from '@/components/offers/FloorPlanScanArtboard';

type OfferFloorPlanPanelProps = {
  floorPlanSrc: string;
  floorPlan3dSrc?: string;
  scanMeta?: FloorPlanScanMeta | null;
  locale: Locale;
  copy: OfferPageCopy;
  themeColors: { textActive: string; borderActive: string; bgActiveSoft: string };
  variant?: 'full' | 'compact';
  onEnlarge?: () => void;
};

export default function OfferFloorPlanPanel({
  floorPlanSrc,
  floorPlan3dSrc,
  scanMeta,
  locale,
  copy,
  themeColors,
  variant = 'full',
  onEnlarge,
}: OfferFloorPlanPanelProps) {
  const hasInteractive = Boolean(scanMeta?.walls?.length);
  const [viewMode, setViewMode] = useState<'image' | 'interactive'>(hasInteractive ? 'interactive' : 'image');

  const metaLine = useMemo(() => {
    if (!scanMeta) return null;
    const parts: string[] = [];
    if (scanMeta.roomCount > 0) parts.push(formatRoomScanRoomCount(scanMeta.roomCount, locale));
    if (scanMeta.totalAreaSqM) parts.push(`~${scanMeta.totalAreaSqM} m²`);
    return parts.join(' · ');
  }, [scanMeta, locale]);

  if (!floorPlanSrc && !floorPlan3dSrc) return null;


  if (!floorPlanSrc && floorPlan3dSrc) {
    return (
      <div className={variant === 'compact' ? 'eos-offer-panel overflow-hidden p-0' : 'eos-offer-panel mb-8 overflow-hidden p-0'}>
        <FloorPlan3dWalkthrough modelUrl={floorPlan3dSrc} copy={copy.floorPlanWalkthrough} compact={variant === 'compact'} />
      </div>
    );
  }
  if (variant === 'compact') {
    return (
      <div className="eos-offer-panel overflow-hidden p-0">
        <button
          type="button"
          onClick={onEnlarge}
          className="group w-full p-4 text-left transition-colors hover:bg-[var(--eos-surface-strong)]"
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
          <div className="overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[#050505]">
            {viewMode === 'interactive' && hasInteractive && scanMeta ? (
              <div className="aspect-[4/3] w-full p-2">
                <FloorPlanScanArtboard
                  walls={scanMeta.walls}
                  meta={scanMeta}
                  width={640}
                  height={480}
                  locale={locale}
                />
              </div>
            ) : (
              <img
                src={floorPlanSrc}
                alt={copy.floorPlan}
                className="aspect-[4/3] w-full object-contain p-3 transition-transform duration-500 group-hover:scale-[1.02]"
              />
            )}
          </div>
        </button>
        {floorPlan3dSrc ? (
          <div className="border-t border-[var(--eos-border)] px-4 pb-4">
            <FloorPlan3dWalkthrough modelUrl={floorPlan3dSrc} copy={copy.floorPlanWalkthrough} compact />
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
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/25 bg-sky-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-sky-200">
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

      <button
        type="button"
        onClick={onEnlarge}
        className="group block w-full px-6 py-6 md:px-8"
      >
        <div className="relative aspect-[16/10] overflow-hidden rounded-[1.75rem] border border-[var(--eos-border)] bg-[#050505] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_55%)]" />
          {viewMode === 'interactive' && hasInteractive && scanMeta ? (
            <div className="relative z-10 flex h-full w-full items-center justify-center p-4">
              <FloorPlanScanArtboard
                walls={scanMeta.walls}
                meta={scanMeta}
                width={960}
                height={600}
                locale={locale}
              />
            </div>
          ) : (
            <img
              src={floorPlanSrc}
              className="relative z-10 h-full w-full object-contain p-4 transition-transform duration-700 group-hover:scale-[1.02]"
              alt={copy.floorPlan}
            />
          )}
          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-5 py-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">{copy.enlarge}</span>
          </div>
        </div>
      </button>

      {floorPlan3dSrc ? (
        <FloorPlan3dWalkthrough modelUrl={floorPlan3dSrc} copy={copy.floorPlanWalkthrough} />
      ) : null}
    </section>
  );
}
