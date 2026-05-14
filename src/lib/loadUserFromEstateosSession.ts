import { prisma } from '@/lib/prisma';

type SessionPayload = {
  id?: unknown;
  email?: unknown;
} | null;

/** Rozwiązuje użytkownika z payloadu `decryptSession` (obsługa zarówno `id`, jak i legacy `email`). */
export async function loadUserFromEstateosSessionPayload(session: SessionPayload) {
  if (!session) return null;

  if (session.id != null && String(session.id).trim() !== '') {
    const id = Number(session.id);
    if (Number.isFinite(id)) {
      return prisma.user.findUnique({ where: { id } });
    }
  }

  if (typeof session.email === 'string' && session.email.trim()) {
    return prisma.user.findUnique({ where: { email: session.email.trim().toLowerCase() } });
  }

  return null;
}
