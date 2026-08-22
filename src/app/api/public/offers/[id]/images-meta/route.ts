import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readPublicOfferImageMeta } from '@/lib/upload/offerImageMeta';

type Ctx = { params: Promise<{ id: string }> };

/** Publiczne metadane HDR zdjęć oferty (tylko isHdr + URL-e wyświetlania). */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const offerId = Number(id);
  if (!Number.isFinite(offerId)) {
    return NextResponse.json({ error: 'Nieprawidłowe ID oferty.' }, { status: 400 });
  }

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { id: true, status: true },
  });
  if (!offer) {
    return NextResponse.json({ error: 'Nie znaleziono oferty.' }, { status: 404 });
  }

  const images = await readPublicOfferImageMeta(offerId);
  return NextResponse.json(
    { success: true, images },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      },
    },
  );
}
