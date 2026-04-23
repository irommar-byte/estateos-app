import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const userId = Number(resolvedParams.id);
    const userIdStr = String(userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, buyerType: true, createdAt: true }
    });

    if (!user) return NextResponse.json({ error: 'Nie znaleziono użytkownika' }, { status: 404 });

    const reviews = await prisma.review.findMany({
      where: { targetId: Number(userIdStr) },
      orderBy: { createdAt: 'desc' }
    });

    // Pobieramy historię spotkań, w których ten użytkownik brał udział
    const appointments = await prisma.appointment.findMany({
      where: {
        OR: [
          { sellerId: Number(userIdStr) },
          { buyerId: Number(userIdStr) }
        ]
      }
    });

    // Obliczamy statystyki
    const completed = appointments.filter(a => a.status === 'COMPLETED').length;
    // Anulowane to takie, z których użytkownik zrezygnował z wyprzedzeniem (usprawiedliwione)
    const canceled = appointments.filter(a => a.status === 'CANCELED').length;
    // Zignorowane/odrzucone to te, które nie doszły do skutku po zaproponowaniu (tzw. no-show lub odrzucenie)
    const declined = appointments.filter(a => a.status === 'DECLINED').length;

    // Prosty wskaźnik niezawodności
    const totalEngagements = completed + canceled;
    const reliability = totalEngagements > 0 ? Math.round((completed / totalEngagements) * 100) : 100;

    return NextResponse.json({ 
      user, 
      reviews, 
      stats: { completed, canceled, declined, reliability } 
    });
  } catch (error) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
