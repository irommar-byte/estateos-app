import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { getAdminStatsPayload } from '@/lib/adminStatsPayload';

async function requireAdmin() {
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

    return NextResponse.json(await getAdminStatsPayload());
  } catch (error) {
    console.error("STATS ERROR:", error);
    return NextResponse.json({ error: "Błąd obliczeń" }, { status: 500 });
  }
}
