import {
  countryLabelFromIso,
  resolvePersistedLocalityFields,
} from "@/lib/offerLocalityCountry";

export type MapboxGeocodeFeature = {
  text?: string;
  address?: string;
  place_name?: string;
  context?: Array<{ id?: string; text?: string; text_pl?: string; short_code?: string }>;
};

export function getMapboxContextText(context: unknown[], idPrefix: string): string {
  if (!Array.isArray(context)) return "";
  const hit = context.find((item) => String((item as { id?: string })?.id || "").startsWith(idPrefix));
  const row = hit as { text?: string; text_pl?: string } | undefined;
  return String(row?.text || row?.text_pl || "").trim();
}

export function getMapboxContextShortCode(context: unknown[], idPrefix: string): string {
  if (!Array.isArray(context)) return "";
  const hit = context.find((item) => String((item as { id?: string })?.id || "").startsWith(idPrefix));
  return String((hit as { short_code?: string })?.short_code || "")
    .trim()
    .toUpperCase();
}

export function mapboxReverseGeocodeUrl(
  lng: number,
  lat: number,
  token: string,
  options?: { language?: string },
): string {
  const language = options?.language || "pl";
  const params = new URLSearchParams({
    access_token: token,
    language,
    limit: "1",
    types: "address,place,locality,neighborhood,district",
  });
  return `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?${params.toString()}`;
}

/** Kraj z wyniku Mapbox; fallback: współrzędne / miasto (bez domyślnego PL przy braku trafienia). */
export function resolveCountryFromMapboxFeature(
  feature: MapboxGeocodeFeature | null | undefined,
  lat: number,
  lng: number,
  cityHint?: string,
): { country: string; countryCode: string } {
  const context = Array.isArray(feature?.context) ? feature.context : [];
  const countryName = getMapboxContextText(context, "country");
  const countryCode = getMapboxContextShortCode(context, "country");

  if (countryName && /^[A-Z]{2}$/.test(countryCode)) {
    return { country: countryName, countryCode };
  }

  const fallback = resolvePersistedLocalityFields({
    city: cityHint,
    lat,
    lng,
  });
  return {
    country: fallback.localityCountry,
    countryCode: fallback.localityCountryCode,
  };
}

export function isoFromMapboxShortCode(raw: string): string {
  const code = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/^([A-Z]{2}).*$/, "$1");
  return /^[A-Z]{2}$/.test(code) ? code : "";
}
