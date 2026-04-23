import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'PENDING';

    const offers = await prisma.offer.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      include: { 
        user: { select: { email: true, name: true, phone: true } } 
      }
    });

    return NextResponse.json({ success: true, offers });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { offerId, newStatus } = await req.json();
    
    if (!offerId || !newStatus) {
      return NextResponse.json({ success: false, message: 'Brak wymaganych danych' }, { status: 400 });
    }

    const offer = await prisma.offer.update({
      where: { id: Number(offerId) },
      data: { status: newStatus }
    });

    return NextResponse.json({ success: true, offer });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
