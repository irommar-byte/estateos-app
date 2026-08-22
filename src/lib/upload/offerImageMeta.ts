import { promises as fs } from 'fs';
import path from 'path';
import type { HdrDetectionResult } from '@/lib/upload/hdrDetection';
import { OFFER_UPLOAD_BASE_FS } from '@/lib/upload/offerMediaUpload';

export type OfferImageMeta = {
  isHdr: boolean;
  masterUrl?: string | null;
  sdrUrl: string;
  hdrDisplayUrl?: string | null;
  masterMime?: string;
  transferCharacteristics?: string;
  hasGainMap?: boolean;
  colorSpace?: string;
  width?: number;
  height?: number;
  format?: string;
  bitDepth?: string;
  detectedAt: string;
  signals?: string[];
};

export type OfferImageMetaPublic = Pick<
  OfferImageMeta,
  'isHdr' | 'masterUrl' | 'sdrUrl' | 'hdrDisplayUrl' | 'masterMime' | 'transferCharacteristics' | 'hasGainMap' | 'colorSpace' | 'width' | 'height'
>;

function metaDir(offerId: number) {
  return path.join(OFFER_UPLOAD_BASE_FS, String(offerId), 'meta');
}

function stemFromPublicUrl(publicUrl: string): string {
  const base = publicUrl.split('/').pop() || '';
  return base.replace(/\.[^.]+$/, '');
}

/** Exported for artifact deletion (same stem logic as sidecar JSON). */
export function stemFromPublicUrlForDelete(publicUrl: string): string {
  return stemFromPublicUrl(publicUrl);
}

export async function saveOfferImageMeta(
  offerId: number,
  publicSdrUrl: string,
  meta: Omit<OfferImageMeta, 'sdrUrl' | 'detectedAt'> & { detectedAt?: string },
): Promise<void> {
  const stem = stemFromPublicUrl(publicSdrUrl);
  const dir = metaDir(offerId);
  await fs.mkdir(dir, { recursive: true });
  const payload: OfferImageMeta = {
    ...meta,
    sdrUrl: publicSdrUrl,
    detectedAt: meta.detectedAt || new Date().toISOString(),
  };
  await fs.writeFile(path.join(dir, `${stem}.json`), JSON.stringify(payload), 'utf8');
}

export async function readOfferImageMeta(
  offerId: number,
  publicUrl: string,
): Promise<OfferImageMeta | null> {
  const stem = stemFromPublicUrl(publicUrl);
  try {
    const raw = await fs.readFile(path.join(metaDir(offerId), `${stem}.json`), 'utf8');
    return JSON.parse(raw) as OfferImageMeta;
  } catch {
    return null;
  }
}

export async function readAllOfferImageMeta(offerId: number): Promise<Record<string, OfferImageMeta>> {
  const dir = metaDir(offerId);
  const out: Record<string, OfferImageMeta> = {};
  try {
    const files = await fs.readdir(dir);
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(dir, f), 'utf8');
        const parsed = JSON.parse(raw) as OfferImageMeta;
        if (parsed.sdrUrl) out[parsed.sdrUrl] = parsed;
      } catch {
        /* skip corrupt meta */
      }
    }
  } catch {
    /* no meta dir */
  }
  return out;
}

export function hdrMetaFromDetection(
  detection: HdrDetectionResult,
  masterUrl: string | null,
): Omit<OfferImageMeta, 'sdrUrl' | 'detectedAt'> {
  return {
    isHdr: detection.isHdr,
    masterUrl,
    hdrDisplayUrl: masterUrl,
    masterMime: detection.masterMime,
    transferCharacteristics: detection.transferCharacteristics,
    hasGainMap: detection.hasGainMap,
    colorSpace: detection.colorSpace,
    width: detection.width,
    height: detection.height,
    format: detection.format,
    bitDepth: detection.bitDepth,
    signals: detection.signals,
  };
}

export function toPublicImageMeta(meta: OfferImageMeta): OfferImageMetaPublic {
  return {
    isHdr: meta.isHdr,
    masterUrl: meta.masterUrl,
    sdrUrl: meta.sdrUrl,
    hdrDisplayUrl: meta.hdrDisplayUrl || meta.masterUrl,
    masterMime: meta.masterMime,
    transferCharacteristics: meta.transferCharacteristics,
    hasGainMap: meta.hasGainMap,
    colorSpace: meta.colorSpace,
    width: meta.width,
    height: meta.height,
  };
}

export async function readPublicOfferImageMeta(offerId: number): Promise<Record<string, OfferImageMetaPublic>> {
  const all = await readAllOfferImageMeta(offerId);
  const out: Record<string, OfferImageMetaPublic> = {};
  for (const [url, meta] of Object.entries(all)) {
    out[url] = toPublicImageMeta(meta);
  }
  return out;
}
