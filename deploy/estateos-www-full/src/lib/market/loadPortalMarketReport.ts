import { prisma } from '@/lib/prisma';
import { MARKETING_ACTIVITY, isActivityVisibleToClient, parseMarketingMetadata } from '@/lib/crm/sellerMarketing';
import { buildMarketReportHtml } from '@/lib/market/reportHtml';
import { loadUserMarketReport, parseReportVariant } from '@/lib/market/deliverReport';

function notFoundHtml(message: string) {
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Raport · EstateOS™</title></head>
<body style="font-family:Georgia,serif;padding:48px;color:#333;max-width:640px;margin:0 auto">
  <p style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#6b6b70;font-weight:700">EstateOS™ Market</p>
  <h1 style="font-size:22px;font-weight:600">Raport niedostępny</h1>
  <p style="line-height:1.55">${message}</p>
</body></html>`;
}

export async function loadPortalMarketReport(params: {
  portalToken: string;
  activityId: number;
}): Promise<{ status: 200; html: string } | { status: 404; html: string }> {
  const token = String(params.portalToken || '').trim();
  const activityId = Number(params.activityId);
  if (!token || !Number.isFinite(activityId) || activityId <= 0) {
    return { status: 404, html: notFoundHtml('Nie znaleziono tego dokumentu.') };
  }

  const client = await prisma.agencyClient.findFirst({
    where: { portalToken: token, status: 'ACTIVE' },
    select: { id: true, agencyUserId: true, firstName: true, lastName: true, email: true },
  });
  if (!client) {
    return { status: 404, html: notFoundHtml('Panel klienta jest niedostępny.') };
  }

  const activity = await prisma.agencyClientActivity.findFirst({
    where: {
      id: activityId,
      clientId: client.id,
      kind: MARKETING_ACTIVITY.MARKET_REPORT,
    },
    select: { metadata: true, createdAt: true },
  });
  if (!activity || !isActivityVisibleToClient(activity.metadata)) {
    return { status: 404, html: notFoundHtml('Ten raport nie jest udostępniony w panelu.') };
  }

  const meta = parseMarketingMetadata(activity.metadata);
  const reportId = Number(meta.reportId);
  if (!Number.isFinite(reportId) || reportId <= 0) {
    return { status: 404, html: notFoundHtml('Raport nie jest już dostępny w archiwum. Poproś agenta o ponowne wysłanie.') };
  }

  const stored = await loadUserMarketReport(client.agencyUserId, reportId);
  if (!stored) {
    return { status: 404, html: notFoundHtml('Nie udało się odczytać archiwum raportu.') };
  }

  const name = `${client.firstName} ${client.lastName}`.trim();
  const variant = parseReportVariant(meta.reportVariant);
  return {
    status: 200,
    html: buildMarketReportHtml(stored.result, {
      recipientName: name,
      recipientEmail: client.email,
      generatedAt: stored.row.createdAt,
      variant,
    }),
  };
}
