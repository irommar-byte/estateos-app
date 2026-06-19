export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { buildAuctionTickerItems } from '@/lib/auction';

export async function GET() {
  try {
    const items = await buildAuctionTickerItems();
    return NextResponse.json({ success: true, items });
  } catch {
    return NextResponse.json({ success: true, items: [] });
  }
}
