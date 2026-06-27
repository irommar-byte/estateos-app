import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: admin.id },
    select: {
      name: true,
      email: true,
      phone: true,
      officePhone: true,
      officeEmail: true,
    },
  });

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Nie znaleziono profilu.' }, { status: 404 });
  }

  const displayName = String(user.name || '').trim() || 'EstateOS';
  const email = String(user.officeEmail || user.email || '').trim();
  const phone = String(user.phone || user.officePhone || '').trim();

  return NextResponse.json({
    ok: true,
    profile: {
      name: displayName,
      email,
      phone,
    },
  });
}
