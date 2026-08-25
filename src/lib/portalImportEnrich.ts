import type { OtodomImportDraft } from '@/lib/otodomImport';
import { normalizeImportDraftHeating } from '@/lib/otodomImport';
import {
  canonicalizeCity,
  canonicalizeDistrict,
  getStrictCities,
  inferCityFromMapboxFeature,
  inferDistrictFromStreet,
  isNonCityLabel,
  isStrictCity,
  normalizeText,
  pickDistrictFromPlaceName,
} from '@/lib/location/locationCatalog';
import { locationNamesEquivalent } from '@/lib/location/locationNameMatch';
import {
  buildForwardGeocodeSearchText,
  mapboxForwardGeocodeUrl,
  pickBestGeocodeFeature,
} from '@/lib/mapboxGeocodeClient';
import { fetchMapboxReverseFeature } from '@/lib/location/resolveOfferLocationFromCoordinates';

/** Gdy OtoDom poda tylko dzielnicę (np. Służew), dopasuj miasto strict z katalogu. */
export function inferCityFromLocationHints(...hints: (string | null | undefined)[]): string {
  const blob = hints.filter(Boolean).join(' ');
  if (!blob.trim()) return '';
  const blobNorm = normalizeText(blob);

  for (const strictCity of getStrictCities()) {
    const norm = normalizeText(strictCity);
    if (norm.length >= 4 && blobNorm.includes(norm)) {
      return strictCity;
    }
  }

  for (const strictCity of getStrictCities()) {
    if (pickDistrictFromPlaceName(strictCity, blob)) {
      return strictCity;
    }
  }

  return '';
}

export function inferCityFromImportSlug(url: string, title: string): string {
  const slug = String(url || '').match(/\/oferta\/([^/?#]+)/i)?.[1] ?? '';
  const blob = `${slug} ${title}`.toLowerCase();

  for (const city of getStrictCities()) {
    const norm = normalizeText(city);
    const slugToken = norm.replace(/\s+/g, '-');
    if (blob.includes(slugToken) || blob.includes(norm)) {
      return city;
    }
  }

  for (const segment of slug.split('-').filter(Boolean)) {
    if (segment.length < 3) continue;
    if (isNonCityLabel(segment)) continue;
    const fromSegment = canonicalizeCity(segment.replace(/-/g, ' '));
    if (fromSegment && (isStrictCity(fromSegment) || fromSegment.length >= 4)) {
      return fromSegment;
    }
  }

  return '';
}

/**
 * Listing text (Warszawa in title) beats a leftover form city (Białystok).
 * On pin vs city conflict, the pin is the listing's actual place unless the title names another city.
 */
export function pickImportedListingCity(params: {
  draftCity?: string | null;
  hintedCity?: string | null;
  pinCity?: string | null;
}): string {
  const draft = canonicalizeCity(params.draftCity);
  const hinted = canonicalizeCity(params.hintedCity);
  const pin = canonicalizeCity(params.pinCity);

  if (hinted && isStrictCity(hinted)) return hinted;
  if (pin && isStrictCity(pin) && draft && isStrictCity(draft) && !locationNamesEquivalent(draft, pin)) {
    return pin;
  }
  if (!draft || isNonCityLabel(draft)) return pin || hinted || draft;
  if (pin && !isStrictCity(draft) && !locationNamesEquivalent(draft, pin)) {
    return canonicalizeCity(pin);
  }
  return draft || pin || hinted || '';
}

export function listingCityFromDraftText(
  draft: Pick<OtodomImportDraft, 'title' | 'street' | 'descriptionText' | 'externalUrl'>,
): string {
  return (
    inferCityFromLocationHints(draft.title, draft.street, draft.descriptionText, draft.externalUrl) ||
    inferCityFromImportSlug(draft.externalUrl || '', draft.title)
  );
}

async function forwardGeocodeStreetInCity(
  street: string,
  city: string,
): Promise<{ lat: number; lng: number } | null> {
  const token = String(process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '').trim();
  if (!token || !street.trim() || !city.trim()) return null;
  const query = buildForwardGeocodeSearchText(street.trim(), city.trim());
  const url = mapboxForwardGeocodeUrl(query, token, { limit: 5, autocomplete: false, cityHint: city });
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;
    const payload = await response.json();
    const features = Array.isArray(payload?.features) ? payload.features : [];
    const best = pickBestGeocodeFeature(features, query, city);
    const center = Array.isArray(best?.center) ? best.center : null;
    const lng = Number(center?.[0]);
    const lat = Number(center?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

async function resolvePinCity(
  draft: Pick<OtodomImportDraft, 'lat' | 'lng'>,
): Promise<string> {
  if (draft.lat == null || draft.lng == null) return '';
  const feature = await fetchMapboxReverseFeature(draft.lat, draft.lng);
  return canonicalizeCity(inferCityFromMapboxFeature(feature));
}

export function inferDistrictForCity(city: string, draft: Pick<OtodomImportDraft, 'district' | 'neighborhood' | 'title' | 'externalUrl' | 'street'>): string {
  const canonicalCity = canonicalizeCity(city);
  if (!canonicalCity) return '';

  const fromStreet = inferDistrictFromStreet(canonicalCity, draft.street);
  if (fromStreet) return fromStreet;

  const blob = [draft.district, draft.neighborhood, draft.street, draft.title, draft.externalUrl].filter(Boolean).join(' ');
  const fromCatalog = pickDistrictFromPlaceName(canonicalCity, blob);
  if (fromCatalog) return fromCatalog;

  if (draft.neighborhood) return canonicalizeDistrict(canonicalCity, draft.neighborhood);
  if (draft.district) return canonicalizeDistrict(canonicalCity, draft.district);
  return '';
}

export async function enrichOtodomImportDraft(draft: OtodomImportDraft): Promise<OtodomImportDraft> {
  const hintedCity = listingCityFromDraftText(draft);
  const pinCity = await resolvePinCity(draft);
  let city = pickImportedListingCity({
    draftCity: draft.city,
    hintedCity,
    pinCity,
  });
  let lat = draft.lat;
  let lng = draft.lng;

  const pinDisagrees =
    Boolean(city) &&
    Boolean(pinCity) &&
    !locationNamesEquivalent(city, pinCity);

  if (city && (pinDisagrees || lat == null || lng == null) && draft.street) {
    const moved = await forwardGeocodeStreetInCity(draft.street, city);
    if (moved) {
      lat = moved.lat;
      lng = moved.lng;
    }
  }

  let district = String(draft.district || draft.neighborhood || '').trim();
  if (city && (!district || pinDisagrees)) {
    district = inferDistrictForCity(city, draft) || district;
  }

  return normalizeImportDraftHeating({
    ...draft,
    lat,
    lng,
    city: canonicalizeCity(city),
    district: canonicalizeDistrict(city, district || draft.district),
  });
}

export type PortalImportPatch = {
  city?: string;
  district?: string;
  price?: number | null;
  area?: number | null;
};

export function applyImportDraftPatch(draft: OtodomImportDraft, patch?: PortalImportPatch): OtodomImportDraft {
  if (!patch) return draft;

  const city =
    patch.city != null && String(patch.city).trim()
      ? canonicalizeCity(String(patch.city).trim())
      : draft.city;
  const district =
    patch.district != null && String(patch.district).trim()
      ? canonicalizeDistrict(city, String(patch.district).trim())
      : draft.district;

  return {
    ...draft,
    city: city || draft.city,
    district: district || draft.district,
    price:
      patch.price != null && Number.isFinite(Number(patch.price)) && Number(patch.price) > 0
        ? Number(patch.price)
        : draft.price,
    area:
      patch.area != null && Number.isFinite(Number(patch.area)) && Number(patch.area) > 0
        ? Number(patch.area)
        : draft.area,
  };
}

export function filterImportDraftImages(
  draft: OtodomImportDraft,
  selectedImageIndices: number[] | null | undefined,
  floorPlanImageIndex: number | null | undefined,
): { draft: OtodomImportDraft; floorPlanImageIndex: number | null } {
  if (!selectedImageIndices?.length) {
    return { draft, floorPlanImageIndex: floorPlanImageIndex ?? null };
  }

  const sorted = [...new Set(selectedImageIndices)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < draft.imageUrls.length)
    .sort((a, b) => a - b);

  if (!sorted.length) {
    return { draft, floorPlanImageIndex: floorPlanImageIndex ?? null };
  }

  const imageUrls = sorted.map((index) => draft.imageUrls[index]).filter(Boolean);
  let mappedFloorPlan: number | null = null;
  if (floorPlanImageIndex != null && sorted.includes(floorPlanImageIndex)) {
    mappedFloorPlan = sorted.indexOf(floorPlanImageIndex);
  }

  return {
    draft: {
      ...draft,
      imageUrls,
      imageCount: imageUrls.length,
    },
    floorPlanImageIndex: mappedFloorPlan,
  };
}
