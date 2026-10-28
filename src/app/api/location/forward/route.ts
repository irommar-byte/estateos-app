import { NextResponse } from "next/server";
import {
  buildForwardGeocodeSearchText,
  mapboxForwardGeocodeUrl,
  parseAddressSearchQuery,
} from "@/lib/mapboxGeocodeClient";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = String(url.searchParams.get("q") || "").trim();
  if (query.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Brak tokenu Mapbox." }, { status: 500 });
  }

  const parsed = parseAddressSearchQuery(query);
  const searchText =
    parsed.fullQuery || buildForwardGeocodeSearchText(parsed.streetPart || query, parsed.cityPart, parsed.countryIso || undefined);

  const [nearLat, nearLng] = String(url.searchParams.get("near") || "").split(",").map(Number);
  const proximity = Number.isFinite(nearLat) && Number.isFinite(nearLng) && nearLat && nearLng ? { lat: nearLat, lng: nearLng } : null;

  try {
    const response = await fetch(
      mapboxForwardGeocodeUrl(searchText, token, { limit: 8, autocomplete: true, defaultCountry: "PL", proximity }),
      { cache: "no-store" },
    );
    if (!response.ok) {
      return NextResponse.json({ suggestions: [] }, { status: 502 });
    }
    const geo = await response.json();
    // Najpierw konkretne adresy z numerem budynku, potem ulice, na końcu miejscowości.
    const rank = (feature: any) => (feature?.address ? 0 : Array.isArray(feature?.place_type) && feature.place_type.includes("address") ? 1 : 2);
    const features = (Array.isArray(geo?.features) ? geo.features : [])
      .map((feature: any, index: number) => ({ feature, index }))
      .sort((a: { feature: any; index: number }, b: { feature: any; index: number }) => rank(a.feature) - rank(b.feature) || a.index - b.index)
      .map((item: { feature: any }) => item.feature)
      .slice(0, 6);
    const suggestions = features.map((feature: any, index: number) => {
      const label = String(feature?.place_name_pl || feature?.place_name || "")
        .replace(/,\s*(Polska|Poland)$/i, "")
        .trim();
      const context = Array.isArray(feature?.context) ? feature.context : [];
      const place = context.find((item: { id?: string }) => String(item?.id || "").startsWith("place"));
      const coords = Array.isArray(feature?.center) ? feature.center : [];
      return {
        id: String(feature?.id || index),
        label,
        address: label,
        city:
          String(place?.text_pl || place?.text || "").trim() ||
          (Array.isArray(feature?.place_type) && feature.place_type.includes("place") ? String(feature?.text_pl || feature?.text || "").trim() : "") ||
          null,
        lng: Number(coords[0]) || null,
        lat: Number(coords[1]) || null,
      };
    }).filter((item: { label: string }) => item.label);
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] }, { status: 502 });
  }
}
