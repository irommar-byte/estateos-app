import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const offers = await prisma.offer.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json(offers);
  } catch (error) { return NextResponse.json({ success: false, error: String(error) }, { status: 500 }); }
}

export async function PUT(req: Request) {
  try {
    const { id, status } = await req.json();

    // === SILNIK ALERTÓW - tylko przy zmianie na ACTIVE ===
    const existing = await prisma.offer.findUnique({ where: { id: Number(id) } });

    const updated = await prisma.offer.update({ where: { id: Number(id) }, data: { status } });

    console.log("STATUS CHECK:", { before: existing?.status, after: status });

    if (existing?.status !== 'ACTIVE' && status === 'ACTIVE') {
      const { radarService } = await import("@/lib/services/radar.service");
      await radarService.matchNewOffer(updated);
    }

    return NextResponse.json({ success: true, offer: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
