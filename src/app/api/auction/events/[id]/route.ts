export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import {
  cancelAuctionEvent,
  getAuctionEventById,
  mapAuctionError,
} from '@/lib/auction';
import { requireInvestorProWeb } from '@/lib/requireInvestorProWeb';
import { resolveWebUserId } from '@/lib/webSessionAuth';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const eventId = Number(rawId);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ success: false, message: 'Invalid eventId' }, { status: 400 });
  }

  try {
    const userId = await resolveWebUserId(req);
    const event = await getAuctionEventById(eventId, userId);
    if (!event) {
      return NextResponse.json({ success: false, message: 'Licytacja niedostępna' }, { status: 404 });
    }
    if (!['SCHEDULED', 'LIVE', 'ENDED', 'SETTLED'].includes(event.status) && !event.isHost) {
      return NextResponse.json({ success: false, message: 'Licytacja niedostępna' }, { status: 404 });
    }
    return NextResponse.json({ success: true, event });
  } catch (error) {
    const mapped = mapAuctionError(error);
    return NextResponse.json({ success: false, message: mapped.message, code: mapped.code }, { status: mapped.status });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const gate = await requireInvestorProWeb(req);
  if (!gate.ok) return gate.response;

  const { id: rawId } = await context.params;
  const eventId = Number(rawId);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ success: false, message: 'Invalid eventId' }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (body.status === 'CANCELLED') {
      const event = await cancelAuctionEvent(gate.userId, eventId);
      return NextResponse.json({ success: true, event });
    }
    return NextResponse.json({ success: false, message: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    const mapped = mapAuctionError(error);
    return NextResponse.json({ success: false, message: mapped.message, code: mapped.code }, { status: mapped.status });
  }
}
