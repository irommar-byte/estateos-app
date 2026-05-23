import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, context: any) {
  try {
    // W Next.js 15 params muszą być odczekane (await)
    const params = await context.params;
    const userId = parseInt(params.id);

    if (isNaN(userId)) return NextResponse.json({ error: 'Nieprawidłowe ID' }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true, role: true, planType: true, buyerType: true, createdAt: true }
    });

    if (!user) return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 });

    const offers = await prisma.offer.findMany({
      where: { userId: userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    const reviews = await prisma.review.findMany({
      where: { revieweeId: Number(userId) },
      orderBy: { createdAt: 'desc' }
    });

    const avgRating = reviews.length > 0 ? (reviews.reduce((a: any,b: any)=>a+b.rating, 0)/reviews.length).toFixed(1) : "5.0";

    return NextResponse.json({ user, offers, reviews, avgRating });
  } catch(e) { return NextResponse.json({ error: 'Błąd' }, { status: 500 }); }
}
