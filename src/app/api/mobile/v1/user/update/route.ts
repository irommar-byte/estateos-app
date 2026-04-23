import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { userId, image } = await req.json();
    
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Brak ID użytkownika' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: Number(userId) },
      data: { image } // Zapisujemy zdjęcie Base64 w bazie
    });

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    console.error("🔥 BŁĄD ZAPISU AVATARA:", error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
