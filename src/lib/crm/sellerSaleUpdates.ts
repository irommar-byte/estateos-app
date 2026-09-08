import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type { PublicLinkPreview } from '@/lib/crm/publicLinkPreview';
import {
  MARKETING_ACTIVITY,
  addExternalPortalListing,
  recordEstateosPromotion,
  recordMarketingActivity,
} from '@/lib/crm/sellerMarketing';
import { sendClientPortalWebPush } from '@/lib/crm/clientPortalWebPush';
import { marketReportPortalPath } from '@/lib/crm/portalActivityStacks';

export const SELLER_SALE_ACTIVITY = {
  MARKET_REPORT: MARKETING_ACTIVITY.MARKET_REPORT,
  FEATURED: MARKETING_ACTIVITY.LISTING_FEATURED,
  EXTERNAL_PORTAL: MARKETING_ACTIVITY.EXTERNAL_PORTAL,
  ESTATEOS_PROMOTED: MARKETING_ACTIVITY.ESTATEOS_PROMOTED,
  EXTERNAL_PORTAL_LISTED: MARKETING_ACTIVITY.EXTERNAL_PORTAL_LISTED,
} as const;

export async function recordSellerSaleUpdate(params: {
  clientId: number;
  agencyUserId: number;
  kind: string;
  title: string;
  body: string;
  offerId?: number | null;
  metadata?: Prisma.InputJsonObject;
  emailSubject?: string;
  emailHtml?: string;
  visibleToClient?: boolean;
  skipClientNotify?: boolean;
}) {
  const meta = (params.metadata || {}) as Record<string, unknown>;
  const visibleToClient =
    params.visibleToClient === true ||
    (params.visibleToClient !== false && meta.visibleToClient === true);

  return recordMarketingActivity({
    clientId: params.clientId,
    agencyUserId: params.agencyUserId,
    kind: params.kind,
    title: params.title,
    body: params.body,
    offerId: params.offerId,
    metadata: meta,
    visibleToClient,
    notifyEmail: visibleToClient && Boolean(params.emailHtml && params.emailSubject),
    skipClientNotify: params.skipClientNotify,
  });
}

export async function notifyLinkedClientsOfferFeatured(params: {
  offerId: number;
  agencyUserId: number;
  until: Date;
  days: number;
}) {
  const clients = await prisma.agencyClient.findMany({
    where: {
      linkedOfferId: params.offerId,
      agencyUserId: params.agencyUserId,
      status: 'ACTIVE',
      type: 'SELLER',
    },
    select: { id: true, agencyUserId: true },
  });
  for (const client of clients) {
    await recordEstateosPromotion({
      clientId: client.id,
      agencyUserId: client.agencyUserId,
      offerId: params.offerId,
      until: params.until,
      days: params.days,
      visibleToClient: false,
    }).catch((error) => {
      console.error('[sellerSaleUpdates.featured]', error);
    });
  }
}

export async function notifyLinkedClientsOfferActivated(params: {
  offerId: number;
  agencyUserId: number;
  endsAt?: Date | null;
}) {
  const clients = await prisma.agencyClient.findMany({
    where: {
      linkedOfferId: params.offerId,
      agencyUserId: params.agencyUserId,
      status: 'ACTIVE',
      type: 'SELLER',
    },
    select: { id: true, agencyUserId: true },
  });
  for (const client of clients) {
    await recordMarketingActivity({
      clientId: client.id,
      agencyUserId: client.agencyUserId,
      kind: MARKETING_ACTIVITY.ESTATEOS_ACTIVATED,
      offerId: params.offerId,
      title: 'Oferta opublikowana na EstateOS™',
      body: 'Ogłoszenie jest aktywne w katalogu EstateOS™ i mogą je znaleźć kupujący.',
      visibleToClient: false,
      metadata: {
        status: 'active',
        promotedUntil: null,
        renewalDueAt: params.endsAt?.toISOString() || null,
      },
    });
  }
}

export async function recordExternalPortalListing(params: {
  clientId: number;
  agencyUserId: number;
  preview: PublicLinkPreview;
  visibleToClient?: boolean;
  portal?: string | null;
  status?: string | null;
  note?: string | null;
  publishedAt?: Date | null;
  renewalDueAt?: Date | null;
  evidenceUrl?: string | null;
  evidenceName?: string | null;
  evidenceMimeType?: string | null;
  groupName?: string | null;
}) {
  return addExternalPortalListing(params);
}

export async function recordMarketReportForClient(params: {
  clientId: number;
  agencyUserId: number;
  emails: string[];
  summary: string;
  mid: number;
  score?: number | null;
  reportId?: number | null;
  reportVariant?: 'classic' | 'pro' | null;
  offerId?: number | null;
  visibleToClient?: boolean;
  portalUrl?: string | null;
}) {
  const emailsLabel = params.emails.join(', ');
  const variant = params.reportVariant || 'classic';
  const title =
    variant === 'pro'
      ? 'Raport wartości nieruchomości · mapa i rekomendacja'
      : 'Raport wartości nieruchomości · zestawienie transakcji';
  const recorded = await recordSellerSaleUpdate({
    clientId: params.clientId,
    agencyUserId: params.agencyUserId,
    kind: SELLER_SALE_ACTIVITY.MARKET_REPORT,
    offerId: params.offerId ?? null,
    title,
    body: `Przygotowaliśmy i wysłaliśmy raport z analizy wartości Państwa nieruchomości na podstawie aktów notarialnych (RCN / GUGiK). Dokument zostaje w panelu współpracy — można go otworzyć w każdej chwili.${emailsLabel ? ` Wysłano też e-mailem na: ${emailsLabel}.` : ''} ${params.summary}`.trim(),
    metadata: {
      emails: params.emails,
      reportId: params.reportId ?? null,
      reportVariant: variant,
      score: params.score ?? null,
      mid: params.mid,
    },
    visibleToClient: params.visibleToClient !== false,
    skipClientNotify: true,
  });

  if (recorded.ok) {
    const client = await prisma.agencyClient.findUnique({
      where: { id: params.clientId },
      select: { portalToken: true },
    });
    const reportPath =
      client?.portalToken && recorded.activityId
        ? marketReportPortalPath(client.portalToken, recorded.activityId)
        : params.portalUrl || undefined;
    await sendClientPortalWebPush(params.clientId, {
      title: 'Raport nieruchomości jest gotowy',
      body: 'Przygotowaliśmy i wysłaliśmy raport z analizy wartości Państwa oferty. Otwórz panel, żeby zawsze mieć do niego dostęp.',
      url: reportPath,
      tag: `market-report-${recorded.activityId || params.reportId || params.clientId}`,
      notificationType: 'MARKET_REPORT',
      native: true,
    }).catch((error) => {
      console.error('[sellerSaleUpdates.marketReport.notify]', error);
    });
  }

  return recorded;
}
