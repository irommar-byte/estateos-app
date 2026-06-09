export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { mapOpenHouseError, reserveOpenHouseSlot } from '@/lib/openHouse';
import { resolveWebUserId } from '@/lib/webSessionAuth';

type RouteContext = { params: Promise<{ slotId: string }> };

export async function POST(req: Request, context: RouteContext) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { slotId: rawSlotId } = await context.params;
  const slotId = Number(rawSlotId);
  if (!Number.isFinite(slotId) || slotId <= 0) {
    return NextResponse.json({ success: false, message: 'Invalid slotId' }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const result = await reserveOpenHouseSlot(userId, slotId, {
      guestCount: body.guestCount,
      note: body.note,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const mapped = mapOpenHouseError(error);
    return NextResponse.json({ success: false, message: mapped.message, code: mapped.code }, { status: mapped.status });
  }
}
