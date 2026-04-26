import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const toInt = (value: string | null, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
};

const resolvePagination = (searchParams: URLSearchParams) => {
  const page = Math.max(1, toInt(searchParams.get('page'), DEFAULT_PAGE));
  const rawLimit = Math.max(1, toInt(searchParams.get('limit'), DEFAULT_LIMIT));
  const limit = Math.min(MAX_LIMIT, rawLimit);
  return { page, limit, skip: (page - 1) * limit };
};

const resolveSort = (searchParams: URLSearchParams) => {
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc';
  switch (sortBy) {
    case 'createdAt':
    case 'email':
    case 'name':
    case 'isVerified':
    case 'role':
      return { orderBy: { [sortBy]: sortDir } };
    case 'offersCount':
      return { orderBy: { offers: { _count: sortDir } } };
    default:
      return { orderBy: { createdAt: 'desc' as const } };
  }
};

const resolveWhere = (searchParams: URLSearchParams) => {
  const search = (searchParams.get('search') || '').trim();
  const andFilters: any[] = [];

  if (search) {
    andFilters.push({
      OR: [
        { email: { contains: search } },
        { name: { contains: search } },
        { phone: { contains: search } },
      ],
    });
  }

  if (andFilters.length === 0) return {};
  return { AND: andFilters };
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const { page, limit, skip } = resolvePagination(searchParams);
    const where = resolveWhere(searchParams);
    const { orderBy } = resolveSort(searchParams);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          image: true,
          role: true,
          isVerified: true,
          createdAt: true,
          _count: { select: { offers: true } },
          radarPreference: { select: { pushNotifications: true, minMatchThreshold: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ success: false, message: "Brak ID użytkownika." }, { status: 400 });
    }

    await prisma.user.delete({ where: { id: Number(userId) } });
    return NextResponse.json({ success: true, message: "Użytkownik usunięty." });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Nie udało się usunąć użytkownika." }, { status: 500 });
  }
}
