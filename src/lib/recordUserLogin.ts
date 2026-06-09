import { prisma } from '@/lib/prisma';

export async function recordUserLogin(userId: number, ip: string): Promise<void> {
  const cleanIp = String(ip || 'unknown').slice(0, 64);
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginIp: cleanIp,
        lastLoginAt: new Date(),
      },
    });
  } catch {
    /* kolumny mogą nie istnieć na starszej bazie — nie blokuj logowania */
  }
}
