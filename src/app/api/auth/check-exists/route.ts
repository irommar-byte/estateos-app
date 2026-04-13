import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, phone } = body;

    // 1. Sprawdzanie E-maila
    if (email) {
      const user = await prisma.user.findUnique({ where: { email } });
      return NextResponse.json({ exists: !!user, taken: !!user });
    }

    // 2. Sprawdzanie Telefonu (Bezwzględna weryfikacja)
    if (phone) {
      // Usuwamy wszystkie spacje, by mieć czysty format, np. +48111222333
      const cleanPhone = phone.replace(/\s/g, '');
      const user = await prisma.user.findFirst({ 
        where: { phone: cleanPhone } 
      });
      return NextResponse.json({ exists: !!user, taken: !!user });
    }

    return NextResponse.json({ exists: false, taken: false });
  } catch (error) {
    console.error("Błąd skanera bazy danych:", error);
    return NextResponse.json({ exists: false, taken: false }, { status: 500 });
  }
}
