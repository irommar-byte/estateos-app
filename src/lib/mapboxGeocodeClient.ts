/**
 * Wspólne zapytania Mapbox Geocoding (forward) — Polska, miasto z formularza lub z przecinka w adresie.
 */

import { normalizeText } from "@/lib/location/locationCatalog";

export type ParsedAddressQuery = {
  streetPart: string;
  cityPart: string;
  fullQuery: string;
};

/** Czy etykieta to jednostka administracyjna (powiat/gmina/województwo), a nie miejscowość. */
export function isAdministrativeAreaLabel(value: unknown): boolean {
  return /^(powiat|gmina|województwo)\s/i.test(String(value || "").trim());
}

/** Numer domu z końca wpisu, np. „Sitaniec 464" → „464". */
export function extractTrailingHouseNumber(raw: string): string {
  const match = String(raw || "")
    .trim()
    .match(/\s+(\d+[a-zA-Z]?(?:\/\d+[a-zA-Z]?)?)$/u);
  return match ? match[1] : "";
}

/** Czy wynik Mapbox to adres ulicy (ulica + numer), a nie miejscowość. */
export function isStreetAddressMapboxFeature(
  feature: { place_type?: string[] } | null | undefined,
): boolean {
  const types = Array.isArray(feature?.place_type) ? feature.place_type : [];
  return types.includes("address");
}

/** Czy wynik Mapbox to miejscowość (wieś), bez konkretnej ulicy. */
export function isLocalityMapboxFeature(
  feature: { place_type?: string[] } | null | undefined,
): boolean {
  const types = Array.isArray(feature?.place_type) ? feature.place_type : [];
  return types.includes("locality") || types.includes("place");
}

/** Miejscowość z wpisu typu „Sitaniec 464" — tylko gdy wynik geokodowania to locality, nie ulica. */
export function extractVillageLocalityHint(
  streetInput: unknown,
  feature?: { place_type?: string[]; text?: string } | null,
): string {
  const village = extractVillageLocalityFromStreet(streetInput);
  if (!village) return "";
  if (!feature) return village;
  if (isStreetAddressMapboxFeature(feature)) return "";
  if (!isLocalityMapboxFeature(feature)) return "";
  return village;
}

function extractVillageLocalityFromStreet(streetInput: unknown): string {
  const street = String(streetInput ?? "").trim();
  if (!street || /^(ul\.?|al\.?|pl\.?|os\.?|ulica|aleja|plac|osiedle)\s/i.test(street)) {
    return "";
  }
  const match = street.match(
    /^([A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż\-]+(?:\s+[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż\-]+)?)\s+\d+/u,
  );
  return match?.[1]?.trim() || "";
}

/** Rozdziela „ulica nr, miasto” lub „ulica nr, miasto, Polska”. */
export function parseAddressSearchQuery(raw: string): ParsedAddressQuery {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    return { streetPart: "", cityPart: "", fullQuery: "" };
  }

  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) {
    return {
      streetPart: trimmed,
      cityPart: "",
      fullQuery: buildForwardGeocodeSearchText(trimmed, ""),
    };
  }

  let cityIndex = parts.length - 1;
  if (/^(polska|poland|pl)$/i.test(parts[cityIndex]) && parts.length >= 3) {
    cityIndex = parts.length - 2;
  }

  const cityPart = parts[cityIndex].replace(/^\d{2}-\d{3}\s+/i, "").trim();
  const streetPart = parts.slice(0, cityIndex).join(", ").trim() || parts[0];

  return {
    streetPart,
    cityPart,
    fullQuery: buildForwardGeocodeSearchText(streetPart, cityPart),
  };
}

/** Zapytanie do Mapbox z preferowanym miastem (formularz lub fragment po przecinku). */
export function buildForwardGeocodeSearchText(street: string, city?: string): string {
  const s = String(street || "").trim();
  const c = String(city || "").trim();
  if (!s) return c ? `${c}, Polska` : "";
  if (!c) return /polska|poland/i.test(s) ? s : `${s}, Polska`;
  const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (norm(s).includes(norm(c))) return s;
  return `${s}, ${c}, Polska`;
}

/** Wybiera wynik geokodowania najbliższy temu, co wpisał użytkownik. */
export function pickBestGeocodeFeature(
  features: any[],
  query: string,
  cityHint?: string,
): any | null {
  if (!features.length) return null;
  const houseNumber = extractTrailingHouseNumber(query);
  const hasAddressMatch = features.some((feature) => {
    if (!isStreetAddressMapboxFeature(feature)) return false;
    const text = normalizeText(String(feature?.text || ""));
    const queryStreet = normalizeText(String(query.split(/\s+\d/)[0] || "").trim());
    return Boolean(queryStreet && text && (text === queryStreet || queryStreet.includes(text)));
  });
  const village = hasAddressMatch ? "" : extractVillageLocalityFromStreet(query);
  const preferredCity = String(cityHint || village || "").trim();
  const preferredNorm = preferredCity ? normalizeText(preferredCity) : "";
  const queryNorm = normalizeText(query.split(",")[0] || query);

  let best = features[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const feature of features) {
    let score = 0;
    const types = Array.isArray(feature?.place_type) ? feature.place_type : [];
    const text = normalizeText(String(feature?.text || ""));
    const featureNumber = String(feature?.address || "").trim();

    if (types.includes("address")) score += 4;
    if (types.includes("locality")) score += 2;
    if (houseNumber && featureNumber === houseNumber) score += 12;
    if (queryNorm && text && queryNorm.includes(text)) score += 6;
    if (queryNorm && text && text.includes(queryNorm.split(/\s+/)[0] || "")) score += 4;
    if (preferredNorm && text === preferredNorm) score += 8;
    if (preferredNorm && normalizeText(String(feature?.place_name || "")).includes(preferredNorm)) {
      score += 3;
    }
    if (houseNumber && !featureNumber && types.includes("locality")) score += 1;

    if (score > bestScore) {
      bestScore = score;
      best = feature;
    }
  }

  return best;
}

export function mapboxForwardGeocodeUrl(
  query: string,
  token: string,
  options?: { limit?: number; autocomplete?: boolean },
): string {
  const limit = options?.limit ?? 6;
  const autocomplete = options?.autocomplete ?? true;
  const params = new URLSearchParams({
    access_token: token,
    language: "pl",
    country: "pl",
    limit: String(limit),
    autocomplete: autocomplete ? "true" : "false",
    types: "address,place,locality",
  });
  return `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params.toString()}`;
}
