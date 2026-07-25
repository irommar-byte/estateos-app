import { NextResponse } from 'next/server';
import { getClientIp } from '@/lib/observability';
import { recordUserLogin } from '@/lib/recordUserLogin';
import { parseMobileUserIdFromAuthHeader } from '@/lib/mobileAuthUserId';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Mobile heartbeat — stamps lastLoginAt so WWW/mobile show ONLINE. */
export async function POST(req: Request) {
  const userId = parseMobileUserIdFromAuthHeader(req.headers.get('authorization'));
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Brak autoryzacji' }, { status: 401 });
  }
  const ip = getClientIp(req);
  await recordUserLogin(userId, ip);
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
