import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const usersCount = await prisma.user.count();
    const totalOffers = await prisma.offer.count();
    const activeOffers = await prisma.offer.count({
      where: { status: 'ACTIVE' }
    });

    const offersRaw = await prisma.offer.findMany({
      select: {
        price: true,
        area: true,
        district: true,
        createdAt: true
      }
    });

    // BEZPIECZNE LICZENIE
    const totalValue = offersRaw.reduce((acc, curr) => {
      const price = Number(String(curr.price || "0").replace(/\D/g, ""));
      return acc + (isNaN(price) ? 0 : price);
    }, 0);

    return NextResponse.json({
      kpis: {
        users: usersCount,
        offers: totalOffers,
        active: activeOffers,
        totalValue
      },
      timeline: {
        offers: offersRaw
      }
    });

  } catch (error) {
    console.error("STATS ERROR:", error);
    return NextResponse.json({ error: "Błąd obliczeń" }, { status: 500 });
  }
}
