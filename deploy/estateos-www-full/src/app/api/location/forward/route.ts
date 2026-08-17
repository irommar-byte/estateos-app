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

  try {
    const response = await fetch(
      mapboxForwardGeocodeUrl(searchText, token, { limit: 6, autocomplete: true }),
      { cache: "no-store" },
    );
    if (!response.ok) {
      return NextResponse.json({ suggestions: [] }, { status: 502 });
    }
    const geo = await response.json();
    const features = Array.isArray(geo?.features) ? geo.features : [];
    const suggestions = features.map((feature: any, index: number) => {
      const label = String(feature?.place_name_pl || feature?.place_name || "").trim();
      const context = Array.isArray(feature?.context) ? feature.context : [];
      const place = context.find((item: { id?: string }) => String(item?.id || "").startsWith("place"));
      const coords = Array.isArray(feature?.center) ? feature.center : [];
      return {
        id: String(feature?.id || index),
        label,
        address: label,
        city: String(place?.text_pl || place?.text || "").trim() || null,
        lng: Number(coords[0]) || null,
        lat: Number(coords[1]) || null,
      };
    }).filter((item: { label: string }) => item.label);
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] }, { status: 502 });
  }
}
