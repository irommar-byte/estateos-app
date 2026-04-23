import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

async function getUserId() {
  const cookieStore = await cookies();
  const session = cookieStore.get('estateos_session') || cookieStore.get('luxestate_user');
  if (!session) return null;
  try { return decryptSession(session.value).id; } 
  catch { 
      const u = await prisma.user.findUnique({ where: { email: session.value }});
      return u ? u.id : null;
  }
}

export async function GET(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
  
  const { searchParams } = new URL(req.url);
  const monthPrefix = searchParams.get('month'); // np. "2026-03"

  try {
    const notes = await prisma.calendarNote.findMany({
      where: { userId, date: { startsWith: monthPrefix || '' } }
    });
    return NextResponse.json(notes);
  } catch (error) {
    return NextResponse.json({ error: 'Błąd pobierania' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });

  try {
    const { date, text } = await req.json();
    if (!text || text.trim() === '') {
       await prisma.calendarNote.deleteMany({ where: { userId, date } });
       return NextResponse.json({ success: true, deleted: true });
    }
    
    const note = await prisma.calendarNote.upsert({
      where: { userId_date: { userId, date } },
      update: { text },
      create: { userId, date, text }
    });
    return NextResponse.json({ success: true, note });
  } catch (error) {
    return NextResponse.json({ error: 'Błąd zapisu' }, { status: 500 });
  }
}
