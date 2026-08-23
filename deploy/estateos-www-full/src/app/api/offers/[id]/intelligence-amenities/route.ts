import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { INTELLIGENCE_AMENITY_FIELDS } from '@/lib/intelligenceAmenityBrain';
import { readOfferAmenityPatches, toggleOfferAmenityPatch } from '@/lib/intelligenceAmenityPatches';

export const dynamic = 'force-dynamic';

async function canEditOffer(req: Request, offerId: number): Promise<boolean> {
  const admin = await requireAdmin();
  if (admin?.id) return true;
  const userId = await resolveWebUserId(req);
  if (!userId) return false;
  const offer = await prisma.offer.findUnique({ where: { id: offerId }, select: { userId: true } });
  return Boolean(offer && offer.userId === userId);
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const offerId = Number((await params).id);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ error: 'Nieprawidłowe ID.' }, { status: 400 });
  }
  const allowed = await canEditOffer(req, offerId);
  if (!allowed) return NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 });
  const patches = await readOfferAmenityPatches(offerId);
  return NextResponse.json({ ok: true, patches });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const offerId = Number((await params).id);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ error: 'Nieprawidłowe ID.' }, { status: 400 });
  }
  const allowed = await canEditOffer(req, offerId);
  if (!allowed) return NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const field = String(body?.field || '');
  const action = body?.action === 'reapply' ? 'reapply' : body?.action === 'undo' ? 'undo' : null;
  if (!INTELLIGENCE_AMENITY_FIELDS.includes(field as (typeof INTELLIGENCE_AMENITY_FIELDS)[number]) || !action) {
    return NextResponse.json({ error: 'Podaj field i action (undo | reapply).' }, { status: 400 });
  }
  const patches = await toggleOfferAmenityPatch(
    offerId,
    field as (typeof INTELLIGENCE_AMENITY_FIELDS)[number],
    action,
  );
  return NextResponse.json({ ok: true, patches, field, action });
}
