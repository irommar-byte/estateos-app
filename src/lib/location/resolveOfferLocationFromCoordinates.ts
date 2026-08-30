import {
  canonicalizeCity,
  canonicalizeDistrict,
  inferAreaLabelFromMapboxFeature,
  inferCityFromMapboxFeature,
  inferStrictDistrictFromMapboxFeature,
  inferDistrictFromStreet,
  preferStreetOrOsiedleDistrict,
  containsNormalizedToken,
  isNonCityLabel,
  isPlaceholderDistrict,
  isStrictCity,
  matchDistrictAlias,
  pickDistrictFromPlaceName,
  validateCityDistrict,
} from "@/lib/location/locationCatalog";
import { locationNamesEquivalent } from "@/lib/location/locationNameMatch";
import {
  resolveStrictDistrictForForm,
  resolveStrictDistrictFromPin,
} from "@/lib/location/strictDistrictFromPin";

export type ResolvedOfferLocation = {
  city: string;
  district: string;
  street: string;
  strictCity: boolean;
  validation: ReturnType<typeof validateCityDistrict>;
};

function getMapboxToken(): string {
  return String(process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "").trim();
}

export async function fetchMapboxReverseFeature(lat: number, lng: number) {
  const token = getMapboxToken();
  if (!token) return null;

  const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&language=pl&limit=1&types=address,place,locality,neighborhood,district,region,country`;

  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json();
    return Array.isArray(payload?.features) ? payload.features[0] : null;
  } catch {
    return null;
  }
}

function isDistrictHint(value: unknown): value is string {
  return !isPlaceholderDistrict(String(value ?? ""));
}

/** Kandydaci dzielnicy z danych OtoDom — przed GPS / pinezką. */
export function listingConfirmedDistrict(
  city: string,
  draft: {
    district?: string | null;
    neighborhood?: string | null;
    title?: string | null;
    descriptionText?: string | null;
  },
): string {
  const blob = [draft.district, draft.neighborhood, draft.title, draft.descriptionText]
    .filter(Boolean)
    .join(' · ');
  const named =
    canonicalizeDistrict(city, draft.district) || pickDistrictFromPlaceName(city, blob);
  if (!named) return '';
  if (!containsNormalizedToken(blob, named)) return '';
  const validation = validateCityDistrict(city, named);
  return validation.valid ? validation.district : '';
}

export function collectOtodomDistrictCandidates(
  city: string,
  draft: {
    district?: string | null;
    neighborhood?: string | null;
    street?: string | null;
    title?: string | null;
    descriptionText?: string | null;
  },
): string[] {
  const canonicalCity = canonicalizeCity(city);
  const hints: string[] = [];
  const push = (value: unknown) => {
    if (!isDistrictHint(value)) return;
    const raw = String(value).trim();
    const alias = matchDistrictAlias(canonicalCity, raw);
    if (alias) hints.push(alias);
    const canon = canonicalizeDistrict(canonicalCity, raw);
    if (canon) hints.push(canon);
    const picked = pickDistrictFromPlaceName(canonicalCity, raw);
    if (picked) hints.push(picked);
    hints.push(raw);
  };

  push(draft.district);
  push(draft.neighborhood);
  if (draft.title || draft.descriptionText) {
    const fromText = pickDistrictFromPlaceName(
      canonicalCity,
      [draft.title, draft.descriptionText].filter(Boolean).join(' '),
    );
    if (fromText) hints.push(fromText);
  }

  if (draft.street) {
    const fromStreet = inferDistrictFromStreet(canonicalCity, draft.street);
    if (fromStreet) hints.push(fromStreet);
  }

  const combined = [draft.district, draft.neighborhood, draft.street].filter(isDistrictHint).join(", ");
  if (combined) {
    const picked = pickDistrictFromPlaceName(canonicalCity, combined);
    if (picked) hints.push(picked);
    for (const part of combined.split(/[,·/|]+/)) {
      push(part);
    }
  }

  return [...new Set(hints.filter(isDistrictHint))];
}

/**
 * Ten sam algorytm co przy dodawaniu oferty: reverse geocoding Mapbox + katalog dzielnic EstateOS.
 * Nie korzysta z etykiet dzielnic pochodzących z OtoDom.
 */
export async function resolveOfferLocationFromCoordinates(params: {
  lat: number;
  lng: number;
  preferredCity?: string | null;
  streetHint?: string | null;
}): Promise<ResolvedOfferLocation | null> {
  const feature = await fetchMapboxReverseFeature(params.lat, params.lng);
  if (!feature) return null;

  const context = Array.isArray(feature.context) ? feature.context : [];
  const streetRaw = String(feature.text || "").trim();
  const numberRaw = String(feature.address || "").trim();
  const primaryAddressLabel = String(feature.place_name || "").split(",")[0]?.trim();
  const street =
    (numberRaw ? `${streetRaw} ${numberRaw}`.trim() : streetRaw) ||
    String(params.streetHint || "").trim() ||
    primaryAddressLabel ||
    "";

  const cityFromFeature = inferCityFromMapboxFeature(feature);
  const preferred = canonicalizeCity(params.preferredCity || "");
  const pinCity = canonicalizeCity(cityFromFeature);
  let city = preferred || pinCity;
  if (
    preferred &&
    pinCity &&
    !isStrictCity(preferred) &&
    !locationNamesEquivalent(preferred, pinCity)
  ) {
    city = pinCity;
  }
  const strict = isStrictCity(city);
  const placeLabel = String(feature.place_name_pl || feature.place_name || "");

  const districtGuessByContext = strict ? inferStrictDistrictFromMapboxFeature(city, feature) : "";
  const districtGuessByLabel = strict ? pickDistrictFromPlaceName(city, placeLabel) : "";
  const areaGuess = strict ? "" : inferAreaLabelFromMapboxFeature(city, feature);
  const districtGuess = districtGuessByContext || districtGuessByLabel || areaGuess;
  const districtMerged = districtGuess || inferAreaLabelFromMapboxFeature(city, feature);
  let district = canonicalizeDistrict(city, districtMerged);
  const fromAddress = preferStreetOrOsiedleDistrict(city, {
    street: params.streetHint || street,
  });
  if (fromAddress) district = fromAddress;
  let validation = validateCityDistrict(city, district);

  if (strict && !validation.valid) {
    const pinDistrict = resolveStrictDistrictFromPin(
      city,
      params.lat,
      params.lng,
      districtMerged || null,
      feature,
    );
    const pinValidation = validateCityDistrict(city, pinDistrict);
    if (pinValidation.valid) {
      district = pinValidation.district;
      validation = pinValidation;
    }
  }

  return {
    city,
    district: strict && validation.valid ? validation.district : district,
    street,
    strictCity: strict,
    validation,
  };
}

export async function resolveOtodomImportLocationFields(draft: {
  lat: number | null;
  lng: number | null;
  city: string;
  district?: string | null;
  neighborhood?: string | null;
  street?: string | null;
  title?: string | null;
  descriptionText?: string | null;
}): Promise<{ city: string; district: string; street: string }> {
  if (draft.lat == null || draft.lng == null) {
    throw new Error("Brak współrzędnych GPS — nie można utworzyć oferty.");
  }

  const feature = await fetchMapboxReverseFeature(draft.lat, draft.lng);
  const resolved = await resolveOfferLocationFromCoordinates({
    lat: draft.lat,
    lng: draft.lng,
    preferredCity: draft.city,
    streetHint: draft.street,
  });

  const city = canonicalizeCity(resolved?.city || draft.city);
  if (!city) {
    throw new Error("Nie udało się ustalić miasta na podstawie współrzędnych.");
  }

  const street = resolved?.street || String(draft.street || "").trim();
  const confirmed = listingConfirmedDistrict(city, draft);
  if (confirmed) {
    const known = validateCityDistrict(city, confirmed);
    if (known.valid) {
      return { city: known.city, district: known.district, street };
    }
  }
  const knownDistrict = preferStreetOrOsiedleDistrict(city, {
    street: draft.street || street,
    neighborhood: draft.neighborhood,
    title: draft.title,
  });
  if (knownDistrict) {
    const known = validateCityDistrict(city, knownDistrict);
    if (known.valid) {
      return { city: known.city, district: known.district, street };
    }
  }

  const importCandidates = collectOtodomDistrictCandidates(city, draft);

  if (resolved?.validation.valid) {
    return {
      city: resolved.validation.city,
      district: resolved.validation.district,
      street,
    };
  }

  if (isStrictCity(city)) {
    const district = resolveStrictDistrictForForm(
      city,
      draft.lat,
      draft.lng,
      importCandidates,
    );
    const validation = validateCityDistrict(city, district);
    if (validation.valid) {
      return {
        city: validation.city,
        district: validation.district,
        street,
      };
    }

    const pinDistrict = resolveStrictDistrictFromPin(
      city,
      draft.lat,
      draft.lng,
      importCandidates[0] ?? null,
      feature ?? undefined,
    );
    const pinValidation = validateCityDistrict(city, pinDistrict);
    if (pinValidation.valid) {
      return {
        city: pinValidation.city,
        district: pinValidation.district,
        street,
      };
    }

    throw new Error(
      pinValidation.message ||
        resolved?.validation.message ||
        `Nie udało się dopasować dzielnicy dla ${city}. Sprawdź pinezkę w podglądzie mapy.`,
    );
  }

  const fallbackDistrict =
    importCandidates[0] ||
    resolved?.district ||
    String(draft.neighborhood || "").trim() ||
    String(draft.district || "").trim() ||
    "Inny obszar";
  const validation = validateCityDistrict(city, fallbackDistrict);
  if (!validation.valid) {
    throw new Error(validation.message || "Nie udało się dopasować lokalizacji.");
  }

  return {
    city: validation.city,
    district: validation.district,
    street,
  };
}
