export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/jwtMobile';
import {
  createOpenHouseEvent,
  listHostOpenHouseEvents,
  listMyOpenHouseReservations,
  listPublishedOpenHouseEvents,
  mapOpenHouseError,
} from '@/lib/openHouse';

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
  const scope = searchParams.get('scope') || 'published';

  try {
    if (scope === 'host') {
      if (!userId) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }
      const events = await listHostOpenHouseEvents(userId);
      return NextResponse.json({ success: true, events });
    }

    if (scope === 'reservations') {
      if (!userId) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }
      const reservations = await listMyOpenHouseReservations(userId);
      return NextResponse.json({ success: true, reservations });
    }

    const events = await listPublishedOpenHouseEvents(userId);
    return NextResponse.json({ success: true, events });
  } catch (error) {
    const mapped = mapOpenHouseError(error);
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
    const event = await createOpenHouseEvent(userId, {
      offerId: Number(body.offerId),
      title: body.title ?? null,
      description: body.description ?? null,
      slots: Array.isArray(body.slots) ? body.slots : [],
      publish: body.publish !== false,
    });
    return NextResponse.json({ success: true, event });
  } catch (error) {
    const mapped = mapOpenHouseError(error);
    return NextResponse.json({ success: false, message: mapped.message, code: mapped.code }, { status: mapped.status });
  }
}
