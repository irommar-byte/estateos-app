import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createOffer } from '@/lib/services/offer.service';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export const dynamic = 'force-dynamic';

// =======================
// GET
// =======================
export async function GET() {
  try {
    const offers = await prisma.offer.findMany({
      where: { status: { in: ["ACTIVE"] } },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(offers);

  } catch (error) {
    console.error('OFFERS ERROR:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

// =======================
// POST
// =======================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    let resolvedUserId: number | null = Number(body?.userId) || null;

    if (!resolvedUserId) {
      const cookieStore = await cookies();
      const nextAuthSession = await getServerSession(authOptions);
      const sessionCookie = cookieStore.get('estateos_session');

      let email = nextAuthSession?.user?.email || null;

      if (!email && sessionCookie?.value) {
        try {
          const sessionData = decryptSession(sessionCookie.value);
          email = sessionData?.email || null;
        } catch {
          email = null;
        }
      }

      if (email) {
        const user = await prisma.user.findUnique({
          where: { email: String(email) },
          select: { id: true }
        });
        resolvedUserId = user?.id ?? null;
      }
    }

    if (!resolvedUserId) {
      return NextResponse.json({ error: 'Brak ID użytkownika' }, { status: 401 });
    }

    const offer = await createOffer({ ...body, userId: resolvedUserId });

    return NextResponse.json({ success: true, offer });

  } catch (e: any) {
    console.error('POST ERROR:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
