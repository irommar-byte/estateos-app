import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { prisma } from '@/lib/prisma';
import { transferOfferManagementFromLead } from '@/lib/offerAgencyManagement';
import { NotificationType } from '@prisma/client';

async function sessionUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('estateos_session') || cookieStore.get('luxestate_user');
  if (!sessionCookie?.value) return null;
  try {
    const data = decryptSession(sessionCookie.value);
    const id = Number(data?.id);
    return Number.isFinite(id) ? id : null;
  } catch {
    const u = await prisma.user.findUnique({ where: { email: sessionCookie.value }, select: { id: true } });
    return u?.id ?? null;
  }
}

export async function POST(req: Request) {
  try {
    const userId = await sessionUserId();
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
      await prisma.notification.create({
        data: {
          userId,
          title: 'Oferta przekazana do agencji',
          body:
            `„${lead.offer.title}” jest teraz zarządzana przez wybraną agencję. ` +
            'Masz podgląd aktywności w panelu — bez kontaktu z kupującymi.',
          type: NotificationType.SYSTEM_ALERT,
        },
      });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Błąd serwera';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
