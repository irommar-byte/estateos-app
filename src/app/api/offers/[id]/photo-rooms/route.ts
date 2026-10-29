import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveUploaderUserId } from '@/lib/upload/resolveUploader';
import { actorMayManageOfferMedia } from '@/lib/upload/offerGalleryMaintenance';
import { loadOfferPhotoRooms, replaceOfferPhotoRooms } from '@/lib/offerPhotoRooms';

type Ctx = { params: Promise<{ id: string }> };

/** Przypisania zdjęć do pomieszczeń — publicznie do odczytu (rzut ↔ galeria). */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const items = await loadOfferPhotoRooms(Number(id));
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'public, max-age=30' } });
}

/** Zapis z edycji oferty: { items: [{ url, room }] } — zastępuje wszystkie przypisania. */
export async function PUT(req: Request, ctx: Ctx) {
  const userId = await resolveUploaderUserId(req);
  if (!userId) return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 });
  const { id } = await ctx.params;
  const offerId = Number(id);
  const offer = Number.isFinite(offerId) && offerId > 0
    ? await prisma.offer.findUnique({ where: { id: offerId }, select: { id: true, userId: true } })
    : null;
  if (!offer) return NextResponse.json({ error: 'Nie znaleziono oferty.' }, { status: 404 });
  if (!(await actorMayManageOfferMedia(offer.userId, userId))) {
    return NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { items?: Array<{ url?: string; room?: string | null }> };
  const items = Array.isArray(body.items) ? body.items.map((item) => ({ url: String(item?.url || ''), room: item?.room ?? null })) : [];
  const saved = await replaceOfferPhotoRooms(offerId, items);
  return NextResponse.json({ success: true, items: saved });
}
