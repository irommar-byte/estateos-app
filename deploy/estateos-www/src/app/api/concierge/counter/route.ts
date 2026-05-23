import { NextResponse } from 'next/server';
import { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { transferId, newRate, clientNetto } = await req.json();

    const transfer = await prisma.leadTransfer.findUnique({ where: { id: transferId } });
    if (!transfer) return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 });

    await prisma.leadTransfer.update({
      where: { id: transferId },
      data: { status: 'USER_COUNTER', commissionRate: parseFloat(newRate) }
    });

    await prisma.notification.create({
      data: {
        userId: transfer.agencyId,
        title: '⚡ Klient negocjuje warunki',
        body:
          `Klient przesłał kontrpropozycję. Oczekuje ${new Intl.NumberFormat('pl-PL').format(clientNetto)} PLN na rękę ze sprzedaży. ` +
          'Szczegóły: https://estateos.pl/moje-konto/crm',
        type: NotificationType.SYSTEM_ALERT,
      }
    });

    return NextResponse.json({ success: true });
  } catch(e) { return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 }); }
}
