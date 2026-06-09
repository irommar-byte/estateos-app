export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { cancelOpenHouseReservation, mapOpenHouseError } from '@/lib/openHouse';
import { resolveWebUserId } from '@/lib/webSessionAuth';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, context: RouteContext) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id: rawId } = await context.params;
  const reservationId = Number(rawId);
  if (!Number.isFinite(reservationId) || reservationId <= 0) {
    return NextResponse.json({ success: false, message: 'Invalid reservationId' }, { status: 400 });
  }

  try {
    const event = await cancelOpenHouseReservation(userId, reservationId);
    return NextResponse.json({ success: true, event });
  } catch (error) {
    const mapped = mapOpenHouseError(error);
    return NextResponse.json({ success: false, message: mapped.message, code: mapped.code }, { status: mapped.status });
  }
}
