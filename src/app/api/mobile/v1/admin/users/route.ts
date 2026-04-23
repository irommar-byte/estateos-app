import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 🛑 TA LINIJKA WYŁĄCZA AGRESYWNY CACHE NEXT.JS
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        image: true,
        role: true,
        isVerified: true,
        _count: { select: { offers: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ success: false, message: "Brak ID użytkownika." }, { status: 400 });
    }

    // Usunięcie użytkownika i jego ofert (Cascade)
    await prisma.user.delete({
      where: { id: Number(userId) }
    });

    return NextResponse.json({ success: true, message: "Użytkownik usunięty." });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Nie udało się usunąć użytkownika." }, { status: 500 });
  }
}
