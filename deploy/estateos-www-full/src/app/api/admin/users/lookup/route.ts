import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';

/** Lekkie wyszukiwanie użytkowników do przypisania oferty / admin UI. */
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const q = String(url.searchParams.get('q') || '').trim();
    if (q.length < 1) {
      return NextResponse.json({ success: true, users: [] });
    }

    const qId = Number(q);
    const or: Array<Record<string, unknown>> = [
      { email: { contains: q } },
      { name: { contains: q } },
    ];
    if (Number.isFinite(qId) && qId > 0) {
      or.unshift({ id: qId });
    }

    const users = await prisma.user.findMany({
      where: { OR: or },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        planType: true,
        isPro: true,
        extraListings: true,
      },
      orderBy: { id: 'asc' },
      take: 25,
    });

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error('[ADMIN USERS LOOKUP]', error);
    return NextResponse.json({ success: false, error: 'Błąd serwera' }, { status: 500 });
  }
}
