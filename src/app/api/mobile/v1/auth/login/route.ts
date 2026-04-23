import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signMobileToken } from '@/lib/jwtMobile';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Brak danych' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return NextResponse.json({ error: 'Nieprawidłowy login' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return NextResponse.json({ error: 'Nieprawidłowe hasło' }, { status: 401 });
    }

    const token = signMobileToken({ id: user.id });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified, // 🟢 Dodano status weryfikacji
        image: user.image,
        phone: user.phone              // 🟢 Dodano avatar
      },
      token
    });

  } catch (e) {
    console.error('LOGIN ERROR:', e);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
