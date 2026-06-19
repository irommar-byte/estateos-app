/**
 * Wspólne zapytania Mapbox Geocoding (forward) — z kontekstem kraju z miasta / adresu.
 */

import { normalizeText } from "@/lib/location/locationCatalog";
import { countryLabelFromIso, inferCountryIsoFromCity } from "@/lib/offerLocalityCountry";

export type ParsedAddressQuery = {
  streetPart: string;
  cityPart: string;
  countryPart: string;
  countryIso: string | null;
  fullQuery: string;
};

const COUNTRY_TOKEN_TO_ISO: Record<string, string> = {
  polska: "PL",
  poland: "PL",
  pl: "PL",
  niemcy: "DE",
  germany: "DE",
  deutschland: "DE",
  de: "DE",
  czechy: "CZ",
  czechia: "CZ",
  cz: "CZ",
  slowacja: "SK",
  slovakia: "SK",
  sk: "SK",
  austria: "AT",
  osterreich: "AT",
  at: "AT",
  ukraina: "UA",
  ukraine: "UA",
  ua: "UA",
};

function countryIsoFromToken(token: string): string | null {
  const norm = token
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return COUNTRY_TOKEN_TO_ISO[norm] || null;
}

/** Kraj i kod ISO z kontekstu wyniku Mapbox. */
export function extractCountryFromMapboxFeature(
  feature: { context?: Array<{ id?: string; text?: string; text_pl?: string; short_code?: string }> } | null | undefined,
): { country: string; countryCode: string } {
  const context = Array.isArray(feature?.context) ? feature.context : [];
  const countryItem = context.find((item) => String(item?.id || "").startsWith("country"));
  const countryCode = String(countryItem?.short_code || "")
    .trim()
    .toUpperCase()
    .replace(/^COUNTRY:/, "");
  const country = String(countryItem?.text_pl || countryItem?.text || "").trim();
  return { country, countryCode };
}

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
  const match = street.match(/^(.+?)\s+\d+[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]?(?:\/\d+[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]?)?\s*$/u);
  if (!match) return "";
  const candidate = match[1].trim();
  if (!candidate || candidate.split(/\s+/).length !== 1) return "";
  return candidate;
}

/** Rozdziela „ulica nr, miasto” lub „ulica nr, miasto, kraj”. */
export function parseAddressSearchQuery(raw: string): ParsedAddressQuery {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    return { streetPart: "", cityPart: "", countryPart: "", countryIso: null, fullQuery: "" };
  }

  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) {
    const iso = countryIsoFromToken(trimmed) || inferCountryIsoFromCity(trimmed) || null;
    return {
      streetPart: trimmed,
      cityPart: "",
      countryPart: "",
      countryIso: iso,
      fullQuery: buildForwardGeocodeSearchText(trimmed, "", iso || undefined),
    };
  }

  let cityIndex = parts.length - 1;
  let countryPart = "";
  let countryIso: string | null = countryIsoFromToken(parts[parts.length - 1]);
  if (countryIso && parts.length >= 3) {
    countryPart = parts[parts.length - 1];
    cityIndex = parts.length - 2;
  }

  const cityPart = parts[cityIndex].replace(/^\d{2}-\d{3}\s+/i, "").trim();
  const streetPart = parts.slice(0, cityIndex).join(", ").trim() || parts[0];
  const resolvedIso = countryIso || inferCountryIsoFromCity(cityPart) || null;

  return {
    streetPart,
    cityPart,
    countryPart,
    countryIso: resolvedIso,
    fullQuery: buildForwardGeocodeSearchText(streetPart, cityPart, resolvedIso || undefined),
  };
}

/** Zapytanie do Mapbox z preferowanym miastem (formularz lub fragment po przecinku). */
export function buildForwardGeocodeSearchText(
  street: string,
  city?: string,
  countryIsoHint?: string,
): string {
  const s = String(street || "").trim();
  const c = String(city || "").trim();
  const cityIso = countryIsoHint || inferCountryIsoFromCity(c);
  const countrySuffix =
    cityIso && cityIso !== "PL" ? countryLabelFromIso(cityIso) : "Polska";

  if (!s) return c ? `${c}, ${countrySuffix}` : "";
  if (!c) {
    if (/polska|poland|niemcy|germany|deutschland/i.test(s)) return s;
    return `${s}, ${countrySuffix}`;
  }
  const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (norm(s).includes(norm(c))) return `${s}, ${countrySuffix}`;
  return `${s}, ${c}, ${countrySuffix}`;
}

function inferCountryIsoFromQuery(query: string, cityHint?: string): string | null {
  const fromCity = inferCountryIsoFromCity(String(cityHint || ""));
  if (fromCity) return fromCity;

  const parsed = parseAddressSearchQuery(query);
  if (parsed.countryIso) return parsed.countryIso;
  const fromParsedCity = inferCountryIsoFromCity(parsed.cityPart);
  if (fromParsedCity) return fromParsedCity;

  const lower = String(query || "").toLowerCase();
  if (/\b(niemcy|germany|deutschland)\b/.test(lower)) return "DE";
  if (/\b(polska|poland)\b/.test(lower)) return "PL";
  if (/\b(czechy|czechia)\b/.test(lower)) return "CZ";
  if (/\b(słowacja|slovakia)\b/.test(lower)) return "SK";
  if (/\b(austria|österreich)\b/.test(lower)) return "AT";
  return null;
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
  options?: { limit?: number; autocomplete?: boolean; cityHint?: string },
): string {
  const limit = options?.limit ?? 6;
  const autocomplete = options?.autocomplete ?? true;
  const countryIso = inferCountryIsoFromQuery(query, options?.cityHint);
  const params = new URLSearchParams({
    access_token: token,
    language: "pl",
    limit: String(limit),
    autocomplete: autocomplete ? "true" : "false",
    types: "address,place,locality",
  });
  if (countryIso) {
    params.set("country", countryIso.toLowerCase());
  }
  return `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params.toString()}`;
}
