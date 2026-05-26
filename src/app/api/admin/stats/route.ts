import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getAdminStatsPayload } from '@/lib/adminStatsPayload';

async function requireAdmin() {
  const nextAuth = await getServerSession(authOptions);
  const nextAuthEmail = String(nextAuth?.user?.email || '').trim().toLowerCase();
  if (nextAuthEmail) {
    const user = await prisma.user.findUnique({
      where: { email: nextAuthEmail },
      select: { id: true, role: true },
    });
    if (user?.role === 'ADMIN') return user;
  }

  const cookieStore = await cookies();
  const sessionToken =
    cookieStore.get('estateos_session')?.value ||
    cookieStore.get('luxestate_user')?.value ||
    null;
  if (!sessionToken) return null;

  const session = decryptSession(sessionToken);
  const email = String(session?.email || '').trim().toLowerCase();
  if (!email) return null;

  return prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await getAdminStatsPayload();
    return NextResponse.json(stats);

  } catch (error) {
    console.error("STATS ERROR:", error);
    return NextResponse.json({ error: "Błąd obliczeń" }, { status: 500 });
  }
}
