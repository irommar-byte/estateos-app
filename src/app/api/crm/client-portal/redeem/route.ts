import { NextResponse } from 'next/server';
import { inviteRateLimited, redeemClientInviteCode } from '@/lib/crm/clientInviteCode';

export const dynamic = 'force-dynamic';

/** Wejście klienta do aplikacji: 6-cyfrowy kod (z QR albo wpisany) → token panelu. */
export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
  if (inviteRateLimited(ip)) {
    return NextResponse.json({ error: 'Zbyt wiele prób. Spróbuj za kilka minut.' }, { status: 429 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const result = await redeemClientInviteCode(String(body.code || ''));
  if (!result) {
    return NextResponse.json({ error: 'Nieprawidłowy kod. Sprawdź cyfry albo poproś agenta o nowy.' }, { status: 404 });
  }
  return NextResponse.json({ success: true, portalToken: result.portalToken });
}
