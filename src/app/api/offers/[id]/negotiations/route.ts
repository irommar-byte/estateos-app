import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const offerId = resolvedParams.id;

    // Szukamy tylko aktywnych negocjacji (Nowa propozycja lub Odbijanie piłeczki)
    const activeNegotiationsCount = await prisma.appointment.count({
      where: { 
        offerId: Number(offerId),
        status: { in: ['PROPOSED', 'COUNTER'] }
      }
    });

    return NextResponse.json({ count: activeNegotiationsCount });
  } catch (error) {
    return NextResponse.json({ count: 0 }); // W razie błędu awaryjnie wyłączamy lampkę
  }
}
