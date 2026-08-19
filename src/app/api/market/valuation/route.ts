import { NextResponse } from 'next/server';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { valueProperty } from '@/lib/market/compsEngine';
import { parsePurpose, parseValuationSubject } from '@/lib/market/parseSubject';
import { parseLooseNumber } from '@/lib/market/format';
import {
  canUseAgentMarket,
  canUseListingMarketHelper,
  canUsePublicMarket,
  loadMarketUser,
} from '@/lib/market/access';
import { hitRateLimit } from '@/lib/market/rateLimit';
import { VALUATION_RATE_LIMIT_PER_10MIN } from '@/lib/market/constants';
import { ensureMarketTables } from '@/lib/market/ensureMarketTables';
import { getMarketReportQuota } from '@/lib/market/reportQuota';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    await ensureMarketTables();
    const userId = await resolveWebUserId(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const purpose = parsePurpose(body.purpose);
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'ip';

    if (hitRateLimit(`val:${userId || ip}`, VALUATION_RATE_LIMIT_PER_10MIN, 10 * 60 * 1000)) {
      return NextResponse.json(
        { ok: false, code: 'RATE', message: 'Zbyt wiele wycen z rzędu. Poczekaj chwilę.' },
        { status: 429 },
      );
    }

    const user = userId ? await loadMarketUser(userId) : null;
    if (purpose === 'consumer') {
      if (!user) {
        return NextResponse.json(
          { ok: false, code: 'AUTH', message: 'Zaloguj się, żeby sprawdzić cenę przy aktach.' },
          { status: 401 },
        );
      }
      if (!(await canUsePublicMarket(user))) {
        return NextResponse.json(
          {
            ok: false,
            code: 'PRO_REQUIRED',
            message:
              'Porównanie ceny z aktami notarialnymi jest dostępne w Investor Pro albo Partner Pro biura.',
          },
          { status: 403 },
        );
      }
    }
    if (purpose === 'listing') {
      if (!user) return NextResponse.json({ ok: false, code: 'AUTH', message: 'Zaloguj się.' }, { status: 401 });
      if (!canUseListingMarketHelper(user)) {
        return NextResponse.json(
          {
            ok: false,
            code: 'PRO_REQUIRED',
            message: 'Analiza ceny przy dodawaniu oferty jest dostępna przy aktywnym Investor Pro.',
          },
          { status: 403 },
        );
      }
    }
    if (purpose === 'crm' || purpose === 'hub') {
      if (!user) return NextResponse.json({ ok: false, code: 'AUTH', message: 'Zaloguj się.' }, { status: 401 });
      if (!canUseAgentMarket(user)) {
        const agencyId = await requireAgencyUserId(req);
        if (!agencyId) {
          return NextResponse.json(
            {
              ok: false,
              code: 'AGENT_REQUIRED',
              message: 'EstateOS™ Market dla agentów wymaga konta biura albo aktywnego Pro.',
            },
            { status: 403 },
          );
        }
      }
    }

    const subject = parseValuationSubject(body);
    if ('error' in subject) {
      return NextResponse.json({ ok: false, code: 'INVALID', message: subject.error }, { status: 422 });
    }

    const listingPrice = parseLooseNumber(body.listingPrice ?? body.price);
    const result = await valueProperty(subject, listingPrice);
    if (!result.ok) {
      const status = result.code === 'SYNCING' ? 503 : 422;
      return NextResponse.json(result, { status });
    }
    const quota = user ? await getMarketReportQuota(user) : null;
    return NextResponse.json({
      ...result,
      access: {
        purpose,
        isPro: Boolean(user && (await canUsePublicMarket(user))),
        marketReportCredits: user?.marketReportCredits ?? 0,
        quota,
      },
    });
  } catch (error) {
    console.error('[market.valuation]', error);
    return NextResponse.json(
      { ok: false, code: 'ERROR', message: 'Nie udało się policzyć wyceny.' },
      { status: 500 },
    );
  }
}
