import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const offerId = resolvedParams.id;
    
    if (!offerId || isNaN(Number(offerId))) {
      return NextResponse.json({ url: null });
    }

    const offer = await prisma.offer.findUnique({
      where: { id: Number(offerId) },
      select: { floorPlan: true } // <--- Zgodnie z podpowiedzią bazy!
    });

    if (!offer || !offer.floorPlan) return NextResponse.json({ url: null });

    return NextResponse.json({ url: offer.floorPlan });
  } catch (error) {
    return NextResponse.json({ url: null });
  }
}
