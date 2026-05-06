import { NextResponse } from "next/server";
import {
  canonicalizeCity,
  canonicalizeDistrict,
  getDistrictsForCity,
  inferStrictDistrictFromMapboxFeature,
  isStrictCity,
  validateCityDistrict,
} from "@/lib/location/locationCatalog";

function getContextText(context: any[], idPrefix: string): string {
  const hit = context.find((item) => String(item?.id || "").startsWith(idPrefix));
  return String(hit?.text || hit?.text_pl || "").trim();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Nieprawidłowe współrzędne." }, { status: 400 });
  }
  if (!token) {
    return NextResponse.json({ error: "Brak tokenu MAPBOX_TOKEN." }, { status: 500 });
  }

  const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&language=pl&country=pl&limit=1`;

  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    const payload = await response.json();
    const feature = Array.isArray(payload?.features) ? payload.features[0] : null;
    const context = Array.isArray(feature?.context) ? feature.context : [];

    const cityRaw =
      getContextText(context, "place") ||
      getContextText(context, "locality") ||
      String(feature?.text || "").trim();
    const legacyDistrictRaw =
      getContextText(context, "neighborhood") ||
      getContextText(context, "district") ||
      getContextText(context, "locality");
    const streetRaw = String(feature?.text || "").trim();
    const numberRaw = String(feature?.address || "").trim();

    const city = canonicalizeCity(cityRaw);
    const inferredDistrict = inferStrictDistrictFromMapboxFeature(city, feature);
    const districtMerged = inferredDistrict || legacyDistrictRaw;
    const district = canonicalizeDistrict(city, districtMerged);
    const strictCity = isStrictCity(city);
    const validation = validateCityDistrict(city, district);
    const street = numberRaw ? `${streetRaw} ${numberRaw}`.trim() : streetRaw;

    return NextResponse.json({
      city,
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

