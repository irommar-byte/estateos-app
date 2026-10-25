import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { isSocialShareCrawler } from '@/lib/socialCrawler';
import { offerLandingPath, trackPublicationVisit } from '@/lib/crm/facebookPromotion';
import { resolvePublicAppOrigin } from '@/lib/offerShareLanding';
import { requestIp } from '@/lib/crm/clientInviteCode';

export const dynamic = 'force-dynamic';

/**
 * Link śledzący publikacji: liczy unikalne wejście (bez botów podglądu linków), zapamiętuje
 * źródło w cookie (do przypisania zapytania) i przekierowuje na ogłoszenie.
 */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const origin = resolvePublicAppOrigin();
  const clean = String(code || '').trim().slice(0, 24);
  const pub = await prisma.marketingPublication
    .findUnique({ where: { code: clean }, select: { offerId: true, agencyUserId: true } })
    .catch(() => null);
  if (!pub) return NextResponse.redirect(`${origin}/`, 302);

  const ua = req.headers.get('user-agent') || '';
  if (!isSocialShareCrawler(ua) && !/bot|crawler|spider|preview/i.test(ua)) {
    const visitor = crypto.createHash('sha256').update(`${requestIp(req.headers)}|${ua}`).digest('hex');
    await trackPublicationVisit(clean, visitor).catch(() => null);
  }
  const res = NextResponse.redirect(`${origin}${offerLandingPath(pub.offerId, pub.agencyUserId)}`, 302);
  res.cookies.set('eos_z', clean, { path: '/', maxAge: 30 * 24 * 60 * 60, sameSite: 'lax', secure: true, httpOnly: true });
  return res;
}
