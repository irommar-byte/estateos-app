import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { transferOfferManagementFromLead } from '@/lib/offerAgencyManagement';
import { notifyLeadTransfer } from '@/lib/leadTransfer';

export async function POST(req: Request) {
  try {
    const userId = await resolveWebUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 });
    }

    const { leadId } = await req.json();
    const id = Number(leadId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Brak ID zapytania.' }, { status: 400 });
    }

    const result = await transferOfferManagementFromLead(id, userId);

    const lead = await prisma.leadTransfer.findUnique({
      where: { id },
      select: { offer: { select: { title: true } }, agencyId: true },
    });

    if (lead) {
      await notifyLeadTransfer({
        userId,
        title: 'Sprzedaż przekazana agencji',
        body:
          `„${lead.offer.title}” jest teraz zarządzana przez wybrane biuro. ` +
          'Masz podgląd aktywności w panelu — bez kontaktu z kupującymi.',
      });
      await notifyLeadTransfer({
        userId: lead.agencyId,
        title: 'Przejęto zarządzanie ofertą',
        body: `Właściciel zaakceptował warunki dla „${lead.offer.title}”. Oferta jest w Twoim CRM.`,
      });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Błąd serwera';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
