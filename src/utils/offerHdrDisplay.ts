import { API_URL } from '../config/network';

export type OfferHdrMetaEntry = {
  isHdr?: boolean;
  hdrDisplayUrl?: string | null;
  masterUrl?: string | null;
  sdrUrl?: string | null;
};

function absolutize(url: string): string {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return `${API_URL}${raw}`;
  return `${API_URL}/${raw}`;
}

function stripOrigin(url: string): string {
  const raw = String(url || '').trim();
  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const parsed = new URL(raw);
      return parsed.pathname;
    }
  } catch {
    /* keep */
  }
  return raw;
}

/** Na iPhonie ładuj master HEIC/JPEG HDR zamiast spłaszczonego WebP. */
export function preferHdrDisplayUri(
  sdrUrl: string,
  metaBySdr: Record<string, OfferHdrMetaEntry> | null | undefined,
): string {
  const absolute = absolutize(sdrUrl);
  if (!metaBySdr) return absolute;
  const path = stripOrigin(absolute);
  const entry =
    metaBySdr[sdrUrl] ||
    metaBySdr[absolute] ||
    metaBySdr[path] ||
    Object.values(metaBySdr).find((item) => {
      const sdr = stripOrigin(String(item?.sdrUrl || ''));
      return sdr && (sdr === path || absolutize(String(item.sdrUrl)) === absolute);
    });
  if (!entry?.isHdr) return absolute;
  const master = entry.hdrDisplayUrl || entry.masterUrl;
  return master ? absolutize(master) : absolute;
}
