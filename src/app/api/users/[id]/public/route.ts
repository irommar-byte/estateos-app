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
            select: { id: true, name: true, planType: true, createdAt: true, email: true }
        });

        if (!user) return NextResponse.json({ error: 'Nie znaleziono użytkownika' }, { status: 404 });

        // 2. Pobieranie ofert (Offer.userId to Int)
        const offers = await prisma.offer.findMany({
            where: { userId: user.id },
            select: { id: true, title: true, price: true, images: true, district: true, city: true, street: true, buildingNumber: true }
        });

        // 3. Pobieranie opinii
        const reviews = await prisma.review.findMany({
            where: { revieweeId: Number(user.id) },
            orderBy: { createdAt: 'desc' }
        });

        // 4. Pobieranie statystyk
        const appointments = await prisma.appointment.findMany({
            where: { deal: { OR: [{ buyerId: Number(user.id) }, { sellerId: Number(user.id) }] } },
            select: { status: true }
        });

        return NextResponse.json({
            user: {
                id: user.id,
                name: user.name || (user.email ? user.email.split('@')[0] : 'Użytkownik'),
                type: user.planType === 'AGENCY' ? 'agency' : 'private',
                memberSince: user.createdAt
            },
            offers,
            reviews,
            stats: {
                totalAppointments: appointments.length,
                completed: appointments.filter(a => a.status === 'ACCEPTED').length,
                excused: appointments.filter(a => a.status === 'DECLINED').length,
                noShow: 0
            }
        });
    } catch (e) {
        return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
    }
}
