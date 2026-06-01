import { sendNotification } from '@/lib/core/notification.core';
import { prisma } from '@/lib/prisma';

export type AdminAttentionKind = 'offer_pending' | 'legal_verification' | 'content_report';

export type AdminAttentionPayload = {
  kind: AdminAttentionKind;
  entityId: number | string;
  title: string;
  body: string;
};

let adminIdsCache: { ids: number[]; fetchedAt: number } | null = null;
const ADMIN_IDS_CACHE_MS = 60_000;

async function listAdminUserIds(): Promise<number[]> {
  const now = Date.now();
  if (adminIdsCache && now - adminIdsCache.fetchedAt < ADMIN_IDS_CACHE_MS) {
    return adminIdsCache.ids;
  }
  const rows = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  });
  const ids = rows.map((r) => r.id).filter((id) => Number.isFinite(id) && id > 0);
  adminIdsCache = { ids, fetchedAt: now };
  return ids;
}

function idempotencyKey(kind: AdminAttentionKind, entityId: number | string, adminId: number) {
  return `admin_attention:${kind}:${entityId}:admin:${adminId}`;
}

async function notifyAdminsAttentionNow(payload: AdminAttentionPayload) {
  const adminIds = await listAdminUserIds();
  if (!adminIds.length) {
    console.warn('[ADMIN_ATTENTION] Brak kont ADMIN — pomijam push.');
    return;
  }

  const data = {
    kind: 'admin_attention',
    attentionType: payload.kind,
    entityId: String(payload.entityId),
    notificationType: 'admin_attention',
    screen: 'Profile',
    route: 'Profile',
    deeplink: 'estateos://profil',
  };

  await Promise.allSettled(
    adminIds.map((userId) =>
      sendNotification({
        userId,
        type: 'ADMIN_ATTENTION',
        title: payload.title,
        body: payload.body,
        data,
        idempotencyKey: idempotencyKey(payload.kind, payload.entityId, userId),
      }),
    ),
  );
}

/** Natychmiastowy push do wszystkich adminów (nie blokuje requestu HTTP). */
export function notifyAdminsAttention(payload: AdminAttentionPayload): void {
  void notifyAdminsAttentionNow(payload).catch((err) => {
    console.error('[ADMIN_ATTENTION] push failed', err);
  });
}

export function notifyAdminsOfferPending(offerId: number, title?: string | null) {
  const label = title?.trim() ? `„${title.trim().slice(0, 72)}”` : `#${offerId}`;
  notifyAdminsAttention({
    kind: 'offer_pending',
    entityId: offerId,
    title: 'Centrala — nowa oferta',
    body: `${label} czeka na weryfikację.`,
  });
}

export function notifyAdminsLegalVerificationPending(offerId: number, title?: string | null) {
  const label = title?.trim() ? `„${title.trim().slice(0, 72)}”` : `#${offerId}`;
  notifyAdminsAttention({
    kind: 'legal_verification',
    entityId: offerId,
    title: 'Weryfikacja prawna KW',
    body: `Nowe zgłoszenie dla oferty ${label}.`,
  });
}

export function notifyAdminsContentReportPending(reportId: number, category?: string) {
  const cat = category?.trim() ? category.trim().toUpperCase() : 'ZGŁOSZENIE';
  notifyAdminsAttention({
    kind: 'content_report',
    entityId: reportId,
    title: 'Nowe zgłoszenie treści',
    body: `Kategoria: ${cat}. Wymaga reakcji w Narzędziach.`,
  });
}
