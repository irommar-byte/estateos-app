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

    const { leadId, reason } = await req.json();
    const id = Number(leadId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Brak ID zapytania.' }, { status: 400 });
    }

    const lead = await prisma.leadTransfer.findUnique({
      where: { id },
      include: { offer: { select: { title: true } } },
    });
    if (!lead) return NextResponse.json({ error: 'Nie znaleziono zapytania.' }, { status: 404 });

    const isOwner = lead.ownerId === userId;
    const isAgency = lead.agencyId === userId;
    if (!isOwner && !isAgency) {
      return NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 });
    }
    if (lead.status === 'ACCEPTED' || lead.status === 'REJECTED') {
      return NextResponse.json({ error: 'To zapytanie jest już zamknięte.' }, { status: 400 });
    }

    await prisma.leadTransfer.update({
      where: { id },
      data: { status: 'REJECTED', message: typeof reason === 'string' ? reason.slice(0, 500) : null },
    });

    const title = lead.offer.title;
    const notifyUserId = isOwner ? lead.agencyId : lead.ownerId;
    await notifyLeadTransfer({
      userId: notifyUserId,
      leadId: lead.id,
      title: isOwner ? CONCIERGE_NOTIFY_TITLES.REJECTED_BY_OWNER : CONCIERGE_NOTIFY_TITLES.REJECTED_BY_AGENCY,
      body:
        (isOwner
          ? `Właściciel nie zaakceptował warunków dla „${title}”.`
          : `Agencja nie przejmuje sprzedaży „${title}”.`) +
        ' https://estateos.pl/moje-konto/crm',
      offerId: lead.offerId,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Błąd serwera.' }, { status: 500 });
  }
}
