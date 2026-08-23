import { NextResponse } from 'next/server';
import { authorizeMobile } from '@/lib/mobileAuth';
import { getIntelligenceSmartAddEnabled, setIntelligenceSmartAddEnabled } from '@/lib/intelligenceSmartAdd';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await authorizeMobile(req);
  if (!auth.ok) return auth.response;
  const enabled = await getIntelligenceSmartAddEnabled(auth.userId);
  return NextResponse.json({ success: true, enabled });
}

export async function PATCH(req: Request) {
  const auth = await authorizeMobile(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  if (typeof body?.enabled !== 'boolean') {
    return NextResponse.json({ success: false, message: 'Podaj enabled (boolean).' }, { status: 400 });
  }
  const enabled = await setIntelligenceSmartAddEnabled(auth.userId, body.enabled);
  return NextResponse.json({ success: true, enabled });
}
