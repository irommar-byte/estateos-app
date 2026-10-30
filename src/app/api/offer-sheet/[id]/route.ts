import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { loadOfferShareCard } from '@/lib/offerShareLanding';
import { parseFloorPlanScanMeta } from '@/lib/roomScan/parseFloorPlanScanMeta';
import { renderOfferSheet, type OfferSheetStyleId } from '@/lib/offerSheetRender';
import { loadOfferPhotoRooms, photoRoomKey } from '@/lib/offerPhotoRooms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Ofertówka A4 jako JPEG (1588 × 2246) — wspólna dla podglądu, JPEG, PDF i druku. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offerId = Number(id);
  const sp = new URL(req.url).searchParams;
  const styl = sp.get('styl');
  const style: OfferSheetStyleId = styl === 'galeria' || styl === 'architekt' ? styl : 'pelna';
  const card = await loadOfferShareCard(offerId, { portalToken: sp.get('portal'), agentUserId: sp.get('agent') });
  if (!card) return NextResponse.json({ error: 'Oferta niedostępna.' }, { status: 404 });
  const row = await prisma.offer.findUnique({ where: { id: offerId }, select: { floorPlanScanMeta: true } }).catch(() => null);
  // Zdjęcia przypisane do pokoi (w kolejności galerii) — podpisy pod rzutem w stylu Architekt.
  const tags = await loadOfferPhotoRooms(offerId);
  const tagByKey = new Map(tags.map((t) => [t.url, t.room]));
  const roomPhotos = [card.imageUrl, ...(card.images || [])]
    .filter(Boolean)
    .map((url) => ({ url, room: tagByKey.get(photoRoomKey(url)) || '' }))
    .filter((p) => p.room);
  const png = Buffer.from(await (await renderOfferSheet(card, style, parseFloorPlanScanMeta(row?.floorPlanScanMeta ?? null), roomPhotos)).arrayBuffer());
  const jpg = await sharp(png).flatten({ background: '#ffffff' }).withMetadata({ density: 192 }).jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer();
  return new NextResponse(new Uint8Array(jpg), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=120' },
  });
}
