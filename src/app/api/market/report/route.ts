import { NextResponse } from 'next/server';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { valueProperty } from '@/lib/market/compsEngine';
import { parseValuationSubject } from '@/lib/market/parseSubject';
import { parseLooseNumber } from '@/lib/market/format';
import { deliverMarketReport } from '@/lib/market/deliverReport';
import { ensureMarketTables } from '@/lib/market/ensureMarketTables';
import {
  canUseAgentMarket,
  consumeMarketReportCredit,
  loadMarketUser,
  proReportsToday,
  PRO_REPORT_DAILY_CAP,
} from '@/lib/market/access';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    await ensureMarketTables();
    const userId = await resolveWebUserId(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return NextResponse.json({ ok: false, code: 'EMAIL', message: 'Podaj adres e-mail do raportu.' }, { status: 422 });
    }
    const subject = parseValuationSubject(body);
    if ('error' in subject) {
      return NextResponse.json({ ok: false, code: 'INVALID', message: subject.error }, { status: 422 });
    }
    const listingPrice = parseLooseNumber(body.listingPrice ?? body.price);
    const result = await valueProperty(subject, listingPrice);
    if (!result.ok) {
      return NextResponse.json(result, { status: result.code === 'SYNCING' ? 503 : 422 });
    }

    const user = userId ? await loadMarketUser(userId) : null;
    const name = String(body.name || user?.email || '').trim();
    let creditUsed = false;
    let purpose = 'consumer';

    if (user && canUseAgentMarket(user)) {
      purpose = 'crm';
      const today = await proReportsToday(user.id);
      if (today >= PRO_REPORT_DAILY_CAP) {
        return NextResponse.json(
          {
            ok: false,
            code: 'DAILY_CAP',
            message: `Dzienny limit raportów (${PRO_REPORT_DAILY_CAP}) został wykorzystany.`,
          },
          { status: 429 },
        );
      }
    } else if (user) {
      const consumed = await consumeMarketReportCredit(user.id);
      if (!consumed) {
        return NextResponse.json(
          {
            ok: false,
            code: 'NEEDS_CREDIT',
            message: 'Raport PDF na e-mail kosztuje 1 kredyt EstateOS™ Market.',
            marketReportCredits: user.marketReportCredits,
          },
          { status: 402 },
        );
      }
      creditUsed = true;
    } else {
      return NextResponse.json(
        {
          ok: false,
          code: 'AUTH',
          message: 'Zaloguj się albo kup 1 kredyt raportu, żeby dostać analizę na e-mail.',
        },
        { status: 401 },
      );
    }

    const sent = await deliverMarketReport({
      userId: user?.id ?? null,
      email,
      name,
      purpose,
      creditUsed,
      subject,
      result,
    });

    return NextResponse.json({
      ok: true,
      emailed: sent,
      creditUsed,
      result,
    });
  } catch (error) {
    console.error('[market.report]', error);
    return NextResponse.json({ ok: false, message: 'Nie udało się wysłać raportu.' }, { status: 500 });
  }
}
