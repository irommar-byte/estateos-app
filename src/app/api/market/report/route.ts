import { NextResponse } from 'next/server';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { prisma } from '@/lib/prisma';
import { valueProperty } from '@/lib/market/compsEngine';
import { parseValuationSubject } from '@/lib/market/parseSubject';
import { parseLooseNumber } from '@/lib/market/format';
import {
  collectReportEmails,
  emailMarketReport,
  loadUserMarketReport,
  recordMarketReportGeneration,
  stampReportEmails,
} from '@/lib/market/deliverReport';
import { buildMarketReportHtml } from '@/lib/market/reportHtml';
import { ensureMarketTables } from '@/lib/market/ensureMarketTables';
import {
  consumeMarketReportQuota,
  getMarketReportQuota,
  refundMarketReportCreditIfUsed,
} from '@/lib/market/reportQuota';
import { loadMarketUser } from '@/lib/market/access';
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

async function resolveClient(userId: number, body: Record<string, unknown>) {
  const clientId = Number(body.clientId);
  if (!Number.isFinite(clientId) || clientId <= 0) return null;
  return prisma.agencyClient.findFirst({
    where: { id: clientId, agencyUserId: userId, status: 'ACTIVE' },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
}

function recipientName(body: Record<string, unknown>, client: { firstName: string; lastName: string } | null, fallback: string) {
  return (
    String(body.name || '').trim() ||
    (client ? `${client.firstName} ${client.lastName}`.trim() : '') ||
    fallback
  );
}

export async function POST(req: Request) {
  try {
    await ensureMarketTables();
    const userId = await resolveWebUserId(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const generateOnly = body.generate === true || body.generate === 'true' || body.action === 'generate';
    const previewOnly = body.preview === true || body.preview === 'true';
    const reportId = Number(body.reportId);
    const sendExisting = Number.isFinite(reportId) && reportId > 0 && !generateOnly;

    const user = userId ? await loadMarketUser(userId) : null;
    if (!user) {
      return NextResponse.json(
        { ok: false, code: 'AUTH', message: 'Zaloguj się, żeby wygenerować raport wyceny.' },
        { status: 401 },
      );
    }

    const client = await resolveClient(user.id, body);
    const emails = collectReportEmails(body, client?.email);
    const name = recipientName(body, client, user.email);

    if (previewOnly && !generateOnly && !sendExisting) {
      const quota = await getMarketReportQuota(user);
      return NextResponse.json(
        {
          ok: false,
          code: 'CONFIRM_GENERATE',
          message:
            'Limit schodzi przy wygenerowaniu raportu, nie przy wysyłce. Potwierdź wygenerowanie tej nieruchomości.',
          quota,
        },
        { status: 422 },
      );
    }

    if (sendExisting) {
      if (!emails.length) {
        return NextResponse.json(
          {
            ok: false,
            code: 'EMAIL',
            message: client
              ? 'Ten klient nie ma e-maila — wpisz adres albo dodaj go na karcie klienta.'
              : 'Podaj adres e-mail, żeby wysłać już wygenerowany raport.',
          },
          { status: 422 },
        );
      }
      const stored = await loadUserMarketReport(user.id, reportId);
      if (!stored) {
        return NextResponse.json(
          { ok: false, code: 'NOT_FOUND', message: 'Nie znaleziono tego raportu.' },
          { status: 404 },
        );
      }
      const sent = await emailMarketReport({ emails, name, result: stored.result });
      await stampReportEmails(reportId, emails);
      if (client) {
        await recordMarketReportForClient({
          clientId: client.id,
          agencyUserId: user.id,
          emails,
          reportId,
          mid: stored.result.estimated.mid,
          score: stored.result.vsListing?.score ?? null,
          summary: `Najbardziej prawdopodobna wartość: ${Math.round(stored.result.estimated.mid).toLocaleString('pl-PL')} zł (${stored.result.stats.count} aktów, ${stored.result.stats.windowMonths} mies.).`,
        });
      }
      const quota = await getMarketReportQuota(user);
      return NextResponse.json({
        ok: true,
        emailed: sent.emailed,
        emails: sent.emails,
        reportId,
        generated: false,
        quota,
        result: stored.result,
        clientRecorded: Boolean(client),
      });
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

    if (!generateOnly && !emails.length) {
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

    const consumed = await consumeMarketReportQuota(user);
    if (!consumed.ok) {
      return NextResponse.json(
        { ok: false, code: consumed.code, message: consumed.message, quota: consumed.quota },
        { status: consumed.status },
      );
    }

    let recorded: { reportId: number; html: string; emails: string[] };
    try {
      recorded = await recordMarketReportGeneration({
        userId: user.id,
        emails,
        fallbackEmail: user.email,
        name,
        purpose: consumed.purpose,
        creditUsed: consumed.creditUsed,
        subject,
        result,
      });
    } catch (error) {
      await refundMarketReportCreditIfUsed(user.id, consumed.creditUsed);
      throw error;
    }

    const html = recorded.html || buildMarketReportHtml(result, { recipientName: name });
    const nextQuota = await getMarketReportQuota(user);

    if (generateOnly) {
      return NextResponse.json({
        ok: true,
        generated: true,
        reportId: recorded.reportId,
        html,
        emails,
        creditUsed: consumed.creditUsed,
        quota: nextQuota,
        result,
      });
    }

    const sent = await emailMarketReport({ emails, name, result });
    if (client) {
      await recordMarketReportForClient({
        clientId: client.id,
        agencyUserId: user.id,
        emails,
        reportId: recorded.reportId,
        mid: result.estimated.mid,
        score: result.vsListing?.score ?? null,
        summary: `Najbardziej prawdopodobna wartość: ${Math.round(result.estimated.mid).toLocaleString('pl-PL')} zł (${result.stats.count} aktów, ${result.stats.windowMonths} mies.).`,
      });
    }

    return NextResponse.json({
      ok: true,
      generated: true,
      emailed: sent.emailed,
      emails: sent.emails,
      reportId: recorded.reportId,
      creditUsed: consumed.creditUsed,
      quota: nextQuota,
      result,
      clientRecorded: Boolean(client),
    });
  } catch (error) {
    console.error('[market.report]', error);
    return NextResponse.json({ ok: false, message: 'Nie udało się wygenerować raportu.' }, { status: 500 });
  }
}
