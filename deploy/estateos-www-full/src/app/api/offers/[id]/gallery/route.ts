import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveUploaderUserId } from '@/lib/upload/resolveUploader';
import {
  actorMayManageOfferMedia,
  purgeOfferGallery,
} from '@/lib/upload/offerGalleryMaintenance';

type Ctx = { params: Promise<{ id: string }> };

/** Po potwierdzeniu kasuje wszystkie zdjęcia galerii oferty (pliki + wpis w bazie). */
export async function DELETE(req: Request, ctx: Ctx) {
  const userId = await resolveUploaderUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const offerId = Number(id);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ error: 'Nieprawidłowe ID oferty.' }, { status: 400 });
  }

  let body: { confirm?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (body.confirm !== true) {
    return NextResponse.json(
      { error: 'Potwierdź usunięcie wszystkich zdjęć (confirm: true).' },
      { status: 400 },
    );
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

  const quota = await purgeOfferGallery(offerId);
  return NextResponse.json({ success: true, ...quota });
}
