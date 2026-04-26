import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ hasPasskey: false, error: 'Brak ID użytkownika' }, { status: 400 });
    }

    // Sprawdzamy czy w bazie istnieje JAKIKOLWIEK klucz dla tego użytkownika
    const passkeyCount = await prisma.authenticator.count({
      where: {
        userId: parseInt(userId)
      }
    });

    // Jeśli count > 0, to ma klucz. Jeśli nie, to nie ma.
    return NextResponse.json({ success: true, hasPasskey: passkeyCount > 0 });
  } catch (error: any) {
    console.error('BŁĄD SPRAWDZANIA STATUSU KLUCZA:', error.message);
    return NextResponse.json({ success: false, hasPasskey: false }, { status: 500 });
  }
}
