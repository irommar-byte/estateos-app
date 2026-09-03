import { prisma } from '@/lib/prisma';

const TOUCH_GAP_MS = 20_000;
const lastTouch = new Map<number, number>();

/** Marks the linked EstateOS user as online while they sit in the client portal. */
export async function touchPortalLinkedPresence(
  linkedUserId: number | null | undefined,
  opts?: { force?: boolean },
) {
  const userId = Number(linkedUserId || 0);
  if (!Number.isFinite(userId) || userId <= 0) return;
  const now = Date.now();
  if (!opts?.force && (lastTouch.get(userId) || 0) + TOUCH_GAP_MS > now) return;
  lastTouch.set(userId, now);
  await prisma.user
    .update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    })
    .catch(() => {});
}
