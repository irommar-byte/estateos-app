import type { OtodomImportDraft } from '@/lib/otodomImport';
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
import { fetchMapboxReverseFeature } from '@/lib/location/resolveOfferLocationFromCoordinates';

/** Gdy OtoDom poda tylko dzielnicę (np. Służew), dopasuj miasto strict z katalogu. */
export function inferCityFromLocationHints(...hints: (string | null | undefined)[]): string {
  const blob = hints.filter(Boolean).join(' ');
  if (!blob.trim()) return '';

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

async function reconcileImportCityWithPin(
  draft: Pick<OtodomImportDraft, 'lat' | 'lng'>,
  city: string,
): Promise<string> {
  if (draft.lat == null || draft.lng == null) return city;

  const feature = await fetchMapboxReverseFeature(draft.lat, draft.lng);
  const pinCity = inferCityFromMapboxFeature(feature);
  if (!pinCity) return city;

  if (!city || isNonCityLabel(city)) {
    return canonicalizeCity(pinCity);
  }

  if (!isStrictCity(city) && !locationNamesEquivalent(city, pinCity)) {
    return canonicalizeCity(pinCity);
  }

  return city;
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
  let city = canonicalizeCity(draft.city);
  let district = String(draft.district || draft.neighborhood || '').trim();

  if (!city) {
    city = inferCityFromLocationHints(
      draft.district,
      draft.neighborhood,
      draft.title,
      draft.externalUrl,
    );
  }

  if (!city) {
    city = inferCityFromImportSlug(draft.externalUrl, draft.title);
  }

  if (!city && draft.lat != null && draft.lng != null) {
    const feature = await fetchMapboxReverseFeature(draft.lat, draft.lng);
    city = inferCityFromMapboxFeature(feature);
  }

  if (city && !district) {
    district = inferDistrictForCity(city, draft);
  }

  city = await reconcileImportCityWithPin(draft, canonicalizeCity(city));

  if (city && !district) {
    district = inferDistrictForCity(city, draft);
  }

  return {
    ...draft,
    city: canonicalizeCity(city),
    district: canonicalizeDistrict(city, district || draft.district),
  };
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
