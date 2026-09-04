import { NextResponse } from 'next/server';
import { authorizeMobile } from '@/lib/mobileAuth';
import { SMART_ADD_ALWAYS_ON } from '@/lib/intelligenceSmartAdd';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await authorizeMobile(req);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ success: true, enabled: SMART_ADD_ALWAYS_ON });
}

export async function PATCH(req: Request) {
  const auth = await authorizeMobile(req);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ success: true, enabled: SMART_ADD_ALWAYS_ON });
}
