import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  try {
    const [maxRow, users] = await Promise.all([
      prisma.user.findFirst({
        orderBy: { id: 'desc' },
        select: { id: true },
      }),
      prisma.user.findMany({
        select: { id: true, name: true, role: true },
        orderBy: { id: 'asc' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      maxId: Number(maxRow?.id || 0),
      users: users.map((row) => ({
        id: row.id,
        name: String(row.name || '').trim() || `Użytkownik #${row.id}`,
        role: row.role,
      })),
    });
  } catch (error) {
    console.error('[admin/simulator/users]', error);
    return NextResponse.json({ success: false, message: 'Nie udało się wczytać listy użytkowników.' }, { status: 500 });
  }
}
