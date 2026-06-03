export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { mapOpenHouseError, reserveOpenHouseSlot } from '@/lib/openHouse';

function parseUserId(req: Request): number | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const rawToken = auth.replace(/^Bearer\s+/i, '').trim();
  if (!rawToken) return null;
  const payload = verifyMobileToken(rawToken) as Record<string, unknown>;
  const userId = Number(payload?.id ?? payload?.userId ?? payload?.sub);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

type RouteContext = { params: Promise<{ slotId: string }> };

export async function POST(req: Request, context: RouteContext) {
  const userId = parseUserId(req);
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
