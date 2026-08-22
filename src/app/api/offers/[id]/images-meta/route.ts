import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readAllOfferImageMeta } from '@/lib/upload/offerImageMeta';
import { resolveUploaderUserId } from '@/lib/upload/resolveUploader';

type Ctx = { params: Promise<{ id: string }> };

/** Metadane HDR zdjęć oferty (sidecar JSON obok plików). */
export async function GET(req: Request, ctx: Ctx) {
  const userId = await resolveUploaderUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 403 });
  }
  const { id } = await ctx.params;
  const offerId = Number(id);
  if (!Number.isFinite(offerId)) {
    return NextResponse.json({ error: 'Nieprawidłowe ID oferty.' }, { status: 400 });
  }

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { userId: true },
  });
  if (!offer) {
    return NextResponse.json({ error: 'Nie znaleziono oferty.' }, { status: 404 });
  }

  if (offer.userId !== userId) {
    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (String(actor?.role || '').toUpperCase() !== 'ADMIN') {
      return NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 });
    }
  }

  const meta = await readAllOfferImageMeta(offerId);
  return NextResponse.json({ success: true, images: meta });
}
