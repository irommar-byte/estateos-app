import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { notifyLeadTransfer } from '@/lib/leadTransfer';

export async function POST(req: Request) {
  try {
    const userId = await resolveWebUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Musisz być zalogowany.' }, { status: 401 });
    }

    const { transferId, newRate, clientNetto } = await req.json();
    const id = Number(transferId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Brak ID zapytania.' }, { status: 400 });
    }

    const transfer = await prisma.leadTransfer.findUnique({ where: { id } });
    if (!transfer) return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 });
    if (transfer.ownerId !== userId) {
      return NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 });
    }

    await prisma.leadTransfer.update({
      where: { id },
      data: { status: 'USER_COUNTER', commissionRate: parseFloat(String(newRate)) },
    });

    await notifyLeadTransfer({
      userId: transfer.agencyId,
      title: 'Klient negocjuje warunki',
      body:
        `Kontrpropozycja prowizji (${newRate}%).` +
        (clientNetto
          ? ` Oczekiwana kwota na rękę: ${new Intl.NumberFormat('pl-PL').format(Number(clientNetto))} zł.`
          : '') +
        ' https://estateos.pl/moje-konto/crm',
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
