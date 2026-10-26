import { API_URL } from '../config/network';
import { resolveMediaUrl } from '../utils/userAvatar';

export function firstOfferImageUrl(raw: unknown): string | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') {
        const url = resolveMediaUrl(item);
        if (url) return url;
        continue;
      }
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        const url = resolveMediaUrl(rec.url ?? rec.src ?? rec.path ?? rec.uri ?? rec.imageUrl);
        if (url) return url;
      }
    }
    return null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return firstOfferImageUrl(JSON.parse(trimmed));
      } catch {
        return resolveMediaUrl(trimmed);
      }
    }
    return resolveMediaUrl(trimmed);
  }
  if (typeof raw === 'object') {
    const rec = raw as Record<string, unknown>;
    return resolveMediaUrl(rec.url ?? rec.src ?? rec.path ?? rec.uri ?? rec.imageUrl);
  }
  return null;
}

export async function fetchPublicOfferCover(offerId: number): Promise<string | null> {
  if (!Number.isFinite(offerId) || offerId <= 0) return null;
  try {
    const res = await fetch(`${API_URL}/api/offers/${offerId}`);
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return firstOfferImageUrl(json.images) || firstOfferImageUrl(json.imageUrl);
  } catch {
    return null;
  }
}
