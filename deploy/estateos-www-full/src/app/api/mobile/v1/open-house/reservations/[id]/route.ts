export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { cancelOpenHouseReservation, mapOpenHouseError } from '@/lib/openHouse';

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

export async function DELETE(_req: Request, context: RouteContext) {
  const userId = parseUserId(_req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const reservationId = Number(id);
  if (!Number.isFinite(reservationId) || reservationId <= 0) {
    return NextResponse.json({ success: false, message: 'Invalid id' }, { status: 400 });
  }

  try {
    const event = await cancelOpenHouseReservation(userId, reservationId);
    return NextResponse.json({ success: true, event });
  } catch (error) {
    const mapped = mapOpenHouseError(error);
    return NextResponse.json({ success: false, message: mapped.message, code: mapped.code }, { status: mapped.status });
  }
}
