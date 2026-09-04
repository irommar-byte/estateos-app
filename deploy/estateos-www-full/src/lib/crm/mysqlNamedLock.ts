import { prisma } from '@/lib/prisma';

function asGot(value: unknown): number {
  if (typeof value === 'bigint') return Number(value);
  return Number(value ?? 0);
}

/** MySQL GET_LOCK on one pooled connection for the duration of `fn`. */
export async function withMysqlNamedLock<T>(
  name: string,
  fn: () => Promise<T>,
  options?: { timeoutMs?: number },
): Promise<{ ok: true; value: T } | { ok: false; reason: 'busy' }> {
  const lockName = String(name || '').slice(0, 64);
  if (!lockName) return { ok: false, reason: 'busy' };
  const timeoutMs = options?.timeoutMs ?? 90_000;
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRawUnsafe<Array<{ got: unknown }>>(
        'SELECT GET_LOCK(?, 0) AS got',
        lockName,
      );
      if (asGot(rows?.[0]?.got) !== 1) {
        return { ok: false as const, reason: 'busy' as const };
      }
      try {
        const value = await fn();
        return { ok: true as const, value };
      } finally {
        await tx.$queryRawUnsafe('SELECT RELEASE_LOCK(?)', lockName).catch(() => null);
      }
    },
    { timeout: timeoutMs, maxWait: 5_000 },
  );
}
