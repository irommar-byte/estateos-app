import type { OtodomImportDraft } from '@/lib/otodomImport';

const FLOOR_PLAN_URL_RE =
  /floor[-_]?plan|floorplan|rzut|plan[-_]?(mieszkania|lokalu|pi[eę]tr|pi[eę]tra)|layout|schemat|uk[łl]ad|uklad|blueprint|grundriss/i;

export function suggestFloorPlanFromUrl(url: string): boolean {
  const decoded = (() => {
    try {
      return decodeURIComponent(url);
    } catch {
      return url;
    }
  })();
  return FLOOR_PLAN_URL_RE.test(url) || FLOOR_PLAN_URL_RE.test(decoded);
}

export function suggestLastImageIsFloorPlan(draft: Pick<OtodomImportDraft, 'imageUrls' | 'title' | 'descriptionText' | 'features'>): boolean {
  const urls = draft.imageUrls || [];
  if (urls.length === 0) return false;

  const last = urls[urls.length - 1];
  if (suggestFloorPlanFromUrl(last)) return true;

  const hay = `${draft.title || ''} ${draft.descriptionText || ''} ${(draft.features || []).join(' ')}`.toLowerCase();
  if (urls.length >= 2 && /rzut|rzuty|plan lokalu|plan mieszkania|plan pi[eę]tra|uk[łl]ad/i.test(hay)) {
    return true;
  }

  return false;
}

export async function analyzeBufferLikelyFloorPlan(buffer: Buffer): Promise<boolean> {
  try {
    const sharp = (await import('sharp')).default;
    const img = sharp(buffer);
    const meta = await img.metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w < 80 || h < 80) return false;

    const aspect = w / h;
    const landscapeOk = aspect >= 1.1 && aspect <= 3.2;

    const stats = await img.stats();
    const rMean = stats.channels[0]?.mean ?? 128;
    const gMean = stats.channels[1]?.mean ?? rMean;
    const bMean = stats.channels[2]?.mean ?? rMean;
    const brightness = (rMean + gMean + bMean) / 3;
    const brightBackground = brightness > 165;

    const raw = await img.clone().resize(72, 72, { fit: 'inside' }).greyscale().raw().toBuffer();
    let edgeSum = 0;
    for (let i = 1; i < raw.length; i += 1) {
      edgeSum += Math.abs(raw[i] - raw[i - 1]);
    }
    const edgeAvg = edgeSum / Math.max(raw.length - 1, 1);
    const lineDrawing = edgeAvg > 6 && edgeAvg < 55;

    return landscapeOk && brightBackground && lineDrawing;
  } catch {
    return false;
  }
}

export async function resolveLastImageIsFloorPlan(
  draft: Pick<OtodomImportDraft, 'imageUrls' | 'title' | 'descriptionText' | 'features'>,
  override: boolean | undefined,
  lastImageBuffer?: Buffer | null,
): Promise<boolean> {
  if (override === true) return true;
  if (override === false) return false;

  if (suggestLastImageIsFloorPlan(draft)) return true;
  if (lastImageBuffer?.length) {
    return analyzeBufferLikelyFloorPlan(lastImageBuffer);
  }
  return false;
}

export function peekLastImageInfo(draft: OtodomImportDraft): {
  lastImageUrl: string | null;
  imageCount: number;
  suggestedFloorPlan: boolean;
} {
  const urls = draft.imageUrls || [];
  const lastImageUrl = urls.length > 0 ? urls[urls.length - 1] : null;
  return {
    lastImageUrl,
    imageCount: urls.length,
    suggestedFloorPlan: suggestLastImageIsFloorPlan(draft),
  };
}
