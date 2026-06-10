export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/jwtMobile';
import {
  createAuctionEvent,
  listHostAuctionEvents,
  listLiveAuctionEvents,
  listMyAuctionBids,
  mapAuctionError,
} from '@/lib/auction';

function parseUserId(req: Request): number | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const rawToken = auth.replace(/^Bearer\s+/i, '').trim();
  if (!rawToken) return null;
  const payload = verifyMobileToken(rawToken) as Record<string, unknown>;
  const userId = Number(payload?.id ?? payload?.userId ?? payload?.sub);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

export async function GET(req: Request) {
  const userId = parseUserId(req);
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get('scope') || 'live';

  try {
    if (scope === 'host') {
      if (!userId) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }
      const events = await listHostAuctionEvents(userId);
      return NextResponse.json({ success: true, events });
    }

    if (scope === 'bids') {
      if (!userId) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }
      const bids = await listMyAuctionBids(userId);
      return NextResponse.json({ success: true, bids });
    }

    const events = await listLiveAuctionEvents(userId);
    return NextResponse.json({ success: true, events });
  } catch (error) {
    const mapped = mapAuctionError(error);
    return NextResponse.json({ success: false, message: mapped.message, code: mapped.code }, { status: mapped.status });
  }
}

export async function POST(req: Request) {
  const userId = parseUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const event = await createAuctionEvent(userId, {
      offerId: Number(body.offerId),
      title: body.title ?? null,
      description: body.description ?? null,
      startPrice: Number(body.startPrice),
      reservePrice: body.reservePrice != null ? Number(body.reservePrice) : null,
      minIncrement: body.minIncrement != null ? Number(body.minIncrement) : null,
      startsAt: String(body.startsAt),
      endsAt: String(body.endsAt),
      publish: body.publish !== false,
    });
    return NextResponse.json({ success: true, event });
  } catch (error) {
    const mapped = mapAuctionError(error);
    return NextResponse.json({ success: false, message: mapped.message, code: mapped.code }, { status: mapped.status });
  }
}
