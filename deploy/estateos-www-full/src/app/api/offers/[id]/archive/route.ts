import { decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { ensureOfferLegalColumns } from '@/lib/services/offer.service';
import {
  getOfferSchemaCompatibilityMessage,
  isOfferSchemaCompatibilityError,
} from '@/lib/offerSchemaErrors';
import { endOfferPublication } from '@/lib/offerPublication';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureOfferLegalColumns();
    const resolvedParams = await params;
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('estateos_session') || cookieStore.get('luxestate_user');

    let dbUserId = null;
    if (sessionCookie) {
      try {
        dbUserId = decryptSession(sessionCookie.value).id;
      } catch (e) {
        const u = await prisma.user.findUnique({ where: { email: sessionCookie.value } });
        if (u) dbUserId = u.id;
      }
    }

    if (!dbUserId) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });

    const offerId = Number(resolvedParams.id);
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      select: { id: true, userId: true },
    });

    if (!offer || offer.userId !== dbUserId) {
      return NextResponse.json({ error: 'Brak dostępu do tej oferty' }, { status: 403 });
    }

    await endOfferPublication({
      offerId,
      endReason: 'MANUAL_ARCHIVE',
      offerStatus: 'ARCHIVED',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isOfferSchemaCompatibilityError(error)) {
      return NextResponse.json(
        { error: getOfferSchemaCompatibilityMessage(), code: 'OFFER_SCHEMA_COMPATIBILITY' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
