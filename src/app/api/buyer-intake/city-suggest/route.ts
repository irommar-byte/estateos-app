import { NextResponse } from 'next/server';
import {
  BUYER_SUGGEST_MIN_CHARS,
  buildBuyerCityGeocodeQuery,
  extractBuyerCitySuggestionsFromMapboxFeatures,
  mergeBuyerCitySuggestions,
  searchBuyerCitySuggestions,
} from '@/lib/buyerIntakeShared';
import { mapboxForwardGeocodeUrl } from '@/lib/mapboxGeocodeClient';

export async function GET(req: Request) {
  const query = String(new URL(req.url).searchParams.get('q') || '').trim();
  if (query.length < BUYER_SUGGEST_MIN_CHARS) {
    return NextResponse.json({ suggestions: [] });
  }

  const local = searchBuyerCitySuggestions(query, 8);

  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    return NextResponse.json({ suggestions: local });
  }

  try {
    const response = await fetch(
      mapboxForwardGeocodeUrl(buildBuyerCityGeocodeQuery(query), token, {
        limit: 8,
        autocomplete: true,
        types: 'place,locality',
      }),
      { cache: 'no-store' },
    );
    if (!response.ok) {
      return NextResponse.json({ suggestions: local });
    }
    const geo = await response.json();
    const features = Array.isArray(geo?.features) ? geo.features : [];
    const remote = extractBuyerCitySuggestionsFromMapboxFeatures(features, query, 8);
    return NextResponse.json({ suggestions: mergeBuyerCitySuggestions(local, remote, 8) });
  } catch {
    return NextResponse.json({ suggestions: local });
  }
}
