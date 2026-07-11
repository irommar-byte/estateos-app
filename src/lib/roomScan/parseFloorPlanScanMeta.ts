import type { FloorPlanScanMeta } from '@/types/roomScan';

export function parseFloorPlanScanMeta(raw: unknown): FloorPlanScanMeta | null {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return null;
    const meta = parsed as Partial<FloorPlanScanMeta>;
    if (meta.version !== 1) return null;
    if (!Array.isArray(meta.walls) || !Array.isArray(meta.sections)) return null;
    if (!meta.bounds || typeof meta.bounds !== 'object') return null;
    return {
      version: 1,
      scannedAt: String(meta.scannedAt || ''),
      roomCount: Number(meta.roomCount) || meta.sections.length || 0,
      totalAreaSqM:
        meta.totalAreaSqM != null && Number.isFinite(Number(meta.totalAreaSqM))
          ? Number(meta.totalAreaSqM)
          : null,
      sections: meta.sections,
      walls: meta.walls,
      bounds: meta.bounds as FloorPlanScanMeta['bounds'],
    };
  } catch {
    return null;
  }
}

export function resolvePublicAssetUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (typeof window !== 'undefined') {
    return trimmed.startsWith('/') ? `${window.location.origin}${trimmed}` : `${window.location.origin}/${trimmed}`;
  }
  return trimmed;
}
