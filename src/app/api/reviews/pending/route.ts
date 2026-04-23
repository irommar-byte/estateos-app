import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('estateos_session')?.value;
    if (!sessionCookie) return NextResponse.json({ pending: null });

    const session = decryptSession(sessionCookie);
    if (!session?.email) return NextResponse.json({ pending: null });

    const user = await prisma.user.findUnique({ where: { email: session.email } });
    if (!user) return NextResponse.json({ pending: null });

    // Szukamy zatwierdzonych spotkań z przeszłości (gdzie data już minęła)
    const pastAppointments = await prisma.appointment.findMany({
      where: {
        status: 'ACCEPTED',
        proposedDate: { lt: new Date() },
        OR: [{ buyerId: Number(user.id) }, { sellerId: Number(user.id) }]
      },
      orderBy: { proposedDate: 'desc' },
      take: 5 // Sprawdzamy 5 ostatnich
    });

    for (const app of pastAppointments) {
      const targetId = app.buyerId === Number(user.id) ? app.sellerId : app.buyerId;
      
      // Sprawdzamy, czy użytkownik już wystawił opinię za to spotkanie
      const existingReview = await prisma.review.findFirst({
        where: { reviewerId: Number(user.id), targetId: Number(targetId) }
      });

      if (!existingReview) {
        // Znaleźliśmy! Pobieramy dane partnera do wyświetlenia w modalu
        const targetUser = await prisma.user.findUnique({ where: { id: Number(targetId) } });
        if (targetUser) {
          return NextResponse.json({
            pending: {
              appId: app.id,
              targetId: Number(targetId),
              targetName: targetUser.name || targetUser.email.split('@')[0],
              date: app.proposedDate
            }
          });
        }
      }
    }

    return NextResponse.json({ pending: null });
  } catch (error) {
    return NextResponse.json({ pending: null }, { status: 500 });
  }
}
