import { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notificationService } from '@/lib/services/notification.service';

export const CONCIERGE_NOTIFY_TITLES = {
  NEW_LEAD: 'Nowe zapytanie o przejęcie sprzedaży',
  TERMS: 'Agencja przesłała warunki współpracy',
  ACCEPTED_OWNER: 'Sprzedaż przekazana agencji',
  ACCEPTED_AGENCY: 'Przejęto zarządzanie ofertą',
  REJECTED_BY_OWNER: 'Właściciel odrzucił przekazanie',
  REJECTED_BY_AGENCY: 'Agencja odrzuciła zapytanie',
  COUNTER: 'Kontrpropozycja warunków współpracy',
} as const;

export function isConciergeLeadNotification(n: { title?: string | null }) {
  const title = String(n.title || '').trim();
  return (Object.values(CONCIERGE_NOTIFY_TITLES) as string[]).includes(title);
}

export function conciergeNotificationLink() {
  return '/moje-konto/crm#concierge-inbox';
}

export async function notifyLeadTransfer(params: {
  userId: number;
  title: string;
  body: string;
  offerId?: number;
  leadId?: number;
}) {
  const cleanBody = params.body.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
  const idempotencyKey =
    params.leadId != null
      ? `concierge:${params.userId}:${params.leadId}:${params.title}`
      : undefined;

  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        title: params.title,
        body: params.body,
        type: NotificationType.SYSTEM_ALERT,
        priority: 'HIGH',
        delivery: 'STANDARD',
        targetType: params.offerId ? 'OFFER' : undefined,
        targetId: params.offerId ? String(params.offerId) : params.leadId ? String(params.leadId) : undefined,
        idempotencyKey,
      },
    });
  } catch (e) {
    const dup =
      e &&
      typeof e === 'object' &&
      'code' in e &&
      (e as { code?: string }).code === 'P2002';
    if (!dup) throw e;
  }

  try {
    await notificationService.sendPushToUser(params.userId, {
      title: params.title,
      body: cleanBody,
      data: {
        kind: 'concierge_lead',
        notificationType: 'CONCIERGE_LEAD',
        screen: 'AgencyLeadInbox',
        deeplink: 'estateos://concierge',
        leadId: params.leadId != null ? String(params.leadId) : undefined,
        offerId: params.offerId != null ? String(params.offerId) : undefined,
        targetType: 'CONCIERGE',
      },
    });
  } catch {
    /* push optional when no device */
  }
}
