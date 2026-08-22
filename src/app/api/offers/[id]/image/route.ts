import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { deleteOfferImageArtifacts } from '@/lib/upload/deleteOfferImageArtifacts';

type Ctx = { params: Promise<{ id: string }> };

/** Usuwa pliki SDR + HDR master + sidecar meta dla jednego zdjęcia oferty. */
export async function DELETE(req: Request, ctx: Ctx) {
  const userId = await resolveWebUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const offerId = Number(id);
  if (!Number.isFinite(offerId)) {
    return NextResponse.json({ error: 'Nieprawidłowe ID oferty.' }, { status: 400 });
  }

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { id: true, userId: true },
  });
  if (!offer) {
    return NextResponse.json({ error: 'Nie znaleziono oferty.' }, { status: 404 });
  }
  if (offer.userId !== userId) {
    return NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 });
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe body.' }, { status: 400 });
  }

  const url = String(body.url || '').trim();
  if (!url) {
    return NextResponse.json({ error: 'Brak URL zdjęcia.' }, { status: 400 });
  }

  try {
    const result = await deleteOfferImageArtifacts(offerId, url);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Usunięcie nie powiodło się.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
