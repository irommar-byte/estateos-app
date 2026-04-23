import { PlanType } from "@prisma/client";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = Number(id);

    const body = await req.json();
    const { action } = body;

    // 🔒 HARD ADMIN (na teraz)
    const admin = await prisma.user.findUnique({
      where: { id: 103 }
    });

    if (!admin) {
      return NextResponse.json({ error: "Brak uprawnień administratora" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json({ error: "Użytkownik nie istnieje" }, { status: 404 });
    }

    let updatedData;

    if (action === "give") {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      updatedData = {
        isPro: true,
        planType: PlanType.INVESTOR,
        proExpiresAt: expiresAt
      };
    } else {
      updatedData = {
        isPro: false,
        proExpiresAt: null
      };
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updatedData
    });

    return NextResponse.json({
      success: true,
      isPro: updated.isPro
    });

  } catch (error) {
    console.error("TOGGLE PRO ERROR:", error);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}
