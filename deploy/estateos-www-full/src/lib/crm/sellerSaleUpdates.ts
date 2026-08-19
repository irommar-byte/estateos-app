import { prisma } from '@/lib/prisma';
import { sendTransactionalEmail } from '@/lib/email/transactional';
import { buildPortalUrl } from '@/lib/agencyClientNotify';
import type { PublicLinkPreview } from '@/lib/crm/publicLinkPreview';

export const SELLER_SALE_ACTIVITY = {
  MARKET_REPORT: 'MARKET_REPORT_SENT',
  FEATURED: 'LISTING_FEATURED',
  EXTERNAL_PORTAL: 'EXTERNAL_PORTAL',
} as const;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function recordSellerSaleUpdate(params: {
  clientId: number;
  agencyUserId: number;
  kind: string;
  title: string;
  body: string;
  offerId?: number | null;
  metadata?: Record<string, unknown>;
  emailSubject?: string;
  emailHtml?: string;
}) {
  const client = await prisma.agencyClient.findFirst({
    where: { id: params.clientId, agencyUserId: params.agencyUserId, status: 'ACTIVE' },
    select: { id: true, email: true, firstName: true, portalToken: true },
  });
  if (!client) return { ok: false as const, error: 'Nie znaleziono klienta.' };

  const activity = await prisma.agencyClientActivity.create({
    data: {
      clientId: client.id,
      agencyUserId: params.agencyUserId,
      kind: params.kind,
      title: params.title.slice(0, 255),
      body: params.body,
      offerId: params.offerId ?? null,
      metadata: params.metadata || {},
    },
  });

  let emailed = false;
  if (client.email && params.emailHtml && params.emailSubject) {
    const portalUrl = client.portalToken ? buildPortalUrl(client.portalToken) : 'https://estateos.pl';
    emailed = await sendTransactionalEmail({
      to: client.email,
      subject: params.emailSubject,
      html: params.emailHtml.replace(/\{\{portalUrl\}\}/g, escapeHtml(portalUrl)),
    });
  }

  return { ok: true as const, activityId: activity.id, emailed };
}

export async function notifyLinkedClientsOfferFeatured(params: {
  offerId: number;
  agencyUserId: number;
  until: Date;
  days: number;
}) {
  const clients = await prisma.agencyClient.findMany({
    where: { linkedOfferId: params.offerId, status: 'ACTIVE' },
    select: { id: true, agencyUserId: true, firstName: true },
  });
  const untilLabel = params.until.toLocaleDateString('pl-PL');
  for (const client of clients) {
    await recordSellerSaleUpdate({
      clientId: client.id,
      agencyUserId: client.agencyUserId,
      kind: SELLER_SALE_ACTIVITY.FEATURED,
      offerId: params.offerId,
      title: 'Wyróżnienie na stronie głównej EstateOS™',
      body: `Twoje ogłoszenie jest teraz na górze katalogu i na stronie głównej EstateOS™ — przez ${params.days} dni (do ${untilLabel}). Pracujemy nad tym, żeby więcej kupujących zobaczyło nieruchomość od razu, bez przewijania listy.`,
      metadata: {
        until: params.until.toISOString(),
        days: params.days,
        offerId: params.offerId,
      },
      emailSubject: 'Twoja oferta jest wyróżniona na EstateOS™',
      emailHtml: `<div style="font-family:-apple-system,sans-serif;padding:24px;color:#111">
        <p style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#059669;font-weight:800">EstateOS™ · sprzedaż</p>
        <h2 style="margin:8px 0 12px">Wyróżniliśmy Twoje ogłoszenie</h2>
        <p>Dzień dobry ${escapeHtml(client.firstName)},</p>
        <p>Twoja nieruchomość jest teraz wyżej w katalogu i na stronie głównej EstateOS™ przez <strong>${params.days} dni</strong> (do ${escapeHtml(untilLabel)}). To nie jest puste „promowanie” — ogłoszenie realnie wskakuje na górę listy, którą przeglądają kupujący i agenci.</p>
        <p><a href="{{portalUrl}}" style="display:inline-block;background:#10b981;color:#052e1c;padding:12px 18px;border-radius:999px;font-weight:800;text-decoration:none">Zobacz, co robimy</a></p>
      </div>`,
    });
  }
}

export async function recordExternalPortalListing(params: {
  clientId: number;
  agencyUserId: number;
  preview: PublicLinkPreview;
}) {
  const client = await prisma.agencyClient.findFirst({
    where: { id: params.clientId, agencyUserId: params.agencyUserId, status: 'ACTIVE' },
    select: { id: true, firstName: true, linkedOfferId: true },
  });
  if (!client) return { ok: false as const, error: 'Nie znaleziono klienta.' };

  return recordSellerSaleUpdate({
    clientId: client.id,
    agencyUserId: params.agencyUserId,
    kind: SELLER_SALE_ACTIVITY.EXTERNAL_PORTAL,
    offerId: client.linkedOfferId,
    title: `Wystawione na ${params.preview.siteName}`,
    body: `Właśnie opublikowaliśmy Twoją nieruchomość na portalu ${params.preview.siteName}. Nie czekasz w ciemno — poniżej masz podgląd ogłoszenia i możesz wejść w ten sam link, który widzą kupujący.`,
    metadata: {
      url: params.preview.url,
      host: params.preview.host,
      siteName: params.preview.siteName,
      title: params.preview.title,
      description: params.preview.description,
      image: params.preview.image,
    },
    emailSubject: `Twoja nieruchomość jest już na ${params.preview.siteName}`,
    emailHtml: `<div style="font-family:-apple-system,sans-serif;padding:24px;color:#111">
      <p style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#059669;font-weight:800">EstateOS™ · sprzedaż</p>
      <h2 style="margin:8px 0 12px">Wystawiliśmy ogłoszenie na ${escapeHtml(params.preview.siteName)}</h2>
      <p>Dzień dobry ${escapeHtml(client.firstName)},</p>
      <p>Twoja oferta jest już widoczna poza EstateOS™ — na <strong>${escapeHtml(params.preview.siteName)}</strong>. Pracujemy na kilku frontach naraz, żeby dotrzeć do kupujących tam, gdzie szukają.</p>
      ${params.preview.image ? `<p><img src="${escapeHtml(params.preview.image)}" alt="" style="max-width:100%;border-radius:16px"/></p>` : ''}
      <p style="font-weight:700">${escapeHtml(params.preview.title)}</p>
      ${params.preview.description ? `<p style="color:#6b7280;font-size:14px">${escapeHtml(params.preview.description)}</p>` : ''}
      <p><a href="${escapeHtml(params.preview.url)}" style="display:inline-block;background:#10b981;color:#052e1c;padding:12px 18px;border-radius:999px;font-weight:800;text-decoration:none">Otwórz ogłoszenie</a></p>
      <p style="margin-top:16px"><a href="{{portalUrl}}">Twój panel współpracy</a></p>
    </div>`,
  });
}

export async function recordMarketReportForClient(params: {
  clientId: number;
  agencyUserId: number;
  emails: string[];
  summary: string;
  mid: number;
  score?: number | null;
}) {
  const emailsLabel = params.emails.join(', ');
  return recordSellerSaleUpdate({
    clientId: params.clientId,
    agencyUserId: params.agencyUserId,
    kind: SELLER_SALE_ACTIVITY.MARKET_REPORT,
    title: 'Wysłaliśmy raport z aktów notarialnych',
    body: `Dostałeś analizę EstateOS™ Market na ${emailsLabel}. ${params.summary} To nie jest ogólnik z portali ogłoszeniowych — porównanie z Rejestrem Cen Nieruchomości, czyli rzeczywistymi transakcjami.`,
    metadata: {
      emails: params.emails,
      mid: params.mid,
      score: params.score ?? null,
    },
  });
}
