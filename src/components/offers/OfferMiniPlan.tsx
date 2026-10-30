'use client';

import { useMemo } from 'react';
import type { FloorPlanScanMeta } from '@/types/roomScan';
import { normalizeScanMeta } from '@/lib/roomScan/planNormalize';
import { resolveWholePlanMeta } from '@/lib/roomScan/wholePlan';
import FloorPlanScanArtboard from '@/components/offers/FloorPlanScanArtboard';

/** Minirzut z podświetlonym pokojem — w rogu galerii przy zdjęciu przypisanym do pomieszczenia. */
export default function OfferMiniPlan({ meta, room, onClick }: { meta: FloorPlanScanMeta; room: string; onClick?: () => void }) {
  const normalized = useMemo(() => normalizeScanMeta(resolveWholePlanMeta(meta).meta), [meta]);
  if (!normalized?.walls?.length) return null;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      className="eos-lightbox-miniplan"
      aria-label={`${room} — pokaż na planie`}
    >
      <FloorPlanScanArtboard walls={normalized.walls} meta={normalized} width={220} height={150} locale="pl" compact highlight={room} />
      <span className="eos-lightbox-miniplan__label">{room}</span>
    </button>
  );
}
