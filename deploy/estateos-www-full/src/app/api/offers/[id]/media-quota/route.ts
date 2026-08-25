import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveUploaderUserId } from '@/lib/upload/resolveUploader';
import {
  actorMayManageOfferMedia,
  getOfferMediaQuota,
} from '@/lib/upload/offerGalleryMaintenance';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const userId = await resolveUploaderUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const offerId = Number(id);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ error: 'Nieprawidłowe ID oferty.' }, { status: 400 });
  }

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { id: true, userId: true },
  });
  if (!offer) {
    return NextResponse.json({ error: 'Nie znaleziono oferty.' }, { status: 404 });
  }
  if (!(await actorMayManageOfferMedia(offer.userId, userId))) {
    return NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 });
  }

  const quota = await getOfferMediaQuota(offerId);
  return NextResponse.json({ success: true, ...quota });
}
