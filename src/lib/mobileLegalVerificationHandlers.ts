import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  extractBearerToken,
  parseUserIdFromMobileJwt,
  requireMobileAdmin,
} from '@/lib/mobileAdminAuth';

const LEGAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
type LegalStatus = (typeof LEGAL_STATUSES)[number];

function normalizeStatus(raw: string | null): LegalStatus {
  const s = String(raw || 'PENDING').trim().toUpperCase();
  return LEGAL_STATUSES.includes(s as LegalStatus) ? (s as LegalStatus) : 'PENDING';
}

export async function getLegalVerificationRequests(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  try {
    const { searchParams } = new URL(req.url);
    const status = normalizeStatus(searchParams.get('status'));

    const items = await prisma.legalVerificationRequest.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      include: {
        offer: {
          select: {
            id: true,
            title: true,
            city: true,
            district: true,
            street: true,
            buildingNumber: true,
            status: true,
            userId: true,
          },
        },
        requester: { select: { id: true, email: true, name: true, phone: true } },
      },
    });

    return NextResponse.json({ success: true, items });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Błąd serwera' }, { status: 500 });
  }
}

export async function postLegalVerificationRequest(req: Request, fallbackOfferId?: number) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim();

    if (action === 'setStatus') {
      const gate = await requireMobileAdmin(req);
      if (!gate.ok) return gate.response;

      const id = Number(body?.id);
      const next = String(body?.status || '').trim().toUpperCase();
      if (!Number.isFinite(id) || id <= 0) {
        return NextResponse.json({ success: false, message: 'Brak poprawnego id zgłoszenia.' }, { status: 400 });
      }
      if (next !== 'APPROVED' && next !== 'REJECTED' && next !== 'PENDING') {
        return NextResponse.json({ success: false, message: 'Nieprawidłowy status.' }, { status: 400 });
      }

      const row = await prisma.legalVerificationRequest.update({
        where: { id },
        data: { status: next },
        include: {
          offer: {
            select: {
              id: true,
              title: true,
              city: true,
              district: true,
              status: true,
            },
          },
        },
      });

      return NextResponse.json({ success: true, item: row });
    }

    const token = extractBearerToken(req);
    if (!token) {
      return NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 });
    }
    const userId = parseUserIdFromMobileJwt(token);
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy token' }, { status: 401 });
    }

    const offerId = Number(body?.offerId ?? body?.offer_id ?? fallbackOfferId);
    if (!Number.isFinite(offerId) || offerId <= 0) {
      return NextResponse.json({ success: false, message: 'Brak poprawnego offerId.' }, { status: 400 });
    }

    const landRegistryNumber = String(
      body?.landRegistryNumber ?? body?.land_registry_number ?? body?.kw ?? ''
    ).trim();
    if (!landRegistryNumber) {
      return NextResponse.json({ success: false, message: 'Brak numeru księgi wieczystej.' }, { status: 400 });
    }

    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      select: { id: true, userId: true },
    });
    if (!offer || offer.userId !== userId) {
      return NextResponse.json({ success: false, message: 'Brak uprawnień do tej oferty.' }, { status: 403 });
    }

    const existingPending = await prisma.legalVerificationRequest.findFirst({
      where: { offerId, status: 'PENDING' },
      select: { id: true },
    });
    if (existingPending) {
      return NextResponse.json(
        { success: false, message: 'Ta oferta ma już oczekujące zgłoszenie weryfikacji prawnej.' },
        { status: 409 }
      );
    }

    const aptRaw = body?.apartmentNumber ?? body?.apartment_number;
    const apartmentNumber = aptRaw != null ? String(aptRaw).trim() || null : null;
    const note = body?.note != null ? String(body.note).trim() || null : null;

    const created = await prisma.legalVerificationRequest.create({
      data: {
        offerId,
        requesterId: userId,
        status: 'PENDING',
        landRegistryNumber: landRegistryNumber.slice(0, 128),
        apartmentNumber: apartmentNumber ? apartmentNumber.slice(0, 64) : null,
        note,
      },
      include: {
        offer: {
          select: {
            id: true,
            title: true,
            city: true,
            district: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, item: created });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Błąd serwera' }, { status: 500 });
  }
}
