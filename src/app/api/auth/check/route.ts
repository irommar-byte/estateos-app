import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('estateos_session');
    
    if (!session) return NextResponse.json({ loggedIn: false });

    // Logika wstecznej kompatybilności (gdyby ktoś miał stare ciasteczko z samym mailem)
    let emailToSearch = session.value;
    let parsedSession: any = null;
    try {
       parsedSession = decryptSession(session.value);
       if (parsedSession && parsedSession.email) {
           emailToSearch = parsedSession.email;
       }
    } catch(e) {} // Ignoruj błąd jeśli to stary format

    const user = await prisma.user.findUnique({ where: { email: emailToSearch } });
    if (!user) return NextResponse.json({ loggedIn: false });

    return NextResponse.json({ 
      loggedIn: true, 
      user: { 
        id: user.id, // KRYTYCZNE: Przekazujemy twarde ID użytkownika
        email: user.email, 
        name: user.name, 
        phone: user.phone, 
        image: user.image,
        advertiserType: user.buyerType || 'private',
        role: user.role 
      } 
    });
  } catch (error) {
    return NextResponse.json({ loggedIn: false });
  }
}
