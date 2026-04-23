import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, email, password, firstName, lastName, phone, avatar, userId, role } = body;

    if (action === 'register') {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return NextResponse.json({ success: false, message: 'Email zajęty' }, { status: 400 });
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Dopasowanie do bazy: Partner -> AGENT. Imię i Nazwisko -> name.
      const dbRole = role === 'PARTNER' ? 'AGENT' : 'USER';
      const fullName = `${firstName || ''} ${lastName || ''}`.trim();

      const user = await prisma.user.create({
        data: { 
          email, 
          password: hashedPassword, 
          name: fullName || email,
          phone: phone || null,
          role: dbRole
        }
      });

      return NextResponse.json({ success: true, user });
    }
    
    if (action === 'update') {
      // Zapisujemy avatar do istniejącej w bazie kolumny 'image'
      const user = await prisma.user.update({
        where: { id: Number(userId) },
        data: { image: avatar }
      });
      return NextResponse.json({ success: true, user });
    }

    return NextResponse.json({ success: false, message: 'Błędna akcja' }, { status: 400 });
  } catch (error: any) {
    console.error("🔥 BŁĄD API AUTH:", error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
