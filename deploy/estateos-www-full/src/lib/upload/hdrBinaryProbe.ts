export type HdrByteProbe = {
  isHdr: boolean;
  hasGainMap: boolean;
  signals: string[];
};

const TEXT_MARKERS = [
  'urn:iso:std:iso:ts:21496',
  'HDRGainMap',
  'hdrgm',
  'apple:singleimage:hdr',
  'GainMapHdr',
  'HDRGainMapVersion',
];

function asciiBoxType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset] || 0,
    bytes[offset + 1] || 0,
    bytes[offset + 2] || 0,
    bytes[offset + 3] || 0,
  );
}

/** Szuka prawdziwego HDR: gain map / tmap / Apple HDR — nie Display P3. */
export function probeHdrFromBytes(input: Uint8Array | ArrayBuffer): HdrByteProbe {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const signals: string[] = [];
  if (!bytes.length) return { isHdr: false, hasGainMap: false, signals };

  const sampleLen = Math.min(bytes.length, 2 * 1024 * 1024);
  const sample = bytes.subarray(0, sampleLen);
  const ascii = latin1(sample);

  for (const marker of TEXT_MARKERS) {
    if (ascii.includes(marker)) signals.push(`binary:${marker}`);
  }
  if (/gain.?map/i.test(ascii)) signals.push('binary:gain-map-text');

  for (let i = 0; i + 8 <= sample.length; i++) {
    const type = asciiBoxType(sample, i + 4);
    if (type === 'tmap') {
      signals.push('bmff:tmap');
      break;
    }
  }

  const hasGainMap = signals.some(
    (s) =>
      s.includes('gain') ||
      s.includes('21496') ||
      s.includes('tmap') ||
      s.includes('HDRGainMap') ||
      s.includes('hdrgm') ||
      s.includes('apple:singleimage:hdr'),
  );

  return { isHdr: hasGainMap, hasGainMap, signals: [...new Set(signals)] };
}

const PROBE_BYTES = 2 * 1024 * 1024;

export async function probeHdrFromBlob(blob: Blob): Promise<boolean> {
  const slice = blob.size > PROBE_BYTES ? blob.slice(0, PROBE_BYTES) : blob;
  const buf = await slice.arrayBuffer();
  return probeHdrFromBytes(new Uint8Array(buf)).isHdr;
}

export async function probeHdrFromUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    const view = buf.byteLength > PROBE_BYTES ? buf.slice(0, PROBE_BYTES) : buf;
    return probeHdrFromBytes(new Uint8Array(view)).isHdr;
  } catch {
    return false;
  }
}

function latin1(sample: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('iso-8859-1').decode(sample);
  }
  const chunk = 4096;
  let out = '';
  for (let i = 0; i < sample.length; i += chunk) {
    const slice = sample.subarray(i, i + chunk);
    let piece = '';
    for (let j = 0; j < slice.length; j++) piece += String.fromCharCode(slice[j]);
    out += piece;
  }
  return out;
}
