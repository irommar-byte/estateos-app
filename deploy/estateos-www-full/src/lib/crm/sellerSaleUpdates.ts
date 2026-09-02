import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type { PublicLinkPreview } from '@/lib/crm/publicLinkPreview';
import {
  MARKETING_ACTIVITY,
  addExternalPortalListing,
  recordEstateosPromotion,
  recordMarketingActivity,
} from '@/lib/crm/sellerMarketing';

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
  visibleToClient?: boolean;
}) {
  const emailsLabel = params.emails.join(', ');
  return recordSellerSaleUpdate({
    clientId: params.clientId,
    agencyUserId: params.agencyUserId,
    kind: SELLER_SALE_ACTIVITY.MARKET_REPORT,
    title: 'Raport z Rejestru Cen Nieruchomości',
    body: `Przekazaliśmy Państwu analizę wartości nieruchomości na podstawie rzeczywistych aktów notarialnych (GUGiK). Dokument jest dostępny w panelu i można go odczytać w każdej chwili.${emailsLabel ? ` Wysłano na: ${emailsLabel}.` : ''}`,
    metadata: {
      emails: params.emails,
      reportId: params.reportId ?? null,
      reportVariant: params.reportVariant || 'classic',
      score: params.score ?? null,
    },
    visibleToClient: params.visibleToClient !== false,
    skipClientNotify: true,
  });
}
