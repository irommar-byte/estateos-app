import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const userIdNum = Number(id);

        if (isNaN(userIdNum)) {
            return NextResponse.json({ error: 'Nieprawidłowe ID' }, { status: 400 });
        }

        // 1. Pobieranie użytkownika (User.id to Int)
        const user = await prisma.user.findFirst({
            where: { id: userIdNum },
            select: { id: true, name: true, buyerType: true, createdAt: true, email: true }
        });

        if (!user) return NextResponse.json({ error: 'Nie znaleziono użytkownika' }, { status: 404 });

        // 2. Pobieranie ofert (Offer.userId to Int)
        const offers = await prisma.offer.findMany({
            where: { userId: user.id },
            select: { id: true, title: true, price: true, images: true, address: true, district: true }
        });

        // 3. Pobieranie opinii (Review.targetId to String)
        const reviews = await prisma.review.findMany({
            where: { targetId: Number(user.id) },
            orderBy: { createdAt: 'desc' }
        });

        // 4. Pobieranie statystyk (Appointment.buyerId / sellerId to String)
        const appointments = await prisma.appointment.findMany({
            where: { OR: [{ buyerId: Number(user.id) }, { sellerId: Number(user.id) }] },
            select: { status: true }
        });

        return NextResponse.json({
            user: {
                id: user.id,
                name: user.name || (user.email ? user.email.split('@')[0] : 'Użytkownik'),
                type: user.buyerType,
                memberSince: user.createdAt
            },
            offers,
            reviews,
            stats: {
                totalAppointments: appointments.length,
                completed: appointments.filter(a => a.status === 'COMPLETED').length,
                excused: appointments.filter(a => ['CANCELED', 'DECLINED'].includes(a.status)).length,
                noShow: appointments.filter(a => a.status === 'NO_SHOW').length
            }
        });
    } catch (e) {
        return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
    }
}
