import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const userId = Number(resolvedParams.id);
    const userIdStr = String(userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, planType: true, role: true, companyName: true, buyerType: true, createdAt: true }
    });

    if (!user) return NextResponse.json({ error: 'Nie znaleziono użytkownika' }, { status: 404 });

    const reviews = await prisma.review.findMany({
      where: { revieweeId: Number(userIdStr) },
      orderBy: { createdAt: 'desc' }
    });

    const offers = await prisma.offer.findMany({
      where: { userId, status: { in: ['ACTIVE', 'PENDING'] } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 6,
      select: {
        id: true,
        title: true,
        city: true,
        district: true,
        street: true,
        buildingNumber: true,
        lat: true,
        lng: true,
        isExactLocation: true,
        images: true,
      },
    });

    // Pobieramy historię spotkań, w których ten użytkownik brał udział
    const appointments = await prisma.appointment.findMany({
      where: {
        deal: { OR: [{ sellerId: Number(userIdStr) }, { buyerId: Number(userIdStr) }] }
      }
    });

    // Obliczamy statystyki
    const completed = appointments.filter(a => a.status === 'ACCEPTED').length;
    // Anulowane to takie, z których użytkownik zrezygnował z wyprzedzeniem (usprawiedliwione)
    const canceled = 0;
    // Zignorowane/odrzucone to te, które nie doszły do skutku po zaproponowaniu (tzw. no-show lub odrzucenie)
    const declined = appointments.filter(a => a.status === 'DECLINED').length;

    // Prosty wskaźnik niezawodności
    const totalEngagements = completed + canceled;
    const reliability = totalEngagements > 0 ? Math.round((completed / totalEngagements) * 100) : 100;

    return NextResponse.json({ 
      user, 
      reviews, 
      offers,
      stats: { completed, canceled, declined, reliability } 
    });
  } catch (error) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
