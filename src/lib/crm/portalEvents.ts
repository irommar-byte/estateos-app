import { prisma } from '@/lib/prisma';
import { sendNotification } from '@/lib/core/notification.core';
import { crmAgentPushData } from '@/lib/crm/agentPush';

/**
 * Zdarzenia z panelu klienta widoczne dla agenta („Dziś → U klientów”) + push do agenta.
 * Zapisywane jako aktywność PORTAL_EVENT na osi klienta.
 */

export const PORTAL_EVENT_KIND = 'PORTAL_EVENT';

export type PortalEventType =
  | 'favorite'
  | 'partner_rating'
  | 'area_request'
  | 'area_saved'
  | 'self_booking'
  | 'buyer_offer_response'
  | 'document_uploaded'
  | 'review'
  | 'referral'
  | 'app_joined';

export async function logPortalEvent(params: {
  clientId: number;
  agencyUserId: number;
  event: PortalEventType;
  title: string;
  body?: string | null;
  offerId?: number | null;
  meta?: Record<string, unknown>;
  push?: boolean;
}) {
  await prisma.agencyClientActivity
    .create({
      data: {
        clientId: params.clientId,
        agencyUserId: params.agencyUserId,
        offerId: params.offerId ?? null,
        kind: PORTAL_EVENT_KIND,
        title: params.title.slice(0, 250),
        body: params.body ? params.body.slice(0, 2000) : null,
        metadata: { event: params.event, ...(params.meta || {}) },
      },
    })
    .catch(() => null);
  if (params.push === false) return;
  await sendNotification({
    userId: params.agencyUserId,
    type: 'CRM_EVENT',
    title: params.title.slice(0, 120),
    body: String(params.body || '').slice(0, 180),
    data: crmAgentPushData(params.clientId, { kind: `PORTAL_${params.event.toUpperCase()}`, notificationType: 'crm_client' }),
  }).catch(() => {});
}

/** Lista zdarzeń z paneli wszystkich klientów agenta (najnowsze pierwsze). */
export async function listPortalActivity(agencyUserId: number, limit = 40) {
  const rows = await prisma.agencyClientActivity.findMany({
    where: {
      agencyUserId,
      kind: { in: [PORTAL_EVENT_KIND, 'PORTAL_CRITERIA_REQUEST'] },
      createdAt: { gte: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, clientId: true, kind: true, title: true, body: true, createdAt: true, metadata: true, offerId: true },
  });
  const clientIds = [...new Set(rows.map((r) => r.clientId))];
  const clients = clientIds.length
    ? await prisma.agencyClient.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, firstName: true, lastName: true, type: true },
      })
    : [];
  const byId = new Map(clients.map((c) => [c.id, c]));
  return rows.map((row) => {
    const meta = (row.metadata || {}) as Record<string, unknown>;
    const c = byId.get(row.clientId);
    return {
      id: row.id,
      clientId: row.clientId,
      clientName: c ? `${c.firstName} ${c.lastName}`.trim() : 'Klient',
      clientType: c?.type || null,
      event: row.kind === 'PORTAL_CRITERIA_REQUEST' ? 'area_request' : String(meta.event || ''),
      pending: row.kind === 'PORTAL_CRITERIA_REQUEST' ? String(meta.status || 'pending') === 'pending' : false,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      meta,
    };
  });
}
