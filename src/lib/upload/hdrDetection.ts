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

const HDR_ICC_RE = /hdr|pq|hlg|rec\.?2020|2100|smpte2084|arib-std-b67|bt2020|display\s*p3/i;
const ULTRA_HDR_MARKERS = [
  'urn:iso:std:iso:ts:21496',
  'GContainer:Directory',
  'hdrgm',
  'HDRGainMap',
  'Container:Directory',
  'apple:singleimage:hdr',
];

function scanBinaryMarkers(buffer: Buffer): string[] {
  const signals: string[] = [];
  if (!buffer || buffer.length < 64) return signals;

  const sampleLen = Math.min(buffer.length, 256 * 1024);
  const sample = buffer.subarray(0, sampleLen);

  const ascii = sample.toString('latin1');
  for (const marker of ULTRA_HDR_MARKERS) {
    if (ascii.includes(marker)) signals.push(`binary:${marker}`);
  }

  if (/gain.?map/i.test(ascii)) signals.push('binary:gain-map-text');
  if (/tmap|auxiliary/i.test(ascii) && ascii.includes('ftyp')) {
    signals.push('binary:heif-auxiliary');
  }

  // ISO BMFF box scan for Apple HDR auxiliary (tmap, mime brnd hvc1+grid)
  for (let i = 0; i + 8 < sample.length; i++) {
    const boxType = sample.subarray(i + 4, i + 8).toString('ascii');
    if (boxType === 'tmap' || boxType === 'grid') {
      signals.push(`bmff:${boxType}`);
      break;
    }
  }

  return signals;
}

function inferTransfer(iccSample: string, space: string): HdrDetectionResult['transferCharacteristics'] {
  if (/smpte2084|pq|bt2100.?pq/i.test(iccSample)) return 'pq';
  if (/arib-std-b67|hlg|bt2100.?hlg/i.test(iccSample)) return 'hlg';
  if (space === 'rec2100' || space === 'rec2020') return 'pq';
  return 'unknown';
}

function evaluateHdr(signals: string[]): boolean {
  const strong = signals.some(
    (s) =>
      s.startsWith('colorspace:rec') ||
      s === 'icc-hdr-profile' ||
      s === 'heif-multi-image' ||
      s === 'heif-wide-gamut' ||
      s === 'jpeg-high-bit-depth' ||
      s.startsWith('binary:urn:iso:std:iso:ts:21496') ||
      s.startsWith('binary:GContainer') ||
      s.startsWith('binary:HDRGainMap') ||
      s.startsWith('binary:apple:singleimage:hdr') ||
      s.startsWith('bmff:tmap'),
  );
  if (strong) return true;

  const gainMap = signals.some(
    (s) => s.startsWith('binary:gain-map') || s.startsWith('binary:hdrgm') || s.includes('gain-map'),
  );
  const wideGamut = signals.some(
    (s) => s === 'heif-wide-gamut' || s === 'display-p3-high-depth' || s.startsWith('colorspace:'),
  );
  return gainMap && wideGamut;
}

/**
 * Wykrywa prawdziwe HDR na podstawie metadanych technicznych (ICC, color space, HEIF, gain map, XMP).
 * Nie oznacza jako HDR tylko dlatego, że zdjęcie jest jasne.
 */
export async function detectHdrImage(
  buffer: Buffer,
  mimeHint?: string | null,
): Promise<HdrDetectionResult> {
  const signals: string[] = [...scanBinaryMarkers(buffer)];
  let transfer: HdrDetectionResult['transferCharacteristics'] = 'unknown';
  let hasGainMap = signals.some((s) => s.includes('gain') || s.includes('GContainer') || s.includes('21496'));

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
