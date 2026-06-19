export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { mapAuctionError, placeAuctionBid } from '@/lib/auction';
import { resolveWebUserId } from '@/lib/webSessionAuth';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id: rawId } = await context.params;
  const eventId = Number(rawId);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ success: false, message: 'Invalid eventId' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const event = await placeAuctionBid(userId, eventId, Number(body.amount));
    return NextResponse.json({ success: true, event });
  } catch (error) {
    const mapped = mapAuctionError(error);
    return NextResponse.json({ success: false, message: mapped.message, code: mapped.code }, { status: mapped.status });
  }
}
