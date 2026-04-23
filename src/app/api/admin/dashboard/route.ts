import { encryptSession, decryptSession } from '@/lib/sessionUtils';
export const runtime = "nodejs";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('estateos_session');

    if (!session) {
      return NextResponse.json({ error: 'Brak sesji' }, { status: 401 });
    }

    let parsed;
    try {
      parsed = decryptSession(session.value);
    } catch {
      return NextResponse.json({ error: 'Nieprawidłowa sesja' }, { status: 401 });
    }

    if (!parsed?.email) {
      return NextResponse.json({ error: 'Brak danych sesji' }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({
      where: { email: parsed.email }
    });

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Brak dostępu' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const offers = await prisma.offer.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const alerts = await prisma.alert.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ users, offers, alerts });

  } catch (err) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
