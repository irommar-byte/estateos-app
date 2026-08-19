import { NextResponse } from 'next/server';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { prisma } from '@/lib/prisma';
import { valueProperty } from '@/lib/market/compsEngine';
import { parseValuationSubject } from '@/lib/market/parseSubject';
import { parseLooseNumber } from '@/lib/market/format';
import { collectReportEmails, deliverMarketReport } from '@/lib/market/deliverReport';
import { buildMarketReportHtml } from '@/lib/market/reportHtml';
import { ensureMarketTables } from '@/lib/market/ensureMarketTables';
import { getMarketReportQuota } from '@/lib/market/reportQuota';
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
import { recordMarketReportForClient } from '@/lib/crm/sellerSaleUpdates';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await ensureMarketTables();
    const userId = await resolveWebUserId(req);
    if (!userId) {
      return NextResponse.json({ ok: false, code: 'AUTH', message: 'Zaloguj się.' }, { status: 401 });
    }
    const user = await loadMarketUser(userId);
    if (!user) {
      return NextResponse.json({ ok: false, code: 'AUTH', message: 'Zaloguj się.' }, { status: 401 });
    }
    const quota = await getMarketReportQuota(user);
    return NextResponse.json({ ok: true, quota });
  } catch (error) {
    console.error('[market.report.quota]', error);
    return NextResponse.json({ ok: false, message: 'Nie udało się pobrać limitu raportów.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureMarketTables();
    const userId = await resolveWebUserId(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const previewOnly = body.preview === true || body.preview === 'true';

    const user = userId ? await loadMarketUser(userId) : null;
    if (!user) {
      return NextResponse.json(
        { ok: false, code: 'AUTH', message: 'Zaloguj się, żeby wysłać raport wyceny na e-mail.' },
        { status: 401 },
      );
    }

    const clientId = Number(body.clientId);
    const client =
      Number.isFinite(clientId) && clientId > 0
        ? await prisma.agencyClient.findFirst({
            where: { id: clientId, agencyUserId: user.id, status: 'ACTIVE' },
            select: { id: true, email: true, firstName: true, lastName: true },
          })
        : null;

    const emails = collectReportEmails(body);
    if (!emails.length) {
      return NextResponse.json(
        {
          ok: false,
          code: 'EMAIL',
          message: client
            ? 'Ten klient nie ma e-maila — wpisz adres albo dodaj go na karcie klienta.'
            : 'Podaj adres e-mail do raportu (e-mail klienta albo alternatywny).',
        },
        { status: 422 },
      );
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

    const quota = await getMarketReportQuota(user);
    const name =
      String(body.name || '').trim() ||
      (client ? `${client.firstName} ${client.lastName}`.trim() : '') ||
      user.email;
    const html = buildMarketReportHtml(result, { recipientName: name });

    if (previewOnly) {
      return NextResponse.json({
        ok: true,
        preview: true,
        html,
        emails,
        quota,
        result,
      });
    }

    let creditUsed = false;
    let purpose = 'consumer';

    const investorPro = isActivePro(user);
    const officePro = await userHasOfficePartnerPro(user.id);
    const admin = String(user.role || '').toUpperCase() === 'ADMIN';

    if (quota.remaining <= 0 && quota.kind !== 'credits') {
      return NextResponse.json(
        { ok: false, code: quota.kind === 'none' ? 'PRO_REQUIRED' : 'PERIOD_CAP', message: quota.message, quota },
        { status: quota.kind === 'none' ? 403 : 429 },
      );
    }

    if (investorPro || admin) {
      if (canUseAgentMarket(user)) purpose = 'crm';
      const today = await proReportsToday(user.id);
      if (today >= PRO_REPORT_DAILY_CAP) {
        return NextResponse.json(
          {
            ok: false,
            code: 'DAILY_CAP',
            message: `Dzienny limit raportów (${PRO_REPORT_DAILY_CAP}) został wykorzystany.`,
            quota,
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
            quota,
          },
          { status: 429 },
        );
      }
      purpose = 'crm';
    } else if (canUseAgentMarket(user)) {
      return NextResponse.json(
        {
          ok: false,
          code: 'PRO_REQUIRED',
          message:
            'Raporty e-mail dla klientów są w Partner Pro — cały zespół dostaje 5 sztuk na 30 dni. Partner Start tego nie obejmuje.',
          quota,
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
            quota,
            marketReportCredits: user.marketReportCredits,
          },
          { status: 403 },
        );
      }
      creditUsed = true;
    }

    const sent = await deliverMarketReport({
      userId: user.id,
      emails,
      name,
      purpose,
      creditUsed,
      subject,
      result,
    });

    if (client) {
      await recordMarketReportForClient({
        clientId: client.id,
        agencyUserId: user.id,
        emails,
        mid: result.estimated.mid,
        score: result.vsListing?.score ?? null,
        summary: `Najbardziej prawdopodobna wartość: ${Math.round(result.estimated.mid).toLocaleString('pl-PL')} zł (${result.stats.count} aktów, ${result.stats.windowMonths} mies.).`,
      });
    }

    const nextQuota = await getMarketReportQuota(user);
    return NextResponse.json({
      ok: true,
      emailed: sent.emailed,
      emails: sent.emails,
      creditUsed,
      quota: nextQuota,
      result,
      clientRecorded: Boolean(client),
    });
  } catch (error) {
    console.error('[market.report]', error);
    return NextResponse.json({ ok: false, message: 'Nie udało się wysłać raportu.' }, { status: 500 });
  }
}
