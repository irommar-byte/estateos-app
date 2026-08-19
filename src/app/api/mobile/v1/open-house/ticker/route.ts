export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { buildOpenHouseTickerItems } from '@/lib/openHouse';
import { maybeDispatchOpenHouseReminders } from '@/lib/openHouseReminders';

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
  try {
    parseUserId(req);
    void maybeDispatchOpenHouseReminders().catch(() => undefined);
    const items = await buildOpenHouseTickerItems();
    return NextResponse.json({
      success: true,
      updatedAt: new Date().toISOString(),
      items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, updatedAt: new Date().toISOString(), items: [], error: message },
      { status: 200 }
    );
  }
}
