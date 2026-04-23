import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { encryptSession } from '@/lib/sessionUtils';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Odbieramy NOWE, potężne pola z aplikacji mobilnej
    const { email, password, name, phone, role } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Brak danych' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ success: false, message: 'Konto już istnieje' }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 10);

    // Inteligentne mapowanie ról z wizytówki mobilnej
    let dbRole = "USER";
    if (role === "PARTNER" || role === "AGENT") dbRole = "AGENT";
    if (role === "ADMIN") dbRole = "ADMIN";

    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name: name || "Użytkownik",
        phone: phone || null,  // Zapisujemy telefon prosto do bazy!
        role: dbRole
      }
    });

    const session = encryptSession({ id: user.id, email: user.email, role: user.role || 'USER' });
    
    // Bezpieczne ustawianie ciasteczek
    (await cookies()).set('estateos_session', session, { httpOnly: true, path: '/' });

    return NextResponse.json({ 
      success: true, 
      token: session, 
      role: user.role || 'USER', 
      name: user.name, 
      id: user.id 
    });

  } catch (e: any) {
    console.error("🔥 BŁĄD REJESTRACJI:", e);
    return NextResponse.json({ success: false, message: e.message || String(e) }, { status: 500 });
  }
}
