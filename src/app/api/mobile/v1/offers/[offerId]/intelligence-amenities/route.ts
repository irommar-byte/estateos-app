import { NextResponse } from 'next/server';
import { authorizeMobile } from '@/lib/mobileAuth';
import { prisma } from '@/lib/prisma';
import { INTELLIGENCE_AMENITY_FIELDS } from '@/lib/intelligenceAmenityBrain';
import { readOfferAmenityPatches, toggleOfferAmenityPatch } from '@/lib/intelligenceAmenityPatches';

export const dynamic = 'force-dynamic';

async function canEdit(userId: number, offerId: number) {
  const [user, offer] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    prisma.offer.findUnique({ where: { id: offerId }, select: { userId: true } }),
  ]);
  if (!offer) return false;
  if (user?.role === 'ADMIN') return true;
  return offer.userId === userId;
}

export async function GET(req: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const auth = await authorizeMobile(req);
  if (!auth.ok) return auth.response;
  const offerId = Number((await params).offerId);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ success: false, message: 'Nieprawidłowe ID.' }, { status: 400 });
  }
  if (!(await canEdit(auth.userId, offerId))) {
    return NextResponse.json({ success: false, message: 'Brak uprawnień.' }, { status: 403 });
  }
  const patches = await readOfferAmenityPatches(offerId);
  return NextResponse.json({ success: true, patches });
}

export async function POST(req: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const auth = await authorizeMobile(req);
  if (!auth.ok) return auth.response;
  const offerId = Number((await params).offerId);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ success: false, message: 'Nieprawidłowe ID.' }, { status: 400 });
  }
  if (!(await canEdit(auth.userId, offerId))) {
    return NextResponse.json({ success: false, message: 'Brak uprawnień.' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const field = String(body?.field || '');
  const action = body?.action === 'reapply' ? 'reapply' : body?.action === 'undo' ? 'undo' : null;
  if (!INTELLIGENCE_AMENITY_FIELDS.includes(field as (typeof INTELLIGENCE_AMENITY_FIELDS)[number]) || !action) {
    return NextResponse.json({ success: false, message: 'Podaj field i action (undo | reapply).' }, { status: 400 });
  }
  const patches = await toggleOfferAmenityPatch(
    offerId,
    field as (typeof INTELLIGENCE_AMENITY_FIELDS)[number],
    action,
  );
  return NextResponse.json({ success: true, patches, field, action });
}
