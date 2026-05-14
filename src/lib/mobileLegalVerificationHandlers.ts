import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  extractBearerToken,
  parseUserIdFromMobileJwt,
  requireMobileAdmin,
} from '@/lib/mobileAdminAuth';

const QUEUE_STATUSES = ['PENDING', 'REJECTED', 'VERIFIED'] as const;
const REJECTION_REASONS = [
  'KW_NOT_FOUND',
  'KW_NUMBER_MISMATCH',
  'APARTMENT_NUMBER_MISMATCH',
  'OWNER_NAME_MISMATCH',
  'DEBT_OR_ENCUMBRANCE',
  'EXPIRED_OR_INVALID_FORMAT',
  'OTHER',
] as const;

type QueueStatus = (typeof QUEUE_STATUSES)[number];

function normalizeQueueStatus(raw: unknown): QueueStatus {
  const value = String(raw || 'PENDING').trim().toUpperCase();
  return QUEUE_STATUSES.includes(value as QueueStatus) ? (value as QueueStatus) : 'PENDING';
}

function normalizeRejectionReason(raw: unknown): string {
  const value = String(raw || '').trim().toUpperCase();
  return REJECTION_REASONS.includes(value as any) ? value : 'OTHER';
}

function requestStatusToMobile(status: string | null | undefined) {
  const value = String(status || '').toUpperCase();
  if (value === 'APPROVED') return 'VERIFIED';
  if (value === 'REJECTED') return 'REJECTED';
  if (value === 'PENDING') return 'PENDING';
  return 'NONE';
}

function queueStatusToRequest(status: QueueStatus) {
  if (status === 'VERIFIED') return 'APPROVED';
  return status;
}

function buildEkwQuickLink(landRegistryNumber: string | null) {
  if (!landRegistryNumber) return null;
  const base = 'https://przegladarka-ekw.ms.gov.pl/eukw_prz/KsiegiWieczyste/wyszukiwanieKW';
  return `${base}?numerKsiegi=${encodeURIComponent(landRegistryNumber)}`;
}

async function currentUserId(req: Request) {
  const token = extractBearerToken(req);
  if (!token) return null;
  return parseUserIdFromMobileJwt(token);
}

async function reviewedByName(reviewedBy: number | null) {
  if (!reviewedBy) return null;
  const user = await prisma.user.findUnique({
    where: { id: Number(reviewedBy) },
    select: { name: true, email: true },
  });
  return user?.name || user?.email || null;
}

async function latestRequestForOffer(offerId: number) {
  return prisma.legalVerificationRequest.findFirst({
    where: { offerId },
    orderBy: { createdAt: 'desc' },
  });
}

async function offerViewFromRequest(offerId: number, requestRow: any) {
  const status = requestStatusToMobile(requestRow?.status);
  const reviewedBy = requestRow?.status !== 'PENDING' ? requestRow?.requesterId ?? null : null;
  return {
    offerId,
    status,
    landRegistryNumber: requestRow?.landRegistryNumber || null,
    apartmentNumber: requestRow?.apartmentNumber || null,
    submittedAt: requestRow?.createdAt ? requestRow.createdAt.toISOString() : null,
    reviewedAt:
      requestRow?.updatedAt && requestRow?.status !== 'PENDING' ? requestRow.updatedAt.toISOString() : null,
    reviewedByName: await reviewedByName(reviewedBy),
    rejection:
      status === 'REJECTED'
        ? {
            reasonCode: normalizeRejectionReason('OTHER'),
            reasonText: requestRow?.note || null,
          }
        : null,
    isLegalSafeVerified: status === 'VERIFIED',
  };
}

function queueItem(row: any) {
  return {
    offerId: Number(row.offer.id),
    offerTitle: row.offer.title || `Oferta #${row.offer.id}`,
    ownerId: Number(row.offer.userId),
    ownerName: row.requester?.name || row.requester?.email || `Użytkownik #${row.offer.userId}`,
    city: row.offer.city || null,
    district: row.offer.district || null,
    street: row.offer.street || null,
    apartmentNumber: row.apartmentNumber || null,
    landRegistryNumber: row.landRegistryNumber || '',
    submittedAt: row.createdAt ? row.createdAt.toISOString() : row.updatedAt.toISOString(),
    status: requestStatusToMobile(row.status),
    ownerNote: row.note || null,
    ekwQuickLink: buildEkwQuickLink(row.landRegistryNumber || null),
  };
}

export async function getOwnerLegalVerification(req: Request, offerId: number) {
  const userId = await currentUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 });
  }

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { id: true, userId: true },
  });
  if (!offer) {
    return NextResponse.json({ success: false, message: 'Nie znaleziono oferty' }, { status: 404 });
  }
  if (offer.userId !== userId) {
    return NextResponse.json({ success: false, message: 'Brak uprawnień do tej oferty.' }, { status: 403 });
  }

  const row = await latestRequestForOffer(offerId);
  if (!row) {
    return NextResponse.json({
      offerId,
      status: 'NONE',
      landRegistryNumber: null,
      apartmentNumber: null,
      submittedAt: null,
      reviewedAt: null,
      reviewedByName: null,
      rejection: null,
      isLegalSafeVerified: false,
    });
  }
  return NextResponse.json(await offerViewFromRequest(offerId, row));
}

export async function submitOwnerLegalVerification(req: Request, offerId: number) {
  const userId = await currentUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const landRegistryNumber = String(
    body?.landRegistryNumber ?? body?.land_registry_number ?? body?.kw ?? ''
  )
    .trim()
    .toUpperCase()
    .slice(0, 128);
  const apartmentNumber = String(body?.apartmentNumber ?? body?.apartment_number ?? '')
    .trim()
    .slice(0, 64);
  const ownerNote =
    body?.ownerNote != null
      ? String(body.ownerNote).trim() || null
      : body?.note != null
        ? String(body.note).trim() || null
        : null;

  if (!landRegistryNumber) {
    return NextResponse.json({ success: false, message: 'Brak numeru księgi wieczystej.' }, { status: 400 });
  }
  if (!apartmentNumber) {
    return NextResponse.json({ success: false, message: 'Brak numeru mieszkania.' }, { status: 400 });
  }

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { id: true, userId: true },
  });
  if (!offer) {
    return NextResponse.json({ success: false, message: 'Nie znaleziono oferty' }, { status: 404 });
  }
  if (offer.userId !== userId) {
    return NextResponse.json({ success: false, message: 'Brak uprawnień do tej oferty.' }, { status: 403 });
  }

  const created = await prisma.legalVerificationRequest.create({
    data: {
      offerId,
      requesterId: userId,
      status: 'PENDING',
      landRegistryNumber,
      apartmentNumber,
      note: ownerNote,
    },
  });
  return NextResponse.json(await offerViewFromRequest(offerId, created));
}

export async function getAdminLegalVerificationQueue(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const status = normalizeQueueStatus(searchParams.get('status'));
  const requestStatus = queueStatusToRequest(status);
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 100);

  const rows = await prisma.legalVerificationRequest.findMany({
    where: { status: requestStatus },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      offer: {
        select: {
          id: true,
          title: true,
          city: true,
          district: true,
          street: true,
          userId: true,
        },
      },
      requester: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({
    items: rows.map(queueItem),
    total: rows.length,
    nextCursor: null,
  });
}

export async function approveLegalVerification(req: Request, offerId: number) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  const target =
    (await prisma.legalVerificationRequest.findFirst({
      where: { offerId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    })) ||
    (await latestRequestForOffer(offerId));
  if (!target) {
    return NextResponse.json({ success: false, message: 'Brak zgłoszenia do zatwierdzenia.' }, { status: 404 });
  }

  const updated = await prisma.legalVerificationRequest.update({
    where: { id: target.id },
    data: { status: 'APPROVED' },
  });
  return NextResponse.json(await offerViewFromRequest(offerId, updated));
}

export async function rejectLegalVerification(req: Request, offerId: number) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const reasonCode = normalizeRejectionReason(body?.reasonCode);
  const reasonText = body?.reasonText != null ? String(body.reasonText).trim() || null : null;
  if (reasonCode === 'OTHER' && !reasonText) {
    return NextResponse.json({ success: false, message: 'Komentarz jest wymagany dla powodu OTHER.' }, { status: 400 });
  }

  const target =
    (await prisma.legalVerificationRequest.findFirst({
      where: { offerId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    })) ||
    (await latestRequestForOffer(offerId));
  if (!target) {
    return NextResponse.json({ success: false, message: 'Brak zgłoszenia do odrzucenia.' }, { status: 404 });
  }

  const note = reasonText || `REJECTION:${reasonCode}`;
  const updated = await prisma.legalVerificationRequest.update({
    where: { id: target.id },
    data: { status: 'REJECTED', note },
  });
  return NextResponse.json(await offerViewFromRequest(offerId, updated));
}
