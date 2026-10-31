import { NextResponse } from 'next/server';
import { BUYER_AGENT_COOKIE, BUYER_AGENT_COOKIE_MAX_AGE_SEC } from '@/lib/buyerIntake.server';
import { resolveSmartLink } from '@/lib/crm/smartSearch';

export const dynamic = 'force-dynamic';

/**
 * Link wyszukiwarki Smart Agent OS™: `/szukam/s/{kod}`. Kod jest losowy — nie da się go
 * podmienić na numer innego agenta. Agenta wybieramy w chwili wysłania formularza
 * (link biura pokazuje aktualnego posiadacza stanowiska, a bez niego kierownika).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const resolved = await resolveSmartLink(code);
  // Względny adres — za proxy req.url wskazuje wewnętrzny host serwera.
  const location = resolved.agentUserId ? '/szukam' : '/szukam?link=inactive';
  const res = new NextResponse(null, { status: 307, headers: { Location: location } });
  if (resolved.agentUserId) {
    res.cookies.set(BUYER_AGENT_COOKIE, code, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: BUYER_AGENT_COOKIE_MAX_AGE_SEC,
    });
  } else {
    res.cookies.delete(BUYER_AGENT_COOKIE);
  }
  return res;
}
