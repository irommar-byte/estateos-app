import { prisma } from '@/lib/prisma';
import { getUserAgencyMembership } from '@/lib/agencyCompany';
import { sendNotification } from '@/lib/core/notification.core';
import { submitOfferActivation } from '@/lib/offerPublication';
import { notifySellerListingLive } from '@/lib/crm/listingLiveNotify';
import { trustedRemaining } from '@/lib/crm/officeCredits';
import { logTeamEvent } from '@/lib/crm/teamLog';

export type OfficeReviewStatus =
  | 'NONE'
  | 'DRAFT'
  | 'OFFICE_REVIEW'
  | 'OFFICE_APPROVED'
  | 'OFFICE_REJECTED';

export async function canManageOfficeOffers(userId: number): Promise<{
  ok: boolean;
  companyId: number | null;
  role: string | null;
  isOwner: boolean;
}> {
  const membership = await getUserAgencyMembership(userId);
  if (!membership || membership.status !== 'ACTIVE') {
    return { ok: false, companyId: null, role: null, isOwner: false };
  }
  const isOwner = membership.company.ownerUserId === userId;
  const role = membership.role;
  const ok = isOwner || role === 'ADMIN' || role === 'MANAGER';
  return { ok, companyId: membership.companyId, role, isOwner };
}

export async function requireActiveAgencyManager(userId: number) {
  const capability = await canManageOfficeOffers(userId);
  if (!capability.ok) return null;
  return getUserAgencyMembership(userId);
}

async function notifyOfficeManagers(params: {
  companyId: number;
  excludeUserId?: number;
  title: string;
  body: string;
  offerId: number;
}) {
  const members = await prisma.agencyCompanyMember.findMany({
    where: {
      companyId: params.companyId,
      status: 'ACTIVE',
      OR: [{ role: 'ADMIN' }, { role: 'MANAGER' }],
    },
    select: { userId: true },
  });
  const company = await prisma.agencyCompany.findUnique({
    where: { id: params.companyId },
    select: { ownerUserId: true },
  });
  const recipients = new Set<number>();
  for (const m of members) recipients.add(m.userId);
  if (company?.ownerUserId) recipients.add(company.ownerUserId);
  if (params.excludeUserId) recipients.delete(params.excludeUserId);

  await Promise.all(
    [...recipients].map((userId) =>
      sendNotification({
        userId,
        type: 'CRM_EVENT',
        title: params.title,
        body: params.body,
        data: {
          type: 'office_offer_review',
          offerId: String(params.offerId),
          notificationType: 'office_offer_review',
        },
      }).catch(() => {}),
    ),
  );
}

export type OfficeReviewResult =
  | { ok: true; status: OfficeReviewStatus; awaitingModeration?: boolean; viaLimit?: boolean }
  | { ok: false; error: string; status?: number; code?: 'NO_OFFICE_CREDIT' | 'OFFICE_POOL_INACTIVE' };

function officeCreditError(error: unknown): OfficeReviewResult | null {
  const message = error instanceof Error ? error.message : '';
  if (message === 'NO_OFFICE_CREDIT') {
    return { ok: false, code: 'NO_OFFICE_CREDIT', status: 409, error: 'W puli biura nie ma kredytów. Dokup kredyty biurowe i zatwierdź ponownie.' };
  }
  if (message === 'OFFICE_POOL_INACTIVE') {
    return { ok: false, code: 'OFFICE_POOL_INACTIVE', status: 409, error: 'Kredyty biura są zamrożone — najpierw przedłuż pakiet Partner.' };
  }
  return null;
}

/** Publikacja z kredytu biura: od razu (kierownik albo agent w ramach limitu). */
async function publishWithOfficeCredit(offer: { id: number; title: string | null; userId: number }, approvedById: number | null) {
  const result = await submitOfferActivation({
    offerId: offer.id,
    userId: offer.userId,
    kind: 'OFFICE_CREDIT',
    officeApprovedById: approvedById,
  });
  await prisma.offer.update({
    where: { id: offer.id },
    data: {
      officeReviewStatus: 'OFFICE_APPROVED',
      officeReviewedAt: new Date(),
      officeReviewedById: approvedById ?? offer.userId,
      officeReviewNote: null,
    },
  });
  if (!result.awaitingModeration) await notifySellerListingLive(offer.id).catch(() => {});
  return result;
}

/**
 * Agent prosi o publikację z kredytu biura. Kierownik publikuje od razu z puli,
 * agent z miesięcznym limitem też (kierownik dostaje informację), pozostali wysyłają prośbę.
 */
export async function submitOfferForOfficeActivation(params: { offerId: number; actorUserId: number }): Promise<OfficeReviewResult> {
  const membership = await getUserAgencyMembership(params.actorUserId);
  const capability = await canManageOfficeOffers(params.actorUserId);
  if ((!membership || membership.status !== 'ACTIVE') && !capability.ok) {
    return { ok: false, error: 'Brak aktywnego członkostwa w biurze.', status: 403 };
  }

  const offer = await prisma.offer.findFirst({
    where: { id: params.offerId, userId: params.actorUserId },
    select: { id: true, title: true, userId: true, status: true, managementStatus: true, officeReviewStatus: true },
  });
  if (!offer) return { ok: false, error: 'Nie znaleziono oferty.', status: 404 };
  if (offer.status === 'ACTIVE') return { ok: false, error: 'Oferta jest już aktywna.', status: 409 };
  if (offer.officeReviewStatus === 'OFFICE_REVIEW') {
    return { ok: false, error: 'Oferta już czeka na zatwierdzenie kierownika.', status: 409 };
  }
  const label = offer.title || `Oferta #${offer.id}`;

  if (capability.ok) {
    try {
      const result = await publishWithOfficeCredit(offer, params.actorUserId);
      return { ok: true, status: 'OFFICE_APPROVED', awaitingModeration: result.awaitingModeration };
    } catch (error) {
      const known = officeCreditError(error);
      if (known) return known;
      throw error;
    }
  }

  if ((await trustedRemaining(params.actorUserId)) > 0) {
    try {
      const result = await publishWithOfficeCredit(offer, null);
      if (membership) {
        await notifyOfficeManagers({
          companyId: membership.companyId,
          excludeUserId: params.actorUserId,
          title: 'Agent opublikował z kredytu biura',
          body: `${label} — w ramach miesięcznego limitu agenta.`,
          offerId: offer.id,
        });
      }
      void logTeamEvent({ userId: params.actorUserId, kind: 'OFFICE_CREDIT_USED', title: `Opublikował z kredytu biura (limit): ${label}`, refType: 'offer', refId: offer.id });
      return { ok: true, status: 'OFFICE_APPROVED', awaitingModeration: result.awaitingModeration, viaLimit: true };
    } catch (error) {
      const known = officeCreditError(error);
      if (known && known.ok === false && known.code === 'OFFICE_POOL_INACTIVE') return known;
      // brak kredytów w puli — prośba do kierownika, który może dokupić
      if (!known) throw error;
    }
  }

  await prisma.offer.update({
    where: { id: offer.id },
    data: {
      status: 'PENDING',
      officeReviewStatus: 'OFFICE_REVIEW',
      officeSubmittedAt: new Date(),
      officeReviewedAt: null,
      officeReviewedById: null,
      officeReviewNote: null,
      managementStatus: offer.managementStatus === 'SELF' ? 'AGENCY_MANAGED' : offer.managementStatus,
    },
  });
  await prisma.$executeRawUnsafe('UPDATE `Offer` SET officeReviewRemindedAt = NULL WHERE id = ?', offer.id);

  if (membership) {
    await notifyOfficeManagers({
      companyId: membership.companyId,
      excludeUserId: params.actorUserId,
      title: 'Ogłoszenie do zatwierdzenia',
      body: `${label} — agent prosi o publikację z kredytu biura.`,
      offerId: offer.id,
    });
  }
  void logTeamEvent({ userId: params.actorUserId, kind: 'OFFICE_REVIEW_REQUEST', title: `Poprosił kierownika o publikację: ${label}`, refType: 'offer', refId: offer.id });
  return { ok: true, status: 'OFFICE_REVIEW' };
}

/** Agent wycofuje prośbę, zanim kierownik zdecyduje. */
export async function withdrawOfficeReview(params: { offerId: number; actorUserId: number }): Promise<OfficeReviewResult> {
  const offer = await prisma.offer.findFirst({
    where: { id: params.offerId, userId: params.actorUserId },
    select: { id: true, title: true, officeReviewStatus: true },
  });
  if (!offer) return { ok: false, error: 'Nie znaleziono oferty.', status: 404 };
  if (offer.officeReviewStatus !== 'OFFICE_REVIEW') return { ok: false, error: 'Ta oferta nie czeka na zatwierdzenie.', status: 409 };
  await prisma.offer.update({ where: { id: offer.id }, data: { officeReviewStatus: 'NONE', officeSubmittedAt: null } });
  void logTeamEvent({ userId: params.actorUserId, kind: 'OFFICE_REVIEW_WITHDRAWN', title: `Wycofał prośbę o publikację: ${offer.title || `Oferta #${offer.id}`}`, refType: 'offer', refId: offer.id });
  return { ok: true, status: 'NONE' };
}

export async function decideOfficeOfferReview(params: {
  offerId: number;
  reviewerUserId: number;
  decision: 'approve' | 'reject';
  note?: string | null;
}): Promise<OfficeReviewResult> {
  const capability = await canManageOfficeOffers(params.reviewerUserId);
  if (!capability.ok || !capability.companyId) {
    return { ok: false, error: 'Tylko kierownik biura może zatwierdzać ogłoszenia.', status: 403 };
  }

  const offer = await prisma.offer.findFirst({
    where: { id: params.offerId },
    select: { id: true, title: true, userId: true, status: true, officeReviewStatus: true },
  });
  if (!offer) return { ok: false, error: 'Nie znaleziono oferty.', status: 404 };

  const member = await prisma.agencyCompanyMember.findFirst({
    where: { userId: offer.userId, companyId: capability.companyId, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!member && offer.userId !== params.reviewerUserId) return { ok: false, error: 'Oferta nie należy do Twojego biura.', status: 403 };
  if (offer.officeReviewStatus !== 'OFFICE_REVIEW') return { ok: false, error: 'Ta prośba została już rozpatrzona albo wycofana.', status: 409 };

  const note = String(params.note || '').trim().slice(0, 512) || null;
  const label = offer.title || `Oferta #${offer.id}`;

  if (params.decision === 'reject') {
    await prisma.offer.update({
      where: { id: offer.id },
      data: {
        status: 'PENDING',
        officeReviewStatus: 'OFFICE_REJECTED',
        officeReviewedAt: new Date(),
        officeReviewedById: params.reviewerUserId,
        officeReviewNote: note || 'Kierownik poprosił o poprawki przed publikacją.',
      },
    });
    await sendNotification({
      userId: offer.userId,
      type: 'CRM_EVENT',
      title: 'Ogłoszenie do poprawy',
      body: note || `${label} — kierownik poprosił o poprawki.`,
      data: { type: 'office_offer_rejected', offerId: String(offer.id) },
    }).catch(() => {});
    void logTeamEvent({ userId: params.reviewerUserId, kind: 'OFFICE_REVIEW_REJECTED', title: `Odesłał do poprawy: ${label}`, body: note, refType: 'offer', refId: offer.id });
    return { ok: true, status: 'OFFICE_REJECTED' };
  }

  let awaitingModeration = false;
  try {
    const result = await publishWithOfficeCredit(offer, params.reviewerUserId);
    awaitingModeration = result.awaitingModeration;
  } catch (error) {
    const known = officeCreditError(error);
    if (known) return known;
    throw error;
  }

  await sendNotification({
    userId: offer.userId,
    type: 'CRM_EVENT',
    title: 'Kierownik zatwierdził ogłoszenie',
    body: awaitingModeration
      ? `${label} — opłacone z kredytu biura, czeka jeszcze na weryfikację EstateOS.`
      : `${label} jest już na rynku — opłacone z kredytu biura.`,
    data: { type: 'office_offer_approved', offerId: String(offer.id) },
  }).catch(() => {});
  void logTeamEvent({ userId: params.reviewerUserId, kind: 'OFFICE_REVIEW_APPROVED', title: `Zatwierdził z kredytu biura: ${label}`, refType: 'offer', refId: offer.id });
  return { ok: true, status: 'OFFICE_APPROVED', awaitingModeration };
}

/** Przypomnienie kierownikom o prośbach czekających dłużej niż 12 godzin (jedno na prośbę). */
export async function remindStaleOfficeReviews(): Promise<number> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT o.id, o.title, m.companyId FROM Offer o
     JOIN AgencyCompanyMember m ON m.userId = o.userId AND m.status = 'ACTIVE'
     WHERE o.officeReviewStatus = 'OFFICE_REVIEW' AND o.officeReviewRemindedAt IS NULL
       AND o.officeSubmittedAt IS NOT NULL AND o.officeSubmittedAt < DATE_SUB(NOW(3), INTERVAL 12 HOUR)
     LIMIT 200`,
  )) as Array<{ id: number; title: string | null; companyId: number }>;
  for (const row of rows) {
    await notifyOfficeManagers({
      companyId: row.companyId,
      title: 'Prośba czeka ponad 12 godzin',
      body: `${row.title || `Oferta #${row.id}`} — agent wciąż czeka na zatwierdzenie publikacji.`,
      offerId: row.id,
    });
    await prisma.$executeRawUnsafe('UPDATE `Offer` SET officeReviewRemindedAt = NOW(3) WHERE id = ?', row.id);
  }
  return rows.length;
}

/** Informacja dla kierownika: agent biura wystawił ogłoszenie z własnych kredytów. */
export async function notifyManagersAboutOwnCreditListing(params: { userId: number; offerId: number }) {
  const membership = await getUserAgencyMembership(params.userId);
  if (!membership || membership.status !== 'ACTIVE' || membership.company.ownerUserId === params.userId) return;
  const capability = await canManageOfficeOffers(params.userId);
  if (capability.ok) return;
  const offer = await prisma.offer.findUnique({ where: { id: params.offerId }, select: { title: true } });
  const label = offer?.title || `Oferta #${params.offerId}`;
  await notifyOfficeManagers({
    companyId: membership.companyId,
    excludeUserId: params.userId,
    title: 'Agent wystawił ogłoszenie z własnych kredytów',
    body: `${label} — publikacja liczy się jako ogłoszenie biura.`,
    offerId: params.offerId,
  });
}

export async function listOfficeReviewQueue(companyId: number) {
  const memberUserIds = (
    await prisma.agencyCompanyMember.findMany({
      where: { companyId, status: 'ACTIVE' },
      select: { userId: true },
    })
  ).map((m) => m.userId);

  if (!memberUserIds.length) return [];

  return prisma.offer.findMany({
    where: {
      userId: { in: memberUserIds },
      officeReviewStatus: 'OFFICE_REVIEW',
    },
    orderBy: { officeSubmittedAt: 'asc' },
    take: 100,
    select: {
      id: true,
      title: true,
      city: true,
      price: true,
      status: true,
      officeReviewStatus: true,
      officeSubmittedAt: true,
      officeReviewNote: true,
      userId: true,
      images: true,
      area: true,
      rooms: true,
      propertyType: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
}
