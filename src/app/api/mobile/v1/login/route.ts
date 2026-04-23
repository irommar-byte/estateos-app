import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Brak emaila lub hasła' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.password) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy email lub hasło' }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy email lub hasło' }, { status: 401 });
    }

    // Generujemy prosty token sesji dla apki mobilnej
    const token = 'session_' + Math.random().toString(36).substr(2) + '_' + user.id;

    return NextResponse.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.name ? user.name.split(' ')[0] : '',
        lastName: user.name ? user.name.split(' ').slice(1).join(' ') : '',
        phone: user.phone,
        role: user.role,
        avatar: user.image
      },
      token 
    });

  } catch (error: any) {
    console.error("🔥 BŁĄD LOGOWANIA:", error.message);
    return NextResponse.json({ success: false, message: 'Błąd serwera podczas logowania' }, { status: 500 });
  }
}
