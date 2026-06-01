import {
  canonicalizeCity,
  canonicalizeDistrict,
  inferAreaLabelFromMapboxFeature,
  inferCityFromMapboxFeature,
  inferStrictDistrictFromMapboxFeature,
  isStrictCity,
  pickDistrictFromPlaceName,
  validateCityDistrict,
} from "@/lib/location/locationCatalog";

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

  const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&language=pl&limit=1&country=pl&types=address,place,locality,neighborhood,district`;

  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json();
    return Array.isArray(payload?.features) ? payload.features[0] : null;
  } catch {
    return null;
  }
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
  const city = preferred || canonicalizeCity(cityFromFeature);
  const strict = isStrictCity(city);
  const placeLabel = String(feature.place_name_pl || feature.place_name || "");

  const districtGuessByContext = strict ? inferStrictDistrictFromMapboxFeature(city, feature) : "";
  const districtGuessByLabel = strict ? pickDistrictFromPlaceName(city, placeLabel) : "";
  const areaGuess = strict ? "" : inferAreaLabelFromMapboxFeature(city, feature);
  const districtGuess = districtGuessByContext || districtGuessByLabel || areaGuess;
  const districtMerged = districtGuess || inferAreaLabelFromMapboxFeature(city, feature);
  const district = canonicalizeDistrict(city, districtMerged);
  const validation = validateCityDistrict(city, district);

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
}): Promise<{ city: string; district: string; street: string }> {
  if (draft.lat == null || draft.lng == null) {
    throw new Error("Brak współrzędnych GPS — nie można utworzyć oferty.");
  }

  const resolved = await resolveOfferLocationFromCoordinates({
    lat: draft.lat,
    lng: draft.lng,
    preferredCity: draft.city,
    streetHint: draft.street,
  });

  if (resolved?.validation.valid) {
    return {
      city: resolved.validation.city,
      district: resolved.validation.district,
      street: resolved.street || String(draft.street || "").trim(),
    };
  }

  const city = canonicalizeCity(resolved?.city || draft.city);
  if (!city) {
    throw new Error("Nie udało się ustalić miasta na podstawie współrzędnych.");
  }

  if (isStrictCity(city)) {
    throw new Error(
      resolved?.validation.message ||
        `Nie udało się dopasować dzielnicy dla ${city} na podstawie współrzędnych GPS. Sprawdź pinezkę w edycji oferty.`,
    );
  }

  const fallbackDistrict =
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
    street: resolved?.street || String(draft.street || "").trim(),
  };
}
