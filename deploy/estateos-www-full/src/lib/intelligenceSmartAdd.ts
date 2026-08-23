import { prisma } from '@/lib/prisma';

async function ensureSmartAddColumn(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`User\` ADD COLUMN \`intelligenceSmartAddEnabled\` BOOLEAN NOT NULL DEFAULT false`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/Duplicate column|exists/i.test(message)) throw error;
  }
}

export async function getIntelligenceSmartAddEnabled(userId: number): Promise<boolean> {
  if (!userId) return false;
  await ensureSmartAddColumn();
  const rows = await prisma.$queryRawUnsafe<Array<{ intelligenceSmartAddEnabled: number | boolean }>>(
    `SELECT intelligenceSmartAddEnabled FROM User WHERE id = ? LIMIT 1`,
    userId,
  );
  return Boolean(rows[0]?.intelligenceSmartAddEnabled);
}

export async function setIntelligenceSmartAddEnabled(userId: number, enabled: boolean): Promise<boolean> {
  await ensureSmartAddColumn();
  await prisma.$executeRawUnsafe(
    `UPDATE User SET intelligenceSmartAddEnabled = ? WHERE id = ?`,
    enabled ? 1 : 0,
    userId,
  );
  return enabled;
}
