import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createOffer } from '@/lib/services/offer.service';

export const dynamic = 'force-dynamic';

// =======================
// GET
// =======================
export async function GET() {
  try {
    const offers = await prisma.offer.findMany({
      where: { status: { in: ["ACTIVE"] } },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(offers);

  } catch (error) {
    console.error('OFFERS ERROR:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

// =======================
// POST
// =======================
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const offer = await createOffer(body);

    return NextResponse.json({ success: true, offer });

  } catch (e: any) {
    console.error('POST ERROR:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
