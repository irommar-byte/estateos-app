export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getPublishedEventForOffer } from '@/lib/openHouse';
import { resolveWebUserId } from '@/lib/webSessionAuth';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const offerId = Number(rawId);

  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ success: false, message: 'Invalid offerId' }, { status: 400 });
  }

  const userId = await resolveWebUserId(req);
  const event = await getPublishedEventForOffer(offerId, userId);
  return NextResponse.json({ success: true, event });
}
