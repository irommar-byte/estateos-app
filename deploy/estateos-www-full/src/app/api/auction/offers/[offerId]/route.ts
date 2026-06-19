export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getActiveAuctionForOffer, mapAuctionError } from '@/lib/auction';
import { resolveWebUserId } from '@/lib/webSessionAuth';

type RouteContext = { params: Promise<{ offerId: string }> };

export async function GET(req: Request, context: RouteContext) {
  const { offerId: rawOfferId } = await context.params;
  const offerId = Number(rawOfferId);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ success: false, message: 'Invalid offerId' }, { status: 400 });
  }

  try {
    const userId = await resolveWebUserId(req);
    const event = await getActiveAuctionForOffer(offerId, userId);
    return NextResponse.json({ success: true, event });
  } catch (error) {
    const mapped = mapAuctionError(error);
    return NextResponse.json({ success: false, message: mapped.message, code: mapped.code }, { status: mapped.status });
  }
}
