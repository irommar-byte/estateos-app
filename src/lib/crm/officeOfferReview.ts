import { prisma } from '@/lib/prisma';
import { getUserAgencyMembership } from '@/lib/agencyCompany';
import { sendNotification } from '@/lib/core/notification.core';
import { submitOfferActivation } from '@/lib/offerPublication';

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

export async function submitOfferForOfficeActivation(params: {
  offerId: number;
  actorUserId: number;
}): Promise<{ ok: true; status: OfficeReviewStatus } | { ok: false; error: string; status?: number }> {
  const membership = await getUserAgencyMembership(params.actorUserId);
  if (!membership || membership.status !== 'ACTIVE') {
    return { ok: false, error: 'Brak aktywnego członkostwa w biurze.', status: 403 };
  }

  const offer = await prisma.offer.findFirst({
    where: { id: params.offerId, userId: params.actorUserId },
    select: {
      id: true,
      title: true,
      status: true,
      managementStatus: true,
      officeReviewStatus: true,
    },
  });
  if (!offer) return { ok: false, error: 'Nie znaleziono oferty.', status: 404 };
  if (offer.status === 'ACTIVE') return { ok: false, error: 'Oferta jest już aktywna.', status: 409 };
  if (offer.officeReviewStatus === 'OFFICE_REVIEW') {
    return { ok: false, error: 'Oferta już czeka na akceptację kierownika.', status: 409 };
  }

  const capability = await canManageOfficeOffers(params.actorUserId);
  if (capability.ok) {
    // Owner/manager can activate directly without platform moderation.
    try {
      await submitOfferActivation({
        offerId: offer.id,
        userId: params.actorUserId,
        kind: 'PLUS_CREDIT',
        skipPlatformModeration: true,
      });
    } catch {
      await prisma.offer.update({
        where: { id: offer.id },
        data: {
          status: 'ACTIVE',
          officeReviewStatus: 'OFFICE_APPROVED',
          officeReviewedAt: new Date(),
          officeReviewedById: params.actorUserId,
          officeReviewNote: 'Aktywacja bezpośrednia przez kierownika biura.',
          officeSubmittedAt: new Date(),
        },
      });
      return { ok: true, status: 'OFFICE_APPROVED' };
    }
    await prisma.offer.update({
      where: { id: offer.id },
      data: {
        officeReviewStatus: 'OFFICE_APPROVED',
        officeReviewedAt: new Date(),
        officeReviewedById: params.actorUserId,
        officeSubmittedAt: new Date(),
        officeReviewNote: 'Aktywacja bezpośrednia przez kierownika biura.',
      },
    });
    return { ok: true, status: 'OFFICE_APPROVED' };
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

  await notifyOfficeManagers({
    companyId: membership.companyId,
    excludeUserId: params.actorUserId,
    title: 'Oferta do aktywacji',
    body: `${offer.title || `Oferta #${offer.id}`} — agent prosi o akceptację biura.`,
    offerId: offer.id,
  });

  return { ok: true, status: 'OFFICE_REVIEW' };
}

export async function decideOfficeOfferReview(params: {
  offerId: number;
  reviewerUserId: number;
  decision: 'approve' | 'reject';
  note?: string | null;
}): Promise<{ ok: true; status: OfficeReviewStatus } | { ok: false; error: string; status?: number }> {
  const capability = await canManageOfficeOffers(params.reviewerUserId);
  if (!capability.ok || !capability.companyId) {
    return { ok: false, error: 'Tylko kierownik biura może akceptować oferty.', status: 403 };
  }

  const offer = await prisma.offer.findFirst({
    where: { id: params.offerId },
    select: {
      id: true,
      title: true,
      userId: true,
      status: true,
      officeReviewStatus: true,
      user: { select: { id: true, agencyMembership: { select: { companyId: true } } } },
    },
  });
  if (!offer) return { ok: false, error: 'Nie znaleziono oferty.', status: 404 };

  const ownerCompanyId = offer.user.agencyMembership?.companyId ?? null;
  if (ownerCompanyId !== capability.companyId && offer.userId !== params.reviewerUserId) {
    // Also allow if reviewer owns company and offer owner is member — already checked via companyId.
    const member = await prisma.agencyCompanyMember.findFirst({
      where: { userId: offer.userId, companyId: capability.companyId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!member) return { ok: false, error: 'Oferta nie należy do Twojego biura.', status: 403 };
  }

  const note = String(params.note || '').trim().slice(0, 512) || null;

  if (params.decision === 'reject') {
    await prisma.offer.update({
      where: { id: offer.id },
      data: {
        status: 'PENDING',
        officeReviewStatus: 'OFFICE_REJECTED',
        officeReviewedAt: new Date(),
        officeReviewedById: params.reviewerUserId,
        officeReviewNote: note || 'Kierownik poprosił o poprawki przed aktywacją.',
      },
    });
    await sendNotification({
      userId: offer.userId,
      type: 'CRM_EVENT',
      title: 'Oferta wymaga poprawek',
      body: note || `${offer.title || `Oferta #${offer.id}`} została odesłana przez kierownika.`,
      data: { type: 'office_offer_rejected', offerId: String(offer.id) },
    }).catch(() => {});
    return { ok: true, status: 'OFFICE_REJECTED' };
  }

  try {
    await submitOfferActivation({
      offerId: offer.id,
      userId: offer.userId,
      kind: 'PLUS_CREDIT',
      skipPlatformModeration: true,
    });
  } catch {
    await prisma.offer.update({
      where: { id: offer.id },
      data: {
        status: 'ACTIVE',
        officeReviewStatus: 'OFFICE_APPROVED',
        officeReviewedAt: new Date(),
        officeReviewedById: params.reviewerUserId,
        officeReviewNote: note,
      },
    });
  }

  await prisma.offer.update({
    where: { id: offer.id },
    data: {
      officeReviewStatus: 'OFFICE_APPROVED',
      officeReviewedAt: new Date(),
      officeReviewedById: params.reviewerUserId,
      officeReviewNote: note,
    },
  });

  await sendNotification({
    userId: offer.userId,
    type: 'CRM_EVENT',
    title: 'Oferta aktywowana przez biuro',
    body: `${offer.title || `Oferta #${offer.id}`} jest już aktywna — bez moderacji platformy.`,
    data: { type: 'office_offer_approved', offerId: String(offer.id) },
  }).catch(() => {});

  return { ok: true, status: 'OFFICE_APPROVED' };
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
      user: { select: { id: true, name: true, email: true } },
    },
  });
}
