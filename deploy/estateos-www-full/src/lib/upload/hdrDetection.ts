import { probeHdrFromBytes } from '@/lib/upload/hdrBinaryProbe';

export type HdrDetectionResult = {
  isHdr: boolean;
  confidence: 'high' | 'medium' | 'low';
  signals: string[];
  colorSpace?: string;
  transferCharacteristics?: 'pq' | 'hlg' | 'srgb' | 'unknown';
  width?: number;
  height?: number;
  format?: string;
  bitDepth?: string;
  hasGainMap?: boolean;
  masterMime?: string;
};

const HDR_ICC_RE = /smpte2084|bt\.?2100|rec\.?2100|\bpq\b|hlg|arib-std-b67/i;

function inferTransfer(iccSample: string, space: string): HdrDetectionResult['transferCharacteristics'] {
  if (/smpte2084|pq|bt2100.?pq/i.test(iccSample)) return 'pq';
  if (/arib-std-b67|hlg|bt2100.?hlg/i.test(iccSample)) return 'hlg';
  if (space === 'rec2100' || space === 'rec2020') return 'pq';
  return 'unknown';
}

function evaluateHdr(signals: string[]): boolean {
  return signals.some(
    (s) =>
      s === 'colorspace:rec2100' ||
      s === 'icc-hdr-profile' ||
      s.startsWith('binary:urn:iso:std:iso:ts:21496') ||
      s.startsWith('binary:HDRGainMap') ||
      s.startsWith('binary:hdrgm') ||
      s.startsWith('binary:apple:singleimage:hdr') ||
      s.startsWith('binary:GainMapHdr') ||
      s.startsWith('bmff:tmap') ||
      s.includes('gain-map'),
  );
}

/**
 * Wykrywa prawdziwe HDR na podstawie metadanych technicznych (ICC, color space, HEIF, gain map, XMP).
 * Nie oznacza jako HDR tylko dlatego, że zdjęcie jest jasne.
 */
export async function detectHdrImage(
  buffer: Buffer,
  mimeHint?: string | null,
): Promise<HdrDetectionResult> {
  const probe = probeHdrFromBytes(buffer);
  const signals: string[] = [...probe.signals];
  let transfer: HdrDetectionResult['transferCharacteristics'] = 'unknown';
  let hasGainMap = probe.hasGainMap;

  try {
    const sharp = (await import('sharp')).default;
    const meta = await sharp(buffer, { failOn: 'none' }).metadata();
    const space = String(meta.space || '').toLowerCase();
    const depth = String(meta.depth || '');
    const format = String(meta.format || '');

    if (space === 'rec2100' || space === 'rec2020') {
      signals.push(`colorspace:${space}`);
    }

    if (space === 'p3' && (depth === 'uint16' || depth === 'float')) {
      signals.push('display-p3-high-depth');
    }

    const mime = (mimeHint || '').toLowerCase();
    if (mime.includes('heic') || mime.includes('heif') || format === 'heif') {
      if (space === 'rec2020' || space === 'p3' || space === 'rec2100') {
        signals.push('heif-wide-gamut');
      }
      if (typeof meta.pages === 'number' && meta.pages > 1) {
        signals.push('heif-multi-image');
      }
    }

    if (meta.icc && meta.icc.length > 0) {
      const iccSample = meta.icc.subarray(0, Math.min(meta.icc.length, 2048)).toString('latin1');
      if (HDR_ICC_RE.test(iccSample)) {
        signals.push('icc-hdr-profile');
      }
      transfer = inferTransfer(iccSample, space);
    } else {
      transfer = inferTransfer('', space);
    }

    if ((format === 'jpeg' || format === 'jpg') && depth === 'uint16') {
      signals.push('jpeg-high-bit-depth');
    }

    const uniqueSignals = [...new Set(signals)];
    hasGainMap =
      hasGainMap ||
      uniqueSignals.some(
        (s) => s.includes('gain') || s.includes('GContainer') || s.includes('21496') || s.includes('tmap'),
      );

    const isHdr = evaluateHdr(uniqueSignals);

    return {
      isHdr,
      confidence: uniqueSignals.filter((s) => !s.startsWith('binary:')).length >= 2 ? 'high' : uniqueSignals.length >= 1 ? 'medium' : 'low',
      signals: uniqueSignals,
      colorSpace: meta.space,
      transferCharacteristics: transfer,
      width: meta.width,
      height: meta.height,
      format: meta.format,
      bitDepth: meta.depth ? String(meta.depth) : undefined,
      hasGainMap,
      masterMime: mimeHint || (format === 'heif' ? 'image/heic' : undefined),
    };
  } catch {
    const uniqueSignals = [...new Set(signals)];
    return {
      isHdr: evaluateHdr(uniqueSignals),
      confidence: 'low',
      signals: uniqueSignals.length ? uniqueSignals : ['metadata_unreadable'],
      hasGainMap,
    };
  }
}

export function masterExtensionForMime(mime: string, fallback = '.jpg'): string {
  const m = mime.toLowerCase();
  if (m.includes('heic') || m.includes('heif')) return '.heic';
  if (m.includes('png')) return '.png';
  if (m.includes('webp')) return '.webp';
  if (m.includes('jpeg') || m.includes('jpg')) return '.jpg';
  return fallback;
}

export function masterMimeFromExtension(ext: string): string {
  const e = ext.toLowerCase();
  if (e.includes('.heic') || e.includes('.heif')) return 'image/heic';
  if (e.includes('.png')) return 'image/png';
  if (e.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}
