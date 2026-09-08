import { NextResponse } from 'next/server';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { prisma } from '@/lib/prisma';
import { valueProperty } from '@/lib/market/compsEngine';
import { parseValuationSubject } from '@/lib/market/parseSubject';
import { parseLooseNumber } from '@/lib/market/format';
import {
  collectReportEmails,
  emailMarketReport,
  listUserOfferReports,
  loadUserMarketReport,
  parseReportVariant,
  previewUserMarketReport,
  recordMarketReportGeneration,
  stampReportEmails,
} from '@/lib/market/deliverReport';
import { ensureMarketTables } from '@/lib/market/ensureMarketTables';
import {
  consumeMarketReportQuota,
  getMarketReportQuota,
  refundMarketReportCreditIfUsed,
} from '@/lib/market/reportQuota';
import { loadMarketUser } from '@/lib/market/access';
import { recordMarketReportForClient } from '@/lib/crm/sellerSaleUpdates';
import { resolveOfferReportInput } from '@/lib/market/offerReportSubject';
import { buildPortalUrl } from '@/lib/agencyClientNotify';
import { marketReportPortalHref } from '@/lib/crm/portalActivityStacks';

export const dynamic = 'force-dynamic';

async function resolveClient(userId: number, body: Record<string, unknown>) {
  const clientId = Number(body.clientId);
  if (!Number.isFinite(clientId) || clientId <= 0) return null;
  return prisma.agencyClient.findFirst({
    where: { id: clientId, agencyUserId: userId, status: 'ACTIVE' },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      portalToken: true,
      linkedOfferId: true,
    },
  });
}

function recipientName(
  body: Record<string, unknown>,
  client: { firstName: string; lastName: string } | null,
  fallback: string,
) {
  return (
    String(body.name || '').trim() ||
    (client ? `${client.firstName} ${client.lastName}`.trim() : '') ||
    fallback
  );
}

function resolveOfferId(
  body: Record<string, unknown>,
  client: { linkedOfferId: number | null } | null,
) {
  const fromBody = Number(body.offerId);
  if (Number.isFinite(fromBody) && fromBody > 0) return fromBody;
  const linked = Number(client?.linkedOfferId);
  return Number.isFinite(linked) && linked > 0 ? linked : null;
}

function portalHomeUrl(token?: string | null) {
  return token ? buildPortalUrl(token) : null;
}

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

    const url = new URL(req.url);
    const reportId = Number(url.searchParams.get('reportId'));
    const preview = url.searchParams.get('preview');
    const clientId = Number(url.searchParams.get('clientId'));
    const offerId = Number(url.searchParams.get('offerId'));
    const quota = await getMarketReportQuota(user);

    if (Number.isFinite(reportId) && reportId > 0 && preview) {
      const variantParam = String(preview).toLowerCase();
      const name = String(url.searchParams.get('name') || '').trim();
      if (variantParam === '1' || variantParam === 'true' || variantParam === 'both') {
        const [classic, pro] = await Promise.all([
          previewUserMarketReport({ userId: user.id, reportId, variant: 'classic', name }),
          previewUserMarketReport({ userId: user.id, reportId, variant: 'pro', name }),
        ]);
        if (!classic && !pro) {
          return NextResponse.json(
            { ok: false, code: 'NOT_FOUND', message: 'Nie znaleziono tego raportu.' },
            { status: 404 },
          );
        }
        return NextResponse.json({
          ok: true,
          reportId,
          html: classic?.html || pro?.html || '',
          htmlPro: pro?.html || classic?.html || '',
          quota,
        });
      }
      const variant = parseReportVariant(variantParam);
      const previewed = await previewUserMarketReport({
        userId: user.id,
        reportId,
        variant,
        name,
      });
      if (!previewed) {
        return NextResponse.json(
          { ok: false, code: 'NOT_FOUND', message: 'Nie znaleziono tego raportu.' },
          { status: 404 },
        );
      }
      return NextResponse.json({
        ok: true,
        reportId,
        variant,
        html: previewed.html,
        quota,
      });
    }

    const reports = await listUserOfferReports({
      userId: user.id,
      clientId: Number.isFinite(clientId) && clientId > 0 ? clientId : null,
      offerId: Number.isFinite(offerId) && offerId > 0 ? offerId : null,
    });

    return NextResponse.json({ ok: true, quota, reports });
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
    const name = recipientName(body, client, '');
    const variant = parseReportVariant(body.variant ?? body.reportVariant);
    const offerId = resolveOfferId(body, client);

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
      await stampReportEmails(reportId, emails);
      let portalUrl = portalHomeUrl(client?.portalToken);
      let clientRecorded = false;
      let activityId: number | null = null;
      if (client) {
        const recorded = await recordMarketReportForClient({
          clientId: client.id,
          agencyUserId: user.id,
          emails,
          reportId,
          reportVariant: variant,
          offerId: offerId || (stored.row as { offerId?: number | null }).offerId || null,
          mid: stored.result.estimated.mid,
          score: stored.result.vsListing?.score ?? null,
          summary: `Najbardziej prawdopodobna wartość: ${Math.round(stored.result.estimated.mid).toLocaleString('pl-PL')} zł (${stored.result.stats.count} aktów, ${stored.result.stats.windowMonths} mies.).`,
        });
        clientRecorded = recorded.ok;
        if (recorded.ok && recorded.activityId && client.portalToken) {
          activityId = recorded.activityId;
          portalUrl = marketReportPortalHref(client.portalToken, recorded.activityId);
        }
      }
      const sent = await emailMarketReport({
        emails,
        name,
        result: stored.result,
        variant,
        portalUrl,
      });
      const quota = await getMarketReportQuota(user);
      return NextResponse.json({
        ok: true,
        emailed: sent.emailed,
        emails: sent.emails,
        reportId,
        generated: false,
        quota,
        result: stored.result,
        clientRecorded,
        activityId,
        notified: clientRecorded,
      });
    }

    let subject = parseValuationSubject(body);
    let listingPrice = parseLooseNumber(body.listingPrice ?? body.price);
    if (offerId) {
      const fromOffer = await resolveOfferReportInput({
        agencyUserId: user.id,
        offerId,
        clientId: client?.id || null,
        body,
      });
      if ('error' in fromOffer) {
        if ('error' in subject) {
          return NextResponse.json({ ok: false, code: 'INVALID', message: fromOffer.error }, { status: 422 });
        }
      } else {
        subject = fromOffer.subject;
        if (listingPrice == null) listingPrice = fromOffer.listingPrice;
      }
    }
    if ('error' in subject) {
      return NextResponse.json({ ok: false, code: 'INVALID', message: subject.error }, { status: 422 });
    }
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

    let recorded: { reportId: number; html: string; htmlPro: string; emails: string[]; result: typeof result };
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
        clientId: client?.id || null,
        offerId,
      });
    } catch (error) {
      await refundMarketReportCreditIfUsed(user.id, consumed.creditUsed);
      throw error;
    }

    const pair = {
      html: recorded.html,
      htmlPro: recorded.htmlPro,
    };
    const nextQuota = await getMarketReportQuota(user);

    if (generateOnly) {
      return NextResponse.json({
        ok: true,
        generated: true,
        reportId: recorded.reportId,
        html: pair.html,
        htmlPro: pair.htmlPro,
        emails,
        creditUsed: consumed.creditUsed,
        quota: nextQuota,
        result: recorded.result,
      });
    }

    let portalUrl = portalHomeUrl(client?.portalToken);
    let activityId: number | null = null;
    if (client) {
      const clientRecord = await recordMarketReportForClient({
        clientId: client.id,
        agencyUserId: user.id,
        emails,
        reportId: recorded.reportId,
        reportVariant: variant,
        offerId,
        mid: recorded.result.estimated.mid,
        score: recorded.result.vsListing?.score ?? null,
        summary: `Najbardziej prawdopodobna wartość: ${Math.round(recorded.result.estimated.mid).toLocaleString('pl-PL')} zł (${recorded.result.stats.count} aktów, ${recorded.result.stats.windowMonths} mies.).`,
      });
      if (clientRecord.ok && clientRecord.activityId && client.portalToken) {
        activityId = clientRecord.activityId;
        portalUrl = marketReportPortalHref(client.portalToken, clientRecord.activityId);
      }
    }
    const sent = await emailMarketReport({
      emails,
      name,
      result: recorded.result,
      variant,
      portalUrl,
    });

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
      activityId,
      notified: Boolean(client),
    });
  } catch (error) {
    console.error('[market.report]', error);
    return NextResponse.json({ ok: false, message: 'Nie udało się wygenerować raportu.' }, { status: 500 });
  }
}
