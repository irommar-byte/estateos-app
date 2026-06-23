import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { notifyLeadTransfer } from '@/lib/leadTransfer';
import { parseLeadConditions } from '@/lib/leadTransferShared';

export async function POST(req: Request) {
  try {
    const userId = await resolveWebUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 });
    }

    const { leadId, status, commissionRate, commissionTerms } = await req.json();
    const id = Number(leadId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Brak ID zapytania.' }, { status: 400 });
    }

    const lead = await prisma.leadTransfer.findUnique({
      where: { id },
      include: { offer: { select: { title: true } } },
    });
    if (!lead) return NextResponse.json({ error: 'Nie znaleziono zapytania.' }, { status: 404 });
    if (lead.agencyId !== userId) {
      return NextResponse.json({ error: 'Tylko wybrana agencja może odpowiadać.' }, { status: 403 });
    }

    const nextStatus = String(status || 'TERMS_PROPOSED').toUpperCase();
    const rate = commissionRate != null ? parseFloat(String(commissionRate)) : null;
    const terms = typeof commissionTerms === 'string' ? commissionTerms.trim().slice(0, 2000) : null;

    if (nextStatus === 'TERMS_PROPOSED' && (rate == null || !Number.isFinite(rate) || rate <= 0)) {
      return NextResponse.json({ error: 'Podaj prowizję w procentach.' }, { status: 400 });
    }
    if (nextStatus === 'TERMS_PROPOSED' && !terms) {
      return NextResponse.json({ error: 'Opisz zakres usług dla klienta.' }, { status: 400 });
    }
    if (nextStatus === 'TERMS_PROPOSED' && terms) {
      const parsed = parseLeadConditions(terms);
      if (parsed.isStructured && parsed.conditions.length < 3) {
        return NextResponse.json(
          { error: 'Zaznacz co najmniej 3 konkretne warunki obsługi.' },
          { status: 400 },
        );
      }
    }

    await prisma.leadTransfer.update({
      where: { id },
      data: {
        status: nextStatus,
        commissionRate: rate,
        commissionTerms: terms,
      },
    });

    if (nextStatus === 'TERMS_PROPOSED') {
      await notifyLeadTransfer({
        userId: lead.ownerId,
        title: 'Agencja przesłała warunki współpracy',
        body:
          `„${lead.offer.title}” — propozycja prowizji ${rate}%. ` +
          'Zaakceptuj przekazanie sprzedaży lub odrzuć w panelu CRM. https://estateos.pl/moje-konto/crm',
        offerId: lead.offerId,
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Błąd serwera.' }, { status: 500 });
  }
}
