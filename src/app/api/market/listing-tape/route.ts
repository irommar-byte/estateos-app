import { NextResponse } from 'next/server';
import { buildListingTape } from '@/lib/market/listingTape';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const locale = String(url.searchParams.get('locale') || 'pl');
    const limit = Number(url.searchParams.get('limit') || 48);
    const tape = await buildListingTape({ locale, limit });
    return NextResponse.json(tape);
  } catch (error) {
    console.error('[market.listing-tape]', error);
    return NextResponse.json({ ok: false, items: [], message: 'Brak taśmy przy aktach.' }, { status: 500 });
  }
}
