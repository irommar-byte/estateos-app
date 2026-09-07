import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateCriticalEnv } from '@/lib/env.server';
import { logEvent } from '@/lib/observability';

export const runtime = 'nodejs';

const DB_PING_MS = 600;

async function pingDb(): Promise<'ok' | 'timeout' | 'error'> {
  try {
    return await Promise.race([
      prisma.$queryRaw`SELECT 1`.then(() => 'ok' as const),
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), DB_PING_MS)),
    ]);
  } catch {
    return 'error';
  }
}

export async function GET() {
  const startedAt = Date.now();
  const envCheck = validateCriticalEnv();
  const db = await pingDb();
  const ready = envCheck.ok && db === 'ok';

  if (!envCheck.ok) {
    logEvent('warn', 'health_missing_env', 'api.health', { missingEnv: envCheck.missing });
  }
  if (db !== 'ok') {
    logEvent('warn', 'health_db_degraded', 'api.health', { db });
  }

  return NextResponse.json(
    {
      ok: true,
      status: ready ? 'ok' : 'degraded',
      db,
      service: 'nieruchomosci',
      nodeEnv: process.env.NODE_ENV,
      version: process.env.npm_package_version || 'unknown',
      commit: process.env.COMMIT_SHA || 'unknown',
      uptimeSec: Math.floor(process.uptime()),
      durationMs: Date.now() - startedAt,
      missingEnv: envCheck.missing,
    },
    { status: 200 },
  );
}
