import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 1. Sprawdzanie zajętości E-maila
    if (body.email) {
      const user = await prisma.user.findUnique({ 
        where: { email: body.email.toLowerCase().trim() } 
      });
      return NextResponse.json({ exists: !!user });
    }
    
    // 2. Sprawdzanie zajętości Telefonu (z uwzględnieniem formatu +48)
    if (body.phone) {
      const cleanPhone = body.phone.replace(/\D/g, '');
      const finalPhone = cleanPhone ? (cleanPhone.startsWith('48') ? cleanPhone : '48' + cleanPhone) : null;
      
      if (!finalPhone) return NextResponse.json({ exists: false });

      const user = await prisma.user.findFirst({ 
        where: { phone: finalPhone } 
      });
      return NextResponse.json({ exists: !!user });
    }

    return NextResponse.json({ exists: false });
  } catch (error) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
