import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { decryptSession } from '@/lib/sessionUtils';

export async function requireAdmin() {
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
    select: { id: true, role: true, email: true },
  });
  if (user?.role === 'ADMIN') return user;
  return null;
}

export async function requireAdminOrThrow() {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') return null;
  return admin;
}
