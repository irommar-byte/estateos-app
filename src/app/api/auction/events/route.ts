export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import {
  createAuctionEvent,
  listHostAuctionEvents,
  listLiveAuctionEvents,
  mapAuctionError,
} from '@/lib/auction';
import { requireInvestorProWeb } from '@/lib/requireInvestorProWeb';
import { resolveWebUserId } from '@/lib/webSessionAuth';

export async function GET(req: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get('scope') || 'host';

  try {
    if (scope === 'live') {
      const events = await listLiveAuctionEvents(userId);
      return NextResponse.json({ success: true, events });
    }
    const events = await listHostAuctionEvents(userId);
    return NextResponse.json({ success: true, events });
  } catch (error) {
    const mapped = mapAuctionError(error);
    return NextResponse.json({ success: false, message: mapped.message, code: mapped.code }, { status: mapped.status });
  }
}

export async function POST(req: Request) {
  const gate = await requireInvestorProWeb(req);
  if (!gate.ok) return gate.response;

  try {
    const body = await req.json();
    const event = await createAuctionEvent(gate.userId, {
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
