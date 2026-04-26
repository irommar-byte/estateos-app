import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('estateos_session')?.value;
    if (!sessionCookie) return NextResponse.json({ error: "Brak sesji" }, { status: 401 });

    const session = decryptSession(sessionCookie);
    if (!session?.email) return NextResponse.json({ error: "Błąd sesji" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.email } });
    if (!user) return NextResponse.json({ error: "Nieautoryzowany" }, { status: 401 });

    const { targetId, rating, comment, dealId } = await req.json();

    if (!targetId || !rating || !dealId) {
      return NextResponse.json({ error: "Brak wymaganych danych" }, { status: 400 });
    }

    // 1. Zapis opinii do bazy
    const newReview = await prisma.review.create({
      data: {
        dealId: Number(dealId),
        reviewerId: Number(user.id),
        revieweeId: Number(targetId),
        rating: parseInt(rating),
        comment: comment || null
      }
    });

    // 2. Powiadomienie (Dzwoneczek) dla ocenionego
    await prisma.notification.create({
      data: {
        userId: Number(targetId),
        title: "Otrzymałeś nową opinię 💎",
        body: `Uczestnik spotkania ocenił Cię na ${rating}/5 gwiazdek.`,
        type: "SYSTEM_ALERT"
      }
    });

    return NextResponse.json({ success: true, review: newReview });
  } catch (error) {
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}
