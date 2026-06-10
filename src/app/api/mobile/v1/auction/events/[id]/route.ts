export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/jwtMobile';
import {
  cancelAuctionEvent,
  getAuctionEventById,
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

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const eventId = Number(rawId);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ success: false, message: 'Invalid eventId' }, { status: 400 });
  }

  try {
    const userId = parseUserId(req);
    const event = await getAuctionEventById(eventId, userId);
    if (!event) {
      return NextResponse.json({ success: false, message: 'Licytacja niedostępna' }, { status: 404 });
    }
    return NextResponse.json({ success: true, event });
  } catch (error) {
    const mapped = mapAuctionError(error);
    return NextResponse.json({ success: false, message: mapped.message, code: mapped.code }, { status: mapped.status });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const userId = parseUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id: rawId } = await context.params;
  const eventId = Number(rawId);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ success: false, message: 'Invalid eventId' }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (body.status === 'CANCELLED') {
      const event = await cancelAuctionEvent(userId, eventId);
      return NextResponse.json({ success: true, event });
    }
    return NextResponse.json({ success: false, message: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    const mapped = mapAuctionError(error);
    return NextResponse.json({ success: false, message: mapped.message, code: mapped.code }, { status: mapped.status });
  }
}
