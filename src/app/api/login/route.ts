import rateLimit from '@/lib/rateLimit';
const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500 });
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { encryptSession } from '@/lib/sessionUtils';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const { isRateLimited } = limiter.check(5, ip);
  if (isRateLimited) {
    return new Response(JSON.stringify({ error: 'Zbyt wiele prób. Odczekaj 60 sekund.' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json();
    const login = body.login || body.email; const password = body.password;

    if (!login || !password) {
      return NextResponse.json({ error: 'Brak danych' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: login },
          { phone: login }
        ]
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'Nieprawidłowe dane' }, { status: 401 });
    }

    const valid = user.password ? await bcrypt.compare(password, user.password) : false;

    if (!valid) {
      return NextResponse.json({ error: 'Nieprawidłowe dane' }, { status: 401 });
    }

    const session = encryptSession({ id: user.id });

    const res = NextResponse.json({ success: true });

    res.cookies.set('estateos_session', session, {
      httpOnly: true,
      path: '/',
    });

    return res;

  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
