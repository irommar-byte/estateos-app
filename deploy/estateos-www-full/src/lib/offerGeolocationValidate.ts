import { canonicalizeCity, normalizeText } from "@/lib/location/locationCatalog";

const REST_OF_COUNTRY_LABEL = "Reszta kraju";

function getContextText(context: unknown[], idPrefix: string): string {
  if (!Array.isArray(context)) return "";
  const hit = context.find((item) => String((item as { id?: string })?.id || "").startsWith(idPrefix));
  return String((hit as { text?: string; text_pl?: string })?.text || (hit as { text_pl?: string })?.text_pl || "").trim();
}

/** Miasto z Mapbox reverse geocoding dla współrzędnych (serwer). */
export async function resolveCityAtCoordinates(lat: number, lng: number): Promise<string> {
  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return "";

  const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&language=pl&limit=1&types=place,locality`;

  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) return "";
    const payload = await response.json();
    const feature = Array.isArray(payload?.features) ? payload.features[0] : null;
    const context = Array.isArray(feature?.context) ? feature.context : [];
    const cityRaw =
      String(feature?.text || "").trim() ||
      getContextText(context, "place") ||
      getContextText(context, "locality");
    return canonicalizeCity(cityRaw);
  } catch {
    return "";
  }
}

export async function assertCoordinatesMatchCity(params: {
  lat: number;
  lng: number;
  city: string;
  district?: string | null;
}): Promise<void> {
  const selected = canonicalizeCity(params.city);
  if (!selected) return;

  const resolved = await resolveCityAtCoordinates(params.lat, params.lng);
  if (!resolved) return;

  const isRestOfCountry = normalizeText(selected) === normalizeText(REST_OF_COUNTRY_LABEL);
  const compareTarget = isRestOfCountry
    ? canonicalizeCity(params.district || "") || selected
    : selected;

  if (!compareTarget) return;

  if (normalizeText(resolved) !== normalizeText(compareTarget)) {
    const districtLocality = canonicalizeCity(params.district || "");
    if (districtLocality && normalizeText(resolved) === normalizeText(districtLocality)) {
      return;
    }
    throw new Error(
      `Pinezka na mapie wskazuje ${resolved}, a wybrane miasto to ${isRestOfCountry ? compareTarget : selected}. Przesuń pinezkę lub zmień miasto.`,
    );
  }
}
