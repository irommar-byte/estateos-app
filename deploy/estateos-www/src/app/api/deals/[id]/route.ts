import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { decryptSession } from '@/lib/sessionUtils';
import { getDealReviewVisibility, resolveFinalizedAtSafe } from '@/lib/dealroomReviews';

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Next.js 15+ wymaga await na params
    const resolvedParams = await context.params;
    const dealId = Number(resolvedParams.id);
    
    if (!dealId) return NextResponse.json({ success: false, error: 'Brak ID' }, { status: 400 });

    const cookieStore = await cookies();
    const dealToken = cookieStore.get('deal_token')?.value;
    const sessionToken = cookieStore.get('estateos_session')?.value || cookieStore.get('luxestate_user')?.value;
    let token = dealToken;

    if (!token) {
       const authHeader = req.headers.get("authorization");
       if (authHeader && authHeader.startsWith("Bearer ")) token = authHeader.split(" ")[1];
    }

    let userId: number | null = null;
    const secretRaw = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || '';
    if (token && secretRaw) {
      try {
        const secret = new TextEncoder().encode(secretRaw);
        const { payload } = await jwtVerify(token, secret);
        userId = Number(payload.id || payload.sub);
      } catch {
        // fallback do sesji legacy
      }
    }

    if (!userId && sessionToken) {
      const session = decryptSession(sessionToken);
      if (session?.id) {
        userId = Number(session.id);
      } else if (session?.email) {
        const user = await prisma.user.findFirst({ where: { email: String(session.email) }, select: { id: true } });
        userId = user?.id ?? null;
      }
    }

    if (!userId) return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });

    // Wyciągamy cały pokój wraz z historią wiadomości!
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        offer: true,
        buyer: true,
        seller: true,
        messages: { orderBy: { createdAt: 'asc' } },
        bids: {
          orderBy: { createdAt: 'desc' },
          include: {
            sender: { select: { id: true, name: true } }
          }
        },
        appointments: {
          orderBy: { createdAt: 'desc' },
          include: {
            proposedBy: { select: { id: true, name: true } }
          }
        }
      }
    });

    if (!deal) return NextResponse.json({ success: false, error: 'Nie znaleziono' }, { status: 404 });
    if (deal.buyerId !== userId && deal.sellerId !== userId) return NextResponse.json({ success: false, error: 'Odmowa dostępu' }, { status: 403 });

    const statusRaw = String(deal.status || '').toUpperCase();
    const finalizationReady = statusRaw === 'AGREED' && !!deal.acceptedBidId;
    // AGREED = cena uzgodniona, finalizacja (SOLD / anulowanie konkurencji) dopiero po POST …/finalize.
    const finalized = ['FINALIZED', 'CLOSED', 'COMPLETED', 'DONE', 'SOLD'].includes(statusRaw);
    const finalizedAtSafe = resolveFinalizedAtSafe(deal);
    const reviewGate = await getDealReviewVisibility({
      dealId,
      viewerId: userId,
      sides: { buyerId: deal.buyerId, sellerId: deal.sellerId },
      finalizedAt: finalizedAtSafe,
    });

    return NextResponse.json({
      success: true,
      deal: {
        ...deal,
        finalizationReady,
        finalized,
        finalizedAt: deal.finalizedAt ?? finalizedAtSafe,
        ...(reviewGate || {
          myReviewSubmitted: false,
          reviewRevealAt: new Date(0).toISOString(),
          reviewRevealUnlocked: false,
          partnerReviewVisible: false,
          partnerReview: null,
        }),
      },
    });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
