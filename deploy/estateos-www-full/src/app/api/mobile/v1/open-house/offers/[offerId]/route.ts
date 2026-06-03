export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { getPublishedEventForOffer } from '@/lib/openHouse';

function parseUserId(req: Request): number | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const rawToken = auth.replace(/^Bearer\s+/i, '').trim();
  if (!rawToken) return null;
  const payload = verifyMobileToken(rawToken) as Record<string, unknown>;
  const userId = Number(payload?.id ?? payload?.userId ?? payload?.sub);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

type RouteContext = { params: Promise<{ offerId: string }> };

export async function GET(req: Request, context: RouteContext) {
  const userId = parseUserId(req);
  const { offerId: rawOfferId } = await context.params;
  const offerId = Number(rawOfferId);

  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ success: false, message: 'Invalid offerId' }, { status: 400 });
  }

  const event = await getPublishedEventForOffer(offerId, userId);
  return NextResponse.json({ success: true, event });
}
