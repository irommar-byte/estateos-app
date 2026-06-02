import { NextResponse } from "next/server";
import {
  fetchMapboxReverseFeature,
  resolveOfferLocationFromCoordinates,
  collectOtodomDistrictCandidates,
} from "@/lib/location/resolveOfferLocationFromCoordinates";
import { getDistrictsForCity, validateCityDistrict } from "@/lib/location/locationCatalog";
import { resolveStrictDistrictForForm } from "@/lib/location/strictDistrictFromPin";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const preferredCity = url.searchParams.get("city");
  const otodomDistrict = url.searchParams.get("district");
  const neighborhood = url.searchParams.get("neighborhood");
  const streetHint = url.searchParams.get("street");

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Nieprawidłowe współrzędne." }, { status: 400 });
  }

  try {
    const resolved = await resolveOfferLocationFromCoordinates({
      lat,
      lng,
      preferredCity,
      streetHint,
    });
    if (!resolved) {
      return NextResponse.json({ error: "Brak tokenu MAPBOX_TOKEN lub błąd reverse geocoding." }, { status: 500 });
    }

    let district =
      resolved.strictCity && resolved.validation.valid
        ? resolved.validation.district
        : resolved.district;
    let requiresDistrictSelection = resolved.strictCity && !resolved.validation.valid;

    if (requiresDistrictSelection) {
      const candidates = collectOtodomDistrictCandidates(resolved.city || preferredCity || "", {
        district: otodomDistrict,
        neighborhood,
        street: streetHint,
      });
      const inferred = resolveStrictDistrictForForm(
        resolved.city || preferredCity || "",
        lat,
        lng,
        candidates,
      );
      const inferredValidation = validateCityDistrict(resolved.city, inferred);
      if (inferredValidation.valid) {
        district = inferredValidation.district;
        requiresDistrictSelection = false;
      }
    }

    const feature = await fetchMapboxReverseFeature(lat, lng);
    const context = Array.isArray(feature?.context) ? feature.context : [];
    const countryItem = context.find((item: { id?: string }) => String(item?.id || "").startsWith("country"));
    const country = String(countryItem?.text || countryItem?.text_pl || "Polska").trim();
    const countryCode = String(countryItem?.short_code || "pl").trim().toUpperCase();

    return NextResponse.json({
      city: resolved.city,
      country,
      countryCode,
      district: resolved.strictCity
        ? district
        : resolved.district,
      street: resolved.street,
      addressLabel: String(feature?.place_name || "").trim(),
      strictCity: resolved.strictCity,
      districtOptions: getDistrictsForCity(resolved.city),
      requiresDistrictSelection,
      lat,
      lng,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Błąd reverse geocoding.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
