import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { notifyOwnerFirstFavorite } from '@/lib/ownerFavoritePush';

async function favoritesCount(offerId: number): Promise<number> {
  return prisma.favoriteOffer.count({ where: { offerId } });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveWebUserId(req);
  if (!userId) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });

  const resolved = await params;
  const offerId = Number(resolved.id);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ error: 'Nieprawidłowe ID oferty' }, { status: 400 });
  }

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { id: true, userId: true, title: true },
  });
  if (!offer) return NextResponse.json({ error: 'Nie znaleziono oferty' }, { status: 404 });

  const existing = await prisma.favoriteOffer.findUnique({
    where: { userId_offerId: { userId, offerId } },
    select: { id: true },
  });

  await prisma.favoriteOffer.upsert({
    where: { userId_offerId: { userId, offerId } },
    create: { userId, offerId },
    update: {},
  });

  const count = await favoritesCount(offerId);
  const firstFavorite = !existing && count === 1 && offer.userId !== userId;
  if (firstFavorite) {
    notifyOwnerFirstFavorite({
      ownerUserId: offer.userId,
      offerId,
      offerTitle: offer.title,
    });
  }

  return NextResponse.json({ success: true, favoritesCount: count, firstFavorite });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveWebUserId(req);
  if (!userId) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });

  const resolved = await params;
  const offerId = Number(resolved.id);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ error: 'Nieprawidłowe ID oferty' }, { status: 400 });
  }

  await prisma.favoriteOffer.deleteMany({ where: { userId, offerId } });
  const count = await favoritesCount(offerId);
  return NextResponse.json({ success: true, favoritesCount: count });
}
