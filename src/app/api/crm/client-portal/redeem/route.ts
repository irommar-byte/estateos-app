import { NextResponse } from 'next/server';
import { parseInviteLink, redeemInviteCode, redeemInviteLinkKey, requestIp } from '@/lib/crm/clientInviteCode';

export const dynamic = 'force-dynamic';

/**
 * Wejście klienta do aplikacji → token panelu.
 * Body: { code: "123456" } (wpisane) albo { link: "https://estateos.pl/app/kod/…" } (zeskanowany QR).
 */
export async function POST(req: Request) {
  const ip = requestIp(req.headers);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const fromLink = parseInviteLink(String(body.link || ''));
  const linkKey = String(body.linkKey || '') || fromLink.linkKey;
  const result = linkKey
    ? await redeemInviteLinkKey(linkKey, ip)
    : await redeemInviteCode(String(body.code || fromLink.code || ''), ip);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, reason: result.reason }, { status: result.status });
  }
  return NextResponse.json({ success: true, portalToken: result.portalToken });
}
