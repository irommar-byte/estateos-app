/**
 * Wspólne zapytania Mapbox Geocoding (forward) — Polska, miasto z formularza lub z przecinka w adresie.
 */

export type ParsedAddressQuery = {
  streetPart: string;
  cityPart: string;
  fullQuery: string;
};

/** Rozdziela „ulica nr, miasto” lub „ulica nr, miasto, Polska”. */
export function parseAddressSearchQuery(raw: string): ParsedAddressQuery {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    return { streetPart: "", cityPart: "", fullQuery: "" };
  }

  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) {
    return { streetPart: trimmed, cityPart: "", fullQuery: trimmed };
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
  if (!c) return s;
  const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (norm(s).includes(norm(c))) return s;
  return `${s}, ${c}, Polska`;
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
