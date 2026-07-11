import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { decryptSession } from '@/lib/sessionUtils';
import { prisma } from '@/lib/prisma';

export type AdminSessionUser = { id: number; role: string };

export async function requireAdmin(): Promise<AdminSessionUser | null> {
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

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  if (user?.role === 'ADMIN') return user;
  return null;
}
