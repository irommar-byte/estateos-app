export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/jwtMobile';
import {
  getOfferPrivateNote,
  refreshOfferSourceStatusIfStale,
  repairImportPrivateNoteFromOffer,
  saveOfferPrivateUserNote,
} from '@/lib/offerPrivateNotes';

type RouteContext = {
  params: Promise<{ offerId: string }> | { offerId: string };
};

function parseUserIdFromBearer(req: Request): number | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const rawToken = auth.replace(/^Bearer\s+/i, '').trim();
  if (!rawToken) return null;
  const payload = verifyMobileToken(rawToken) as { id?: number; userId?: number; sub?: number };
  const userId = Number(payload?.id ?? payload?.userId ?? payload?.sub);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

async function verifyAccess(req: Request, offerId: number) {
  const authUserId = parseUserIdFromBearer(req);
  if (!authUserId) {
    return { error: NextResponse.json({ success: false, message: 'Brak autoryzacji.' }, { status: 401 }) };
  }
  const actor = await prisma.user.findUnique({
    where: { id: authUserId },
    select: { id: true, role: true },
  });
  if (!actor) {
    return { error: NextResponse.json({ success: false, message: 'Brak autoryzacji.' }, { status: 401 }) };
  }
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { id: true, userId: true },
  });
  if (!offer) {
    return { error: NextResponse.json({ success: false, message: 'Oferta nie istnieje.' }, { status: 404 }) };
  }
  const isAdmin = String(actor.role || '').toUpperCase() === 'ADMIN';
  if (!isAdmin && Number(offer.userId) !== Number(actor.id)) {
    return { error: NextResponse.json({ success: false, message: 'Brak uprawnień.' }, { status: 403 }) };
  }
  return { offer };
}

function serializeNoteRow(row: Awaited<ReturnType<typeof getOfferPrivateNote>>) {
  return {
    userNote: row?.userNote || '',
    importSource: row?.importSource || null,
    importExternalUrl: row?.importExternalUrl || null,
    importExternalId: row?.importExternalId || null,
    importSnapshotJson: row?.importSnapshotJson || null,
    sourceIsActive: row?.sourceIsActive == null ? null : Boolean(row.sourceIsActive),
    sourceLastCheckAt: row?.sourceLastCheckAt || null,
    sourceLastHttpStatus: row?.sourceLastHttpStatus || null,
    sourceLastError: row?.sourceLastError || null,
  };
}

export async function GET(req: Request, context: RouteContext) {
  const params = await context.params;
  const offerId = Number(params.offerId);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ success: false, message: 'Nieprawidłowe ID oferty.' }, { status: 400 });
  }

  const access = await verifyAccess(req, offerId);
  if ('error' in access) return access.error;

  try {
    const noteOwnerId = Number(access.offer.userId);
    let row = await getOfferPrivateNote(offerId, noteOwnerId);
    if (!row?.importSnapshotJson || !row?.importSource) {
      row = await repairImportPrivateNoteFromOffer(offerId, noteOwnerId);
    }
    row = await refreshOfferSourceStatusIfStale(offerId, noteOwnerId);
    return NextResponse.json(
      { success: true, ok: true, note: serializeNoteRow(row) },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Błąd serwera';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(req: Request, context: RouteContext) {
  const params = await context.params;
  const offerId = Number(params.offerId);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ success: false, message: 'Nieprawidłowe ID oferty.' }, { status: 400 });
  }

  const access = await verifyAccess(req, offerId);
  if ('error' in access) return access.error;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const userNote = String(body?.userNote ?? '').slice(0, 20000);
    await saveOfferPrivateUserNote({
      offerId,
      userId: access.offer.userId,
      userNote,
    });
    const row = await getOfferPrivateNote(offerId, access.offer.userId);
    return NextResponse.json({
      success: true,
      ok: true,
      note: {
        userNote: row?.userNote || '',
        updatedAt: row?.updatedAt || null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Błąd serwera';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
