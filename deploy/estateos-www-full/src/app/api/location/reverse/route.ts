import { NextResponse } from "next/server";
import {
  fetchMapboxReverseFeature,
  resolveOfferLocationFromCoordinates,
} from "@/lib/location/resolveOfferLocationFromCoordinates";
import { getDistrictsForCity } from "@/lib/location/locationCatalog";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const preferredCity = url.searchParams.get("preferredCity");
  const streetHint = url.searchParams.get("streetHint");

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

    const feature = await fetchMapboxReverseFeature(lat, lng);
    const context = Array.isArray(feature?.context) ? feature.context : [];
    const countryItem = context.find((item: { id?: string }) => String(item?.id || "").startsWith("country"));
    const countryCode = String(countryItem?.short_code || "")
      .trim()
      .toUpperCase()
      .replace(/^COUNTRY:/, "");
    const country = String(countryItem?.text_pl || countryItem?.text || "").trim();

    return NextResponse.json({
      city: resolved.city,
      country,
      countryCode,
      district: resolved.strictCity
        ? resolved.validation.valid
          ? resolved.validation.district
          : ""
        : resolved.district,
      street: resolved.street,
      addressLabel: String(feature?.place_name || "").trim(),
      strictCity: resolved.strictCity,
      districtOptions: getDistrictsForCity(resolved.city),
      requiresDistrictSelection: resolved.strictCity && !resolved.validation.valid,
      lat,
      lng,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Błąd reverse geocoding.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
