import { canonicalizeCity } from "@/lib/location/locationCatalog";

import { extractTrailingHouseNumber } from "@/lib/mapboxGeocodeClient";

/** Ulica + numer z wyniku Mapbox (bez miasta, kodu i kraju). */
export function formatShortStreetFromMapboxFeature(
  feature: {
    text?: string;
    address?: string;
    place_name?: string;
    place_name_pl?: string;
  } | null | undefined,
  userQuery?: string,
): string {
  const street = String(feature?.text || "").trim();
  const number = String(feature?.address || "").trim();
  if (street && number) return `${street} ${number}`.trim();
  const head = String(feature?.place_name_pl || feature?.place_name || "")
    .split(",")[0]
    ?.trim();
  const base = head || street;
  const houseFromQuery = extractTrailingHouseNumber(String(userQuery || ""));
  if (base && houseFromQuery && !number) {
    return `${base} ${houseFromQuery}`.trim();
  }
  return base;
}

/** Czy w tekście adresu jest inne miasto niż wybrane w formularzu. */
export function addressMentionsOtherCity(addressRaw: unknown, cityRaw: unknown): boolean {
  const selected = canonicalizeCity(String(cityRaw || ""));
  const address = String(addressRaw || "").trim();
  if (!selected || !address) return false;

  const segments = address.split(",").map((s) => s.trim()).filter(Boolean);
  for (let i = 1; i < segments.length; i++) {
    const withoutPostal = segments[i].replace(/^\d{2}-\d{3}\s+/i, "").trim();
    const found = canonicalizeCity(withoutPostal);
    if (found && found !== selected) return true;
  }
  return false;
}

/** Jedna linia lokalizacji do podsumowania — bez powielania miasta i dzielnicy. */
export function formatOfferLocationLine(input: {
  address?: unknown;
  street?: unknown;
  city?: unknown;
  district?: unknown;
}): string {
  const city = String(input.city || "").trim();
  const district = String(input.district || "").trim();
  let street = String(input.street || input.address || "").trim();

  if (street && city && addressMentionsOtherCity(street, city)) {
    street = street.split(",")[0]?.trim() || street;
  }

  if (street) {
    const streetLower = street.toLowerCase();
    if (district && streetLower.includes(district.toLowerCase())) {
      street = street
        .replace(new RegExp(`,?\\s*${district.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"), "")
        .trim();
    }
    if (city && streetLower.includes(city.toLowerCase())) {
      street = street
        .replace(new RegExp(`,?\\s*${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"), "")
        .trim();
    }
  }

  const locality = [district, city].filter(Boolean).join(", ");
  if (street && locality) return `${street}, ${locality}`;
  return locality || street || "—";
}
