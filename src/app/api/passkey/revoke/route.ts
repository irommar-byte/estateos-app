import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Brak ID użytkownika' }, { status: 400 });
    }

    // Bezpowrotne usunięcie wszystkich kluczy przypisanych do tego ID z bazy danych
    await prisma.authenticator.deleteMany({
      where: {
        userId: parseInt(userId)
      }
    });

    return NextResponse.json({ success: true, message: 'Klucz sprzętowy został trwale usunięty z bazy.' });
  } catch (error: any) {
    console.error('BŁĄD USUWANIA KLUCZA PASSKEY:', error.message);
    return NextResponse.json({ success: false, error: 'Błąd wewnętrzny serwera' }, { status: 500 });
  }
}
