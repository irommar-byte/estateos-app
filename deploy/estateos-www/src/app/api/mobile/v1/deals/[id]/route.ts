export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { DealStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/jwtMobile';

/**
 * W Prisma nie ma statusu „started” — dla mobile DELETE traktujemy jako „wczesny etap”
 * INITIATED oraz NEGOTIATION. Pozostałe statusy: blokada 422.
 */
const MOBILE_DEAL_DELETE_ALLOWED = new Set<DealStatus>([
  DealStatus.INITIATED,
  DealStatus.NEGOTIATION,
]);

function parseUserIdFromAuthHeader(authHeader: string | null): number | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const rawToken = authHeader.slice('Bearer '.length).trim();
  const token = rawToken.startsWith('Bearer ')
    ? rawToken.slice('Bearer '.length).trim()
    : rawToken;
  if (!token) return null;

  const verified = verifyMobileToken(token) as any;
  const verifiedId = Number(verified?.id ?? verified?.userId ?? verified?.sub);
  if (Number.isFinite(verifiedId) && verifiedId > 0) {
    return verifiedId;
  }

  const decoded = jwt.decode(token) as any;
  const id = Number(decoded?.id ?? decoded?.userId ?? decoded?.sub);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await context.params;
    const dealId = Number(resolvedParams.id);
    if (!dealId || Number.isNaN(dealId)) {
      return NextResponse.json({ error: 'Nieprawidłowe ID transakcji' }, { status: 400 });
    }

    const actorId = parseUserIdFromAuthHeader(
      _req.headers.get('authorization') || _req.headers.get('Authorization')
    );
    if (!actorId) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    const deal = await prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) {
      return NextResponse.json({ error: 'Transakcja nie istnieje' }, { status: 404 });
    }
    if (deal.buyerId !== actorId && deal.sellerId !== actorId) {
      return NextResponse.json({ error: 'Brak dostępu do transakcji' }, { status: 403 });
    }

    if (!deal.isActive) {
      return NextResponse.json(
        {
          error: 'Transakcja jest już zamknięta',
          message: 'Transakcja jest już zamknięta',
        },
        { status: 409 }
      );
    }

    if (!MOBILE_DEAL_DELETE_ALLOWED.has(deal.status)) {
      const msg =
        'Można usunąć tylko transakcję we wczesnej fazie (status rozpoczęty / negocjacje).';
      return NextResponse.json({ error: msg, message: msg }, { status: 422 });
    }

    await prisma.deal.update({
      where: { id: dealId },
      data: {
        isActive: false,
        status: DealStatus.CANCELLED,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error('[MOBILE DELETE /api/mobile/v1/deals/:id]', e);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
