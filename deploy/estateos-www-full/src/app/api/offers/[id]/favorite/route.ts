import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveWebUserId } from '@/lib/webSessionAuth';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveWebUserId(req);
  if (!userId) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });

  const resolved = await params;
  const offerId = Number(resolved.id);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ error: 'Nieprawidłowe ID oferty' }, { status: 400 });
  }

  await prisma.favoriteOffer.upsert({
    where: { userId_offerId: { userId, offerId } },
    create: { userId, offerId },
    update: {},
  });

  return NextResponse.json({ success: true });
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
  return NextResponse.json({ success: true });
}
