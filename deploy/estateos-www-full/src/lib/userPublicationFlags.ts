import { prisma } from '@/lib/prisma';
import { ensureOfferPublicationSchema } from '@/lib/offerPublication';

export async function readFirstFreePublicationUsed(userId: number): Promise<boolean> {
  await ensureOfferPublicationSchema();
  const rows = (await prisma.$queryRawUnsafe<Array<{ firstFreePublicationUsed: number }>>(
    'SELECT firstFreePublicationUsed FROM `User` WHERE id = ? LIMIT 1',
    userId,
  )) as Array<{ firstFreePublicationUsed: number }>;
  return Number(rows[0]?.firstFreePublicationUsed ?? 0) > 0;
}

export async function enrichMobileUserWithPublicationFlags<T extends { id: number }>(
  shaped: T,
): Promise<T & { firstFreePublicationUsed: boolean }> {
  const firstFreePublicationUsed = await readFirstFreePublicationUsed(shaped.id);
  return { ...shaped, firstFreePublicationUsed };
}
