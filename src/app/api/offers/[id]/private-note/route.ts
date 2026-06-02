import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { prisma } from '@/lib/prisma';
import {
  getOfferPrivateNote,
  refreshOfferSourceStatusIfStale,
  saveOfferPrivateUserNote,
} from '@/lib/offerPrivateNotes';

async function resolveCurrentUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('estateos_session') || cookieStore.get('luxestate_user');
  if (!sessionCookie?.value) return null;
  try {
    const data = decryptSession(sessionCookie.value);
    const id = Number(data?.id);
    if (Number.isFinite(id) && id > 0) {
      return prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    }
    const email = String(data?.email || '').trim().toLowerCase();
    if (email) {
      return prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
    }
  } catch {
    return null;
  }
  return null;
}

async function verifyAccess(offerId: number) {
  const actor = await resolveCurrentUser();
  if (!actor) return { error: NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 }) };
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { id: true, userId: true },
  });
  if (!offer) return { error: NextResponse.json({ error: 'Oferta nie istnieje' }, { status: 404 }) };
  const isAdmin = String(actor.role || '').toUpperCase() === 'ADMIN';
  if (!isAdmin && Number(offer.userId) !== Number(actor.id)) {
    return { error: NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 }) };
  }
  return { actor, offer };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const offerId = Number(resolvedParams.id);
    if (!Number.isFinite(offerId) || offerId <= 0) {
      return NextResponse.json({ error: 'Nieprawidłowe ID oferty' }, { status: 400 });
    }
    const access = await verifyAccess(offerId);
    if ('error' in access) return access.error;

    const row = await refreshOfferSourceStatusIfStale(offerId, access.offer.userId);
    return NextResponse.json({
      ok: true,
      note: {
        userNote: row?.userNote || '',
        importSource: row?.importSource || null,
        importExternalUrl: row?.importExternalUrl || null,
        importExternalId: row?.importExternalId || null,
        importSnapshotJson: row?.importSnapshotJson || null,
        sourceIsActive: row?.sourceIsActive == null ? null : Boolean(row.sourceIsActive),
        sourceLastCheckAt: row?.sourceLastCheckAt || null,
        sourceLastHttpStatus: row?.sourceLastHttpStatus || null,
        sourceLastError: row?.sourceLastError || null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Błąd serwera';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const offerId = Number(resolvedParams.id);
    if (!Number.isFinite(offerId) || offerId <= 0) {
      return NextResponse.json({ error: 'Nieprawidłowe ID oferty' }, { status: 400 });
    }
    const access = await verifyAccess(offerId);
    if ('error' in access) return access.error;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const userNote = String(body?.userNote ?? '').slice(0, 20000);
    await saveOfferPrivateUserNote({
      offerId,
      userId: access.offer.userId,
      userNote,
    });
    const row = await getOfferPrivateNote(offerId, access.offer.userId);
    return NextResponse.json({
      ok: true,
      note: {
        userNote: row?.userNote || '',
        updatedAt: row?.updatedAt || null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Błąd serwera';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
