import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { notifyLeadTransfer, CONCIERGE_NOTIFY_TITLES } from '@/lib/leadTransfer';

export async function POST(req: Request) {
  try {
    const userId = await resolveWebUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 });
    }

    const { offerId, agencyId } = await req.json();
    const oid = Number(offerId);
    const aid = Number(agencyId);
    if (!Number.isFinite(oid) || !Number.isFinite(aid)) {
      return NextResponse.json({ error: 'Wybierz ofertę i agencję.' }, { status: 400 });
    }

    const offer = await prisma.offer.findFirst({
      where: { id: oid, userId },
      select: { id: true, title: true, managementStatus: true },
    });
    if (!offer) {
      return NextResponse.json({ error: 'Oferta nie należy do Twojego konta.' }, { status: 403 });
    }
    if (String(offer.managementStatus || 'SELF').toUpperCase() === 'AGENCY_MANAGED') {
      return NextResponse.json({ error: 'Ta oferta jest już zarządzana przez agencję.' }, { status: 400 });
    }

    const existing = await prisma.leadTransfer.findFirst({
      where: {
        offerId: oid,
        ownerId: userId,
        status: { in: ['PENDING', 'TERMS_PROPOSED', 'USER_COUNTER'] },
      },
    });
    if (existing) {
      return NextResponse.json({ error: 'Masz już aktywne zapytanie o przekazanie tej oferty.' }, { status: 409 });
    }

    const lead = await prisma.leadTransfer.create({
      data: { offerId: oid, ownerId: userId, agencyId: aid },
    });

    await notifyLeadTransfer({
      userId: aid,
      leadId: lead.id,
      title: CONCIERGE_NOTIFY_TITLES.NEW_LEAD,
      body:
        `Właściciel prosi o profesjonalną obsługę oferty „${offer.title}”. ` +
        'Przejrzyj ogłoszenie i prześlij warunki w panelu CRM. https://estateos.pl/moje-konto/crm',
      offerId: oid,
    });

    return NextResponse.json({ success: true, lead });
  } catch {
    return NextResponse.json({ error: 'Błąd serwera.' }, { status: 500 });
  }
}
