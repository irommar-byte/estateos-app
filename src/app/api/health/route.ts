import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateCriticalEnv } from '@/lib/env.server';
import { logEvent } from '@/lib/observability';

export const runtime = 'nodejs';

export async function GET() {
  const startedAt = Date.now();
  const envCheck = validateCriticalEnv();

  try {
    await prisma.$queryRaw`SELECT 1`;

    const payload = {
      ok: envCheck.ok,
      status: envCheck.ok ? 'ok' : 'degraded',
      service: 'nieruchomosci',
      nodeEnv: process.env.NODE_ENV,
      version: process.env.npm_package_version || 'unknown',
      commit: process.env.COMMIT_SHA || 'unknown',
      uptimeSec: Math.floor(process.uptime()),
      durationMs: Date.now() - startedAt,
      missingEnv: envCheck.missing,
    };

    if (!envCheck.ok) {
      logEvent('warn', 'health_missing_env', 'api.health', { missingEnv: envCheck.missing });
    }

    return NextResponse.json(payload, { status: envCheck.ok ? 200 : 503 });
  } catch (error) {
    logEvent('error', 'health_db_ping_failed', 'api.health', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        status: 'down',
        service: 'nieruchomosci',
        missingEnv: envCheck.missing,
      },
      { status: 503 }
    );
  }
}
