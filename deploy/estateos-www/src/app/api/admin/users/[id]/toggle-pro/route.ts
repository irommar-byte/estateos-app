import { PlanType } from "@prisma/client";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';

async function requireAdmin() {
  const cookieStore = await cookies();
  const sessionToken =
    cookieStore.get('estateos_session')?.value ||
    cookieStore.get('luxestate_user')?.value ||
    null;
  if (!sessionToken) return null;

  const session = decryptSession(sessionToken);
  const email = String(session?.email || '').trim().toLowerCase();
  if (!email) return null;

  return prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: "Brak uprawnień administratora" }, { status: 403 });
    }

    const { id } = await params;
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: "Nieprawidłowe ID użytkownika" }, { status: 400 });
    }

    const body = await req.json();
    const { action } = body;

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
    } else if (action === "take") {
      updatedData = {
        isPro: false,
        proExpiresAt: null
      };
    } else {
      return NextResponse.json({ error: "Nieprawidłowa akcja" }, { status: 400 });
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
