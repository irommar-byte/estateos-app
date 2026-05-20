import { prisma } from '@/lib/prisma';

/** Czy użytkownik ma zapisany co najmniej jeden WebAuthn credential w `Authenticator`. */
export async function userHasRegisteredPasskey(userId: number): Promise<boolean> {
  const n = await prisma.authenticator.count({ where: { userId } });
  return n > 0;
}
