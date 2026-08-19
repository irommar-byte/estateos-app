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
  isActivePro,
  loadMarketUser,
  officeProReportsInWindow,
  proReportsToday,
  OFFICE_PRO_REPORT_CAP,
  OFFICE_PRO_REPORT_WINDOW_DAYS,
  PRO_REPORT_DAILY_CAP,
  userHasOfficePartnerPro,
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

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          code: 'AUTH',
          message: 'Zaloguj się, żeby wysłać raport wyceny na e-mail.',
        },
        { status: 401 },
      );
    }

    const investorPro = isActivePro(user);
    const officePro = await userHasOfficePartnerPro(user.id);
    const admin = String(user.role || '').toUpperCase() === 'ADMIN';

    if (investorPro || admin) {
      if (canUseAgentMarket(user)) purpose = 'crm';
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
    } else if (officePro) {
      const used = await officeProReportsInWindow(user.id);
      if (used >= OFFICE_PRO_REPORT_CAP) {
        return NextResponse.json(
          {
            ok: false,
            code: 'PERIOD_CAP',
            message: `Limit ${OFFICE_PRO_REPORT_CAP} raportów na ${OFFICE_PRO_REPORT_WINDOW_DAYS} dni został wykorzystany.`,
          },
          { status: 429 },
        );
      }
    } else if (canUseAgentMarket(user)) {
      return NextResponse.json(
        {
          ok: false,
          code: 'PRO_REQUIRED',
          message:
            'Raporty e-mail dla klientów są w Partner Pro — cały zespół dostaje 5 sztuk na 30 dni. Partner Start tego nie obejmuje.',
        },
        { status: 403 },
      );
    } else {
      const consumed = await consumeMarketReportCredit(user.id);
      if (!consumed) {
        return NextResponse.json(
          {
            ok: false,
            code: 'PRO_REQUIRED',
            message: 'Raport z aktów na e-mail jest dostępny w Investor Pro albo Partner Pro biura.',
            marketReportCredits: user.marketReportCredits,
          },
          { status: 403 },
        );
      }
      creditUsed = true;
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
