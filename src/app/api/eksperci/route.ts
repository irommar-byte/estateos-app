import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const experts = await prisma.user.findMany({
      where: { buyerType: "agency" },
      select: { id: true, name: true, email: true, phone: true, createdAt: true }
    });

    // Sztuczne doklejenie opinii dla wizualizacji (docelowo z bazy)
    const expertsWithStats = experts.map(exp => ({
      ...exp,
      rating: (Math.random() * (5.0 - 4.5) + 4.5).toFixed(1),
      reviewsCount: Math.floor(Math.random() * 50) + 5,
      transactions: Math.floor(Math.random() * 120) + 10
    })).sort((a, b) => Number(b.rating) - Number(a.rating));

    return NextResponse.json(expertsWithStats);
  } catch (error) {
    return NextResponse.json([]);
  }
}
