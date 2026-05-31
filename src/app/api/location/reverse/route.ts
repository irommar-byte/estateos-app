import { NextResponse } from "next/server";
import {
  canonicalizeCity,
  canonicalizeDistrict,
  getDistrictsForCity,
  inferAreaLabelFromMapboxFeature,
  inferCityFromMapboxFeature,
  isStrictCity,
  validateCityDistrict,
} from "@/lib/location/locationCatalog";
import { resolveStrictDistrictFromPin } from "@/lib/location/strictDistrictFromPin";
import { sanitizeNonStrictAreaLabel } from "@/lib/location/localityDisplay";
import {
  getMapboxContextText,
  mapboxReverseGeocodeUrl,
  resolveCountryFromMapboxFeature,
} from "@/lib/mapboxReverseGeocode";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const cityHint = String(url.searchParams.get("city") || "").trim();
  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Nieprawidłowe współrzędne." }, { status: 400 });
  }
  if (!token) {
    return NextResponse.json({ error: "Brak tokenu MAPBOX_TOKEN." }, { status: 500 });
  }

  const endpoint = mapboxReverseGeocodeUrl(lng, lat, token, { language: "pl" });

  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    const payload = await response.json();
    const feature = Array.isArray(payload?.features) ? payload.features[0] : null;
    const context = Array.isArray(feature?.context) ? feature.context : [];

    const { country, countryCode } = resolveCountryFromMapboxFeature(feature, lat, lng, cityHint);

    const streetRaw = String(feature?.text || "").trim();
    const numberRaw = String(feature?.address || "").trim();
    const primaryAddressLabel = String(feature?.place_name || "").split(",")[0]?.trim();

    const city = inferCityFromMapboxFeature(feature) || canonicalizeCity(cityHint);
    const inferredDistrict = inferAreaLabelFromMapboxFeature(city, feature);
    const legacyDistrictRaw =
      getMapboxContextText(context, "neighborhood") ||
      getMapboxContextText(context, "district") ||
      getMapboxContextText(context, "locality");
    const districtMerged = inferredDistrict || legacyDistrictRaw;
    let district = canonicalizeDistrict(city, districtMerged);
    const strictCity = isStrictCity(city);
    if (strictCity) {
      district =
        resolveStrictDistrictFromPin(city, lat, lng, legacyDistrictRaw, feature) ||
        district;
    }
    const validation = validateCityDistrict(city, district);
    const street = (numberRaw ? `${streetRaw} ${numberRaw}`.trim() : streetRaw) || primaryAddressLabel || "";
    if (!strictCity) {
      district = sanitizeNonStrictAreaLabel(district, city, street);
    }

    return NextResponse.json({
      city,
      country,
      countryCode,
      district: strictCity ? (validation.valid ? validation.district : "") : district,
      street,
      addressLabel: String(feature?.place_name || "").trim(),
      strictCity,
      districtOptions: getDistrictsForCity(city),
      requiresDistrictSelection: strictCity && !validation.valid,
      lat,
      lng,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Błąd reverse geocoding." }, { status: 500 });
  }
}
